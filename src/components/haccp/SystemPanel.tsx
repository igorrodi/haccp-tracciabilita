import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChangePassword } from './ChangePassword';
import { Suppliers } from './Suppliers';
import { UserManagement } from './UserManagement';
import { CloudBackupSettings } from './CloudBackupSettings';
import { DataExport } from './DataExport';
import { AllergenManagement } from './AllergenManagement';
import { PrinterSettings } from './PrinterSettings';
import { UpdatesBackupPanel } from './UpdatesBackupPanel';
import { TemperatureLocationsSettings } from './TemperatureLocationsSettings';
import { SeasonManager } from './SeasonManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Database, Settings, FileSpreadsheet, AlertTriangle, Truck, Users, Info, Printer, ArrowUpCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isAdmin } from '@/lib/pocketbase';
import { useAppVersion } from '@/hooks/useAppVersion';

export const SystemPanel = () => {
  const admin = isAdmin();
  const version = useAppVersion();

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
        <TabsList className="inline-flex w-full min-w-max md:grid md:w-full md:grid-cols-8 gap-1">
          <TabsTrigger value="suppliers" className="flex-shrink-0 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            Fornitori
          </TabsTrigger>
          {admin && <TabsTrigger value="users" className="flex-shrink-0 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Utenti
          </TabsTrigger>}
          <TabsTrigger value="allergens" className="flex-shrink-0 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Allergeni
          </TabsTrigger>
          <TabsTrigger value="seasons" className="flex-shrink-0 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Stagioni
          </TabsTrigger>
          <TabsTrigger value="data" className="flex-shrink-0 flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" />
            Dati & Cloud
          </TabsTrigger>
          <TabsTrigger value="printer" className="flex-shrink-0 flex items-center gap-1">
            <Printer className="w-3 h-3" />
            Stampante
          </TabsTrigger>
          <TabsTrigger value="updates" className="flex-shrink-0 flex items-center gap-1">
            <ArrowUpCircle className="w-3 h-3" />
            Aggiornamenti
          </TabsTrigger>
          <TabsTrigger value="info" className="flex-shrink-0 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Info
          </TabsTrigger>
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

      <TabsContent value="allergens">
        <AllergenManagement />
      </TabsContent>

      <TabsContent value="seasons">
        <SeasonManager />
      </TabsContent>

      {/* Unified Data & Cloud tab */}
      <TabsContent value="data">
        <div className="space-y-4">
          <DataExport />
          <CloudBackupSettings />
        </div>
      </TabsContent>

      <TabsContent value="printer">
        <div className="space-y-4">
          <PrinterSettings />
          <TemperatureLocationsSettings />
        </div>
      </TabsContent>

      <TabsContent value="updates">
        <UpdatesBackupPanel />
      </TabsContent>

      <TabsContent value="account">
        <ChangePassword />
      </TabsContent>

      <TabsContent value="info">
        <div className="space-y-4">
          {/* System Info */}
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
                  <p className="text-sm text-muted-foreground">
                    HACCP Tracker v{version?.app_version || '2.1.0'} - PocketBase Edition
                  </p>
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

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h4 className="font-medium text-primary mb-2">✅ Sistema Locale</h4>
                  <p className="text-sm text-muted-foreground">
                    Tutti i dati sono salvati localmente sul Raspberry Pi.
                    Nessuna dipendenza da servizi cloud esterni.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database - moved here from its own tab */}
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
                  {[
                    { name: 'products', desc: 'Prodotti/Categorie' },
                    { name: 'lots', desc: 'Lotti di produzione' },
                    { name: 'suppliers', desc: 'Fornitori' },
                    { name: 'allergens', desc: 'Allergeni' },
                    { name: 'lot_images', desc: 'Foto etichette lotti' },
                    { name: 'printer_settings', desc: 'Impostazioni stampante' },
                    { name: 'cloud_settings', desc: 'Configurazione cloud' },
                    { name: 'temperature_logs', desc: 'Log temperature' },
                    { name: 'reception_logs', desc: 'Log ricezione merci' },
                    { name: 'cleaning_logs', desc: 'Log pulizie' },
                  ].map(col => (
                    <li key={col.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full" />
                      <strong>{col.name}</strong> - {col.desc}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
};
