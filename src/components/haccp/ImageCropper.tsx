import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  isOpen: boolean;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ImageCropper = ({ image, onCropComplete, onCancel, isOpen }: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);
  const [outputSize, setOutputSize] = useState<string>('800');

  const onCropChange = (location: { x: number; y: number }) => {
    setCrop(location);
  };

  const onZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const onCropAreaComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, parseInt(outputSize));
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Errore nel ritaglio:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Ritaglia immagine</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Trascina l'immagine per riposizionarla, usa gli angoli per ridimensionare l'area di ritaglio
          </p>
        </DialogHeader>
        
        <div className="relative h-[400px] bg-black rounded-lg overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
            showGrid={true}
            cropShape="rect"
            style={{
              containerStyle: {
                backgroundColor: '#000',
              },
              cropAreaStyle: {
                border: '2px solid #fff',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              }
            }}
          />
        </div>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={aspectRatio.toString()} onValueChange={(value) => setAspectRatio(parseFloat(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Quadrato (1:1)</SelectItem>
                  <SelectItem value="1.3333333333333333">4:3 Orizzontale</SelectItem>
                  <SelectItem value="0.75">3:4 Verticale</SelectItem>
                  <SelectItem value="1.7777777777777777">16:9 Orizzontale</SelectItem>
                  <SelectItem value="0.5625">9:16 Verticale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dimensione</Label>
              <Select value={outputSize} onValueChange={setOutputSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">Piccola (400px)</SelectItem>
                  <SelectItem value="800">Media (800px)</SelectItem>
                  <SelectItem value="1200">Grande (1200px)</SelectItem>
                  <SelectItem value="1600">Molto grande (1600px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Zoom</Label>
              <span className="text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
            </div>
            <Slider
              value={[zoom]}
              onValueChange={(values) => setZoom(values[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              💡 Puoi anche usare la rotella del mouse per zoomare
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          <Button onClick={createCroppedImage}>
            Conferma ritaglio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const getCroppedImg = async (imageSrc: string, pixelCrop: Area, maxWidth: number = 800): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Impossibile creare il canvas');
  }

  // Calculate output dimensions maintaining aspect ratio
  let outputWidth = pixelCrop.width;
  let outputHeight = pixelCrop.height;
  
  if (outputWidth > maxWidth) {
    const scale = maxWidth / outputWidth;
    outputWidth = maxWidth;
    outputHeight = outputHeight * scale;
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      }
    }, 'image/jpeg', 0.95);
  });
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
