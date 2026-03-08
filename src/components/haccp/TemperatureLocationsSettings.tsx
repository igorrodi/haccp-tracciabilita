import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pb, currentUser } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { Thermometer, Plus, Trash2, Save } from 'lucide-react';

const DEFAULT_LOCATIONS = [
  'Frigo 1', 'Frigo 2', 'Frigo 3',
  'Freezer 1', 'Freezer 2',
  'Ambiente', 'Cella frigorifera',
];

export const useTemperatureLocations = () => {
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const user = currentUser();
      if (!user) { setLoading(false); return; }
      const record = await pb.collection('app_settings').getFirstListItem(
        `key = "temperature_locations"`,
        { requestKey: null }
      ).catch(() => null);
      if (record && (record as any).value) {
        const parsed = JSON.parse((record as any).value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocations(parsed);
        }
      }
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  };

  return { locations, loading, reload: loadLocations };
};

export const TemperatureLocationsSettings = () => {
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [newLocation, setNewLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const record = await pb.collection('app_settings').getFirstListItem(
        `key = "temperature_locations"`,
        { requestKey: null }
      ).catch(() => null);
      if (record) {
        setSettingsId(record.id);
        const parsed = JSON.parse((record as any).value);
        if (Array.isArray(parsed)) setLocations(parsed);
      }
    } catch { /* use defaults */ }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = currentUser();
      if (!user) return;
      const data = { key: 'temperature_locations', value: JSON.stringify(locations), user_id: user.id };
      if (settingsId) {
        await pb.collection('app_settings').update(settingsId, data);
      } else {
        const record = await pb.collection('app_settings').create(data);
        setSettingsId(record.id);
      }
      toast.success('Posizioni salvate');
    } catch {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const addLocation = () => {
    const name = newLocation.trim();
    if (!name || locations.includes(name)) return;
    setLocations(prev => [...prev, name]);
    setNewLocation('');
  };

  const removeLocation = (index: number) => {
    setLocations(prev => prev.filter((_, i) => i !== index));
  };

  const updateLocation = (index: number, value: string) => {
    setLocations(prev => prev.map((loc, i) => i === index ? value : loc));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Thermometer className="w-4 h-4" />
          Posizioni Temperature
        </CardTitle>
        <CardDescription>
          Personalizza i nomi dei frigoriferi, freezer e altre posizioni per il registro temperature
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {locations.map((loc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={loc}
                onChange={e => updateLocation(i, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeLocation(i)}
                disabled={locations.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Nuova posizione..."
            value={newLocation}
            onChange={e => setNewLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={addLocation} disabled={!newLocation.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            Aggiungi
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Salvataggio...' : 'Salva posizioni'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Le modifiche saranno visibili nella tab Temperature dopo il salvataggio.
        </p>
      </CardContent>
    </Card>
  );
};
