import { useState } from "react";
import { Header } from "@/components/haccp/Header";
import { LotForm } from "@/components/haccp/LotForm";
import { ProductsList } from "@/components/haccp/ProductsList";
import { SystemPanel } from "@/components/haccp/SystemPanel";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"home" | "products" | "system">("home");

  return (
    <div className="min-h-screen haccp-gradient">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {activeTab === "home" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <LotForm />
            </div>
            <div className="lg:col-span-2">
              <ProductsList />
            </div>
          </div>
        )}
        
        {activeTab === "products" && <ProductsList />}
        
        {activeTab === "system" && <SystemPanel />}
      </main>
    </div>
  );
};

export default Index;
