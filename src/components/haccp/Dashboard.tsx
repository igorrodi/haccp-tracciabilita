import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { pb, currentUser } from '@/lib/pocketbase';
import { differenceInDays, format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertTriangle, Package, TrendingUp, Clock, Snowflake, CheckCircle } from 'lucide-react';

interface LotWithProduct {
  id: string;
  lot_number: string;
  internal_lot_number?: string;
  product_id?: string;
  production_date: string;
  expiry_date?: string;
  is_frozen?: boolean;
  product_name?: string;
}

export const Dashboard = () => {
  const [expiringLots, setExpiringLots] = useState<LotWithProduct[]>([]);
  const [expiredLots, setExpiredLots] = useState<LotWithProduct[]>([]);
  const [stats, setStats] = useState({ totalLots: 0, totalProducts: 0, frozenLots: 0, lotsThisWeek: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const user = currentUser();
      if (!user) return;

      const [lots, products] = await Promise.all([
        pb.collection('lots').getFullList<any>({ sort: '-created' }),
        pb.collection('products').getFullList<any>(),
      ]);

      const productMap: Record<string, string> = {};
      products.forEach((p: any) => { productMap[p.id] = p.name; });

      const now = new Date();
      const in3Days = addDays(now, 3);
      const weekAgo = addDays(now, -7);

      const enrichedLots = lots.map(lot => ({
        ...lot,
        product_name: productMap[lot.product_id] || 'N/D',
      }));

      const expiring = enrichedLots.filter(lot => {
        if (!lot.expiry_date) return false;
        const exp = new Date(lot.expiry_date);
        return exp > now && exp <= in3Days;
      }).sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());

      const expired = enrichedLots.filter(lot => {
        if (!lot.expiry_date) return false;
        return new Date(lot.expiry_date) <= now;
      }).sort((a, b) => new Date(b.expiry_date!).getTime() - new Date(a.expiry_date!).getTime());

      const lotsThisWeek = lots.filter(l => new Date(l.created) >= weekAgo).length;
      const frozenLots = lots.filter(l => l.is_frozen).length;

      setExpiringLots(expiring);
      setExpiredLots(expired.slice(0, 5));
      setStats({
        totalLots: lots.length,
        totalProducts: products.length,
        frozenLots,
        lotsThisWeek,
      });
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalProducts}</p>
              <p className="text-xs text-muted-foreground">Prodotti</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalLots}</p>
              <p className="text-xs text-muted-foreground">Lotti totali</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Snowflake className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.frozenLots}</p>
              <p className="text-xs text-muted-foreground">Congelati</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.lotsThisWeek}</p>
              <p className="text-xs text-muted-foreground">Questa settimana</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring soon alerts */}
      {(expiringLots.length > 0 || expiredLots.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiringLots.length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  In scadenza (entro 3 giorni)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiringLots.map(lot => (
                  <div key={lot.id} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                    <div>
                      <span className="font-medium">{lot.product_name}</span>
                      <span className="text-muted-foreground ml-2 font-mono">
                        ({lot.internal_lot_number || lot.lot_number})
                      </span>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                      {differenceInDays(new Date(lot.expiry_date!), new Date())}g
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {expiredLots.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Scaduti
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiredLots.map(lot => (
                  <div key={lot.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded text-sm">
                    <div>
                      <span className="font-medium">{lot.product_name}</span>
                      <span className="text-muted-foreground ml-2">({lot.lot_number})</span>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {format(new Date(lot.expiry_date!), 'dd/MM', { locale: it })}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {expiringLots.length === 0 && expiredLots.length === 0 && (
        <Card className="border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Nessun lotto in scadenza o scaduto</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
