import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, UserCheck, UserX, Trash2 } from "lucide-react";
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get all profiles with email
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, authorized_at');

      if (rolesError) throw rolesError;

      // Map profiles with roles
      const usersMap = new Map<string, UserWithRole>();

      profiles?.forEach(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        usersMap.set(profile.user_id, {
          user_id: profile.user_id,
          email: profile.email || 'email@example.com',
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

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente l'utente "${userName}"? Questa azione non può essere annullata.`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non autenticato');

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Utente eliminato con successo');
      fetchUsers();
    } catch (error: any) {
      toast.error('Errore nell\'eliminazione: ' + error.message);
    }
  };


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
        <Alert className="mb-6 bg-primary/5 border-primary/20">
          <AlertDescription>
            <strong>🔐 Registrazione Self-Service</strong>
            <p className="mt-2 text-sm">
              Gli utenti possono registrarsi autonomamente dalla pagina di login. 
              Una volta registrati, riceveranno un'email di conferma da Supabase. 
              Dopo la conferma, appariranno qui e potrai assegnare loro i ruoli appropriati.
            </p>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun utente trovato
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.user_id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/50 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.full_name || 'Utente'}</div>
                  <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  {user.authorized_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Autorizzato: {new Date(user.authorized_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {user.role ? (
                    <>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="whitespace-nowrap">
                        {user.role === 'admin' ? 'Amministratore' : 'Utente'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revokeRole(user.user_id)}
                        className="shrink-0"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteUser(user.user_id, user.full_name || user.email)}
                        className="shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => authorizeUser(user.user_id, 'admin')}
                        className="whitespace-nowrap"
                      >
                        <UserCheck className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Amministratore</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => authorizeUser(user.user_id, 'guest')}
                        className="whitespace-nowrap"
                      >
                        <UserCheck className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Utente</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteUser(user.user_id, user.full_name || user.email)}
                        className="shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
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
            <strong>Amministratore:</strong> Accesso completo al sistema, può autorizzare altri utenti<br />
            <strong>Utente:</strong> Accesso limitato alle funzionalità base
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
