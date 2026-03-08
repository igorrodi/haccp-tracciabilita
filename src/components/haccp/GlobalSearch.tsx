import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { pb } from '@/lib/pocketbase';
import { Search, Package, Hash, Truck, X } from 'lucide-react';

interface SearchResult {
  type: 'product' | 'lot' | 'supplier';
  id: string;
  title: string;
  subtitle?: string;
}

interface GlobalSearchProps {
  onSelectProduct?: (productId: string) => void;
}

export const GlobalSearch = ({ onSelectProduct }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const [products, lots, suppliers] = await Promise.all([
        pb.collection('products').getList(1, 5, { filter: `name ~ "${q}"` }).catch(() => ({ items: [] })),
        pb.collection('lots').getList(1, 5, { filter: `lot_number ~ "${q}" || internal_lot_number ~ "${q}"` }).catch(() => ({ items: [] })),
        pb.collection('suppliers').getList(1, 5, { filter: `name ~ "${q}"` }).catch(() => ({ items: [] })),
      ]);

      const r: SearchResult[] = [
        ...products.items.map((p: any) => ({ type: 'product' as const, id: p.id, title: p.name, subtitle: `${p.shelf_life_days || '—'}g shelf life` })),
        ...lots.items.map((l: any) => ({ type: 'lot' as const, id: l.id, title: l.lot_number, subtitle: l.internal_lot_number || '' })),
        ...suppliers.items.map((s: any) => ({ type: 'supplier' as const, id: s.id, title: s.name, subtitle: s.contact_info || '' })),
      ];
      setResults(r);
      setOpen(r.length > 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const iconMap = { product: Package, lot: Hash, supplier: Truck };
  const labelMap = { product: 'Prodotto', lot: 'Lotto', supplier: 'Fornitore' };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca prodotti, lotti, fornitori..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-9 pr-8"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <Card className="absolute top-full mt-1 w-full z-50 shadow-lg">
          <CardContent className="p-1">
            {results.map(r => {
              const Icon = iconMap[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors text-left"
                  onClick={() => {
                    if (r.type === 'product' && onSelectProduct) onSelectProduct(r.id);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">{labelMap[r.type]}</Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
      {open && loading && (
        <Card className="absolute top-full mt-1 w-full z-50">
          <CardContent className="p-3 text-center text-sm text-muted-foreground">Ricerca...</CardContent>
        </Card>
      )}
    </div>
  );
};
