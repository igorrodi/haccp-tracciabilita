import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupplierManagement } from './SupplierManagement';
import { UserManagement } from './UserManagement';
import { AllergenManagement } from './AllergenManagement';

export const SystemPanel = () => {
  return (
    <Tabs defaultValue="suppliers" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="suppliers">Fornitori</TabsTrigger>
        <TabsTrigger value="users">Utenti</TabsTrigger>
        <TabsTrigger value="allergens">Allergeni</TabsTrigger>
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
    </Tabs>
  );
};
