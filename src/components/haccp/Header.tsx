import { useEffect, useState } from "react";
import { Shield, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HeaderProps {
  activeTab: "home" | "products" | "system";
  onTabChange: (tab: "home" | "products" | "system") => void;
}

export const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const [userProfile, setUserProfile] = useState<{ full_name?: string; company_name?: string } | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, company_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        setUserProfile(profile);
      }
    };

    fetchUserProfile();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Errore durante il logout");
    } else {
      toast.success("Logout effettuato con successo");
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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
            {userProfile?.company_name && (
              <p className="text-sm text-muted-foreground">{userProfile.company_name}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
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
          </nav>

          <div className="flex items-center gap-3 pl-3 border-l border-border">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(userProfile?.full_name)}
                </AvatarFallback>
              </Avatar>
              {userProfile?.full_name && (
                <span className="text-sm font-medium hidden sm:block">
                  {userProfile.full_name}
                </span>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};