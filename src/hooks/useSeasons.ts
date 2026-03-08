import { useState, useEffect, useCallback } from 'react';
import { pb, currentUser } from '@/lib/pocketbase';

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'archived';
  notes?: string;
  user_id: string;
  created: string;
}

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSeasons = useCallback(async () => {
    try {
      const data = await pb.collection('seasons').getFullList<Season>({ sort: '-created' });
      setSeasons(data);
      const active = data.find(s => s.status === 'active') || null;
      setActiveSeason(active);
    } catch {
      // Collection may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

  const createSeason = async (name: string, notes?: string) => {
    const user = currentUser();
    if (!user) return null;
    try {
      const newSeason = await pb.collection('seasons').create<Season>({
        name,
        start_date: new Date().toISOString(),
        status: 'active',
        notes: notes || '',
        user_id: user.id,
      });
      await fetchSeasons();
      return newSeason;
    } catch (err) {
      console.error('Error creating season:', err);
      return null;
    }
  };

  const archiveSeason = async (seasonId: string) => {
    try {
      await pb.collection('seasons').update(seasonId, {
        status: 'archived',
        end_date: new Date().toISOString(),
      });
      await fetchSeasons();
      return true;
    } catch (err) {
      console.error('Error archiving season:', err);
      return false;
    }
  };

  return { seasons, activeSeason, loading, createSeason, archiveSeason, refetch: fetchSeasons };
}
