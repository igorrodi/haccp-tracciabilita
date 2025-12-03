import { useState } from "react";
import { HeaderPocketBase } from "@/components/haccp/HeaderPocketBase";
import { SystemPanel } from "@/components/haccp/SystemPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

const IndexPocketBase = () => {
  const [activeTab, setActiveTab] = useState<"home" | "products" | "system">("home");

  return (
    <div className="min-h-screen haccp-gradient">
      <HeaderPocketBase activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {activeTab === "home" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Construction className="w-5 h-5" />
                Home - PocketBase
              </CardTitle>
              <CardDescription>
                Questa è la versione standalone con PocketBase.
                Le funzionalità di gestione lotti saranno disponibili dopo la configurazione delle collezioni PocketBase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Per configurare le collezioni, accedi al pannello admin di PocketBase:
                </p>
                <code className="block bg-muted p-3 rounded-lg text-sm">
                  https://haccp-app.local/_/
                </code>
                <p className="text-sm text-muted-foreground">
                  Collezioni da creare:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>products</strong> - Prodotti</li>
                  <li><strong>lots</strong> - Lotti</li>
                  <li><strong>suppliers</strong> - Fornitori</li>
                  <li><strong>categories</strong> - Categorie</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
        
        {activeTab === "products" && (
          <Card>
            <CardHeader>
              <CardTitle>Prodotti</CardTitle>
              <CardDescription>
                Gestione prodotti - Da configurare con PocketBase
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        
        {activeTab === "system" && <SystemPanel />}
      </main>
    </div>
  );
};

export default IndexPocketBase;
