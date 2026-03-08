import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pb, currentUser } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { Thermometer, Plus, TrendingUp, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTemperatureLocations } from './TemperatureLocationsSettings';

interface TempLog {
  id: string;
  location: string;
  temperature: number;
  notes?: string;
  user_id: string;
  created: string;
}

export const TemperatureLog = () => {
  const [logs, setLogs] = useState<TempLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [location, setLocation] = useState('');
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');
  const [filterLocation, setFilterLocation] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await pb.collection('temperature_logs').getFullList<TempLog>({
        sort: '-created',
      });
      setLogs(data);
    } catch (err) {
      console.error('Error fetching temperature logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = currentUser();
    if (!user || !location || !temperature) return;

    try {
      await pb.collection('temperature_logs').create({
        location,
        temperature: parseFloat(temperature),
        notes: notes || undefined,
        user_id: user.id,
      });
      toast.success('Temperatura registrata');
      setShowForm(false);
      setTemperature('');
      setNotes('');
      fetchLogs();
    } catch {
      toast.error('Errore nel salvataggio');
    }
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      const now = new Date();

      // Title
      doc.setFontSize(18);
      doc.text('Registro Temperature HACCP', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generato il ${format(now, 'dd/MM/yyyy HH:mm', { locale: it })}`, 14, 28);
      if (filterLocation !== 'all') {
        doc.text(`Filtro: ${filterLocation}`, 14, 34);
      }

      // Table
      const tableData = filteredLogs.map(log => [
        format(new Date(log.created), 'dd/MM/yyyy', { locale: it }),
        format(new Date(log.created), 'HH:mm', { locale: it }),
        log.location,
        `${log.temperature}°C`,
        isAnomalous(log.temperature, log.location) ? '⚠ ANOMALA' : 'OK',
        log.notes || '',
      ]);

      autoTable(doc, {
        startY: filterLocation !== 'all' ? 40 : 34,
        head: [['Data', 'Ora', 'Posizione', 'Temp.', 'Stato', 'Note']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 163, 74] },
        didParseCell: (data: any) => {
          if (data.column.index === 4 && data.cell.raw === '⚠ ANOMALA') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`HACCP Tracker - Pagina ${i}/${pageCount}`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`temperature_${format(now, 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF esportato con successo');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Errore nell\'esportazione PDF');
    }
  };

  const locations = [...new Set(logs.map(l => l.location))];
  const filteredLogs = filterLocation === 'all' ? logs : logs.filter(l => l.location === filterLocation);

  const chartData = filteredLogs
    .slice(0, 30)
    .reverse()
    .map(l => ({
      time: format(new Date(l.created), 'dd/MM HH:mm', { locale: it }),
      temp: l.temperature,
      location: l.location,
    }));

  const isAnomalous = (temp: number, loc: string) => {
    if (loc.toLowerCase().includes('freezer') || loc.toLowerCase().includes('cella')) return temp > -15;
    if (loc.toLowerCase().includes('frigo')) return temp > 8 || temp < 0;
    return temp > 30;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Registro Temperature</h3>
        </div>
        <div className="flex items-center gap-2">
          {filteredLogs.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4 mr-1" />
              Esporta PDF
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" />
            Registra
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Posizione</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Temperatura (°C)</Label>
                  <Input type="number" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="es: 4.5" />
                </div>
              </div>
              <div>
                <Label>Note (opzionale)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note aggiuntive..." />
              </div>
              <Button type="submit" className="w-full">Salva temperatura</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Label className="text-sm">Filtra:</Label>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le posizioni</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trend Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} unit="°C" className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value}°C`, 'Temperatura']}
                />
                <ReferenceLine y={8} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Max Frigo', fontSize: 10 }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="temp" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ultime rilevazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna rilevazione registrata</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {filteredLogs.slice(0, 20).map(log => (
                <div key={log.id} className={`flex items-center justify-between p-2 rounded text-sm ${isAnomalous(log.temperature, log.location) ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'}`}>
                  <div className="flex items-center gap-2">
                    <Thermometer className={`w-3.5 h-3.5 ${isAnomalous(log.temperature, log.location) ? 'text-destructive' : 'text-primary'}`} />
                    <span className="font-medium">{log.location}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold ${isAnomalous(log.temperature, log.location) ? 'text-destructive' : ''}`}>
                      {log.temperature}°C
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created), 'dd/MM HH:mm', { locale: it })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
