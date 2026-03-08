import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Save, Wifi, Monitor, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { pb, currentUser } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { LabelPreview } from './LabelPreview';
import { LABEL_PRESETS, getCUPSPrinters, getCUPSStatus } from '@/lib/labelPrinter';

interface PrinterSettingsData {
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
  include_freezing_date: boolean;
  font_size: string;
  printer_name?: string;
  printer_connection_type?: string;
  printer_ip_address?: string;
  printer_vendor_id?: number;
  printer_product_id?: number;
  cups_printer_name?: string;
  custom_layout?: any;
}

interface CUPSPrinter {
  name: string;
  enabled: boolean;
  description: string;
}

export const PrinterSettings = () => {
  const [settings, setSettings] = useState<PrinterSettingsData>({
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
    include_freezing_date: true,
    font_size: 'medium',
    printer_connection_type: 'browser',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cupsPrinters, setCupsPrinters] = useState<CUPSPrinter[]>([]);
  const [cupsAvailable, setCupsAvailable] = useState<boolean | null>(null);
  const [checkingCups, setCheckingCups] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const checkCUPS = async () => {
    setCheckingCups(true);
    try {
      const [printersResult, statusResult] = await Promise.all([
        getCUPSPrinters(),
        getCUPSStatus(),
      ]);
      setCupsAvailable(printersResult.cups_available);
      setCupsPrinters(printersResult.printers);
      
      if (printersResult.cups_available) {
        if (printersResult.printers.length > 0) {
          toast.success(`${printersResult.printers.length} stampante/i trovata/e`);
        } else {
          toast.info('CUPS attivo ma nessuna stampante configurata. Accedi a CUPS (porta 631) per aggiungere una stampante.');
        }
      } else {
        toast.error('CUPS non disponibile sul server');
      }
    } catch {
      setCupsAvailable(false);
      toast.error('Impossibile contattare CUPS');
    } finally {
      setCheckingCups(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const user = currentUser();
      if (!user) return;

      const data = await pb.collection('printer_settings').getFirstListItem(
        `user_id = "${user.id}"`,
        { requestKey: null }
      ).catch(() => null);

      if (data) {
        setSettings(data as any);
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
      const user = currentUser();
      if (!user) return;

      const { id, ...settingsWithoutId } = settings;
      const settingsData = { ...settingsWithoutId, user_id: user.id };

      if (id) {
        await pb.collection('printer_settings').update(id, settingsData);
      } else {
        const result = await pb.collection('printer_settings').create(settingsData);
        setSettings({ ...settings, id: result.id });
      }

      toast.success('Impostazioni stampante salvate');
    } catch (error) {
      toast.error('Errore nel salvataggio');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrinter = async (checked: boolean) => {
    const newSettings = { ...settings, printer_enabled: checked };
    setSettings(newSettings);
    
    try {
      const user = currentUser();
      if (!user) return;

      const { id, ...settingsWithoutId } = newSettings;
      const settingsData = { ...settingsWithoutId, user_id: user.id };

      if (id) {
        await pb.collection('printer_settings').update(id, { printer_enabled: checked });
      } else {
        const result = await pb.collection('printer_settings').create(settingsData);
        setSettings({ ...newSettings, id: result.id });
      }
      toast.success(checked ? 'Stampante abilitata' : 'Stampante disabilitata');
    } catch (error) {
      console.error('Error saving printer toggle:', error);
      toast.error('Errore nel salvataggio');
    }
  };

  const handlePresetChange = (presetName: string) => {
    if (presetName === 'custom') return;
    const preset = LABEL_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setSettings(prev => ({ ...prev, label_width: preset.width, label_height: preset.height }));
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Impostazioni Stampante Etichette
          </CardTitle>
          <CardDescription>
            Configura la stampante per le etichette dei lotti. Supporta stampa via CUPS o browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
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
              onCheckedChange={handleTogglePrinter}
            />
          </div>

          {settings.printer_enabled && (
            <>
              {/* Connection Type */}
              <div className="space-y-4 rounded-lg border p-4">
                <Label className="text-base font-semibold">Metodo di Stampa</Label>

                <div className="space-y-2">
                  <Label htmlFor="connection-type">Tipo di Connessione</Label>
                  <Select
                    value={settings.printer_connection_type || 'browser'}
                    onValueChange={(value) => {
                      setSettings(prev => ({ ...prev, printer_connection_type: value }));
                      if (value === 'cups' && cupsAvailable === null) {
                        checkCUPS();
                      }
                    }}
                  >
                    <SelectTrigger id="connection-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="browser">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          <span>Browser (Dialogo Sistema)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cups">
                        <div className="flex items-center gap-2">
                          <Printer className="h-4 w-4" />
                          <span>CUPS (Stampa Diretta)</span>
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

                {/* CUPS Section */}
                {settings.printer_connection_type === 'cups' && (
                  <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium">Stato CUPS</Label>
                        {cupsAvailable === true && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Attivo
                          </Badge>
                        )}
                        {cupsAvailable === false && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-1" /> Non disponibile
                          </Badge>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={checkCUPS} disabled={checkingCups}>
                        <RefreshCw className={`w-3 h-3 mr-1 ${checkingCups ? 'animate-spin' : ''}`} />
                        Verifica
                      </Button>
                    </div>

                    {cupsPrinters.length > 0 && (
                      <div className="space-y-2">
                        <Label>Stampante CUPS</Label>
                        <Select
                          value={settings.cups_printer_name || ''}
                          onValueChange={(value) => setSettings(prev => ({ ...prev, cups_printer_name: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona stampante..." />
                          </SelectTrigger>
                          <SelectContent>
                            {cupsPrinters.map(p => (
                              <SelectItem key={p.name} value={p.name}>
                                <div className="flex items-center gap-2">
                                  <Printer className="h-3 w-3" />
                                  <span>{p.name}</span>
                                  {p.enabled && <Badge variant="outline" className="text-[10px]">attiva</Badge>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Per aggiungere stampanti, accedi all'interfaccia CUPS su <code className="bg-background px-1 rounded">http://[IP-Raspberry]:631</code>
                    </p>
                  </div>
                )}

                {/* Network Section */}
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
                  </div>
                )}
              </div>

              {/* Label Format Presets */}
              <div className="space-y-4 rounded-lg border p-4">
                <Label className="text-base font-semibold">Formato Etichetta</Label>

                <div className="space-y-2">
                  <Label>Preset formato</Label>
                  <Select
                    value={LABEL_PRESETS.find(p => p.width === settings.label_width && p.height === settings.label_height)?.name || 'custom'}
                    onValueChange={handlePresetChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona formato..." />
                    </SelectTrigger>
                    <SelectContent>
                      {LABEL_PRESETS.map(preset => (
                        <SelectItem key={preset.name} value={preset.name}>
                          {preset.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Personalizzato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="label_width">Larghezza (mm)</Label>
                    <Input
                      id="label_width"
                      type="number"
                      className="rounded-xl"
                      value={settings.label_width}
                      onChange={(e) => setSettings({ ...settings, label_width: parseInt(e.target.value) || 100 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="label_height">Altezza (mm)</Label>
                    <Input
                      id="label_height"
                      type="number"
                      className="rounded-xl"
                      value={settings.label_height}
                      onChange={(e) => setSettings({ ...settings, label_height: parseInt(e.target.value) || 50 })}
                    />
                  </div>
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <Label htmlFor="font_size">Dimensione testo base</Label>
                <Select
                  value={settings.font_size}
                  onValueChange={(value) => setSettings({ ...settings, font_size: value })}
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

              {/* Label Preview with Drag & Drop */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Layout Etichetta (Drag & Drop)</Label>
                <LabelPreview 
                  width={settings.label_width}
                  height={settings.label_height}
                  settings={settings}
                  onSettingsChange={setSettings}
                />
              </div>

              {/* Save Button */}
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
