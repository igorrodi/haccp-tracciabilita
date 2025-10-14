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
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Ultimi Lotti Registrati</h3>
      </div>

      <div className="relative mb-4">
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
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
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
          ))}
        </div>
      ) : filteredLots.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? 'Nessun lotto trovato' : 'Nessun lotto registrato ancora'}</p>
              <p className="text-sm">Registra il primo lotto per iniziare</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredLots.map((lot) => (
            <Card 
              key={lot.id} 
              className="relative hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {categories[lot.category_id] || 'Prodotto sconosciuto'}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {format(new Date(lot.production_date), 'dd/MM/yyyy')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {lot.internal_lot_number && (
                    <Badge variant="outline" className="text-xs">
                      Lotto Interno: {lot.internal_lot_number}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Lotto Originale: {lot.lot_number}
                  </Badge>
                  {lot.is_frozen && (
                    <Badge className="text-xs bg-blue-500">
                      Congelato
                    </Badge>
                  )}
                </div>
                {lot.expiry_date && (
                  <div className="text-sm text-muted-foreground">
                    Scadenza: {format(new Date(lot.expiry_date), 'dd/MM/yyyy')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
