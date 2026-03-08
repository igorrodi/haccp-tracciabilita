import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useSeasons } from '@/hooks/useSeasons';
import { pb } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, Archive, Plus, Loader2, FolderOpen, FolderArchive, ChevronDown, ChevronUp } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const SeasonManager = () => {
  const { seasons, activeSeason, loading, createSeason, archiveSeason, refetch } = useSeasons();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null);
  const [archiveStats, setArchiveStats] = useState<Record<string, { lots: number; temps: number }>>({});

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const season = await createSeason(newName.trim(), newNotes.trim());
    if (season) {
      toast.success(`Stagione "${newName}" creata e attivata`);
      setNewName('');
      setNewNotes('');
      setShowCreate(false);
    } else {
      toast.error('Errore nella creazione della stagione');
    }
    setCreating(false);
  };

  const handleArchive = async () => {
    if (!activeSeason) return;
    setArchiving(true);

    try {
      // Tag all untagged lots and temperature_logs with the active season
      const [untaggedLots, untaggedTemps] = await Promise.all([
        pb.collection('lots').getFullList({ filter: `season_id = "" || season_id = null` }).catch(() => []),
        pb.collection('temperature_logs').getFullList({ filter: `season_id = "" || season_id = null` }).catch(() => []),
      ]);

      // Batch update lots
      for (const lot of untaggedLots) {
        await pb.collection('lots').update(lot.id, { season_id: activeSeason.id });
      }

      // Batch update temperature logs
      for (const temp of untaggedTemps) {
        await pb.collection('temperature_logs').update(temp.id, { season_id: activeSeason.id });
      }

      const success = await archiveSeason(activeSeason.id);
      if (success) {
        toast.success(`Stagione "${activeSeason.name}" archiviata con ${untaggedLots.length} lotti e ${untaggedTemps.length} rilevazioni temperature`);
      }
    } catch (err) {
      console.error('Archive error:', err);
      toast.error("Errore durante l'archiviazione");
    }

    setArchiving(false);
  };

  const loadArchiveStats = async (seasonId: string) => {
    if (archiveStats[seasonId]) {
      setExpandedArchive(expandedArchive === seasonId ? null : seasonId);
      return;
    }

    try {
      const [lots, temps] = await Promise.all([
        pb.collection('lots').getList(1, 1, { filter: `season_id = "${seasonId}"` }).catch(() => ({ totalItems: 0 })),
        pb.collection('temperature_logs').getList(1, 1, { filter: `season_id = "${seasonId}"` }).catch(() => ({ totalItems: 0 })),
      ]);

      setArchiveStats(prev => ({
        ...prev,
        [seasonId]: { lots: lots.totalItems, temps: temps.totalItems },
      }));
      setExpandedArchive(seasonId);
    } catch {
      toast.error('Errore nel caricamento statistiche');
    }
  };

  const archivedSeasons = seasons.filter(s => s.status === 'archived');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Season */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-primary" />
            Stagione Lavorativa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSeason ? (
            <div className="space-y-3">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-lg">{activeSeason.name}</h3>
                      <Badge className="bg-primary/20 text-primary border-0">Attiva</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Iniziata il {format(new Date(activeSeason.start_date), 'dd MMMM yyyy', { locale: it })}
                    </p>
                    {activeSeason.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{activeSeason.notes}</p>
                    )}
                  </div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={archiving}>
                    {archiving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Archive className="w-4 h-4 mr-2" />
                    )}
                    Archivia Stagione e Inizia Nuova
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archivia "{activeSeason.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tutti i lotti e le temperature registrati finora verranno associati a questa stagione e archiviati.
                      Potrai sempre consultarli dall'archivio. Dopo l'archiviazione potrai creare una nuova stagione.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive}>Archivia</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Nessuna stagione attiva. Crea una nuova stagione per iniziare a organizzare i tuoi dati.
                </p>
              </div>

              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuova Stagione
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuova Stagione Lavorativa</DialogTitle>
                    <DialogDescription>
                      Crea una nuova stagione per organizzare lotti e temperature.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome Stagione *</Label>
                      <Input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Es: Estate 2026, Stagione Invernale 2026..."
                      />
                    </div>
                    <div>
                      <Label>Note (opzionale)</Label>
                      <Textarea
                        value={newNotes}
                        onChange={e => setNewNotes(e.target.value)}
                        placeholder="Note sulla stagione..."
                        rows={2}
                      />
                    </div>
                    <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full">
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Crea Stagione
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived Seasons */}
      {archivedSeasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderArchive className="w-5 h-5" />
              Archivio Stagioni ({archivedSeasons.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archivedSeasons.map(season => (
              <div key={season.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => loadArchiveStats(season.id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <FolderArchive className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{season.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(season.start_date), 'dd/MM/yyyy', { locale: it })}
                        {season.end_date && ` — ${format(new Date(season.end_date), 'dd/MM/yyyy', { locale: it })}`}
                      </p>
                    </div>
                  </div>
                  {expandedArchive === season.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {expandedArchive === season.id && archiveStats[season.id] && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-lg font-bold">{archiveStats[season.id].lots}</p>
                        <p className="text-xs text-muted-foreground">Lotti</p>
                      </div>
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-lg font-bold">{archiveStats[season.id].temps}</p>
                        <p className="text-xs text-muted-foreground">Temperature</p>
                      </div>
                    </div>
                    {season.notes && (
                      <p className="text-xs text-muted-foreground">{season.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
