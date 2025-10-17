import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupplierManagement } from './SupplierManagement';
import { UserManagement } from './UserManagement';
import { AllergenManagement } from './AllergenManagement';
import { DataExport } from './DataExport';

export const SystemPanel = () => {
  return (
    <Tabs defaultValue="suppliers" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="suppliers">Fornitori</TabsTrigger>
        <TabsTrigger value="users">Utenti</TabsTrigger>
        <TabsTrigger value="allergens">Allergeni</TabsTrigger>
        <TabsTrigger value="export">Esportazione</TabsTrigger>
      </TabsList>
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
    </Tabs>
  );
};
