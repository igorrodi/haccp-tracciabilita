import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Package, Search } from 'lucide-react';

interface Lot {
  id: string;
  lot_number: string;
  internal_lot_number?: string;
  production_date: string;
  expiry_date?: string;
  is_frozen?: boolean;
  category_id: string;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

export const RecentLotsList = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRecentLots();
  }, []);

  const fetchRecentLots = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch last 5 lots
      const { data: lotsData, error: lotsError } = await supabase
        .from('haccp_lots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (lotsError) {
        toast.error('Errore nel caricamento dei lotti');
        return;
      }

      setLots(lotsData || []);

      // Fetch categories for these lots
      const categoryIds = [...new Set(lotsData?.map(lot => lot.category_id).filter(Boolean))];
      if (categoryIds.length > 0) {
        const { data: categoriesData } = await supabase
          .from('product_categories')
          .select('id, name')
          .in('id', categoryIds);

        const categoriesMap: Record<string, string> = {};
        categoriesData?.forEach((cat: Category) => {
          categoriesMap[cat.id] = cat.name;
        });
        setCategories(categoriesMap);
      }
    } catch (error) {
      toast.error('Errore nel caricamento dei lotti');
    } finally {
      setLoading(false);
    }
  };

  const filteredLots = lots.filter(lot => {
    const searchLower = searchQuery.toLowerCase();
    const internalLotMatch = lot.internal_lot_number?.toLowerCase().includes(searchLower);
    const originalLotMatch = lot.lot_number.toLowerCase().includes(searchLower);
    return internalLotMatch || originalLotMatch;
  });

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Prodotti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cerca per lotto interno o originale..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredLots.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {searchQuery ? 'Nessun lotto trovato' : 'Nessun lotto registrato ancora'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredLots.map((lot) => (
              <div
                key={lot.id}
                className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {categories[lot.category_id] || 'Prodotto sconosciuto'}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lot.internal_lot_number && (
                        <Badge variant="secondary" className="text-xs">
                          Lotto: {lot.internal_lot_number}
                        </Badge>
                      )}
                      {lot.is_frozen && (
                        <Badge variant="outline" className="text-xs">
                          Congelato
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    {format(new Date(lot.production_date), 'dd/MM/yyyy')}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Lotto originale: {lot.lot_number}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
