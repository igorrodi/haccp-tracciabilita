import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, 
  HardDrive, Download, Shield, FileText, ArrowUpCircle
} from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { useAppVersion } from '@/hooks/useAppVersion';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface UpdateLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface BackupInfo {
  name: string;
  size: string;
  date: string;
}

interface UpdateStatusData {
  version: any;
  log_entries: UpdateLogEntry[];
  backups: BackupInfo[];
  disk_usage?: string;
}

export const UpdatesBackupPanel = () => {
  const version = useAppVersion();
  const [logEntries, setLogEntries] = useState<UpdateLogEntry[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const data = await pb.send('/api/updates/status', { method: 'GET' });
      setLogEntries(data.log_entries || []);
      setBackups(data.backups || []);
    } catch {
      // In preview/dev mode, show sample data
      setLogEntries([
        { timestamp: new Date().toISOString(), level: 'info', message: 'Modalità sviluppo — log non disponibili' },
      ]);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'updated':
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aggiornato</Badge>;
      case 'up_to_date':
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Nessun aggiornamento</Badge>;
      case 'installed':
        return <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" />Prima installazione</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Fallito</Badge>;
      case 'rollback':
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Rollback</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Sconosciuto</Badge>;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'ok': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'error': return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
      case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      default: return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-5 bg-muted rounded w-1/3"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5" />
              Stato Aggiornamenti
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
          <CardDescription>
            Stato corrente del sistema e cronologia aggiornamenti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Version */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground mb-1">Versione</p>
              <p className="text-lg font-semibold">v{version?.app_version || '—'}</p>
            </div>
            {/* Last Update */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground mb-1">Ultimo aggiornamento</p>
              <p className="text-sm font-medium">{formatDate(version?.last_update)}</p>
            </div>
            {/* Status */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground mb-1">Stato</p>
              <div className="mt-0.5">{getStatusBadge(version?.update_status)}</div>
            </div>
          </div>

          {version?.last_check && (
            <p className="text-xs text-muted-foreground mt-3">
              Ultimo controllo: {formatDate(version.last_check)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Update Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4" />
            Log Aggiornamenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nessun log disponibile
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-1 pr-4">
                {logEntries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 text-sm">
                    {getLogIcon(entry.level)}
                    <span className="text-xs text-muted-foreground shrink-0 font-mono w-[130px]">
                      {formatDate(entry.timestamp)}
                    </span>
                    <span className={`flex-1 ${entry.level === 'error' ? 'text-destructive' : entry.level === 'warn' ? 'text-amber-600' : 'text-foreground'}`}>
                      {entry.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Backups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="w-4 h-4" />
            Backup Database
          </CardTitle>
          <CardDescription>
            Backup automatici creati prima di ogni aggiornamento (max 5 conservati)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-6">
              <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nessun backup disponibile
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                I backup vengono creati automaticamente prima di ogni aggiornamento
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium font-mono">{backup.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(backup.date)}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{backup.size}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
