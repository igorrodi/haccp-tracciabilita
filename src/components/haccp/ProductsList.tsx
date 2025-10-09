import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryForm } from "./CategoryForm";
import { CategoriesList } from "./CategoriesList";
import { Plus, Package } from "lucide-react";

export const ProductsList = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCategoryAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Package className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Gestione Prodotti</h2>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Prodotti
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Aggiungi Prodotto
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="space-y-4">
          <CategoriesList refreshTrigger={refreshTrigger} />
        </TabsContent>
        
        <TabsContent value="add" className="space-y-4">
          <CategoryForm onCategoryAdded={handleCategoryAdded} />
        </TabsContent>
      </Tabs>
    </div>
  );
};