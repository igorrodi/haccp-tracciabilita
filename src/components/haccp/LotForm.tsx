import { useState } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const PRODUCT_CATEGORIES = [
  "Salsiccia",
  "Stinchi",
  "Salami di cervo",
  "Prosciutto",
  "Bresaola",
  "Altro"
];

export const LotForm = () => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [originalLot, setOriginalLot] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [freezingDate, setFreezingDate] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      toast({
        title: "Immagine caricata",
        description: "Ora puoi ritagliare l'etichetta se necessario",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !originalLot || !productionDate) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    // TODO: Implementare il salvataggio quando Supabase sarà attivato
    toast({
      title: "Successo!",
      description: "Lotto salvato correttamente",
    });

    // Reset form
    setSelectedProduct("");
    setOriginalLot("");
    setProductionDate("");
    setFreezingDate("");
    setSelectedImage(null);
    setImagePreview(null);
  };

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
            <Label htmlFor="product">Categoria Prodotto *</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleziona categoria" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lotto Originale */}
          <div className="space-y-2">
            <Label htmlFor="original-lot">Lotto originale *</Label>
            <Input
              id="original-lot"
              type="text"
              value={originalLot}
              onChange={(e) => setOriginalLot(e.target.value)}
              placeholder="Es. ORIG-123 (estratto da OCR)"
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Verrà compilato automaticamente tramite OCR dall'etichetta caricata
            </p>
          </div>

          {/* Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="production-date">Data produzione *</Label>
              <Input
                id="production-date"
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="freezing-date">Data congelamento</Label>
              <Input
                id="freezing-date"
                type="date"
                value={freezingDate}
                onChange={(e) => setFreezingDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Upload Etichetta */}
          <div className="space-y-2">
            <Label>Etichetta originale</Label>
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
                <p className="text-xs text-muted-foreground mt-2">
                  Dopo il caricamento potrai ritagliare l'etichetta e il lotto verrà estratto automaticamente (OCR)
                </p>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full haccp-btn-primary">
            Salva lotto
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};