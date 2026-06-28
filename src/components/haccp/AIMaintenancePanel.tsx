import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Activity, HardDrive, Database, Cloud, Wifi, Loader2, Wrench, AlertTriangle, CheckCircle2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pb } from '@/lib/pocketbase';

interface Diagnostics {
  timestamp: string;
  services: { pocketbase_running: boolean; http_health: boolean; cups_running: boolean; collections_reachable: boolean };
  disk: { total_kb: number; free_kb: number; used_percent: number };
  database: { size_kb: number; integrity: string };
  backups: { count: number; last_file: string; last_age_hours: number };
  cloud: { configured: boolean; provider: string; reachable: boolean };
  network: { internet: boolean };
  filesystem: { pb_data_writable: boolean };
}

interface AIAction { id: string; label: string; why?: string }
interface AIIssue { area: string; message: string; severity: 'info' | 'warn' | 'critical' }
interface AIReport { summary: string; severity: 'ok' | 'warn' | 'critical'; issues: AIIssue[]; actions: AIAction[] }

const fmtKb = (kb: number) => kb > 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} GB` : kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;

const Dot = ({ ok }: { ok: boolean }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
);

export const AIMaintenancePanel = () => {
  const { toast } = useToast();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [report, setReport] = useState<AIReport | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [fixLog, setFixLog] = useState<string>('');

  const loadDiag = async () => {
    setLoadingDiag(true);
    try {
      const res = await fetch(`${pb.baseURL}/api/ai-maintenance/diagnose`, {
        headers: { Authorization: pb.authStore.token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore diagnosi');
      setDiag(data);
    } catch (e: any) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingDiag(false);
    }
  };

  const runAnalyze = async () => {
    setLoadingAi(true);
    setReport(null);
    try {
      const res = await fetch(`${pb.baseURL}/api/ai-maintenance/analyze`, {
        method: 'POST',
        headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      if (data.diagnostics) setDiag(data.diagnostics);
      setReport(data.report);
      toast({ title: 'Analisi AI completata', description: data.report?.summary?.slice(0, 120) || '' });
    } catch (e: any) {
      toast({ title: 'Errore AI', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAi(false);
    }
  };

  const runFix = async (action: string) => {
    setFixing(action);
    try {
      const res = await fetch(`${pb.baseURL}/api/ai-maintenance/fix`, {
        method: 'POST',
        headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setFixLog(`[${action}] ${data.output || ''}`);
      if (!res.ok || !data.success) throw new Error(data.error || data.output || 'Fix fallito');
      toast({ title: 'Azione eseguita', description: action });
      setTimeout(loadDiag, 1500);
    } catch (e: any) {
      toast({ title: 'Errore azione', description: e.message, variant: 'destructive' });
    } finally {
      setFixing(null);
    }
  };

  useEffect(() => { loadDiag(); }, []);

  const sevBadge = (s?: string) => {
    if (s === 'critical') return <Badge variant="destructive">Critico</Badge>;
    if (s === 'warn') return <Badge className="bg-amber-500">Attenzione</Badge>;
    if (s === 'ok') return <Badge className="bg-green-600">OK</Badge>;
    return <Badge variant="secondary">Info</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" /> Manutenzione AI
          </CardTitle>
          <CardDescription>
            Controllo periodico di servizi, disco, database, backup e integrazione cloud.
            L'AI propone azioni correttive che puoi eseguire con un click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadDiag} disabled={loadingDiag} variant="outline">
              {loadingDiag ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
              Aggiorna diagnosi
            </Button>
            <Button onClick={runAnalyze} disabled={loadingAi || !diag}>
              {loadingAi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
              Analizza con AI
            </Button>
          </div>

          {diag && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 border rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-sm"><Activity className="w-4 h-4" /> Servizi</div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2"><Dot ok={diag.services.pocketbase_running} /> PocketBase</div>
                  <div className="flex items-center gap-2"><Dot ok={diag.services.http_health} /> HTTP /api/health</div>
                  <div className="flex items-center gap-2"><Dot ok={diag.services.collections_reachable} /> Collezioni raggiungibili</div>
                  <div className="flex items-center gap-2"><Dot ok={diag.services.cups_running} /> CUPS (stampa)</div>
                </div>
              </div>

              <div className="p-3 border rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-sm"><HardDrive className="w-4 h-4" /> Disco</div>
                <div className="text-xs">
                  Usato {diag.disk.used_percent}% — libero {fmtKb(diag.disk.free_kb)} / {fmtKb(diag.disk.total_kb)}
                </div>
                {diag.disk.used_percent >= 85 && (
                  <div className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Spazio in esaurimento</div>
                )}
              </div>

              <div className="p-3 border rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-sm"><Database className="w-4 h-4" /> Database</div>
                <div className="text-xs">Dimensione: {fmtKb(diag.database.size_kb)}</div>
                <div className="text-xs flex items-center gap-2">
                  <Dot ok={diag.database.integrity === 'ok'} /> Integrità: {diag.database.integrity}
                </div>
              </div>

              <div className="p-3 border rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-sm"><Cloud className="w-4 h-4" /> Backup & Cloud</div>
                <div className="text-xs">Backup locali: {diag.backups.count} {diag.backups.last_file && `(ultimo ${diag.backups.last_age_hours}h fa)`}</div>
                <div className="text-xs flex items-center gap-2">
                  <Dot ok={diag.cloud.configured} /> Cloud {diag.cloud.provider || 'non configurato'}
                  {diag.cloud.configured && <><Dot ok={diag.cloud.reachable} /> raggiungibile</>}
                </div>
                <div className="text-xs flex items-center gap-2"><Wifi className="w-3 h-3" /> Internet: <Dot ok={diag.network.internet} /></div>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Nota o richiesta per l'AI (opzionale)</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Es: il backup cloud non si completa da 2 giorni, controlla cosa fare"
              rows={2}
            />
          </div>

          {report && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center gap-2">
                <h3 className="font-medium">Diagnosi AI</h3>
                {sevBadge(report.severity)}
              </div>
              <p className="text-sm text-muted-foreground">{report.summary}</p>

              {report.issues?.length > 0 && (
                <div className="space-y-1.5">
                  {report.issues.map((i, idx) => (
                    <div key={idx} className="text-xs p-2 border rounded flex items-start gap-2">
                      {i.severity === 'critical' ? <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5" />
                        : i.severity === 'warn' ? <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />
                        : <CheckCircle2 className="w-3 h-3 text-muted-foreground mt-0.5" />}
                      <div><span className="font-medium">[{i.area}]</span> {i.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {report.actions?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2"><Wrench className="w-4 h-4" /> Azioni proposte</div>
                  <div className="grid gap-2">
                    {report.actions.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 p-2 border rounded">
                        <div className="text-xs">
                          <div className="font-medium">{a.label}</div>
                          {a.why && <div className="text-muted-foreground">{a.why}</div>}
                        </div>
                        <Button size="sm" onClick={() => runFix(a.id)} disabled={fixing !== null}>
                          {fixing === a.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                          Esegui
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {fixLog && (
            <div className="p-2 bg-muted rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
              {fixLog}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
