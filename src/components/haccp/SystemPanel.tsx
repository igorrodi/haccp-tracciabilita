import { Settings, Database, Shield, Download, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserManagement } from "./UserManagement";

export const SystemPanel = () => {
  const { toast } = useToast();

  const handleExportData = () => {
    toast({
      title: "Esportazione dati",
      description: "Funzionalità disponibile quando Supabase sarà attivato",
    });
  };

  const handleImportData = () => {
    toast({
      title: "Importazione dati",
      description: "Funzionalità disponibile quando Supabase sarà attivato",
    });
  };

  return (
    <div className="space-y-6">
      {/* Gestione Utenti */}
      <UserManagement />

      {/* Stato Sistema */}
      <Card className="haccp-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Stato Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Lotti registrati</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <Settings className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">6</div>
              <div className="text-sm text-muted-foreground">Categorie prodotti</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <Shield className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-bold text-green-600">ATTIVO</div>
              <div className="text-sm text-muted-foreground">Sistema HACCP</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurazioni */}
      <Card className="haccp-card">
        <CardHeader>
          <CardTitle>Configurazioni</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
              <h3 className="font-medium">Database Supabase</h3>
              <p className="text-sm text-muted-foreground">
                Sistema di storage per lotti e immagini
              </p>
            </div>
            <Badge variant="secondary">Non configurato</Badge>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
              <h3 className="font-medium">OCR Engine</h3>
              <p className="text-sm text-muted-foreground">
                Estrazione automatica testi dalle etichette
              </p>
            </div>
            <Badge variant="secondary">Non configurato</Badge>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
              <h3 className="font-medium">Backup automatico</h3>
              <p className="text-sm text-muted-foreground">
                Salvataggio automatico dei dati
              </p>
            </div>
            <Badge variant="secondary">Disabilitato</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Gestione Dati */}
      <Card className="haccp-card">
        <CardHeader>
          <CardTitle>Gestione Dati</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              onClick={handleExportData}
              variant="outline" 
              className="flex items-center gap-2 rounded-xl"
            >
              <Download className="w-4 h-4" />
              Esporta dati
            </Button>
            
            <Button 
              onClick={handleImportData}
              variant="outline" 
              className="flex items-center gap-2 rounded-xl"
            >
              <Upload className="w-4 h-4" />
              Importa dati
            </Button>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <h4 className="font-medium text-yellow-800 mb-2">⚠️ Configurazione richiesta</h4>
            <p className="text-sm text-yellow-700">
              Per utilizzare tutte le funzionalità (salvataggio dati, OCR, backup), 
              è necessario attivare l'integrazione Supabase cliccando sul pulsante verde 
              in alto a destra nell'interfaccia.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};