import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserCheck, UserX, Mail, Trash2, Loader2, Shield } from "lucide-react";
import { pb, getAllUsers, updateUserRole, deleteUser, register, PBUser, currentUser } from "@/lib/pocketbase";
import { toast } from "sonner";

export const UserManagementPocketBase = () => {
  const [users, setUsers] = useState<PBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const current = currentUser();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await getAllUsers();
    if (error) {
      toast.error('Errore nel caricamento utenti');
    } else if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    const { error } = await updateUserRole(userId, newRole);
    if (error) {
      toast.error('Errore nel cambio ruolo: ' + error);
    } else {
      toast.success(`Ruolo aggiornato a ${newRole === 'admin' ? 'Amministratore' : 'Utente'}`);
      fetchUsers();
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (userId === current?.id) {
      toast.error('Non puoi eliminare il tuo stesso account');
      return;
    }
    
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${userName}"?`)) {
      return;
    }

    const { error } = await deleteUser(userId);
    if (error) {
      toast.error('Errore nell\'eliminazione: ' + error);
    } else {
      toast.success('Utente eliminato');
      fetchUsers();
    }
  };

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as 'admin' | 'user';
    const password = Math.random().toString(36).slice(-12) + 'A1!';

    const { error } = await register(email, password, password, name, role);

    if (error) {
      toast.error(error);
    } else {
      toast.success(`Utente ${email} creato con password temporanea`);
      setInviteDialogOpen(false);
      fetchUsers();
    }

    setSending(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestione Utenti
            </CardTitle>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Nuovo Utente
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
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/50 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {user.name || 'Utente'}
                      {user.id === current?.id && (
                        <Badge variant="outline" className="text-xs">Tu</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? (
                        <><Shield className="w-3 h-3 mr-1" /> Amministratore</>
                      ) : (
                        'Utente'
                      )}
                    </Badge>
                    
                    {user.id !== current?.id && (
                      <>
                        {user.role === 'admin' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRoleChange(user.id, 'user')}
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRoleChange(user.id, 'admin')}
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(user.id, user.name || user.email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <h4 className="font-medium text-blue-800 mb-2">ℹ️ Nota</h4>
            <p className="text-sm text-blue-700">
              <strong>Amministratore:</strong> Accesso completo, gestione utenti<br />
              <strong>Utente:</strong> Accesso base, solo visualizzazione
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Nuovo Utente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" type="text" placeholder="Mario Rossi" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="utente@azienda.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Ruolo</Label>
              <select
                id="role"
                name="role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="user">Utente</option>
                <option value="admin">Amministratore</option>
              </select>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Verrà generata una password temporanea. L'utente dovrà cambiarla al primo accesso.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crea Utente'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
