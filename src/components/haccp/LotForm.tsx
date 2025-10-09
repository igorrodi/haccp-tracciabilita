import { useState, useEffect } from "react";
import { Camera, Upload, Package, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from 'zod';
import { createWorker } from 'tesseract.js';

const lotSchema = z.object({
  category_id: z.string().uuid('Seleziona una categoria'),
  lot_number: z.string().trim().min(1, 'Numero lotto richiesto'),
  production_date: z.string().min(1, 'Data produzione richiesta'),
  expiry_date: z.string().optional(),
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [lotNumber, setLotNumber] = useState('');
  const [isFrozen, setIsFrozen] = useState(false);

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

  const performOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const worker = await createWorker('ita');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      // Extract lot number patterns (e.g., L.503586, LOT 123456, etc.)
      const lotPatterns = [
        /L\.\s*\d+/i,
        /LOT\s*\d+/i,
        /LOTTO\s*\d+/i,
        /\b\d{6,}\b/
      ];

      for (const pattern of lotPatterns) {
        const match = text.match(pattern);
        if (match) {
          const extractedLot = match[0].replace(/\s+/g, '');
          setLotNumber(extractedLot);
          toast.success(`Numero lotto rilevato: ${extractedLot}`);
          break;
        }
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast.error('Errore durante il riconoscimento testo');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newImages = [...selectedImages, ...files];
    setSelectedImages(newImages);

    const newPreviews = await Promise.all(
      files.map(file => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      }))
    );

    setImagePreviews([...imagePreviews, ...newPreviews]);
    toast.success(`${files.length} immagine/i caricata/e`);

    // Perform OCR on first image if lot number is empty
    if (!lotNumber && files[0]) {
      await performOCR(files[0]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      category_id: selectedCategory,
      lot_number: lotNumber || (formData.get('lot_number') as string),
      production_date: formData.get('production_date') as string,
      expiry_date: formData.get('expiry_date') as string,
      notes: formData.get('notes') as string
    };

    try {
      const validatedData = lotSchema.parse(data);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // Upload images to storage if present
      let labelImageUrl: string | null = null;
      if (selectedImages.length > 0) {
        const firstImage = selectedImages[0];
        const fileName = `${user.id}/${Date.now()}_${firstImage.name}`;
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('label-images')
          .upload(fileName, firstImage);

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('label-images')
            .getPublicUrl(fileName);
          labelImageUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from('haccp_lots')
        .insert([{
          user_id: user.id,
          category_id: validatedData.category_id,
          lot_number: validatedData.lot_number,
          production_date: validatedData.production_date,
          expiry_date: validatedData.expiry_date || null,
          notes: validatedData.notes || null,
          is_frozen: isFrozen,
          label_image_url: labelImageUrl
        }]);

      if (error) {
        setError(error.message);
      } else {
        toast.success('Lotto salvato con successo!');
        (e.target as HTMLFormElement).reset();
        setSelectedCategory("");
        setSelectedImages([]);
        setImagePreviews([]);
        setLotNumber('');
        setIsFrozen(false);
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
          {/* Prodotto */}
          <div className="space-y-2">
            <Label htmlFor="category">Prodotto *</Label>
            {categoriesLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-xl"></div>
            ) : categories.length === 0 ? (
              <Alert>
                <Package className="w-4 h-4" />
                <AlertDescription>
                  Nessun prodotto disponibile. Vai alla sezione "Prodotti" per aggiungere dei prodotti.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleziona prodotto" />
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

          {/* Dettagli prodotto selezionato */}
          {selectedCategoryData && (
            <div className="bg-muted/50 p-4 rounded-xl space-y-2">
              <h4 className="font-medium text-sm">Prodotto: {selectedCategoryData.name}</h4>
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

          {/* Lotto originale */}
          <div className="space-y-2">
            <Label htmlFor="lot_number">Lotto originale *</Label>
            <div className="relative">
              <Input
                id="lot_number"
                name="lot_number"
                type="text"
                placeholder="Es. L.503586"
                className="rounded-xl"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                required
              />
              {ocrLoading && (
                <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {ocrLoading && (
              <p className="text-xs text-muted-foreground">Riconoscimento testo in corso...</p>
            )}
          </div>

          {/* Stato congelamento */}
          <div className="flex items-center justify-between space-x-2 p-4 rounded-xl border bg-card">
            <div className="space-y-0.5">
              <Label htmlFor="is_frozen">Prodotto congelato</Label>
              <p className="text-sm text-muted-foreground">Il prodotto verrà conservato a -18°</p>
            </div>
            <Switch
              id="is_frozen"
              checked={isFrozen}
              onCheckedChange={setIsFrozen}
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
            <Label>Foto etichetta (opzionale - OCR automatico)</Label>
            <div className="camera-upload-area">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Scatta o carica foto</p>
                    <p className="text-sm text-muted-foreground">
                      Il numero lotto verrà riconosciuto automaticamente
                    </p>
                  </div>
                </div>
              </label>
            </div>
            
            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-32 object-cover rounded-xl border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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