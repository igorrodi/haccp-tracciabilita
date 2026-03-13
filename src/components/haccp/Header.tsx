import { useEffect, useState } from "react";
import { Shield, LogOut, Home, Package, Settings, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { pb, logout, currentUser, isAdmin } from "@/lib/pocketbase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  activeTab: "home" | "products" | "system" | "temperature";
  onTabChange: (tab: "home" | "products" | "system" | "temperature") => void;
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

  const admin = isAdmin();

  const tabs = [
    { key: "home" as const, label: "Home", icon: Home },
    { key: "products" as const, label: "Prodotti", icon: Package },
    ...(admin ? [
      { key: "temperature" as const, label: "Temperature", icon: Thermometer },
      { key: "system" as const, label: "Sistema", icon: Settings },
    ] : []),
  ];

  return (
    <header className="bg-card shadow-sm sticky top-0 z-30 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2.5 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">HACCP Tracker</h1>
              <p className="text-xs text-muted-foreground">Versione Locale</p>
            </div>
          </div>
          
          <div className="hidden md:block flex-1 max-w-sm mx-6">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl">
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

        {/* Navigation tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              className="rounded-xl flex-shrink-0"
              onClick={() => onTabChange(tab.key)}
            >
              <tab.icon className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Button>
          ))}
        </nav>

        {/* Mobile search */}
        <div className="md:hidden">
          <GlobalSearch />
        </div>
      </div>
    </header>
  );
};
