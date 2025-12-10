import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, PBProduct } from '@/hooks/usePocketBase';
import { Plus, Package, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
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

export const ProductsList = () => {
  const { data: products, loading, error, create, update, remove } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    shelf_life_days: '',
    ingredients: '',
    preparation_procedure: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      shelf_life_days: '',
      ingredients: '',
      preparation_procedure: '',
    });
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Prodotti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Prodotti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              Collezione "products" non trovata nel database PocketBase.
            </p>
            <p className="text-xs text-muted-foreground">
              Accedi al pannello admin per creare la collezione.
            </p>
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
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nuovo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Prodotto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Es: Lasagna alla bolognese"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelf_life_days">Durata (giorni)</Label>
                <Input
                  id="shelf_life_days"
                  type="number"
                  value={formData.shelf_life_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, shelf_life_days: e.target.value }))}
                  placeholder="Es: 5"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ingredients">Ingredienti</Label>
                <Textarea
                  id="ingredients"
                  value={formData.ingredients}
                  onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
                  placeholder="Lista ingredienti..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preparation_procedure">Procedura</Label>
                <Textarea
                  id="preparation_procedure"
                  value={formData.preparation_procedure}
                  onChange={(e) => setFormData(prev => ({ ...prev, preparation_procedure: e.target.value }))}
                  placeholder="Procedura di preparazione..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Annulla
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting || !formData.name}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Salva' : 'Crea'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun prodotto. Clicca "Nuovo" per aggiungerne uno.
          </p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    {product.shelf_life_days && (
                      <p className="text-sm text-muted-foreground">
                        Durata: {product.shelf_life_days} giorni
                      </p>
                    )}
                    {product.ingredients && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {product.ingredients}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(product)}>
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
                          <AlertDialogAction onClick={() => handleDelete(product.id)}>
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
