import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, useLots, PBProduct, PBLot } from '@/hooks/usePocketBase';
import { pb } from '@/lib/pocketbase';
import { Plus, Package, Pencil, Trash2, Loader2, AlertTriangle, Hash, ChevronDown, ChevronUp, Snowflake } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface AllergenInfo {
  number: number;
  category_name: string;
}

export const ProductsList = () => {
  const { data: products, loading, error, create, update, remove } = useProducts();
  const { data: lots } = useLots();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allergens, setAllergens] = useState<AllergenInfo[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [lotImages, setLotImages] = useState<Record<string, { id: string; url: string }[]>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    shelf_life_days: '',
    ingredients: '',
    preparation_procedure: '',
  });

  useEffect(() => {
    pb.collection('allergens').getFullList<AllergenInfo>({ sort: 'number' })
      .then(setAllergens)
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setFormData({ name: '', shelf_life_days: '', ingredients: '', preparation_procedure: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const productData = {
      name: formData.name,
      shelf_life_days: formData.shelf_life_days ? parseInt(formData.shelf_life_days) : null,
      ingredients: formData.ingredients || null,
      preparation_procedure: formData.preparation_procedure || null,
    };
    if (editingId) {
      await update(editingId, productData);
    } else {
      await create(productData);
    }
    resetForm();
    setDialogOpen(false);
    setSubmitting(false);
  };

  const handleEdit = (product: PBProduct) => {
    setFormData({
      name: product.name,
      shelf_life_days: product.shelf_life_days?.toString() || '',
      ingredients: product.ingredients || '',
      preparation_procedure: product.preparation_procedure || '',
    });
    setEditingId(product.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const getProductAllergens = (ingredients?: string): AllergenInfo[] => {
    if (!ingredients || allergens.length === 0) return [];
    const lower = ingredients.toLowerCase();
    return allergens.filter(a => {
      const terms = a.category_name.toLowerCase().split(/[,\/]/);
      return terms.some(t => lower.includes(t.trim()));
    });
  };

  const getLotCount = (productId: string): number => {
    return lots.filter(l => l.product_id === productId).length;
  };

  const getProductLots = (productId: string): PBLot[] => {
    return lots.filter(l => l.product_id === productId);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
  };

  const productForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome Prodotto *</Label>
        <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Es: Lasagna alla bolognese" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shelf_life_days">Durata (giorni)</Label>
        <Input id="shelf_life_days" type="number" value={formData.shelf_life_days} onChange={(e) => setFormData(prev => ({ ...prev, shelf_life_days: e.target.value }))} placeholder="Es: 5" min="1" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ingredients">Ingredienti</Label>
        <Textarea id="ingredients" value={formData.ingredients} onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))} placeholder="Lista ingredienti..." rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="preparation_procedure">Procedura</Label>
        <Textarea id="preparation_procedure" value={formData.preparation_procedure} onChange={(e) => setFormData(prev => ({ ...prev, preparation_procedure: e.target.value }))} placeholder="Procedura di preparazione..." rows={3} />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); resetForm(); }}>Annulla</Button>
        <Button type="submit" className="flex-1" disabled={submitting || !formData.name}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Salva' : 'Crea'}
        </Button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Prodotti</CardTitle></CardHeader>
        <CardContent className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Prodotti</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Nuovo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo Prodotto</DialogTitle><DialogDescription>Inserisci i dettagli del nuovo prodotto</DialogDescription></DialogHeader>
              {productForm}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-muted-foreground">Database non connesso. In produzione i prodotti saranno salvati su PocketBase.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Prodotti ({products.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Nuovo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</DialogTitle><DialogDescription>Inserisci i dettagli del prodotto</DialogDescription></DialogHeader>
            {productForm}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nessun prodotto. Clicca "Nuovo" per aggiungerne uno.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const productAllergens = getProductAllergens(product.ingredients);
              const lotCount = getLotCount(product.id);
              const isExpanded = expandedProduct === product.id;
              const productLots = isExpanded ? getProductLots(product.id) : [];

              return (
                <div
                  key={product.id}
                  className="rounded-lg border border-border hover:border-primary/50 transition-colors overflow-hidden"
                >
                  <div className="p-4 bg-muted/50">
                    <div className="flex items-start justify-between">
                      <button
                        className="space-y-1.5 flex-1 min-w-0 text-left"
                        onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{product.name}</h3>
                          {lotCount > 0 && (
                            isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 flex-wrap">
                          {product.shelf_life_days && (
                            <span className="text-sm text-muted-foreground">📅 {product.shelf_life_days}g</span>
                          )}
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {lotCount} lott{lotCount === 1 ? 'o' : 'i'}
                          </span>
                        </div>

                        {product.ingredients && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{product.ingredients}</p>
                        )}

                        {productAllergens.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            {productAllergens.map(a => (
                              <Badge key={a.number} variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">
                                {a.category_name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>

                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(product); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina prodotto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Stai per eliminare "{product.name}". Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(product.id)}>Elimina</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>

                  {/* Expanded lot list */}
                  {isExpanded && (
                    <div className="border-t border-border bg-background p-3 space-y-2">
                      {productLots.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Nessun lotto registrato per questo prodotto</p>
                      ) : (
                        productLots.map(lot => (
                          <div key={lot.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary text-xs tracking-wider">
                                {lot.internal_lot_number || '—'}
                              </span>
                              {lot.is_frozen && <Snowflake className="w-3 h-3 text-blue-500" />}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {lot.lot_number && <span className="truncate max-w-[120px]">{lot.lot_number}</span>}
                              <span>{formatDate(lot.production_date)}</span>
                              {lot.expiry_date && (
                                <span className={new Date(lot.expiry_date) < new Date() ? 'text-destructive font-medium' : ''}>
                                  → {formatDate(lot.expiry_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
