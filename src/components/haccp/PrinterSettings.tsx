import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Printer, Save, Usb, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { detectUSBPrinters, requestUSBPrinter, DetectedPrinter } from '@/lib/printerDetection';

interface PrinterSettings {
  id?: string;
  printer_enabled: boolean;
  printer_type: string;
  label_width: number;
  label_height: number;
  include_qr_code: boolean;
  include_barcode: boolean;
  include_product_name: boolean;
  include_lot_number: boolean;
  include_expiry_date: boolean;
  include_production_date: boolean;
  font_size: string;
  printer_name?: string;
  printer_connection_type?: string;
  printer_ip_address?: string;
  printer_vendor_id?: number;
  printer_product_id?: number;
}

export const PrinterSettings = () => {
  const [settings, setSettings] = useState<PrinterSettings>({
    printer_enabled: false,
    printer_type: 'thermal',
    label_width: 100,
    label_height: 50,
    include_qr_code: true,
    include_barcode: true,
    include_product_name: true,
    include_lot_number: true,
    include_expiry_date: true,
    include_production_date: true,
    font_size: 'medium',
    printer_connection_type: 'browser',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState<DetectedPrinter[]>([]);

  useEffect(() => {
    fetchSettings();
    loadDetectedPrinters();
  }, []);

  const loadDetectedPrinters = async () => {
    try {
      const printers = await detectUSBPrinters();
      setDetectedPrinters(printers);
    } catch (error) {
      console.error('Error loading printers:', error);
    }
  };

  const handleRequestPrinter = async () => {
    try {
      const printer = await requestUSBPrinter();
      if (printer) {
        setSettings(prev => ({
          ...prev,
          printer_name: printer.name,
          printer_connection_type: 'usb',
          printer_vendor_id: printer.vendorId,
          printer_product_id: printer.productId,
        }));
        await loadDetectedPrinters();
        toast.success('Stampante selezionata con successo');
      }
    } catch (error) {
      toast.error('Errore nella selezione della stampante');
      console.error(error);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        toast.error('Errore nel caricamento delle impostazioni');
      } else if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching printer settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const settingsData = {
        ...settings,
        user_id: user.id,
      };

      let error;
      if (settings.id) {
        // Update existing settings
        const result = await supabase
          .from('printer_settings')
          .update(settingsData)
          .eq('id', settings.id);
        error = result.error;
      } else {
        // Insert new settings
        const result = await supabase
          .from('printer_settings')
          .insert([settingsData])
          .select()
          .single();
        error = result.error;
        if (!error && result.data) {
          setSettings(result.data);
        }
      }

      if (error) {
        toast.error('Errore nel salvataggio delle impostazioni');
      } else {
        toast.success('Impostazioni stampante salvate con successo');
      }
    } catch (error) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Impostazioni Stampante Etichette
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Printer */}
        <div className="flex items-center justify-between space-x-2 p-4 rounded-xl border bg-card">
          <div className="space-y-0.5">
            <Label htmlFor="printer_enabled">Abilita stampante</Label>
            <p className="text-sm text-muted-foreground">
              Attiva la funzione di stampa etichette per i lotti
            </p>
          </div>
          <Switch
            id="printer_enabled"
            checked={settings.printer_enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, printer_enabled: checked })
            }
          />
        </div>

        {settings.printer_enabled && (
          <>
            {/* Printer Type */}
            <div className="space-y-2">
              <Label htmlFor="printer_type">Tipo stampante</Label>
              <Select
                value={settings.printer_type}
                onValueChange={(value) =>
                  setSettings({ ...settings, printer_type: value })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
            <SelectItem value="thermal">Termica</SelectItem>
            <SelectItem value="inkjet">Inkjet</SelectItem>
            <SelectItem value="laser">Laser</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Connessione Stampante</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="connection-type">Tipo di Connessione</Label>
          <Select
            value={settings.printer_connection_type || 'browser'}
            onValueChange={(value) => setSettings(prev => ({ ...prev, printer_connection_type: value }))}
          >
            <SelectTrigger id="connection-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="browser">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  <span>Browser (Dialogo Sistema)</span>
                </div>
              </SelectItem>
              <SelectItem value="usb">
                <div className="flex items-center gap-2">
                  <Usb className="h-4 w-4" />
                  <span>USB Diretta</span>
                </div>
              </SelectItem>
              <SelectItem value="network">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  <span>Rete (IP)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {settings.printer_connection_type === 'usb' && (
          <div className="space-y-2">
            <Label>Stampante USB</Label>
            {settings.printer_name ? (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted">
                <div className="flex items-center gap-2">
                  <Usb className="h-4 w-4" />
                  <span className="text-sm font-medium">{settings.printer_name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestPrinter}
                >
                  Cambia
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleRequestPrinter}
                variant="outline"
                className="w-full"
              >
                <Usb className="mr-2 h-4 w-4" />
                Seleziona Stampante USB
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Permette al browser di comunicare direttamente con la stampante USB
            </p>
          </div>
        )}

        {settings.printer_connection_type === 'network' && (
          <div className="space-y-2">
            <Label htmlFor="printer-ip">Indirizzo IP Stampante</Label>
            <Input
              id="printer-ip"
              type="text"
              placeholder="192.168.1.100"
              value={settings.printer_ip_address || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, printer_ip_address: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Inserisci l'indirizzo IP della stampante di rete
            </p>
          </div>
        )}
      </div>

            {/* Label Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="label_width">Larghezza etichetta (mm)</Label>
                <Input
                  id="label_width"
                  type="number"
                  className="rounded-xl"
                  value={settings.label_width}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      label_width: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label_height">Altezza etichetta (mm)</Label>
                <Input
                  id="label_height"
                  type="number"
                  className="rounded-xl"
                  value={settings.label_height}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      label_height: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label htmlFor="font_size">Dimensione testo</Label>
              <Select
                value={settings.font_size}
                onValueChange={(value) =>
                  setSettings({ ...settings, font_size: value })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Piccolo</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="large">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* What to Include */}
            <div className="space-y-4">
              <Label>Informazioni da includere nell'etichetta</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include_product_name" className="font-normal">
                    Nome prodotto
                  </Label>
                  <Switch
                    id="include_product_name"
                    checked={settings.include_product_name}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, include_product_name: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include_lot_number" className="font-normal">
                    Numero lotto
                  </Label>
                  <Switch
                    id="include_lot_number"
                    checked={settings.include_lot_number}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, include_lot_number: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include_production_date" className="font-normal">
                    Data produzione
                  </Label>
                  <Switch
                    id="include_production_date"
                    checked={settings.include_production_date}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, include_production_date: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include_expiry_date" className="font-normal">
                    Data scadenza
                  </Label>
                  <Switch
                    id="include_expiry_date"
                    checked={settings.include_expiry_date}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, include_expiry_date: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include_qr_code" className="font-normal">
                    Codice QR
                  </Label>
                  <Switch
                    id="include_qr_code"
                    checked={settings.include_qr_code}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, include_qr_code: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include_barcode" className="font-normal">
                    Codice a barre
                  </Label>
                  <Switch
                    id="include_barcode"
                    checked={settings.include_barcode}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, include_barcode: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};