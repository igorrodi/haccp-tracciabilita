import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { pb } from "@/lib/pocketbase";
import { toast } from "sonner";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri').max(100, 'Nome troppo lungo'),
  ingredients: z.string().max(2000, 'Lista ingredienti troppo lunga').optional(),
  preparation_procedure: z.string().max(2000, 'Procedimento troppo lungo').optional(),
  shelf_life_days: z.number().int().positive('Inserire un numero positivo').optional()
});

interface Category {
  id: string;
  name: string;
  ingredients?: string;
  preparation_procedure?: string;
  shelf_life_days?: number;
}

interface EditCategoryDialogProps {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryUpdated: () => void;
}

export const EditCategoryDialog = ({ 
  category, 
  open, 
  onOpenChange, 
  onCategoryUpdated 
}: EditCategoryDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    ingredients: '',
    preparation_procedure: '',
    shelf_life_days: undefined as number | undefined
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        ingredients: category.ingredients || '',
        preparation_procedure: category.preparation_procedure || '',
        shelf_life_days: category.shelf_life_days || undefined
      });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    setLoading(true);
    setError('');

    try {
      const dataToValidate = {
        ...formData,
        ingredients: formData.ingredients?.trim() || undefined,
        preparation_procedure: formData.preparation_procedure?.trim() || undefined
      };
      const validatedData = categorySchema.parse(dataToValidate);

      await pb.collection('products').update(category.id, {
        name: validatedData.name,
        ingredients: validatedData.ingredients || null,
        preparation_procedure: validatedData.preparation_procedure || null,
        shelf_life_days: validatedData.shelf_life_days || null
      });

      toast.success('Categoria aggiornata con successo!');
      onCategoryUpdated();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if ((err as any)?.message?.includes('unique')) {
        setError('Categoria già esistente con questo nome');
      } else {
        setError('Errore durante l\'aggiornamento della categoria');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifica Categoria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome Categoria *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="es. Pasta Fresca, Dolci, Carni..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-ingredients">Ingredienti</Label>
            <Textarea
              id="edit-ingredients"
              value={formData.ingredients}
              onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
              placeholder="• Farina di grano tenero tipo 00&#10;• Uova fresche&#10;• Latte intero"
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              💡 Inserisci ogni ingrediente su una nuova riga. Gli allergeni saranno evidenziati automaticamente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-procedure">Procedimento di Preparazione</Label>
            <Textarea
              id="edit-procedure"
              value={formData.preparation_procedure}
              onChange={(e) => setFormData({ ...formData, preparation_procedure: e.target.value })}
              placeholder="Descrivere il procedimento standard di preparazione per questa categoria..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-shelf-life">Giorni di Scadenza</Label>
            <Input
              id="edit-shelf-life"
              type="number"
              min="1"
              value={formData.shelf_life_days || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                shelf_life_days: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="es. 7, 30, 90..."
            />
            <p className="text-sm text-muted-foreground">
              Numero di giorni di conservazione dalla data di produzione (opzionale)
            </p>
          </div>

          {error && (
            <Alert className="border-destructive/50 text-destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};