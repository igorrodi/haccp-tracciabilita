import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pb, currentUser } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { z } from 'zod';
import { Package } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri').max(100, 'Nome troppo lungo'),
  ingredients: z.string().max(2000, 'Lista ingredienti troppo lunga').optional(),
  preparation_procedure: z.string().max(2000, 'Procedimento troppo lungo').optional(),
  shelf_life_days: z.number().int().positive('Inserire un numero positivo').optional()
});

interface CategoryFormProps {
  onCategoryAdded: () => void;
}

export const CategoryForm = ({ onCategoryAdded }: CategoryFormProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const shelfLifeDaysValue = formData.get('shelf_life_days') as string;
    const data = {
      name: (formData.get('name') as string)?.trim() || '',
      ingredients: (formData.get('ingredients') as string)?.trim() || undefined,
      preparation_procedure: (formData.get('preparation_procedure') as string)?.trim() || undefined,
      shelf_life_days: shelfLifeDaysValue ? parseInt(shelfLifeDaysValue) : undefined
    };

    try {
      const validatedData = categorySchema.parse(data);
      
      const user = currentUser();
      if (!user) throw new Error('Utente non autenticato');

      await pb.collection('products').create({
        user_id: user.id,
        name: validatedData.name,
        ingredients: validatedData.ingredients || null,
        preparation_procedure: validatedData.preparation_procedure || null,
        shelf_life_days: validatedData.shelf_life_days || null
      });

      toast.success('Categoria aggiunta con successo!');
      (e.target as HTMLFormElement).reset();
      onCategoryAdded();
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if ((err as any)?.message?.includes('unique')) {
        setError('Categoria già esistente con questo nome');
      } else {
        setError('Errore durante il salvataggio della categoria');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              <Package className="w-4 h-4 inline mr-2" />
              Nome Prodotto *
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="es. Salsiccia, Salmone, Pasta Fresca..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredienti</Label>
            <Textarea
              id="ingredients"
              name="ingredients"
              placeholder="• Farina di grano tenero tipo 00&#10;• Uova fresche&#10;• Latte intero&#10;• Burro&#10;• Sale"
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              💡 Inserisci ogni ingrediente su una nuova riga, anche senza bullet point. Gli allergeni saranno evidenziati automaticamente (glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, solfiti, lupini, molluschi)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preparation_procedure">Procedimento di Preparazione</Label>
            <Textarea
              id="preparation_procedure"
              name="preparation_procedure"
              placeholder="Descrivere il procedimento standard di preparazione per questo prodotto..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shelf_life_days">Giorni di Scadenza</Label>
            <Input
              id="shelf_life_days"
              name="shelf_life_days"
              type="number"
              min="1"
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Aggiunta in corso...' : 'Aggiungi Prodotto'}
        </Button>
      </form>
    </div>
  );
};