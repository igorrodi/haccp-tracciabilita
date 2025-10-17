import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export const DataExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all lots with related data
      const { data: lots, error } = await supabase
        .from('haccp_lots')
        .select(`
          *,
          product_categories(name, ingredients),
          suppliers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Prepare data for CSV
      const csvData = lots?.map(lot => ({
        'Numero Lotto Interno': lot.internal_lot_number,
        'Numero Lotto': lot.lot_number,
        'Prodotto': lot.product_categories?.name || '',
        'Fornitore': lot.suppliers?.name || '',
        'Data Produzione': lot.production_date,
        'Data Scadenza': lot.expiry_date || '',
        'Data Ricezione': lot.reception_date || '',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Stato': lot.status,
        'Note': lot.notes || '',
        'Data Creazione': new Date(lot.created_at).toLocaleString('it-IT')
      })) || [];

      // Create CSV
      const ws = XLSX.utils.json_to_sheet(csvData);
      const csv = XLSX.utils.sheet_to_csv(ws);
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lotti_haccp_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success("Dati esportati in CSV con successo");
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error("Errore durante l'esportazione CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      // Fetch all lots with related data
      const { data: lots, error: lotsError } = await supabase
        .from('haccp_lots')
        .select(`
          *,
          product_categories(name, ingredients),
          suppliers(name)
        `)
        .order('created_at', { ascending: false });

      if (lotsError) throw lotsError;

      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch suppliers
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (suppliersError) throw suppliersError;

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Lots sheet
      const lotsData = lots?.map(lot => ({
        'Numero Lotto Interno': lot.internal_lot_number,
        'Numero Lotto': lot.lot_number,
        'Prodotto': lot.product_categories?.name || '',
        'Fornitore': lot.suppliers?.name || '',
        'Data Produzione': lot.production_date,
        'Data Scadenza': lot.expiry_date || '',
        'Data Ricezione': lot.reception_date || '',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Stato': lot.status,
        'Note': lot.notes || '',
        'Data Creazione': new Date(lot.created_at).toLocaleString('it-IT')
      })) || [];
      const lotsWs = XLSX.utils.json_to_sheet(lotsData);
      XLSX.utils.book_append_sheet(wb, lotsWs, 'Lotti');

      // Categories sheet
      const categoriesData = categories?.map(cat => ({
        'Nome': cat.name,
        'Ingredienti': cat.ingredients || '',
        'Durata (giorni)': cat.shelf_life_days || '',
        'Procedura': cat.preparation_procedure || '',
        'Data Creazione': new Date(cat.created_at).toLocaleString('it-IT')
      })) || [];
      const categoriesWs = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, categoriesWs, 'Prodotti');

      // Suppliers sheet
      const suppliersData = suppliers?.map(sup => ({
        'Nome': sup.name,
        'Contatti': sup.contact_info || '',
        'Note': sup.notes || '',
        'Data Creazione': new Date(sup.created_at).toLocaleString('it-IT')
      })) || [];
      const suppliersWs = XLSX.utils.json_to_sheet(suppliersData);
      XLSX.utils.book_append_sheet(wb, suppliersWs, 'Fornitori');

      // Download Excel
      XLSX.writeFile(wb, `haccp_completo_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Dati esportati in Excel con successo");
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error("Errore durante l'esportazione Excel");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esportazione Dati</CardTitle>
        <CardDescription>
          Esporta tutti i dati del sistema in formato CSV o Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={exportToCSV}
            disabled={isExporting}
            className="w-full"
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Esporta CSV (Solo Lotti)
          </Button>
          <Button
            onClick={exportToExcel}
            disabled={isExporting}
            className="w-full"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Esporta Excel (Completo)
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          L'esportazione CSV include solo i lotti. L'esportazione Excel include lotti, prodotti e fornitori in fogli separati.
        </p>
      </CardContent>
    </Card>
  );
};