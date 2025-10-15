import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Trash2, Plus, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Supplier {
  id: string;
  name: string;
  contact_info: string | null;
  notes: string | null;
}

export const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_info: '',
    notes: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      toast.error('Errore nel caricamento fornitori');
      return;
    }

    setSuppliers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingSupplier) {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: formData.name,
          contact_info: formData.contact_info || null,
          notes: formData.notes || null,
        })
        .eq('id', editingSupplier.id);

      if (error) {
        toast.error('Errore nell\'aggiornamento del fornitore');
        return;
      }

      toast.success('Fornitore aggiornato');
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          user_id: user.id,
          name: formData.name,
          contact_info: formData.contact_info || null,
          notes: formData.notes || null,
        });

      if (error) {
        toast.error('Errore nella creazione del fornitore');
        return;
      }

      toast.success('Fornitore creato');
    }

    setFormData({ name: '', contact_info: '', notes: '' });
    setEditingSupplier(null);
    setIsDialogOpen(false);
    fetchSuppliers();
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_info: supplier.contact_info || '',
      notes: supplier.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo fornitore?')) return;

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Errore nell\'eliminazione del fornitore');
      return;
    }

    toast.success('Fornitore eliminato');
    fetchSuppliers();
  };

  const openNewDialog = () => {
    setEditingSupplier(null);
    setFormData({ name: '', contact_info: '', notes: '' });
    setIsDialogOpen(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Gestione Fornitori</h3>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Fornitore
        </Button>
      </div>

      <div className="space-y-2">
        {suppliers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nessun fornitore registrato</p>
        ) : (
          suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div>
                <p className="font-medium">{supplier.name}</p>
                {supplier.contact_info && (
                  <p className="text-sm text-muted-foreground">{supplier.contact_info}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(supplier)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(supplier.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Fornitore *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="contact_info">Informazioni di Contatto</Label>
              <Input
                id="contact_info"
                value={formData.contact_info}
                onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                placeholder="Email, telefono, etc."
              />
            </div>

            <div>
              <Label htmlFor="notes">Note</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Note aggiuntive sul fornitore"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Annulla
              </Button>
              <Button type="submit">
                {editingSupplier ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
