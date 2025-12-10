import { useEffect, useState } from "react";
import { Shield, LogOut, User, Home, Package, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { pb, logout, currentUser } from "@/lib/pocketbase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  activeTab: "home" | "products" | "system";
  onTabChange: (tab: "home" | "products" | "system") => void;
}

export const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const [userEmail, setUserEmail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const user = currentUser();
    if (user) {
      setUserEmail(user.email || "");
    }
  }, []);

  const handleLogout = () => {
    logout();
    toast.success("Logout effettuato con successo");
    navigate("/auth", { replace: true });
  };

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <header className="bg-card shadow-sm sticky top-0 z-30 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-primary-foreground p-3 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">HACCP Tracker</h1>
            <p className="text-sm text-muted-foreground">Versione Locale</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile: Icons only */}
          <nav className="flex items-center gap-1 md:hidden">
            <Button
              variant={activeTab === "home" ? "default" : "ghost"}
              size="icon"
              className="rounded-xl"
              onClick={() => onTabChange("home")}
            >
              <Home className="w-4 h-4" />
            </Button>
            <Button
              variant={activeTab === "products" ? "default" : "ghost"}
              size="icon"
              className="rounded-xl"
              onClick={() => onTabChange("products")}
            >
              <Package className="w-4 h-4" />
            </Button>
            <Button
              variant={activeTab === "system" ? "default" : "ghost"}
              size="icon"
              className="rounded-xl"
              onClick={() => onTabChange("system")}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </nav>

          {/* Desktop: Full text */}
          <nav className="hidden md:flex items-center gap-3">
            <Button
              variant={activeTab === "home" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => onTabChange("home")}
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <Button
              variant={activeTab === "products" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => onTabChange("products")}
            >
              <Package className="w-4 h-4 mr-2" />
              Prodotti
            </Button>
            <Button
              variant={activeTab === "system" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => onTabChange("system")}
            >
              <Settings className="w-4 h-4 mr-2" />
              Sistema
            </Button>
          </nav>

          {/* Account Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl ml-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(userEmail)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {userEmail && (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium truncate">
                    {userEmail}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                className="md:hidden"
                onClick={() => onTabChange("system")}
              >
                <Settings className="w-4 h-4 mr-2" />
                Sistema
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
