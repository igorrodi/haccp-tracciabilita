import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { Plus, Package } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri').max(100, 'Nome troppo lungo'),
  description: z.string().trim().max(500, 'Descrizione troppo lunga').optional(),
  preparation_procedure: z.string().trim().max(2000, 'Procedimento troppo lungo').optional()
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
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      preparation_procedure: formData.get('preparation_procedure') as string
    };

    try {
      const validatedData = categorySchema.parse(data);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const { error } = await supabase
        .from('product_categories')
        .insert([{
          user_id: user.id,
          name: validatedData.name,
          description: validatedData.description || null,
          preparation_procedure: validatedData.preparation_procedure || null
        }]);

      if (error) {
        if (error.message.includes('duplicate key')) {
          setError('Categoria già esistente con questo nome');
        } else {
          setError(error.message);
        }
      } else {
        toast.success('Categoria aggiunta con successo!');
        (e.target as HTMLFormElement).reset();
        onCategoryAdded();
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('Errore durante il salvataggio della categoria');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Aggiungi Prodotto
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Descrizione del prodotto (ingredienti, caratteristiche...)..."
              rows={3}
            />
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

          {error && (
            <Alert className="border-destructive/50 text-destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Aggiunta in corso...' : 'Aggiungi Prodotto'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};