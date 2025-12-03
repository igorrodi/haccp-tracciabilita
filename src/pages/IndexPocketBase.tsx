import { useState } from "react";
import { HeaderPocketBase } from "@/components/haccp/HeaderPocketBase";
import { LotFormPocketBase } from "@/components/haccp/LotFormPocketBase";
import { RecentLotsListPocketBase } from "@/components/haccp/RecentLotsListPocketBase";
import { ProductsListPocketBase } from "@/components/haccp/ProductsListPocketBase";
import { SystemPanelPocketBase } from "@/components/haccp/SystemPanelPocketBase";

const IndexPocketBase = () => {
  const [activeTab, setActiveTab] = useState<"home" | "products" | "system">("home");

  return (
    <div className="min-h-screen haccp-gradient">
      <HeaderPocketBase activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {activeTab === "home" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <LotFormPocketBase />
            </div>
            <div className="lg:col-span-2">
              <RecentLotsListPocketBase />
            </div>
          </div>
        )}
        
        {activeTab === "products" && <ProductsListPocketBase />}
        
        {activeTab === "system" && <SystemPanelPocketBase />}
      </main>
    </div>
  );
};

export default IndexPocketBase;
