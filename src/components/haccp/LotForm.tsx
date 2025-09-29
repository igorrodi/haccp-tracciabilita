import { useState, useEffect } from "react";
import { Camera, Upload, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from 'zod';

const lotSchema = z.object({
  category_id: z.string().uuid('Seleziona una categoria'),
  lot_number: z.string().trim().min(1, 'Numero lotto richiesto'),
  product_name: z.string().trim().min(2, 'Nome prodotto richiesto'),
  production_date: z.string().min(1, 'Data produzione richiesta'),
  expiry_date: z.string().optional(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  ph_level: z.number().optional(),
  notes: z.string().trim().max(500, 'Note troppo lunghe').optional()
});

interface Category {
  id: string;
  name: string;
  description?: string;
  preparation_procedure?: string;
}

export const LotForm = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('product_categories')
          .select('*')
          .eq('user_id', user.id)
          .order('name');

        if (error) {
          toast.error('Errore nel caricamento delle categorie');
        } else {
          setCategories(data || []);
        }
      } catch (error) {
        toast.error('Errore nel caricamento delle categorie');
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      toast.success("Immagine caricata con successo!");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      category_id: selectedCategory,
      lot_number: formData.get('lot_number') as string,
      product_name: formData.get('product_name') as string,
      production_date: formData.get('production_date') as string,
      expiry_date: formData.get('expiry_date') as string,
      temperature: formData.get('temperature') ? Number(formData.get('temperature')) : undefined,
      humidity: formData.get('humidity') ? Number(formData.get('humidity')) : undefined,
      ph_level: formData.get('ph_level') ? Number(formData.get('ph_level')) : undefined,
      notes: formData.get('notes') as string
    };

    try {
      const validatedData = lotSchema.parse(data);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const { error } = await supabase
        .from('haccp_lots')
        .insert([{
          user_id: user.id,
          category_id: validatedData.category_id,
          lot_number: validatedData.lot_number,
          product_name: validatedData.product_name,
          production_date: validatedData.production_date,
          expiry_date: validatedData.expiry_date || null,
          temperature: validatedData.temperature || null,
          humidity: validatedData.humidity || null,
          ph_level: validatedData.ph_level || null,
          notes: validatedData.notes || null
        }]);

      if (error) {
        setError(error.message);
      } else {
        toast.success('Lotto salvato con successo!');
        (e.target as HTMLFormElement).reset();
        setSelectedCategory("");
        setSelectedImage(null);
        setImagePreview(null);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('Errore durante il salvataggio del lotto');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryData = categories.find(cat => cat.id === selectedCategory);

  return (
    <Card className="haccp-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Inserisci nuovo lotto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Categoria Prodotto */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria Prodotto *</Label>
            {categoriesLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-xl"></div>
            ) : categories.length === 0 ? (
              <Alert>
                <Package className="w-4 h-4" />
                <AlertDescription>
                  Nessuna categoria disponibile. Vai alla sezione "Prodotti" per aggiungere delle categorie.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Dettagli categoria selezionata */}
          {selectedCategoryData && (
            <div className="bg-muted/50 p-4 rounded-xl space-y-2">
              <h4 className="font-medium text-sm">Categoria: {selectedCategoryData.name}</h4>
              {selectedCategoryData.description && (
                <p className="text-sm text-muted-foreground">{selectedCategoryData.description}</p>
              )}
              {selectedCategoryData.preparation_procedure && (
                <div className="text-sm">
                  <span className="font-medium">Procedimento: </span>
                  <span className="text-muted-foreground">{selectedCategoryData.preparation_procedure}</span>
                </div>
              )}
            </div>
          )}

          {/* Nome Prodotto */}
          <div className="space-y-2">
            <Label htmlFor="product_name">Nome Prodotto *</Label>
            <Input
              id="product_name"
              name="product_name"
              type="text"
              placeholder="Es. Salsiccia fresca di suino"
              className="rounded-xl"
              required
            />
          </div>

          {/* Numero Lotto */}
          <div className="space-y-2">
            <Label htmlFor="lot_number">Numero Lotto *</Label>
            <Input
              id="lot_number"
              name="lot_number"
              type="text"
              placeholder="Es. L.503586"
              className="rounded-xl"
              required
            />
          </div>

          {/* Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="production_date">Data produzione *</Label>
              <Input
                id="production_date"
                name="production_date"
                type="date"
                className="rounded-xl"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Data scadenza</Label>
              <Input
                id="expiry_date"
                name="expiry_date"
                type="date"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Parametri HACCP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperatura (°C)</Label>
              <Input
                id="temperature"
                name="temperature"
                type="number"
                step="0.1"
                placeholder="es. 4.5"
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="humidity">Umidità (%)</Label>
              <Input
                id="humidity"
                name="humidity"
                type="number"
                step="0.1"
                placeholder="es. 75.0"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph_level">pH</Label>
              <Input
                id="ph_level"
                name="ph_level"
                type="number"
                step="0.01"
                placeholder="es. 6.2"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Note aggiuntive..."
              className="rounded-xl"
            />
          </div>

          {/* Upload Etichetta */}
          <div className="space-y-2">
            <Label>Etichetta originale (opzionale)</Label>
            <div className="camera-upload-area">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Scatta o carica etichetta</p>
                    <p className="text-sm text-muted-foreground">
                      Tocca per aprire fotocamera o selezionare file
                    </p>
                  </div>
                </div>
              </label>
            </div>
            
            {imagePreview && (
              <div className="mt-4">
                <img
                  src={imagePreview}
                  alt="Anteprima etichetta"
                  className="max-w-full h-48 object-cover rounded-xl border"
                />
              </div>
            )}
          </div>

          {error && (
            <Alert className="border-destructive/50 text-destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full haccp-btn-primary" 
            disabled={loading || categories.length === 0}
          >
            {loading ? 'Salvataggio in corso...' : 'Salva lotto'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};