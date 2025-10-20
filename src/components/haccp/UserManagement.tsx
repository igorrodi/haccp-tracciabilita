import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserCheck, UserX, Shield, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email('Email non valida').max(255, 'Email troppo lunga'),
  password: z.string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'La password deve contenere almeno una lettera minuscola, una maiuscola e un numero'),
  fullName: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri').max(100, 'Nome troppo lungo')
});

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

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
      // Delete user from auth.users (this will cascade to profiles and user_roles)
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      toast.success('Utente eliminato con successo');
      fetchUsers();
    } catch (error: any) {
      toast.error('Errore nell\'eliminazione: ' + error.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      fullName: formData.get('fullName') as string,
      role: formData.get('role') as 'admin' | 'guest'
    };

    try {
      const validatedData = createUserSchema.parse(data);
      
      // Create user using Supabase admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            full_name: validatedData.fullName
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Errore nella creazione utente');

      // Assign role to the new user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Non autenticato');

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: data.role,
          authorized_by: currentUser.id
        });

      if (roleError) throw roleError;

      toast.success('Utente creato con successo');
      setCreateDialogOpen(false);
      fetchUsers();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Errore nella creazione utente');
      }
    } finally {
      setCreating(false);
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
    <>
      <Card className="haccp-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestione Utenti
            </CardTitle>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Crea Utente
            </Button>
          </div>
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

    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crea Nuovo Utente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome e Cognome</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Mario Rossi"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Username)</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="utente@azienda.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Almeno 8 caratteri, maiuscole e numeri"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Ruolo</Label>
            <select
              id="role"
              name="role"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="guest">Utente</option>
              <option value="admin">Amministratore</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creazione...' : 'Crea Utente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};
