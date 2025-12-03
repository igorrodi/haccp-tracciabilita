import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { pb, login, register, isAuthenticated } from '@/lib/pocketbase';
import { Loader2, Mail, Lock, User } from 'lucide-react';

const AuthPocketBase = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await login(email, password);
        if (error) {
          toast({
            title: 'Errore di accesso',
            description: error,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Accesso effettuato',
            description: 'Benvenuto!',
          });
          navigate('/', { replace: true });
        }
      } else {
        if (password !== confirmPassword) {
          toast({
            title: 'Errore',
            description: 'Le password non corrispondono',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (password.length < 8) {
          toast({
            title: 'Errore',
            description: 'La password deve essere di almeno 8 caratteri',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { error } = await register(email, password, confirmPassword);
        if (error) {
          toast({
            title: 'Errore di registrazione',
            description: error,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Registrazione completata',
            description: 'Account creato con successo!',
          });
          navigate('/', { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen haccp-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            🥗 HACCP Tracciabilità
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin ? 'Accedi al sistema' : 'Crea un nuovo account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@esempio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                    minLength={8}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? 'Accesso in corso...' : 'Registrazione...'}
                </>
              ) : (
                <>{isLogin ? 'Accedi' : 'Registrati'}</>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-sm text-primary hover:underline"
                disabled={loading}
              >
                {isLogin
                  ? 'Non hai un account? Registrati'
                  : 'Hai già un account? Accedi'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPocketBase;
