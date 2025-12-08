import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Calendar, Loader2, Check, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pb } from '@/lib/pocketbase';
import * as XLSX from 'xlsx';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';

interface ExportConfig {
  id?: string;
  autoExport: boolean;
  exportDay: 'sunday' | 'monday';
  groupByCategory: boolean;
  includeSupplier: boolean;
  lastExport?: string;
}

interface PBLot {
  id: string;
  lot_number: string;
  internal_lot_number?: string;
  production_date: string;
  expiry_date?: string;
  reception_date?: string;
  freezing_date?: string;
  is_frozen?: boolean;
  notes?: string;
  status?: string;
  expand?: {
    category_id?: { id: string; name: string };
    supplier_id?: { id: string; name: string };
  };
}

interface PBCategory {
  id: string;
  name: string;
}

export const DataExportPocketBase = () => {
  const [config, setConfig] = useState<ExportConfig>({
    autoExport: false,
    exportDay: 'sunday',
    groupByCategory: true,
    includeSupplier: true
  });
  const [categories, setCategories] = useState<PBCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('current');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
    loadCategories();
  }, []);

  const loadConfig = async () => {
    try {
      const records = await pb.collection('export_settings').getList(1, 1);
      if (records.items.length > 0) {
        const record = records.items[0];
        setConfig({
          id: record.id,
          autoExport: record.auto_export || false,
          exportDay: record.export_day || 'sunday',
          groupByCategory: record.group_by_category !== false,
          includeSupplier: record.include_supplier !== false,
          lastExport: record.last_export
        });
      }
    } catch (error) {
      console.log('Export settings not configured yet');
    }
  };

  const loadCategories = async () => {
    try {
      const records = await pb.collection('products').getFullList<PBCategory>({
        sort: 'name'
      });
      setCategories(records);
    } catch (error) {
      console.log('Could not load categories');
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(true);
      
      const data = {
        auto_export: config.autoExport,
        export_day: config.exportDay,
        group_by_category: config.groupByCategory,
        include_supplier: config.includeSupplier
      };

      if (config.id) {
        await pb.collection('export_settings').update(config.id, data);
      } else {
        const record = await pb.collection('export_settings').create(data);
        setConfig(prev => ({ ...prev, id: record.id }));
      }

      toast({
        title: "Impostazioni salvate",
        description: "Le preferenze di export sono state aggiornate"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare le impostazioni",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getWeekRange = (weekOption: string) => {
    const today = new Date();
    let start: Date, end: Date;
    
    if (weekOption === 'current') {
      start = startOfWeek(today, { weekStartsOn: 1 });
      end = endOfWeek(today, { weekStartsOn: 1 });
    } else if (weekOption === 'last') {
      const lastWeek = subWeeks(today, 1);
      start = startOfWeek(lastWeek, { weekStartsOn: 1 });
      end = endOfWeek(lastWeek, { weekStartsOn: 1 });
    } else {
      // Last 2 weeks
      start = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      end = endOfWeek(today, { weekStartsOn: 1 });
    }
    
    return { start, end };
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      
      const { start, end } = getWeekRange(selectedWeek);
      
      // Build filter
      let filter = `production_date >= "${format(start, 'yyyy-MM-dd')}" && production_date <= "${format(end, 'yyyy-MM-dd')}"`;
      
      if (selectedCategory !== 'all') {
        filter += ` && category_id = "${selectedCategory}"`;
      }

      // Fetch lots with expanded relations
      const lots = await pb.collection('lots').getFullList<PBLot>({
        filter,
        sort: '-production_date',
        expand: 'category_id,supplier_id'
      });

      if (lots.length === 0) {
        toast({
          title: "Nessun dato",
          description: "Non ci sono lotti nel periodo selezionato",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      // Prepare data for Excel
      const excelData = lots.map(lot => ({
        'Numero Lotto': lot.lot_number,
        'Lotto Interno': lot.internal_lot_number || '-',
        'Categoria': lot.expand?.category_id?.name || '-',
        'Data Produzione': lot.production_date ? format(new Date(lot.production_date), 'dd/MM/yyyy', { locale: it }) : '-',
        'Data Scadenza': lot.expiry_date ? format(new Date(lot.expiry_date), 'dd/MM/yyyy', { locale: it }) : '-',
        'Data Ricezione': lot.reception_date ? format(new Date(lot.reception_date), 'dd/MM/yyyy', { locale: it }) : '-',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Data Congelamento': lot.freezing_date ? format(new Date(lot.freezing_date), 'dd/MM/yyyy', { locale: it }) : '-',
        ...(config.includeSupplier && { 'Fornitore': lot.expand?.supplier_id?.name || '-' }),
        'Note': lot.notes || '-',
        'Stato': lot.status || 'active'
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();

      if (config.groupByCategory && selectedCategory === 'all') {
        // Group by category - create separate sheets
        const groupedData: Record<string, typeof excelData> = {};
        
        excelData.forEach(row => {
          const category = row['Categoria'];
          if (!groupedData[category]) {
            groupedData[category] = [];
          }
          groupedData[category].push(row);
        });

        Object.entries(groupedData).forEach(([category, data]) => {
          const ws = XLSX.utils.json_to_sheet(data);
          // Set column widths
          ws['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
            { wch: 20 }, { wch: 30 }, { wch: 10 }
          ];
          const sheetName = category.substring(0, 31).replace(/[\\/*?[\]]/g, '');
          XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Senza categoria');
        });
      } else {
        // Single sheet with all data
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
          { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
          { wch: 20 }, { wch: 30 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Lotti');
      }

      // Generate filename
      const weekLabel = selectedWeek === 'current' ? 'settimana-corrente' : 
                        selectedWeek === 'last' ? 'settimana-scorsa' : 'ultime-2-settimane';
      const categoryLabel = selectedCategory === 'all' ? 'tutti' : 
                           categories.find(c => c.id === selectedCategory)?.name || 'categoria';
      const filename = `lotti-${categoryLabel}-${weekLabel}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);

      // Update last export
      if (config.id) {
        await pb.collection('export_settings').update(config.id, {
          last_export: new Date().toISOString()
        });
        setConfig(prev => ({ ...prev, lastExport: new Date().toISOString() }));
      }

      toast({
        title: "Export completato",
        description: `${lots.length} lotti esportati in ${filename}`
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Errore export",
        description: error.message || "Impossibile esportare i dati",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const exportAllCategories = async () => {
    try {
      setExporting(true);
      
      const { start, end } = getWeekRange(selectedWeek);
      
      // Fetch all lots with expanded relations
      const filter = `production_date >= "${format(start, 'yyyy-MM-dd')}" && production_date <= "${format(end, 'yyyy-MM-dd')}"`;
      
      const lots = await pb.collection('lots').getFullList<PBLot>({
        filter,
        sort: 'category_id,-production_date',
        expand: 'category_id,supplier_id'
      });

      if (lots.length === 0) {
        toast({
          title: "Nessun dato",
          description: "Non ci sono lotti nel periodo selezionato",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      // Create one Excel file per category
      const groupedLots: Record<string, PBLot[]> = {};
      
      lots.forEach(lot => {
        const categoryName = lot.expand?.category_id?.name || 'Senza categoria';
        if (!groupedLots[categoryName]) {
          groupedLots[categoryName] = [];
        }
        groupedLots[categoryName].push(lot);
      });

      let exportedCount = 0;
      
      for (const [categoryName, categoryLots] of Object.entries(groupedLots)) {
        const excelData = categoryLots.map(lot => ({
          'Numero Lotto': lot.lot_number,
          'Lotto Interno': lot.internal_lot_number || '-',
          'Data Produzione': lot.production_date ? format(new Date(lot.production_date), 'dd/MM/yyyy', { locale: it }) : '-',
          'Data Scadenza': lot.expiry_date ? format(new Date(lot.expiry_date), 'dd/MM/yyyy', { locale: it }) : '-',
          'Data Ricezione': lot.reception_date ? format(new Date(lot.reception_date), 'dd/MM/yyyy', { locale: it }) : '-',
          'Congelato': lot.is_frozen ? 'Sì' : 'No',
          'Data Congelamento': lot.freezing_date ? format(new Date(lot.freezing_date), 'dd/MM/yyyy', { locale: it }) : '-',
          ...(config.includeSupplier && { 'Fornitore': lot.expand?.supplier_id?.name || '-' }),
          'Note': lot.notes || '-',
          'Stato': lot.status || 'active'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
          { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 },
          { wch: 30 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Lotti');

        const safeCategory = categoryName.replace(/[\\/*?[\]:]/g, '-').substring(0, 30);
        const weekLabel = format(start, 'dd-MM') + '_' + format(end, 'dd-MM-yyyy');
        const filename = `${safeCategory}_${weekLabel}.xlsx`;

        XLSX.writeFile(wb, filename);
        exportedCount++;
      }

      toast({
        title: "Export completato",
        description: `${exportedCount} file esportati (uno per categoria)`
      });
    } catch (error: any) {
      toast({
        title: "Errore export",
        description: error.message || "Impossibile esportare i dati",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Export Dati
        </CardTitle>
        <CardDescription>
          Esporta i lotti in formato Excel per categoria e periodo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Periodo</Label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Settimana corrente</SelectItem>
                <SelectItem value="last">Settimana scorsa</SelectItem>
                <SelectItem value="last2">Ultime 2 settimane</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={exportToExcel} 
            disabled={exporting}
            className="flex-1"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Esporta Excel
          </Button>
          
          <Button 
            onClick={exportAllCategories} 
            variant="outline"
            disabled={exporting}
            className="flex-1"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4 mr-2" />
            )}
            Un File per Categoria
          </Button>
        </div>

        {/* Auto Export Settings */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Export Automatico Settimanale
          </h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Abilita export automatico</Label>
              <p className="text-sm text-muted-foreground">
                Genera automaticamente i file Excel ogni settimana
              </p>
            </div>
            <Switch
              checked={config.autoExport}
              onCheckedChange={(checked) => 
                setConfig(prev => ({ ...prev, autoExport: checked }))
              }
            />
          </div>

          {config.autoExport && (
            <div className="space-y-2">
              <Label>Giorno export</Label>
              <Select
                value={config.exportDay}
                onValueChange={(value: 'sunday' | 'monday') => 
                  setConfig(prev => ({ ...prev, exportDay: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunday">Domenica (fine settimana)</SelectItem>
                  <SelectItem value="monday">Lunedì (inizio settimana)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Raggruppa per categoria</Label>
              <p className="text-sm text-muted-foreground">
                Crea fogli separati per ogni categoria
              </p>
            </div>
            <Switch
              checked={config.groupByCategory}
              onCheckedChange={(checked) => 
                setConfig(prev => ({ ...prev, groupByCategory: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Includi fornitore</Label>
              <p className="text-sm text-muted-foreground">
                Aggiungi colonna fornitore nell'export
              </p>
            </div>
            <Switch
              checked={config.includeSupplier}
              onCheckedChange={(checked) => 
                setConfig(prev => ({ ...prev, includeSupplier: checked }))
              }
            />
          </div>
        </div>

        {/* Last Export Info */}
        {config.lastExport && (
          <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
            <span className="text-sm">Ultimo export:</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="w-3 h-3 mr-1" />
              {format(new Date(config.lastExport), "dd/MM/yyyy HH:mm", { locale: it })}
            </Badge>
          </div>
        )}

        {/* Save Button */}
        <Button 
          onClick={saveConfig} 
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Salva Preferenze Export
        </Button>
      </CardContent>
    </Card>
  );
};
