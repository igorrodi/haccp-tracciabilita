import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Image as ImageIcon, Edit, Trash2, X, ListOrdered, QrCode, FileText, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { highlightAllergens } from '@/lib/allergens';
import { printLabel } from '@/lib/labelPrinter';

interface Product {
  id: string;
  name: string;
  ingredients?: string;
  preparation_procedure?: string;
  shelf_life_days?: number;
}

interface Lot {
  id: string;
  lot_number: string;
  production_date: string;
  expiry_date?: string;
  label_image_url?: string;
  internal_lot_number?: string;
  notes?: string;
  is_frozen?: boolean;
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

interface Supplier {
  id: string;
  name: string;
}

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
}

export const ProductDetails = ({ product, onBack }: ProductDetailsProps) => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedLotForQR, setSelectedLotForQR] = useState<Lot | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [highlightedIngredients, setHighlightedIngredients] = useState<Array<{ text: string; isAllergen: boolean }>>([]);
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<any>(null);

  useEffect(() => {
    fetchLots();
    checkAdminStatus();
    checkPrinterSettings();
    if (product.ingredients) {
      highlightAllergens(product.ingredients).then(setHighlightedIngredients);
    }
  }, [product.id, product.ingredients]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const checkPrinterSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPrinterEnabled(data.printer_enabled);
        setPrinterSettings(data);
      }
    } catch (error) {
      console.error('Error checking printer settings:', error);
    }
  };

  const fetchLots = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('haccp_lots')
        .select('*')
        .eq('category_id', product.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Errore nel caricamento dei lotti');
      } else {
        setLots(data || []);
        
        // Fetch suppliers for these lots
        const supplierIds = [...new Set(data?.map(lot => lot.supplier_id).filter(Boolean))];
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
        const userIds = [...new Set(data?.map(lot => lot.user_id).filter(Boolean))];
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
      }
    } catch (error) {
      toast.error('Errore nel caricamento dei lotti');
    } finally {
      setLoading(false);
    }
  };

  const handleViewImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };

  const handleViewQRCode = (lot: Lot) => {
    setSelectedLotForQR(lot);
    setQrDialogOpen(true);
  };

  const generateQRData = (lot: Lot) => {
    return JSON.stringify({
      prodotto: product.name,
      lotto_interno: lot.internal_lot_number,
      lotto_originale: lot.lot_number,
      produzione: lot.production_date,
      scadenza: lot.expiry_date || 'N/A',
      congelato: lot.is_frozen ? 'Sì' : 'No',
      data_congelamento: lot.is_frozen ? lot.production_date : 'N/A',
      note: lot.notes || 'N/A',
    });
  };

  const handleDeleteLot = async (id: string, lotNumber: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il lotto "${lotNumber}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('haccp_lots')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Errore durante l\'eliminazione');
      } else {
        toast.success('Lotto eliminato con successo');
        fetchLots();
      }
    } catch (error) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  const handlePrintLabel = async (lot: Lot) => {
    if (!printerSettings) {
      toast.error('Configurazione stampante non trovata');
      return;
    }

    try {
      await printLabel(
        {
          internal_lot_number: lot.internal_lot_number,
          lot_number: lot.lot_number,
          production_date: lot.production_date,
          expiry_date: lot.expiry_date,
          product_name: product.name,
        },
        printerSettings
      );
      toast.success('Etichetta inviata alla stampante');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Errore durante la stampa');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={onBack} className="mb-2">
              ← Torna ai prodotti
            </Button>
            <h3 className="text-2xl font-bold">{product.name}</h3>
          </div>
        </div>

        {product.ingredients && (
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ingredienti
              </h4>
              <div className="text-sm whitespace-pre-wrap">
                {highlightedIngredients.map((part, idx) => (
                  <span
                    key={idx}
                    className={part.isAllergen ? 'font-bold underline decoration-2 decoration-amber-500' : ''}
                  >
                    {part.text}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {product.preparation_procedure && (
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Procedimento di Preparazione</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {product.preparation_procedure}
              </p>
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <ListOrdered className="w-5 h-5" />
            <Badge variant="secondary">Totale: {lots.length}</Badge>
          </div>

          {loading ? (
            <Card>
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
          ) : lots.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>Nessun lotto registrato per questo prodotto</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etichetta</TableHead>
                      <TableHead>Utente</TableHead>
                      <TableHead>Lotto</TableHead>
                      <TableHead>Lotto originale</TableHead>
                      <TableHead>Produzione</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Congelamento</TableHead>
                      <TableHead>Fornitore</TableHead>
                      <TableHead>Ricezione</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          {lot.label_image_url ? (
                            <button
                              onClick={() => handleViewImage(lot.label_image_url!)}
                              className="w-12 h-12 rounded overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                            >
                              <img
                                src={lot.label_image_url}
                                alt="Etichetta"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {profiles[lot.user_id] ? (
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
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                              ?
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{lot.internal_lot_number || '—'}</TableCell>
                        <TableCell>{lot.lot_number}</TableCell>
                        <TableCell>{format(new Date(lot.production_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          {lot.expiry_date ? format(new Date(lot.expiry_date), 'dd/MM/yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          {lot.is_frozen ? format(new Date(lot.production_date), 'dd/MM/yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          {lot.supplier_id && suppliers[lot.supplier_id] ? suppliers[lot.supplier_id] : '—'}
                        </TableCell>
                        <TableCell>
                          {lot.reception_date ? format(new Date(lot.reception_date), 'dd/MM/yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewQRCode(lot)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            {printerEnabled && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintLabel(lot)}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLot(lot.id, lot.lot_number)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Etichetta Prodotto</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Etichetta ingrandita"
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code Prodotto</DialogTitle>
          </DialogHeader>
          {selectedLotForQR && (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-6 rounded-lg">
                <QRCodeSVG 
                  value={generateQRData(selectedLotForQR)} 
                  size={256}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="text-sm space-y-1 w-full">
                <p><strong>Prodotto:</strong> {product.name}</p>
                <p><strong>Lotto:</strong> {selectedLotForQR.internal_lot_number}</p>
                <p><strong>Lotto originale:</strong> {selectedLotForQR.lot_number}</p>
                <p><strong>Produzione:</strong> {format(new Date(selectedLotForQR.production_date), 'yyyy-MM-dd')}</p>
                {selectedLotForQR.expiry_date && (
                  <p><strong>Scadenza:</strong> {format(new Date(selectedLotForQR.expiry_date), 'yyyy-MM-dd')}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
