import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
            Trascina l'immagine per riposizionarla, usa lo zoom per ingrandire. Il ritaglio è libero, puoi ridimensionare l'area come preferisci.
          </p>
        </DialogHeader>
        
        <div className="relative h-[400px] bg-black rounded-lg overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={undefined}
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
          <div className="space-y-2">
            <Label>Dimensione output</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant={outputSize === '400' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOutputSize('400')}
              >
                Piccola
              </Button>
              <Button
                type="button"
                variant={outputSize === '800' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOutputSize('800')}
              >
                Media
              </Button>
              <Button
                type="button"
                variant={outputSize === '1200' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOutputSize('1200')}
              >
                Grande
              </Button>
              <Button
                type="button"
                variant={outputSize === '1600' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOutputSize('1600')}
              >
                XL
              </Button>
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
