import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wifi, Lock, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { toast } from 'sonner';

export const WiFiSettings = () => {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const records = await pb.collection('wifi_settings').getFullList({ requestKey: null });
      if (records.length > 0) {
        const rec = records[0];
        setRecordId(rec.id);
        setSsid((rec as any).wifi_ssid || '');
        setLastSaved((rec as any).wifi_ssid || '');
        // Don't show saved password for security
      }
    } catch (err: any) {
      console.warn('WiFi settings not available:', err?.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ssid.trim()) {
      toast.error('Inserisci un nome per la rete Wi-Fi');
      return;
    }
    if (password && password.length < 8) {
      toast.error('La password Wi-Fi deve essere di almeno 8 caratteri');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Le password non corrispondono');
      return;
    }

    setLoading(true);
    try {
      const data: any = { wifi_ssid: ssid.trim() };
      if (password) {
        data.wifi_password = password;
      }

      if (recordId) {
        await pb.collection('wifi_settings').update(recordId, data, { requestKey: null });
      } else {
        const rec = await pb.collection('wifi_settings').create(data, { requestKey: null });
        setRecordId(rec.id);
      }

      setLastSaved(ssid.trim());
      setPassword('');
      setConfirmPassword('');
      toast.success('Configurazione Wi-Fi salvata. L\'hotspot si riavvierà con le nuove impostazioni.');
    } catch (err: any) {
      toast.error('Errore salvataggio: ' + (err?.message || 'sconosciuto'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          Impostazioni Wi-Fi Hotspot
        </CardTitle>
        <CardDescription>
          Configura il nome e la password della rete Wi-Fi creata dal Raspberry Pi
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          {lastSaved && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Rete attiva: <strong>{lastSaved}</strong></span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wifi-ssid">Nome Rete (SSID)</Label>
            <div className="relative">
              <Wifi className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="wifi-ssid"
                type="text"
                placeholder="HACCP-Tracciabilita"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                className="pl-10"
                maxLength={32}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wifi-password">Nuova Password Wi-Fi</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="wifi-password"
                type="password"
                placeholder="Lascia vuoto per non cambiare"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                minLength={8}
                disabled={loading}
              />
            </div>
          </div>

          {password && (
            <div className="space-y-2">
              <Label htmlFor="wifi-confirm">Conferma Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="wifi-confirm"
                  type="password"
                  placeholder="Ripeti la password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  minLength={8}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p>Dopo il salvataggio, l'hotspot Wi-Fi verrà riavviato.</p>
              <p>I dispositivi connessi dovranno ricollegarsi con le nuove credenziali.</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applicazione...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salva e Applica
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
