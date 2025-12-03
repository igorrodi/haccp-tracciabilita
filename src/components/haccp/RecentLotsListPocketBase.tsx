import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLots, useProducts, useSuppliers, PBLot } from '@/hooks/usePocketBase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, Snowflake, Trash2, Package } from 'lucide-react';
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

export const RecentLotsListPocketBase = () => {
  const { data: lots, loading, error, remove } = useLots();
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();

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
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Lotti Recenti ({lots.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun lotto registrato. Crea il primo lotto!
          </p>
        ) : (
          <div className="space-y-3">
            {lots.slice(0, 10).map((lot) => (
              <div
                key={lot.id}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      <span className="font-medium">{lot.lot_number}</span>
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
                            Stai per eliminare il lotto {lot.lot_number}. Questa azione non può essere annullata.
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
