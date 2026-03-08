import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Package, ScanBarcode, Camera, Crop, FileSearch, X, ImagePlus, Hash, Lock } from 'lucide-react';
import { useProducts, useSuppliers, useLots } from '@/hooks/usePocketBase';
import { pb } from '@/lib/pocketbase';
import { format } from 'date-fns';
import { BarcodeScanner } from './BarcodeScanner';
import { ImageCropper } from './ImageCropper';
import { toast } from 'sonner';

interface PhotoItem {
  id: string;
  dataUrl: string;
  blob: Blob | null;
  name: string;
}

let photoCounter = 0;

// Generate a unique 6-character alphanumeric code
const generateInternalLot = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let result = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
};

export const LotForm = () => {
  const { data: products, loading: productsLoading } = useProducts();
  const { data: suppliers, loading: suppliersLoading } = useSuppliers();
  const { create: createLot } = useLots();

  const [internalLot, setInternalLot] = useState(generateInternalLot());
  const [originalLots, setOriginalLots] = useState<string[]>([]);
  const [currentOriginalLot, setCurrentOriginalLot] = useState('');

  const [formData, setFormData] = useState({
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
  
  // Multi-photo state
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [cropTarget, setCropTarget] = useState<PhotoItem | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrTargetId, setOcrTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBarcodeScan = (barcode: string) => {
    addOriginalLot(barcode);
    setShowScanner(false);
  };

  const addOriginalLot = (lot: string) => {
    const trimmed = lot.trim();
    if (!trimmed) return;
    if (originalLots.includes(trimmed)) {
      toast.info('Questo lotto è già stato aggiunto');
      return;
    }
    setOriginalLots(prev => [...prev, trimmed]);
    setCurrentOriginalLot('');
    toast.success(`Lotto originale aggiunto: ${trimmed}`);
  };

  const removeOriginalLot = (index: number) => {
    setOriginalLots(prev => prev.filter((_, i) => i !== index));
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
      const id = `photo-${++photoCounter}`;
      const newPhoto: PhotoItem = { id, dataUrl: reader.result as string, blob: file, name: file.name };
      setPhotos(prev => [...prev, newPhoto]);
      setCropTarget(newPhoto);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = (blob: Blob) => {
    if (!cropTarget) return;
    const url = URL.createObjectURL(blob);
    setPhotos(prev => prev.map(p => 
      p.id === cropTarget.id ? { ...p, dataUrl: url, blob } : p
    ));
    setShowCropper(false);
    setCropTarget(null);
    toast.success('Immagine ritagliata');
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    if (ocrTargetId === id) { setOcrResult(null); setOcrTargetId(null); }
  };

  const startCrop = (photo: PhotoItem) => {
    setCropTarget(photo);
    setShowCropper(true);
  };

  const handleOCR = async (photo: PhotoItem) => {
    setOcrProcessing(true);
    setOcrResult(null);
    setOcrTargetId(photo.id);
    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(photo.dataUrl, 'ita+eng', { logger: () => {} });
      const text = data.text.trim();
      setOcrResult(text);

      const lotPatterns = [
        /(?:lotto?|lot|l\.?\s*n?\.?\s*):?\s*([A-Z0-9\-\/\.]+)/i,
        /(?:batch|partita):?\s*([A-Z0-9\-\/\.]+)/i,
        /\b([A-Z]{1,3}[\-\/]?\d{2,}[\-\/]?\d{0,4}[A-Z]?)\b/,
        /\b(\d{6,12})\b/,
      ];

      let foundLot = '';
      for (const pattern of lotPatterns) {
        const match = text.match(pattern);
        if (match) { foundLot = match[1].trim(); break; }
      }

      if (foundLot) {
        addOriginalLot(foundLot);
      } else if (text.length > 0) {
        toast.info('Testo trovato ma nessun lotto riconosciuto automaticamente.');
      } else {
        toast.warning("Nessun testo riconosciuto. Prova con un'immagine più chiara.");
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
      internal_lot_number: internalLot,
      lot_number: originalLots.join(' | '),
      ...formData,
      expiry_date: formData.expiry_date || null,
      freezing_date: formData.is_frozen ? formData.freezing_date || formData.production_date : null,
      supplier_id: formData.supplier_id || null,
      product_id: formData.product_id || null,
    };

    const { data: newLot, error } = await createLot(lotData);
    
    if (!error && newLot) {
      for (const photo of photos) {
        if (photo.blob) {
          try {
            const formDataUpload = new FormData();
            formDataUpload.append('lot_id', newLot.id);
            formDataUpload.append('image', photo.blob, photo.name || 'photo.jpg');
            await pb.collection('lot_images').create(formDataUpload);
          } catch (uploadErr) {
            console.error('Photo upload error:', uploadErr);
          }
        }
      }

      if (photos.length > 0) {
        toast.success(`Lotto ${internalLot} creato con ${photos.length} foto`);
      }

      // Reset form with new internal lot
      setInternalLot(generateInternalLot());
      setOriginalLots([]);
      setCurrentOriginalLot('');
      setFormData({
        product_id: '',
        supplier_id: '',
        production_date: format(new Date(), 'yyyy-MM-dd'),
        expiry_date: '',
        is_frozen: false,
        freezing_date: '',
        notes: '',
      });
      setPhotos([]);
      setOcrResult(null);
      setOcrTargetId(null);
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
            <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
          </div>
        )}

        {cropTarget && (
          <ImageCropper
            image={cropTarget.dataUrl}
            isOpen={showCropper}
            onCropComplete={handleCropComplete}
            onCancel={() => { setShowCropper(false); setCropTarget(null); }}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Internal lot number - auto generated, read-only */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Il Tuo Lotto Interno
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 p-3 bg-primary/5 border-2 border-primary/20 rounded-lg">
                <Hash className="w-4 h-4 text-primary" />
                <span className="font-mono text-lg font-bold tracking-widest text-primary">{internalLot}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInternalLot(generateInternalLot())}
                title="Genera nuovo codice"
              >
                🔄
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Codice univoco a 6 caratteri. Sarà stampato sulle etichette e usato per la ricerca.
            </p>
          </div>

          {/* Original lot numbers - multiple */}
          <div className="space-y-2">
            <Label>Lotti Originali (fornitore)</Label>
            
            {originalLots.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {originalLots.map((lot, i) => (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                    {lot}
                    <button type="button" onClick={() => removeOriginalLot(i)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={currentOriginalLot}
                onChange={(e) => setCurrentOriginalLot(e.target.value)}
                placeholder="Es: LOT-2024-001"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOriginalLot(currentOriginalLot);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addOriginalLot(currentOriginalLot)}
                disabled={!currentOriginalLot.trim()}
                title="Aggiungi lotto"
              >
                <Plus className="h-4 w-4" />
              </Button>
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
            <p className="text-xs text-muted-foreground">
              Aggiungi uno o più lotti originali del fornitore. Premi Invio o usa lo scanner.
            </p>
          </div>

          {/* Multi-photo section */}
          <div className="space-y-2">
            <Label>📷 Foto Etichette</Label>
            
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden border bg-muted">
                    <img src={photo.dataUrl} alt="Etichetta" className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-white hover:bg-white/20" onClick={() => startCrop(photo)} title="Ritaglia">
                        <Crop className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-white hover:bg-white/20" onClick={() => handleOCR(photo)} disabled={ocrProcessing} title="OCR → Lotto originale">
                        <FileSearch className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-destructive hover:bg-white/20" onClick={() => removePhoto(photo.id)} title="Rimuovi">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
              <Button type="button" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                {photos.length > 0 ? (
                  <><ImagePlus className="h-4 w-4 mr-2" />Aggiungi altra foto ({photos.length})</>
                ) : (
                  <><Camera className="h-4 w-4 mr-2" />Scatta / Carica foto</>
                )}
              </Button>
            </div>

            {ocrProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisi OCR in corso...
              </div>
            )}

            {ocrResult && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Testo estratto:</p>
                <p className="text-sm whitespace-pre-wrap break-all font-mono">{ocrResult}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              💡 L'OCR estrae automaticamente i lotti originali dalle foto delle etichette.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_id">Prodotto</Label>
            <Select value={formData.product_id} onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Caricamento..." : "Seleziona prodotto"} /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_id">Fornitore</Label>
            <Select value={formData.supplier_id} onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Caricamento..." : "Seleziona fornitore"} /></SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="production_date">Data Produzione *</Label>
              <Input id="production_date" type="date" value={formData.production_date} onChange={(e) => setFormData(prev => ({ ...prev, production_date: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Data Scadenza</Label>
              <Input id="expiry_date" type="date" value={formData.expiry_date} onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="is_frozen" className="cursor-pointer">Prodotto Congelato</Label>
            <Switch id="is_frozen" checked={formData.is_frozen} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_frozen: checked }))} />
          </div>

          {formData.is_frozen && (
            <div className="space-y-2">
              <Label htmlFor="freezing_date">Data Congelamento</Label>
              <Input id="freezing_date" type="date" value={formData.freezing_date} onChange={(e) => setFormData(prev => ({ ...prev, freezing_date: e.target.value }))} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Note aggiuntive..." rows={3} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creazione...</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" />Crea Lotto {internalLot}</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
