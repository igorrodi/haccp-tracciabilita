import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { pb, currentUser, isAdmin as checkIsAdmin } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, ListOrdered, QrCode, FileText, Printer, ArrowLeft, Copy } from 'lucide-react';
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
  freezing_date?: string;
  supplier_id?: string;
  reception_date?: string;
  created: string;
  user_id: string;
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
  const [users, setUsers] = useState<Record<string, any>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<any>(null);

  useEffect(() => {
    fetchLots();
    setIsAdmin(checkIsAdmin());
    checkPrinterSettings();
    if (product.ingredients) {
      highlightAllergens(product.ingredients).then(setHighlightedIngredients);
    }
  }, [product.id, product.ingredients]);

  const checkPrinterSettings = async () => {
    try {
      const user = currentUser();
      if (!user) return;

      const data = await pb.collection('printer_settings').getFirstListItem(
        `user_id = "${user.id}"`,
        { requestKey: null }
      ).catch(() => null);

      if (data) {
        setPrinterEnabled((data as any).printer_enabled);
        setPrinterSettings(data);
      }
    } catch (error) {
      console.error('Error checking printer settings:', error);
    }
  };

  const fetchLots = async () => {
    try {
      const user = currentUser();
      if (!user) return;

      const data = await pb.collection('lots').getFullList<Lot>({
        filter: `product_id = "${product.id}"`,
        sort: '-created',
      });

      setLots(data || []);
      
      // Fetch suppliers for these lots
      const supplierIds = [...new Set(data?.map(lot => lot.supplier_id).filter(Boolean))];
      if (supplierIds.length > 0) {
        const suppliersData = await pb.collection('suppliers').getFullList<Supplier>({
          filter: supplierIds.map(id => `id = "${id}"`).join(' || '),
        });

        const suppliersMap: Record<string, string> = {};
        suppliersData?.forEach((sup) => {
          suppliersMap[sup.id] = sup.name;
        });
        setSuppliers(suppliersMap);
      }

      // Fetch user info for these lots
      const userIds = [...new Set(data?.map(lot => lot.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const usersMap: Record<string, any> = {};
        for (const userId of userIds) {
          try {
            const userData = await pb.collection('users').getOne(userId);
            usersMap[userId] = userData;
          } catch (e) {
            // User might not exist
          }
        }
        setUsers(usersMap);
      }
    } catch (error) {
      console.error('Error fetching lots:', error);
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
      await pb.collection('lots').delete(id);
      toast.success('Lotto eliminato con successo');
      fetchLots();
    } catch (error) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  const copyLotInfo = (lot: Lot) => {
    const productionDate = format(new Date(lot.production_date), 'dd/MM/yyyy');
    const expiryDate = lot.expiry_date ? format(new Date(lot.expiry_date), 'dd/MM/yyyy') : 'N/A';
    const internalLot = lot.internal_lot_number || 'N/A';
    
    const textToCopy = `${product.name}
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
          is_frozen: lot.is_frozen,
          freezing_date: lot.freezing_date,
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
          <div className="w-full">
            <Button 
              variant="outline" 
              onClick={onBack} 
              className="mb-4 group hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
              Torna ai prodotti
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
                          {users[lot.user_id] ? (
                            <div 
                              className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary"
                              title={users[lot.user_id].name || users[lot.user_id].email}
                            >
                              {(users[lot.user_id].name || users[lot.user_id].email || 'U')
                                .split(' ')
                                .map((n: string) => n[0])
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
                              size="icon"
                              onClick={() => copyLotInfo(lot)}
                              title="Copia informazioni lotto"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
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
                  level="M"
                  includeMargin={true}
                />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  Lotto: {selectedLotForQR.internal_lot_number || selectedLotForQR.lot_number}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};