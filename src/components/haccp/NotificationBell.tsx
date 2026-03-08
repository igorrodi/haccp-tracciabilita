import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { pb } from '@/lib/pocketbase';
import { Bell, AlertTriangle, Clock, Thermometer } from 'lucide-react';
import { differenceInDays, addDays, format, differenceInHours } from 'date-fns';
import { it } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'expiring' | 'expired' | 'temp_reminder';
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
}

const TEMP_REMINDER_HOURS = 15 * 24; // 15 days in hours

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkNotifications = async () => {
    try {
      const [lots, products, tempLogs] = await Promise.all([
        pb.collection('lots').getFullList<any>({ sort: '-created' }),
        pb.collection('products').getFullList<any>(),
        pb.collection('temperature_logs').getFullList<any>({ sort: '-created', perPage: 500 }).catch(() => []),
      ]);

      const productMap: Record<string, string> = {};
      products.forEach((p: any) => { productMap[p.id] = p.name; });

      const now = new Date();
      const in3Days = addDays(now, 3);
      const notifs: Notification[] = [];

      // Lot expiry notifications
      lots.forEach(lot => {
        const prodName = productMap[lot.product_id] || 'Prodotto sconosciuto';
        if (lot.expiry_date) {
          const exp = new Date(lot.expiry_date);
          if (exp <= now) {
            notifs.push({
              id: `expired-${lot.id}`,
              type: 'expired',
              title: `${prodName} SCADUTO`,
              message: `Lotto ${lot.lot_number} scaduto il ${format(exp, 'dd/MM/yyyy', { locale: it })}`,
              severity: 'danger',
            });
          } else if (exp <= in3Days) {
            const days = differenceInDays(exp, now);
            notifs.push({
              id: `expiring-${lot.id}`,
              type: 'expiring',
              title: `${prodName} in scadenza`,
              message: `Lotto ${lot.lot_number} scade tra ${days} giorn${days === 1 ? 'o' : 'i'}`,
              severity: 'warning',
            });
          }
        }
      });

      // Temperature reminder: check per-location last log
      const locationLastLog: Record<string, Date> = {};
      (tempLogs as any[]).forEach(log => {
        if (!locationLastLog[log.location] || new Date(log.created) > locationLastLog[log.location]) {
          locationLastLog[log.location] = new Date(log.created);
        }
      });

      // If there are any temperature logs, check each location
      if (Object.keys(locationLastLog).length > 0) {
        Object.entries(locationLastLog).forEach(([loc, lastDate]) => {
          const hoursSince = differenceInHours(now, lastDate);
          if (hoursSince >= TEMP_REMINDER_HOURS) {
            const daysSince = Math.floor(hoursSince / 24);
            notifs.push({
              id: `temp-reminder-${loc}`,
              type: 'temp_reminder',
              title: `Registra temperatura: ${loc}`,
              message: `Ultima rilevazione ${daysSince} giorni fa. Registra una nuova temperatura.`,
              severity: 'info',
            });
          }
        });
      } else if (lots.length > 0) {
        // No temp logs at all but has lots — general reminder
        notifs.push({
          id: 'temp-reminder-general',
          type: 'temp_reminder',
          title: 'Registra le temperature',
          message: 'Nessuna rilevazione trovata. Ricordati di registrare le temperature ogni 15 giorni.',
          severity: 'info',
        });
      }

      setNotifications(notifs);
    } catch { /* ignore */ }
  };

  const dangerCount = notifications.filter(n => n.severity === 'danger').length;
  const warningCount = notifications.filter(n => n.severity === 'warning').length;
  const infoCount = notifications.filter(n => n.severity === 'info').length;
  const totalCount = notifications.length;

  const severityIcon: Record<string, JSX.Element> = {
    danger: <AlertTriangle className="w-4 h-4 text-destructive" />,
    warning: <Clock className="w-4 h-4 text-amber-500" />,
    info: <Thermometer className="w-4 h-4 text-primary" />,
  };

  const badgeColor = dangerCount > 0 ? 'bg-destructive' : warningCount > 0 ? 'bg-amber-500' : 'bg-primary';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="w-5 h-5" />
          {totalCount > 0 && (
            <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${badgeColor}`}>
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifiche</h4>
          {totalCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {dangerCount > 0 && <span className="text-destructive font-medium">{dangerCount} scadut{dangerCount === 1 ? 'o' : 'i'}</span>}
              {dangerCount > 0 && (warningCount > 0 || infoCount > 0) && ' · '}
              {warningCount > 0 && <span className="text-amber-500 font-medium">{warningCount} in scadenza</span>}
              {warningCount > 0 && infoCount > 0 && ' · '}
              {infoCount > 0 && <span className="text-primary font-medium">{infoCount} promemoria</span>}
            </p>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              ✅ Nessuna notifica
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`p-3 border-b border-border last:border-0 ${
                n.severity === 'danger' ? 'bg-destructive/5' : 
                n.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-950/10' : 
                'bg-primary/5'
              }`}>
                <div className="flex items-start gap-2">
                  {severityIcon[n.severity]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
