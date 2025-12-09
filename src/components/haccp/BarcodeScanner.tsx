import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, SwitchCamera, Flashlight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Prefer back camera
          const backCameraIndex = devices.findIndex(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("rear") ||
              d.label.toLowerCase().includes("posteriore")
          );
          setCurrentCameraIndex(backCameraIndex >= 0 ? backCameraIndex : 0);
        }
      })
      .catch((err) => {
        console.error("Error getting cameras:", err);
        toast({
          title: "Errore fotocamera",
          description: "Impossibile accedere alla fotocamera. Verifica i permessi.",
          variant: "destructive",
        });
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    if (cameras.length === 0) {
      toast({
        title: "Nessuna fotocamera",
        description: "Non è stata trovata nessuna fotocamera disponibile.",
        variant: "destructive",
      });
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode("barcode-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        cameras[currentCameraIndex].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778,
        },
        (decodedText) => {
          // Success callback
          toast({
            title: "Codice rilevato!",
            description: decodedText,
          });
          onScan(decodedText);
          stopScanning();
        },
        () => {
          // Error callback (ignore - continuous scanning)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error("Error starting scanner:", err);
      toast({
        title: "Errore avvio scanner",
        description: "Impossibile avviare lo scanner. Riprova.",
        variant: "destructive",
      });
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    await stopScanning();
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);

    // Restart with new camera after a brief delay
    setTimeout(() => {
      startScanning();
    }, 300);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;

    try {
      const track = scannerRef.current
        .getRunningTrackCameraCapabilities?.()
        ?.torchFeature?.();

      if (track) {
        await track.apply(!torchEnabled);
        setTorchEnabled(!torchEnabled);
      } else {
        toast({
          title: "Flash non disponibile",
          description: "Questa fotocamera non supporta il flash.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error toggling torch:", err);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Scanner Codice a Barre
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          id="barcode-reader"
          className="w-full rounded-lg overflow-hidden bg-muted min-h-[200px]"
        />

        <div className="flex gap-2 justify-center">
          {!isScanning ? (
            <Button onClick={startScanning} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Avvia Scansione
            </Button>
          ) : (
            <>
              <Button variant="destructive" onClick={stopScanning}>
                <X className="h-4 w-4 mr-2" />
                Ferma
              </Button>
              {cameras.length > 1 && (
                <Button variant="outline" onClick={switchCamera}>
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant={torchEnabled ? "default" : "outline"}
                onClick={toggleTorch}
              >
                <Flashlight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Inquadra il codice a barre o QR code. Supporta EAN-13, EAN-8, UPC, Code-128, QR.
        </p>
      </CardContent>
    </Card>
  );
}
