import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useLots, useProducts, useSuppliers, PBLot } from '@/hooks/usePocketBase';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, Snowflake, Trash2, Package, Printer, FileDown, Filter } from 'lucide-react';
import { pb, currentUser } from '@/lib/pocketbase';
import { printLabel } from '@/lib/labelPrinter';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const RecentLotsList = () => {
  const { data: lots, loading, error, remove } = useLots();
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const checkPrinter = async () => {
      try {
        const user = currentUser();
        if (!user) return;
        const data = await pb.collection('printer_settings').getFirstListItem(
          `user_id = "${user.id}"`,
          { requestKey: null }
        ).catch(() => null);
        if (data) {
          setPrinterEnabled((data as any).printer_enabled);
          setPrinterSettings(data);
        }
      } catch { /* ignore */ }
    };
    checkPrinter();
  }, []);

  const getProductName = (productId?: string) => {
    if (!productId) return 'N/D';
    const product = products.find(p => p.id === productId);
    return product?.name || 'N/D';
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return null;
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || null;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/D';
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: it });
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const handlePrint = async (lot: PBLot) => {
    if (!printerSettings) return;
    try {
      await printLabel(
        {
          internal_lot_number: lot.internal_lot_number,
          lot_number: lot.lot_number,
          production_date: lot.production_date,
          expiry_date: lot.expiry_date,
          product_name: getProductName(lot.product_id),
          is_frozen: lot.is_frozen,
          freezing_date: lot.freezing_date,
        },
        printerSettings
      );
      toast.success('Etichetta inviata alla stampante');
    } catch {
      toast.error('Errore durante la stampa');
    }
  };

  const filteredLots = lots.filter(lot => {
    if (!dateFrom && !dateTo) return true;
    const lotDate = new Date(lot.production_date || lot.created);
    if (dateFrom && dateTo) {
      return isWithinInterval(lotDate, { start: startOfDay(new Date(dateFrom)), end: endOfDay(new Date(dateTo)) });
    }
    if (dateFrom) return lotDate >= startOfDay(new Date(dateFrom));
    if (dateTo) return lotDate <= endOfDay(new Date(dateTo));
    return true;
  });

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      const now = new Date();

      doc.setFontSize(18);
      doc.text('Registro Lotti HACCP', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generato il ${format(now, 'dd/MM/yyyy HH:mm', { locale: it })}`, 14, 28);

      let startY = 34;
      if (dateFrom || dateTo) {
        doc.text(`Periodo: ${dateFrom || '...'} — ${dateTo || '...'}`, 14, 34);
        startY = 40;
      }

      const tableData = filteredLots.map(lot => [
        lot.internal_lot_number || '—',
        getProductName(lot.product_id),
        lot.lot_number || '—',
        getSupplierName(lot.supplier_id) || '—',
        lot.production_date ? format(new Date(lot.production_date), 'dd/MM/yyyy') : '—',
        lot.expiry_date ? format(new Date(lot.expiry_date), 'dd/MM/yyyy') : '—',
        lot.is_frozen ? 'Sì' : 'No',
      ]);

      autoTable(doc, {
        startY,
        head: [['Lotto Int.', 'Prodotto', 'Lotti Orig.', 'Fornitore', 'Produzione', 'Scadenza', 'Cong.']],
        body: tableData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 22 },
          2: { cellWidth: 30 },
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`HACCP Tracker - Pagina ${i}/${pageCount}`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`lotti_${format(now, 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF lotti esportato');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error("Errore nell'esportazione PDF");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Lotti Recenti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Lotti Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Collezione "lots" non trovata. Creala nel pannello admin PocketBase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Lotti ({filteredLots.length})
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" />
              Filtra
            </Button>
            {filteredLots.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleExportPDF}>
                <FileDown className="w-4 h-4 mr-1" />
                PDF
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Da</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">A</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            {(dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Reset
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredLots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {lots.length === 0 ? 'Nessun lotto registrato. Crea il primo lotto!' : 'Nessun lotto nel periodo selezionato.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredLots.slice(0, 20).map((lot) => (
              <div
                key={lot.id}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      <span className="font-mono font-bold text-primary tracking-wider">
                        {lot.internal_lot_number || '—'}
                      </span>
                      {lot.is_frozen && (
                        <Badge variant="secondary" className="text-xs">
                          <Snowflake className="w-3 h-3 mr-1" />
                          Congelato
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getProductName(lot.product_id)}
                    </p>
                    {lot.lot_number && (
                      <p className="text-xs text-muted-foreground">
                        Originali: {lot.lot_number}
                      </p>
                    )}
                    {getSupplierName(lot.supplier_id) && (
                      <p className="text-xs text-muted-foreground">
                        Fornitore: {getSupplierName(lot.supplier_id)}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Prod: {formatDate(lot.production_date)}
                    </p>
                    {lot.expiry_date && (
                      <p className="text-xs text-muted-foreground">
                        Scad: {formatDate(lot.expiry_date)}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-0.5">
                      {printerEnabled && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => handlePrint(lot)}
                          title="Stampa etichetta"
                        >
                          <Printer className="h-3 w-3 text-primary" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina lotto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Stai per eliminare il lotto {lot.internal_lot_number || lot.lot_number}. Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(lot.id)}>
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
