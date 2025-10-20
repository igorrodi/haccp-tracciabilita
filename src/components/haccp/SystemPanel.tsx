import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupplierManagement } from './SupplierManagement';
import { UserManagement } from './UserManagement';
import { AllergenManagement } from './AllergenManagement';
import { DataExport } from './DataExport';
import { PrinterSettings } from './PrinterSettings';

export const SystemPanel = () => {
  return (
    <Tabs defaultValue="suppliers" className="w-full">
      <div className="w-full overflow-x-auto pb-2">
        <TabsList className="inline-flex w-full min-w-max md:grid md:w-full md:grid-cols-5 gap-1">
          <TabsTrigger value="suppliers" className="flex-shrink-0">Fornitori</TabsTrigger>
          <TabsTrigger value="users" className="flex-shrink-0">Utenti</TabsTrigger>
          <TabsTrigger value="allergens" className="flex-shrink-0">Allergeni</TabsTrigger>
          <TabsTrigger value="export" className="flex-shrink-0">Esportazione</TabsTrigger>
          <TabsTrigger value="printer" className="flex-shrink-0">Stampante</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="suppliers">
        <SupplierManagement />
      </TabsContent>
      <TabsContent value="users">
        <UserManagement />
      </TabsContent>
      <TabsContent value="allergens">
        <AllergenManagement />
      </TabsContent>
      <TabsContent value="export">
        <DataExport />
      </TabsContent>
      <TabsContent value="printer">
        <PrinterSettings />
      </TabsContent>
    </Tabs>
  );
};
