import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, FileSpreadsheet, Usb, Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pb } from '@/lib/pocketbase';

interface UsbDevice { device: string; sizeMB: number; label: string; fstype: string }
interface UsbStatus { lastRun: string; status: 'success' | 'error'; error: string | null; device: string }

export const downloadInspectionFile = async (kind: 'pdf' | 'xls') => {
  const res = await fetch(`${pb.baseURL.replace(/\/$/, '')}/api/inspection/file/${kind}`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Errore ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Registro_HACCP_${new Date().toISOString().slice(0, 10)}.${kind}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const InspectionUsbPanel = () => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [status, setStatus] = useState<UsbStatus | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [usbEnabled, setUsbEnabled] = useState(false);
  const [usbDevice, setUsbDevice] = useState('auto');

  const loadDevices = async () => {
    try {
      const res: any = await pb.send('/api/usb/devices', { method: 'GET', requestKey: null });
      setDevices(res?.devices || []);
      setStatus(res?.status || null);
    } catch { /* non admin o servizio non disponibile */ }
  };

  useEffect(() => {
    loadDevices();
    pb.collection('cloud_settings').getList(1, 1, { requestKey: null }).then((r) => {
      const rec: any = r.items[0];
      if (rec) {
        setRecordId(rec.id);
        setUsbEnabled(!!rec.usb_enabled);
        setUsbDevice(rec.usb_device || 'auto');
      }
    }).catch(() => {});
  }, []);

  const saveUsb = async (enabled: boolean, device: string) => {
    setUsbEnabled(enabled);
    setUsbDevice(device);
    try {
      const data = { usb_enabled: enabled, usb_device: device === 'auto' ? '' : device };
      if (recordId) await pb.collection('cloud_settings').update(recordId, data);
      else {
        const rec = await pb.collection('cloud_settings').create({ provider: 'none', ...data });
        setRecordId(rec.id);
      }
      toast({ title: 'Impostazione salvata' });
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message, variant: 'destructive' });
    }
  };

  const download = async (kind: 'pdf' | 'xls') => {
    setBusy(kind);
    try { await downloadInspectionFile(kind); }
    catch (e: any) { toast({ title: 'Download non riuscito', description: e?.message, variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const copyNow = async () => {
    setBusy('usb');
    try {
      await pb.send('/api/usb/backup', { method: 'POST', body: { device: usbDevice }, requestKey: null });
      toast({ title: 'Copia avviata', description: 'Non togliere la chiavetta finché lo stato non diventa "Completato".' });
      setTimeout(loadDevices, 8000);
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-5 h-5" />File per i controlli</CardTitle>
          <CardDescription>
            Registro completo di lotti, temperature e fornitori. Si crea da solo ogni notte alle 03:35 e va anche nel backup. I lotti scaduti sono evidenziati in rosso.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button variant="hero" size="lg" onClick={() => download('pdf')} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <FileText />} Scarica PDF
          </Button>
          <Button variant="outline" size="lg" onClick={() => download('xls')} disabled={!!busy}>
            {busy === 'xls' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Scarica Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Usb className="w-5 h-5" />Backup su chiavetta USB</CardTitle>
          <CardDescription>
            Copia dati, foto e file per i controlli sulla chiavetta (cartelle HACCP-Backup e HACCP-Ispezione). Tiene gli ultimi 14 giorni.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chiavetta</Label>
              <Button variant="ghost" size="sm" onClick={loadDevices}><RefreshCw className="w-4 h-4" /> Cerca</Button>
            </div>
            <Select value={usbDevice} onValueChange={(v) => saveUsb(usbEnabled, v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Qualsiasi chiavetta collegata</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.device} value={d.device}>
                    {d.label || 'Senza nome'} · {d.sizeMB >= 1024 ? `${(d.sizeMB / 1024).toFixed(1)} GB` : `${d.sizeMB} MB`} · {d.fstype}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {devices.length === 0 && <p className="text-sm text-muted-foreground">Nessuna chiavetta trovata. Inseriscila e tocca "Cerca".</p>}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Copia automatica ogni notte</Label>
              <p className="text-sm text-muted-foreground">Alle 04:30, se la chiavetta è collegata</p>
            </div>
            <Switch checked={usbEnabled} onCheckedChange={(c) => saveUsb(c, usbDevice)} />
          </div>
          <Button size="lg" className="w-full" onClick={copyNow} disabled={!!busy}>
            {busy === 'usb' ? <Loader2 className="animate-spin" /> : <Usb />} Copia adesso
          </Button>
          {status && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-sm">
              <span>Ultima copia: {new Date(status.lastRun).toLocaleString('it-IT')}</span>
              {status.status === 'success'
                ? <Badge variant="outline" className="border-success text-success"><Check className="w-3 h-3 mr-1" />Completato</Badge>
                : <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />{status.error || 'Errore'}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
