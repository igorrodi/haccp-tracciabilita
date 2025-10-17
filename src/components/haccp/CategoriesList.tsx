import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Package, Trash2, FileText, Clock, Edit, ChevronRight } from 'lucide-react';
import { EditCategoryDialog } from './EditCategoryDialog';
import { ProductDetails } from './ProductDetails';
import { highlightAllergens } from '@/lib/allergens';

interface Category {
  id: string;
  name: string;
  ingredients?: string;
  preparation_procedure?: string;
  shelf_life_days?: number;
  created_at: string;
}

interface CategoriesListProps {
  refreshTrigger: number;
}

interface IngredientHighlight {
  ingredient: string;
  parts: Array<{ text: string; isAllergen: boolean }>;
}

export const CategoriesList = ({ refreshTrigger }: CategoriesListProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Category | null>(null);
  const [ingredientHighlights, setIngredientHighlights] = useState<Record<string, IngredientHighlight[]>>({});

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Errore nel caricamento delle categorie');
      } else {
        setCategories(data || []);
        
        // Pre-process ingredients highlighting
        const highlights: Record<string, IngredientHighlight[]> = {};
        for (const category of data || []) {
          if (category.ingredients) {
            const ingredients = category.ingredients.split('\n').filter(line => line.trim());
            const categoryHighlights: IngredientHighlight[] = [];
            
            for (const ingredient of ingredients) {
              const cleanIngredient = ingredient.trim().replace(/^[•\-\*]\s*/, '');
              const parts = await highlightAllergens(cleanIngredient);
              categoryHighlights.push({ ingredient: cleanIngredient, parts });
            }
            
            highlights[category.id] = categoryHighlights;
          }
        }
        setIngredientHighlights(highlights);
      }
    } catch (error) {
      toast.error('Errore nel caricamento delle categorie');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [refreshTrigger]);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setEditDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la categoria "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Errore durante l\'eliminazione');
      } else {
        toast.success('Categoria eliminata con successo');
        fetchCategories();
      }
    } catch (error) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  // Se un prodotto è selezionato, mostra i suoi dettagli
  if (selectedProduct) {
    return (
      <ProductDetails 
        product={selectedProduct} 
        onBack={() => setSelectedProduct(null)} 
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <EditCategoryDialog
        category={editingCategory}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onCategoryUpdated={fetchCategories}
      />
      
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Prodotti ({categories.length})</h3>
        </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun prodotto ancora creato</p>
              <p className="text-sm">Aggiungi il primo prodotto per iniziare</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {categories.map((category) => (
            <Card 
              key={category.id} 
              className="relative hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedProduct(category)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {category.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(category);
                      }}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(category.id, category.name);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.ingredients && ingredientHighlights[category.id] && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="w-4 h-4" />
                      Ingredienti
                    </div>
                    <ul className="text-sm pl-6 space-y-1 list-disc list-inside">
                      {ingredientHighlights[category.id].map((item, idx) => (
                        <li key={idx}>
                          {item.parts.map((part, partIdx) => (
                            <span
                              key={partIdx}
                              className={part.isAllergen ? 'font-bold underline decoration-2 decoration-amber-500' : ''}
                            >
                              {part.text}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {category.preparation_procedure && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      Preparazione
                    </div>
                    <p className="text-sm text-muted-foreground pl-6 whitespace-pre-wrap">
                      {category.preparation_procedure.length > 100 
                        ? `${category.preparation_procedure.substring(0, 100)}...` 
                        : category.preparation_procedure}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge variant="secondary" className="text-xs">
                    Creata il {new Date(category.created_at).toLocaleDateString('it-IT')}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-primary">
                    Vedi lotti <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </>
  );
};