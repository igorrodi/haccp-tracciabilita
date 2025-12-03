import { useState, useEffect, useCallback } from 'react';
import { pb, currentUser } from '@/lib/pocketbase';
import { useToast } from '@/hooks/use-toast';

// Generic hook for PocketBase collections
export function useCollection<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const records = await pb.collection(collectionName).getFullList<T>({
        sort: '-created',
      });
      setData(records);
    } catch (err: any) {
      const message = err.message || 'Errore nel caricamento dati';
      setError(message);
      // Don't show toast for 404 (collection doesn't exist yet)
      if (err.status !== 404) {
        toast({
          title: 'Errore',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [collectionName, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const create = async (record: Partial<T>) => {
    try {
      const user = currentUser();
      const newRecord = await pb.collection(collectionName).create({
        ...record,
        user_id: user?.id,
      });
      setData(prev => [newRecord as T, ...prev]);
      toast({ title: 'Successo', description: 'Record creato' });
      return { data: newRecord, error: null };
    } catch (err: any) {
      const message = err.message || 'Errore nella creazione';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
      return { data: null, error: message };
    }
  };

  const update = async (id: string, record: Partial<T>) => {
    try {
      const updatedRecord = await pb.collection(collectionName).update(id, record);
      setData(prev => prev.map(item => 
        (item as any).id === id ? updatedRecord as T : item
      ));
      toast({ title: 'Successo', description: 'Record aggiornato' });
      return { data: updatedRecord, error: null };
    } catch (err: any) {
      const message = err.message || 'Errore nell\'aggiornamento';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
      return { data: null, error: message };
    }
  };

  const remove = async (id: string) => {
    try {
      await pb.collection(collectionName).delete(id);
      setData(prev => prev.filter(item => (item as any).id !== id));
      toast({ title: 'Successo', description: 'Record eliminato' });
      return { error: null };
    } catch (err: any) {
      const message = err.message || 'Errore nell\'eliminazione';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
      return { error: message };
    }
  };

  return { data, loading, error, refetch: fetchData, create, update, remove };
}

// Types for collections
export interface PBProduct {
  id: string;
  name: string;
  shelf_life_days?: number;
  ingredients?: string;
  preparation_procedure?: string;
  user_id: string;
  created: string;
  updated: string;
}

export interface PBLot {
  id: string;
  lot_number: string;
  internal_lot_number?: string;
  product_id?: string;
  production_date: string;
  expiry_date?: string;
  freezing_date?: string;
  reception_date?: string;
  supplier_id?: string;
  is_frozen?: boolean;
  status?: string;
  notes?: string;
  user_id: string;
  created: string;
  updated: string;
}

export interface PBSupplier {
  id: string;
  name: string;
  contact_info?: string;
  notes?: string;
  user_id: string;
  created: string;
  updated: string;
}

// Specific hooks
export const useProducts = () => useCollection<PBProduct>('products');
export const useLots = () => useCollection<PBLot>('lots');
export const useSuppliers = () => useCollection<PBSupplier>('suppliers');
