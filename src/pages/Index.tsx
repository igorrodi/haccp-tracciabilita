import { useState } from "react";
import { Header } from "@/components/haccp/Header";
import { LotForm } from "@/components/haccp/LotForm";
import { RecentLotsList } from "@/components/haccp/RecentLotsList";
import { ProductsList } from "@/components/haccp/ProductsList";
import { SystemPanel } from "@/components/haccp/SystemPanel";
import { Dashboard } from "@/components/haccp/Dashboard";
import { TemperatureLog } from "@/components/haccp/TemperatureLog";
import { AppFooter } from "@/components/haccp/AppFooter";
import { isAdmin } from "@/lib/pocketbase";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"home" | "products" | "system" | "temperature">("home");
  const admin = isAdmin();

  return (
    <div className="min-h-screen haccp-gradient flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-6xl mx-auto p-6 space-y-6 flex-1 w-full">
        {activeTab === "home" && (
          <div className="space-y-6">
            <Dashboard />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <LotForm />
              </div>
              <div className="lg:col-span-2">
                <RecentLotsList />
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "products" && <ProductsList />}
        
        {activeTab === "temperature" && admin && <TemperatureLog />}
        
        {activeTab === "system" && admin && <SystemPanel />}
      </main>

      <AppFooter />
    </div>
  );
};

export default Index;
