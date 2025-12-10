import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Suppliers } from './Suppliers';
import { UserManagement } from './UserManagement';
import { CloudBackupSettings } from './CloudBackupSettings';
import { DataExport } from './DataExport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Database, Settings, Cloud, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isAdmin } from '@/lib/pocketbase';

export const SystemPanel = () => {
  const admin = isAdmin();

  const openPocketBaseAdmin = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    let adminUrl = 'http://localhost:8090/_/';
    
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      if (protocol === 'https:') {
        adminUrl = `${protocol}//${hostname}/api/_/`;
      } else {
        adminUrl = `http://${hostname}:8090/_/`;
      }
    }
    
    window.open(adminUrl, '_blank');
  };

  return (
    <Tabs defaultValue="suppliers" className="w-full">
      <div className="w-full overflow-x-auto pb-2">
        <TabsList className="inline-flex w-full min-w-max md:grid md:w-full md:grid-cols-6 gap-1">
          <TabsTrigger value="suppliers" className="flex-shrink-0">Fornitori</TabsTrigger>
          {admin && <TabsTrigger value="users" className="flex-shrink-0">Utenti</TabsTrigger>}
          <TabsTrigger value="export" className="flex-shrink-0 flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" />
            Export
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex-shrink-0 flex items-center gap-1">
            <Cloud className="w-3 h-3" />
            Cloud
          </TabsTrigger>
          <TabsTrigger value="database" className="flex-shrink-0">Database</TabsTrigger>
          <TabsTrigger value="info" className="flex-shrink-0">Info</TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="suppliers">
        <Suppliers />
      </TabsContent>

      {admin && (
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      )}

      <TabsContent value="export">
        <DataExport />
      </TabsContent>

      <TabsContent value="backup">
        <CloudBackupSettings />
      </TabsContent>

      
      <TabsContent value="database">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Gestione Database
            </CardTitle>
            <CardDescription>
              Accedi al pannello admin di PocketBase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={openPocketBaseAdmin} className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Apri PocketBase Admin
            </Button>
            
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h4 className="font-medium">Collezioni disponibili:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>products</strong> - Prodotti/Categorie
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>lots</strong> - Lotti di produzione
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>suppliers</strong> - Fornitori
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>allergens</strong> - Allergeni
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>printer_settings</strong> - Impostazioni stampante
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="info">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Informazioni Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Versione</h4>
                <p className="text-sm text-muted-foreground">HACCP Tracker v2.0 - PocketBase Edition</p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Backend</h4>
                <p className="text-sm text-muted-foreground">PocketBase (SQLite) - Ottimizzato per Raspberry Pi</p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Comandi Utili</h4>
                <div className="space-y-2 font-mono text-xs">
                  <p className="p-2 bg-background rounded">haccp-status   # Stato sistema</p>
                  <p className="p-2 bg-background rounded">haccp-backup   # Backup manuale</p>
                  <p className="p-2 bg-background rounded">haccp-update   # Aggiorna app</p>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">✅ Sistema Locale</h4>
                <p className="text-sm text-green-700">
                  Tutti i dati sono salvati localmente sul Raspberry Pi.
                  Nessuna dipendenza da servizi cloud esterni.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
