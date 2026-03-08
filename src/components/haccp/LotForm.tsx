import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Package, ScanBarcode, Camera, Crop, FileSearch } from 'lucide-react';
import { useProducts, useSuppliers, useLots } from '@/hooks/usePocketBase';
import { format } from 'date-fns';
import { BarcodeScanner } from './BarcodeScanner';
import { ImageCropper } from './ImageCropper';
import { toast } from 'sonner';

export const LotForm = () => {
  const { data: products, loading: productsLoading } = useProducts();
  const { data: suppliers, loading: suppliersLoading } = useSuppliers();
  const { create: createLot } = useLots();

  const [formData, setFormData] = useState({
    lot_number: '',
    product_id: '',
    supplier_id: '',
    production_date: format(new Date(), 'yyyy-MM-dd'),
    expiry_date: '',
    is_frozen: false,
    freezing_date: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Photo/OCR state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBarcodeScan = (barcode: string) => {
    setFormData(prev => ({ ...prev, lot_number: barcode }));
    setShowScanner(false);
  };

  // Auto-calculate expiry date based on product shelf life
  useEffect(() => {
    if (formData.product_id && formData.production_date) {
      const product = products.find(p => p.id === formData.product_id);
      if (product?.shelf_life_days) {
        const prodDate = new Date(formData.production_date);
        prodDate.setDate(prodDate.getDate() + product.shelf_life_days);
        setFormData(prev => ({
          ...prev,
          expiry_date: format(prodDate, 'yyyy-MM-dd'),
        }));
      }
    }
  }, [formData.product_id, formData.production_date, products]);

  // Handle photo capture/upload
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
      setShowCropper(true);
      setCroppedImage(null);
      setOcrResult(null);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Handle crop complete
  const handleCropComplete = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setCroppedImage(url);
    setShowCropper(false);
    toast.success('Immagine ritagliata con successo');
  };

  // OCR: extract lot number from image
  const handleOCR = async () => {
    const imageToProcess = croppedImage || capturedImage;
    if (!imageToProcess) return;

    setOcrProcessing(true);
    setOcrResult(null);

    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(imageToProcess, 'ita+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Progress tracking if needed
          }
        }
      });
      
      const text = data.text.trim();
      setOcrResult(text);

      // Try to find a lot number pattern in the text
      const lotPatterns = [
        /(?:lotto?|lot|l\.?\s*n?\.?\s*):?\s*([A-Z0-9\-\/\.]+)/i,
        /(?:batch|partita):?\s*([A-Z0-9\-\/\.]+)/i,
        /\b([A-Z]{1,3}[\-\/]?\d{2,}[\-\/]?\d{0,4}[A-Z]?)\b/,
        /\b(\d{6,12})\b/,
      ];

      let foundLot = '';
      for (const pattern of lotPatterns) {
        const match = text.match(pattern);
        if (match) {
          foundLot = match[1].trim();
          break;
        }
      }

      if (foundLot) {
        setFormData(prev => ({ ...prev, lot_number: foundLot }));
        toast.success(`Lotto trovato: ${foundLot}`);
      } else if (text.length > 0) {
        toast.info('Testo trovato ma nessun lotto riconosciuto. Controlla il testo estratto sotto.');
      } else {
        toast.warning('Nessun testo riconosciuto. Prova con un\'immagine più chiara.');
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast.error('Errore durante il riconoscimento del testo');
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const lotData = {
      ...formData,
      expiry_date: formData.expiry_date || null,
      freezing_date: formData.is_frozen ? formData.freezing_date || formData.production_date : null,
      supplier_id: formData.supplier_id || null,
      product_id: formData.product_id || null,
    };

    const { error } = await createLot(lotData);
    
    if (!error) {
      setFormData({
        lot_number: '',
        product_id: '',
        supplier_id: '',
        production_date: format(new Date(), 'yyyy-MM-dd'),
        expiry_date: '',
        is_frozen: false,
        freezing_date: '',
        notes: '',
      });
      setCapturedImage(null);
      setCroppedImage(null);
      setOcrResult(null);
    }

    setSubmitting(false);
  };

  const isLoading = productsLoading || suppliersLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Nuovo Lotto
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showScanner && (
          <div className="mb-4">
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        )}

        {/* Image Cropper Dialog */}
        {capturedImage && (
          <ImageCropper
            image={capturedImage}
            isOpen={showCropper}
            onCropComplete={handleCropComplete}
            onCancel={() => setShowCropper(false)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lot_number">Numero Lotto *</Label>
            <div className="flex gap-2">
              <Input
                id="lot_number"
                value={formData.lot_number}
                onChange={(e) => setFormData(prev => ({ ...prev, lot_number: e.target.value }))}
                placeholder="Es: LOT-2024-001"
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowScanner(!showScanner)}
                title="Scansiona codice a barre"
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Photo capture + OCR section */}
          <div className="space-y-2">
            <Label>📷 Foto Etichetta (OCR)</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                {capturedImage ? 'Cambia foto' : 'Scatta / Carica foto'}
              </Button>
              {capturedImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCropper(true)}
                  title="Ritaglia immagine"
                >
                  <Crop className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Image preview */}
            {(croppedImage || capturedImage) && (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={croppedImage || capturedImage!}
                    alt="Etichetta"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleOCR}
                  disabled={ocrProcessing}
                >
                  {ocrProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <FileSearch className="h-4 w-4 mr-2" />
                      Estrai numero lotto (OCR)
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* OCR result */}
            {ocrResult && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Testo estratto:</p>
                <p className="text-sm whitespace-pre-wrap break-all font-mono">{ocrResult}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_id">Prodotto</Label>
            <Select
              value={formData.product_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Caricamento..." : "Seleziona prodotto"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_id">Fornitore</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Caricamento..." : "Seleziona fornitore"} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="production_date">Data Produzione *</Label>
              <Input
                id="production_date"
                type="date"
                value={formData.production_date}
                onChange={(e) => setFormData(prev => ({ ...prev, production_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Data Scadenza</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="is_frozen" className="cursor-pointer">Prodotto Congelato</Label>
            <Switch
              id="is_frozen"
              checked={formData.is_frozen}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_frozen: checked }))}
            />
          </div>

          {formData.is_frozen && (
            <div className="space-y-2">
              <Label htmlFor="freezing_date">Data Congelamento</Label>
              <Input
                id="freezing_date"
                type="date"
                value={formData.freezing_date}
                onChange={(e) => setFormData(prev => ({ ...prev, freezing_date: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Note aggiuntive..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || !formData.lot_number}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creazione...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Crea Lotto
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
