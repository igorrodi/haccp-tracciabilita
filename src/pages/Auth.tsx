import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Shield, Mail, Lock } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta')
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string
    };

    try {
      const validatedData = loginSchema.parse(data);
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Email o password non corretti');
        } else {
          setError(error.message);
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('Errore durante l\'accesso');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Sistema HACCP</h1>
          <p className="text-muted-foreground mt-2">Accesso sicuro al sistema di gestione</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accesso al Sistema</CardTitle>
            <CardDescription>
              Inserisci le tue credenziali per accedere
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  placeholder="esempio@azienda.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Password
                </Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Accesso in corso...' : 'Accedi'}
              </Button>
            </form>

            {error && (
              <Alert className="mt-4 border-destructive/50 text-destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-4 border-green-500/50 text-green-700">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="text-center mt-6">
              <Link 
                to="/" 
                className="text-sm text-muted-foreground hover:text-primary"
              >
                ← Torna alla home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}