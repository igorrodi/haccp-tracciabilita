import { useAppVersion } from '@/hooks/useAppVersion';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, RefreshCw, Info } from 'lucide-react';

export const AppFooter = () => {
  const version = useAppVersion();

  if (!version) return null;

  const statusIcon = () => {
    switch (version.update_status) {
      case 'updated':
      case 'up_to_date':
        return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
      case 'failed':
      case 'rollback':
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      case 'dev':
        return <Info className="w-3 h-3 text-muted-foreground" />;
      default:
        return <RefreshCw className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const statusText = () => {
    switch (version.update_status) {
      case 'updated': return 'Aggiornato';
      case 'up_to_date': return 'Aggiornato';
      case 'failed': return 'Aggiornamento fallito';
      case 'rollback': return 'Rollback effettuato';
      case 'dev': return 'Sviluppo';
      default: return '';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: it });
    } catch {
      return null;
    }
  };

  const lastUpdate = formatDate(version.last_update);
  const lastCheck = formatDate(version.last_check);

  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{version.app_name}</span>
          <span className="text-muted-foreground/60">v{version.app_version}</span>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="hidden sm:inline" title="Ultimo aggiornamento">
              Aggiornato: {lastUpdate}
            </span>
          )}
          {lastCheck && !lastUpdate && (
            <span className="hidden sm:inline" title="Ultimo controllo">
              Controllo: {lastCheck}
            </span>
          )}
          <span className="flex items-center gap-1">
            {statusIcon()}
            {statusText()}
          </span>
        </div>
      </div>
    </footer>
  );
};
