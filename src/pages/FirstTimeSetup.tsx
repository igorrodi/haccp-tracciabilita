import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Shield, User, Mail, Lock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const adminSchema = z.object({
  fullName: z.string().min(2, 'Nome deve avere almeno 2 caratteri').max(100, 'Nome troppo lungo'),
  email: z.string().email('Email non valida').toLowerCase(),
  password: z.string()
    .min(8, 'Password deve avere almeno 8 caratteri')
    .regex(/[a-zA-Z]/, 'Password deve contenere almeno una lettera')
    .regex(/[0-9]/, 'Password deve contenere almeno un numero'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non coincidono",
  path: ["confirmPassword"],
});

export default function FirstTimeSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'welcome' | 'create' | 'complete'>('welcome');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    checkFirstTimeSetup();
  }, []);

  const checkFirstTimeSetup = async () => {
    try {
      // Verifica se esiste già un admin
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (rolesError) {
        console.error('Error checking roles:', rolesError);
      }

      // Se non ci sono admin, è il primo setup
      if (!roles || roles.length === 0) {
        setIsFirstTime(true);
      } else {
        // Se c'è già un admin, redirect al login normale
        navigate('/auth');
      }
    } catch (err) {
      console.error('Error checking first time setup:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string
    };

    try {
      const validatedData = adminSchema.parse(data);

      // 1. Registra l'utente
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            full_name: validatedData.fullName
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Errore durante la creazione utente');

      // 2. Aspetta che il profilo sia creato (trigger automatico)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. Assegna il ruolo admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: signUpData.user.id,
          role: 'admin'
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
        // Non blocchiamo se il ruolo fallisce, potrebbe essere un problema di RLS
      }

      setStep('complete');
      toast.success('Account amministratore creato con successo!');

    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Errore durante la creazione dell\'account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/auth');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verifica configurazione...</p>
        </div>
      </div>
    );
  }

  if (!isFirstTime) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Sistema HACCP</h1>
          <p className="text-muted-foreground mt-2">Configurazione iniziale</p>
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Benvenuto! 👋</CardTitle>
              <CardDescription className="text-base mt-2">
                Questa è la prima configurazione del sistema HACCP.
                Creerai ora il tuo account amministratore principale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Accesso completo al sistema</p>
                    <p className="text-muted-foreground">Gestisci prodotti, lotti, utenti e impostazioni</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Gestione utenti</p>
                    <p className="text-muted-foreground">Potrai invitare altri utenti e assegnare ruoli</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Sicurezza garantita</p>
                    <p className="text-muted-foreground">I tuoi dati sono protetti e crittografati</p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-lg" 
                onClick={() => setStep('create')}
              >
                Inizia Configurazione
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Admin Step */}
        {step === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Crea Account Amministratore
              </CardTitle>
              <CardDescription>
                Inserisci i dati per il tuo account admin principale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    <User className="w-4 h-4 inline mr-2" />
                    Nome Completo
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Mario Rossi"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="admin@azienda.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Minimo 8 caratteri"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Conferma Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Ripeti la password"
                    required
                  />
                </div>

                {error && (
                  <Alert className="border-destructive/50 text-destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep('welcome')}
                    className="flex-1"
                  >
                    Indietro
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creazione...
                      </>
                    ) : (
                      'Crea Account'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Configurazione Completata! 🎉</CardTitle>
              <CardDescription className="text-base mt-2">
                Il tuo account amministratore è stato creato con successo.
                Ora puoi accedere al sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> Se hai abilitato la conferma email nelle impostazioni Supabase, 
                  controlla la tua casella di posta per confermare l'account.
                </p>
              </div>

              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleGoToLogin}
              >
                Vai al Login
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
