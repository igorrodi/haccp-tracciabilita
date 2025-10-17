import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryForm } from "./CategoryForm";
import { CategoriesList } from "./CategoriesList";
import { Plus, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ProductsList = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const handleCategoryAdded = () => {
    setRefreshTrigger(prev => prev + 1);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Gestione Prodotti</h2>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setDialogOpen(true)}
            size="lg"
            className="rounded-full w-12 h-12 p-0"
          >
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </div>

      <CategoriesList refreshTrigger={refreshTrigger} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Aggiungi Prodotto
            </DialogTitle>
          </DialogHeader>
          <CategoryForm onCategoryAdded={handleCategoryAdded} />
        </DialogContent>
      </Dialog>
    </div>
  );
};