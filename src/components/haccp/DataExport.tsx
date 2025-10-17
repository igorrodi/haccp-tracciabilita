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
          product_categories(name, ingredients, shelf_life_days, preparation_procedure),
          suppliers(name, contact_info, notes)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Prepare data for CSV - complete 1:1 table export
      const csvData = lots?.map(lot => ({
        'ID': lot.id,
        'Numero Lotto Interno': lot.internal_lot_number,
        'Numero Lotto': lot.lot_number,
        'ID Categoria': lot.category_id || '',
        'Nome Prodotto': lot.product_categories?.name || '',
        'Ingredienti Prodotto': lot.product_categories?.ingredients || '',
        'Durata Prodotto (giorni)': lot.product_categories?.shelf_life_days || '',
        'Procedura Prodotto': lot.product_categories?.preparation_procedure || '',
        'ID Fornitore': lot.supplier_id || '',
        'Nome Fornitore': lot.suppliers?.name || '',
        'Contatti Fornitore': lot.suppliers?.contact_info || '',
        'Note Fornitore': lot.suppliers?.notes || '',
        'Data Produzione': lot.production_date,
        'Data Scadenza': lot.expiry_date || '',
        'Data Ricezione': lot.reception_date || '',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Stato': lot.status,
        'Note Lotto': lot.notes || '',
        'URL Immagine Etichetta': lot.label_image_url || '',
        'ID Utente': lot.user_id,
        'Data Creazione': new Date(lot.created_at).toLocaleString('it-IT'),
        'Data Aggiornamento': new Date(lot.updated_at).toLocaleString('it-IT')
      })) || [];

      // Create CSV
      const ws = XLSX.utils.json_to_sheet(csvData);
      const csv = XLSX.utils.sheet_to_csv(ws);
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lotti_completo_${new Date().toISOString().split('T')[0]}.csv`;
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
          product_categories(name, ingredients, shelf_life_days, preparation_procedure),
          suppliers(name, contact_info, notes)
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

      // Lots sheet - complete data with label images
      const lotsData = lots?.map(lot => ({
        'ID': lot.id,
        'Numero Lotto Interno': lot.internal_lot_number,
        'Numero Lotto': lot.lot_number,
        'ID Categoria': lot.category_id || '',
        'Nome Prodotto': lot.product_categories?.name || '',
        'Ingredienti Prodotto': lot.product_categories?.ingredients || '',
        'Durata Prodotto (giorni)': lot.product_categories?.shelf_life_days || '',
        'Procedura Prodotto': lot.product_categories?.preparation_procedure || '',
        'ID Fornitore': lot.supplier_id || '',
        'Nome Fornitore': lot.suppliers?.name || '',
        'Contatti Fornitore': lot.suppliers?.contact_info || '',
        'Note Fornitore': lot.suppliers?.notes || '',
        'Data Produzione': lot.production_date,
        'Data Scadenza': lot.expiry_date || '',
        'Data Ricezione': lot.reception_date || '',
        'Congelato': lot.is_frozen ? 'Sì' : 'No',
        'Stato': lot.status,
        'Note Lotto': lot.notes || '',
        'URL Immagine Etichetta': lot.label_image_url || '',
        'ID Utente': lot.user_id,
        'Data Creazione': new Date(lot.created_at).toLocaleString('it-IT'),
        'Data Aggiornamento': new Date(lot.updated_at).toLocaleString('it-IT')
      })) || [];
      const lotsWs = XLSX.utils.json_to_sheet(lotsData);
      XLSX.utils.book_append_sheet(wb, lotsWs, 'Lotti');

      // Categories sheet
      const categoriesData = categories?.map(cat => ({
        'ID': cat.id,
        'Nome': cat.name,
        'Ingredienti': cat.ingredients || '',
        'Durata (giorni)': cat.shelf_life_days || '',
        'Procedura': cat.preparation_procedure || '',
        'ID Utente': cat.user_id,
        'Data Creazione': new Date(cat.created_at).toLocaleString('it-IT'),
        'Data Aggiornamento': new Date(cat.updated_at).toLocaleString('it-IT')
      })) || [];
      const categoriesWs = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, categoriesWs, 'Prodotti');

      // Suppliers sheet
      const suppliersData = suppliers?.map(sup => ({
        'ID': sup.id,
        'Nome': sup.name,
        'Contatti': sup.contact_info || '',
        'Note': sup.notes || '',
        'ID Utente': sup.user_id,
        'Data Creazione': new Date(sup.created_at).toLocaleString('it-IT'),
        'Data Aggiornamento': new Date(sup.updated_at).toLocaleString('it-IT')
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
            Esporta CSV (Lotti Completi)
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
          L'esportazione CSV include tutti i dati dei lotti con prodotti e fornitori correlati. L'esportazione Excel include lotti (con URL foto etichette), prodotti e fornitori in fogli separati.
        </p>
      </CardContent>
    </Card>
  );
};