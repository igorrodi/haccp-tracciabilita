import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { login, isAuthenticated, checkFirstTimeSetup } from '@/lib/pocketbase';
import { Loader2, Mail, Lock, LogIn, ShieldCheck } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated()) {
        navigate('/', { replace: true });
        return;
      }
      // If no users exist, redirect to first-time setup
      const isFirstTime = await checkFirstTimeSetup();
      if (isFirstTime) {
        navigate('/setup', { replace: true });
        return;
      }
      setChecking(false);
    };
    init();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setLoading(true);
    try {
      const { error } = await login(trimmedEmail, password);
      if (error) {
        toast({
          title: 'Errore di accesso',
          description: error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Accesso effettuato', description: 'Benvenuto!' });
        navigate('/', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen haccp-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/70 shadow-raised overflow-hidden">
        <div className="bg-gradient-primary px-6 py-8 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-foreground/15 p-3 backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">HACCP Tracciabilità</h1>
              <p className="text-sm opacity-80">Sistema locale di controllo alimentare</p>
            </div>
          </div>
        </div>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="font-display text-xl">Accedi</CardTitle>
          <CardDescription>Inserisci le tue credenziali per continuare</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@esempio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 text-base"
                  required
                  disabled={loading}
                  maxLength={255}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 text-base"
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accesso in corso...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Accedi
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 rounded-xl border border-border bg-muted/60 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Per ottenere un account, contatta l'amministratore del sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
