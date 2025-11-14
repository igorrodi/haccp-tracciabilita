import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Package, Search, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Lot {
  id: string;
  lot_number: string;
  internal_lot_number?: string;
  production_date: string;
  expiry_date?: string;
  is_frozen?: boolean;
  category_id: string;
  supplier_id?: string;
  reception_date?: string;
  created_at: string;
  user_id: string;
}

interface Profile {
  user_id: string;
  full_name?: string;
  email?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

export const RecentLotsList = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
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

      // Fetch suppliers for these lots
      const supplierIds = [...new Set(lotsData?.map(lot => lot.supplier_id).filter(Boolean))];
      if (supplierIds.length > 0) {
        const { data: suppliersData } = await supabase
          .from('suppliers')
          .select('id, name')
          .in('id', supplierIds);

        const suppliersMap: Record<string, string> = {};
        suppliersData?.forEach((sup: Supplier) => {
          suppliersMap[sup.id] = sup.name;
        });
        setSuppliers(suppliersMap);
      }

      // Fetch user profiles for these lots
      const userIds = [...new Set(lotsData?.map(lot => lot.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        const profilesMap: Record<string, Profile> = {};
        profilesData?.forEach((profile: Profile) => {
          profilesMap[profile.user_id] = profile;
        });
        setProfiles(profilesMap);
      }
    } catch (error) {
      toast.error('Errore nel caricamento dei lotti');
    } finally {
      setLoading(false);
    }
  };

  const copyLotInfo = (lot: Lot) => {
    const categoryName = categories[lot.category_id] || 'Prodotto sconosciuto';
    const productionDate = format(new Date(lot.production_date), 'dd/MM/yyyy');
    const expiryDate = lot.expiry_date ? format(new Date(lot.expiry_date), 'dd/MM/yyyy') : 'N/A';
    const internalLot = lot.internal_lot_number || 'N/A';
    
    const textToCopy = `${categoryName}
Prod: ${productionDate}
Scad: ${expiryDate}
Lotto org: ${lot.lot_number}
Lotto int: ${internalLot}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success('Informazioni copiate negli appunti');
    }).catch(() => {
      toast.error('Errore nella copia');
    });
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
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      {categories[lot.category_id] || 'Prodotto sconosciuto'}
                    </CardTitle>
                    {profiles[lot.user_id] && (
                      <div 
                        className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary"
                        title={profiles[lot.user_id].full_name || profiles[lot.user_id].email}
                      >
                        {(profiles[lot.user_id].full_name || profiles[lot.user_id].email || 'U')
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                          .substring(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLotInfo(lot)}
                      title="Copia informazioni lotto"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(lot.production_date), 'dd/MM/yyyy')}
                    </Badge>
                  </div>
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
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {lot.expiry_date && (
                    <div>
                      <span className="text-muted-foreground">Scadenza: </span>
                      <span className="font-medium">
                        {format(new Date(lot.expiry_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                  {lot.supplier_id && suppliers[lot.supplier_id] && (
                    <div>
                      <span className="text-muted-foreground">Fornitore: </span>
                      <span className="font-medium">{suppliers[lot.supplier_id]}</span>
                    </div>
                  )}
                  {lot.reception_date && (
                    <div>
                      <span className="text-muted-foreground">Ricezione: </span>
                      <span className="font-medium">
                        {format(new Date(lot.reception_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
