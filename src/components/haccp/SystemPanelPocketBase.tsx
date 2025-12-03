import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SuppliersPocketBase } from './SuppliersPocketBase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Database, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SystemPanelPocketBase = () => {
  const openPocketBaseAdmin = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    let adminUrl = 'http://localhost:8090/_/';
    
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      if (protocol === 'https:') {
        adminUrl = `${protocol}//${hostname}/_/`;
      } else {
        adminUrl = `http://${hostname}:8090/_/`;
      }
    }
    
    window.open(adminUrl, '_blank');
  };

  return (
    <Tabs defaultValue="suppliers" className="w-full">
      <div className="w-full overflow-x-auto pb-2">
        <TabsList className="inline-flex w-full min-w-max md:grid md:w-full md:grid-cols-3 gap-1">
          <TabsTrigger value="suppliers" className="flex-shrink-0">Fornitori</TabsTrigger>
          <TabsTrigger value="database" className="flex-shrink-0">Database</TabsTrigger>
          <TabsTrigger value="info" className="flex-shrink-0">Info</TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="suppliers">
        <SuppliersPocketBase />
      </TabsContent>
      
      <TabsContent value="database">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Gestione Database
            </CardTitle>
            <CardDescription>
              Accedi al pannello admin di PocketBase per gestire collezioni e dati
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={openPocketBaseAdmin} className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Apri PocketBase Admin
            </Button>
            
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h4 className="font-medium">Collezioni richieste:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>products</strong> - name, shelf_life_days, ingredients, preparation_procedure, user_id
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>lots</strong> - lot_number, product_id, production_date, expiry_date, is_frozen, freezing_date, supplier_id, notes, user_id
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <strong>suppliers</strong> - name, contact_info, notes, user_id
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
                <p className="text-sm text-muted-foreground">HACCP Tracker - PocketBase Edition</p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Backend</h4>
                <p className="text-sm text-muted-foreground">PocketBase (SQLite)</p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Comandi Utili</h4>
                <div className="space-y-2 font-mono text-xs">
                  <p className="p-2 bg-background rounded">haccp-status</p>
                  <p className="p-2 bg-background rounded">haccp-backup</p>
                  <p className="p-2 bg-background rounded">haccp-update</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
