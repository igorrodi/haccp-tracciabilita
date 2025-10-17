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
          product_categories(name),
          suppliers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Prepare data for CSV - only visible table columns
      const csvData = lots?.map(lot => ({
        'Lotto Interno': lot.internal_lot_number || '',
        'Lotto Originale': lot.lot_number,
        'Prodotto': lot.product_categories?.name || '',
        'Data Produzione': lot.production_date,
        'Data Scadenza': lot.expiry_date || '',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Fornitore': lot.suppliers?.name || '',
        'Ricezione Merce': lot.reception_date || ''
      })) || [];

      // Create CSV
      const ws = XLSX.utils.json_to_sheet(csvData);
      const csv = XLSX.utils.sheet_to_csv(ws);
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lotti_${new Date().toISOString().split('T')[0]}.csv`;
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
          product_categories(name),
          suppliers(name)
        `)
        .order('created_at', { ascending: false });

      if (lotsError) throw lotsError;

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Lots sheet - table columns + label image URLs
      const lotsData = lots?.map(lot => ({
        'Lotto Interno': lot.internal_lot_number || '',
        'Lotto Originale': lot.lot_number,
        'Prodotto': lot.product_categories?.name || '',
        'Data Produzione': lot.production_date,
        'Data Scadenza': lot.expiry_date || '',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Fornitore': lot.suppliers?.name || '',
        'Ricezione Merce': lot.reception_date || '',
        'Foto Etichetta': lot.label_image_url || ''
      })) || [];
      const lotsWs = XLSX.utils.json_to_sheet(lotsData);
      XLSX.utils.book_append_sheet(wb, lotsWs, 'Lotti');

      // Download Excel
      XLSX.writeFile(wb, `lotti_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Dati esportati in Excel con successo");
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error("Errore durante l'esportazione Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const handleMegaBackup = () => {
    toast.info("Funzione di backup su Mega in arrivo. Sarà necessario configurare le credenziali Mega.");
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={exportToCSV}
            disabled={isExporting}
            className="w-full"
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Esporta CSV
          </Button>
          <Button
            onClick={exportToExcel}
            disabled={isExporting}
            className="w-full"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Esporta Excel
          </Button>
          <Button
            onClick={handleMegaBackup}
            disabled={isExporting}
            className="w-full"
            variant="secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Backup su Mega
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          CSV ed Excel includono: lotto interno/originale, prodotto, date, fornitore e ricezione merce. Excel include anche le foto delle etichette. Il backup su Mega salverà tutti i dati e le immagini.
        </p>
      </CardContent>
    </Card>
  );
};