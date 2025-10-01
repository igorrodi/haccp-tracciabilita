import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserWithRole {
  user_id: string;
  email: string;
  role: 'admin' | 'guest' | null;
  full_name?: string;
  authorized_at?: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    fetchUsers();
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

  const fetchUsers = async () => {
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, authorized_at');

      if (rolesError) throw rolesError;

      // Get current user's auth data to get emails
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // For now, we can only show the current user's email
      // In a real scenario, you'd need an admin API endpoint to list all users
      const usersMap = new Map<string, UserWithRole>();

      profiles?.forEach(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        usersMap.set(profile.user_id, {
          user_id: profile.user_id,
          email: profile.user_id === user.id ? user.email! : 'user@example.com',
          role: userRole?.role as 'admin' | 'guest' | null,
          full_name: profile.full_name || undefined,
          authorized_at: userRole?.authorized_at
        });
      });

      setUsers(Array.from(usersMap.values()));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Errore nel caricamento utenti');
    } finally {
      setLoading(false);
    }
  };

  const authorizeUser = async (userId: string, role: 'admin' | 'guest') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
          authorized_by: user.id
        });

      if (error) throw error;

      toast.success(`Utente autorizzato come ${role}`);
      fetchUsers();
    } catch (error: any) {
      toast.error('Errore nell\'autorizzazione: ' + error.message);
    }
  };

  const revokeRole = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Ruolo revocato');
      fetchUsers();
    } catch (error: any) {
      toast.error('Errore nella revoca: ' + error.message);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="haccp-card">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Solo gli amministratori possono gestire gli utenti</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="haccp-card">
        <CardContent className="p-6">
          <div className="text-center">Caricamento utenti...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="haccp-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Gestione Utenti
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun utente trovato
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"
              >
                <div className="flex-1">
                  <div className="font-medium">{user.full_name || 'Utente'}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  {user.authorized_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Autorizzato: {new Date(user.authorized_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {user.role ? (
                    <>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revokeRole(user.user_id)}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => authorizeUser(user.user_id, 'admin')}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => authorizeUser(user.user_id, 'guest')}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Guest
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-800 mb-2">ℹ️ Nota</h4>
          <p className="text-sm text-blue-700">
            <strong>Admin:</strong> Accesso completo al sistema, può autorizzare altri utenti<br />
            <strong>Guest:</strong> Accesso limitato alle funzionalità base
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
