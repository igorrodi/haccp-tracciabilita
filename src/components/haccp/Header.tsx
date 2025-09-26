import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  activeTab: "home" | "products" | "system";
  onTabChange: (tab: "home" | "products" | "system") => void;
}

export const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  return (
    <header className="bg-card shadow-sm sticky top-0 z-30 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-primary-foreground p-3 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">HACCP Tracker</h1>
        </div>
        
        <nav className="flex items-center gap-3">
          <Button
            variant={activeTab === "home" ? "default" : "ghost"}
            className="rounded-xl"
            onClick={() => onTabChange("home")}
          >
            Home
          </Button>
          <Button
            variant={activeTab === "products" ? "default" : "ghost"}
            className="rounded-xl"
            onClick={() => onTabChange("products")}
          >
            Prodotti
          </Button>
          <Button
            variant={activeTab === "system" ? "default" : "ghost"}
            className="rounded-xl"
            onClick={() => onTabChange("system")}
          >
            Sistema
          </Button>
          <Button variant="destructive" className="rounded-xl">
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
};