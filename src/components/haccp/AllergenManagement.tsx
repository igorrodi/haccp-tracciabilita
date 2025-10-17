import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

interface Allergen {
  id: string;
  number: number;
  category_name: string;
  official_ingredients: string;
  common_examples: string;
}

export const AllergenManagement = () => {
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAllergens();
  }, []);

  const fetchAllergens = async () => {
    try {
      const { data, error } = await supabase
        .from('allergens')
        .select('*')
        .order('number');

      if (error) {
        toast.error('Errore nel caricamento degli allergeni');
      } else {
        setAllergens(data || []);
      }
    } catch (error) {
      toast.error('Errore nel caricamento degli allergeni');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      
      const newAllergens = dataLines.map(line => {
        const parts = line.split(';');
        return {
          number: parseInt(parts[0]),
          category_name: parts[1] || '',
          official_ingredients: parts[2] || '',
          common_examples: parts[3] || ''
        };
      }).filter(a => !isNaN(a.number));

      // Delete existing allergens
      const { error: deleteError } = await supabase
        .from('allergens')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      // Insert new allergens
      const { error: insertError } = await supabase
        .from('allergens')
        .insert(newAllergens);

      if (insertError) throw insertError;

      toast.success(`${newAllergens.length} allergeni caricati con successo`);
      fetchAllergens();
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast.error('Errore durante il caricamento del file CSV');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Gestione Allergeni
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button
                  variant="default"
                  disabled={uploading}
                  asChild
                >
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Caricamento...' : 'Carica CSV'}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p>Formato CSV richiesto: Numero;Nome Categoria Allergeni;Ingredienti Ufficiali;Esempi Comuni</p>
            <p className="mt-1">Il caricamento di un nuovo file sostituirà completamente la tabella esistente.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Allergeni Attualmente Configurati ({allergens.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          ) : allergens.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun allergene configurato</p>
              <p className="text-sm mt-2">Carica un file CSV per iniziare</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">N°</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Ingredienti Ufficiali</TableHead>
                    <TableHead>Esempi Comuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allergens.map((allergen) => (
                    <TableRow key={allergen.id}>
                      <TableCell className="font-medium">{allergen.number}</TableCell>
                      <TableCell className="font-medium">{allergen.category_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {allergen.official_ingredients || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {allergen.common_examples || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
