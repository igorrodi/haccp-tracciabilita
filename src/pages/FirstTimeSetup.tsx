import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { register, checkFirstTimeSetup, pb } from '@/lib/pocketbase';
import { Loader2, Shield, Mail, Lock, User, CheckCircle2, Wifi, Store } from 'lucide-react';

const FirstTimeSetup = () => {
  const [step, setStep] = useState(1);
  // Admin fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  // WiFi fields
  const [wifiSsid, setWifiSsid] = useState('HACCP-Tracciabilita');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiConfirmPassword, setWifiConfirmPassword] = useState('');
  // Restaurant name
  const [restaurantName, setRestaurantName] = useState('');

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkFirstTimeSetup().then((isFirstTime) => {
      if (!isFirstTime) {
        navigate('/auth', { replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (password !== confirmPassword) {
      toast({ title: 'Errore', description: 'Le password admin non corrispondono', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Errore', description: 'La password admin deve essere di almeno 8 caratteri', variant: 'destructive' });
      return;
    }
    if (wifiPassword.length > 0 && wifiPassword.length < 8) {
      toast({ title: 'Errore', description: 'La password Wi-Fi deve essere di almeno 8 caratteri', variant: 'destructive' });
      return;
    }
    if (wifiPassword !== wifiConfirmPassword) {
      toast({ title: 'Errore', description: 'Le password Wi-Fi non corrispondono', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 1. Create admin account
      const { error } = await register(trimmedEmail, password, confirmPassword, trimmedName, 'admin');
      if (error) {
        toast({ title: 'Errore', description: error, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // 2. Save WiFi settings
      try {
        await pb.collection('wifi_settings').create({
          wifi_ssid: wifiSsid.trim() || 'HACCP-Tracciabilita',
          wifi_password: wifiPassword || '',
          restaurant_name: restaurantName.trim() || '',
        }, { requestKey: null });
      } catch (wifiErr: any) {
        console.warn('WiFi settings save warning:', wifiErr?.message);
        // Non-blocking: WiFi settings collection might not exist yet
      }

      // 3. Try to remove the first_run flag via custom endpoint
      try {
        const baseUrl = pb.baseURL || window.location.origin;
        await fetch(baseUrl + '/api/complete-setup', {
          method: 'POST',
          headers: {
            'Authorization': pb.authStore.token ? ('Bearer ' + pb.authStore.token) : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wifi_ssid: wifiSsid.trim() || 'HACCP-Tracciabilita',
            wifi_password: wifiPassword || '',
          }),
        });
      } catch (setupErr) {
        console.warn('complete-setup endpoint not available:', setupErr);
      }

      setStep(4);
      setTimeout(() => navigate('/', { replace: true }), 2500);
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
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {step <= 1 && <Shield className="w-8 h-8 text-primary" />}
            {step === 2 && <User className="w-8 h-8 text-primary" />}
            {step === 3 && <Wifi className="w-8 h-8 text-primary" />}
            {step === 4 && <CheckCircle2 className="w-8 h-8 text-green-600" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === 1 && "Benvenuto in HACCP Tracciabilità"}
            {step === 2 && "Crea Account Amministratore"}
            {step === 3 && "Configurazione Wi-Fi"}
            {step === 4 && "Configurazione Completata!"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Configurazione iniziale del sistema"}
            {step === 2 && "Questo sarà l'account principale del sistema"}
            {step === 3 && "Configura la rete Wi-Fi del dispositivo"}
            {step === 4 && "Il sistema è pronto per l'uso"}
          </CardDescription>

          {/* Step indicator */}
          {step < 4 && (
            <div className="flex justify-center gap-2 pt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step ? 'w-8 bg-primary' : s < step ? 'w-8 bg-primary/40' : 'w-8 bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>Creerai l'account amministratore principale</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>Configurerai la rete Wi-Fi del dispositivo</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>La registrazione pubblica sarà disabilitata</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>Solo l'admin potrà creare nuovi utenti</p>
                </div>
              </div>
              <Button onClick={() => setStep(2)} className="w-full" size="lg">
                Inizia Configurazione
              </Button>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurantName">Nome Ristorante (opzionale)</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="restaurantName"
                    type="text"
                    placeholder="Es. Ristorante Da Mario"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="pl-10"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome Admin (opzionale)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Il tuo nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@esempio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    maxLength={255}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimo 8 caratteri"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Ripeti la password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Indietro
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    if (!email.trim()) {
                      toast({ title: 'Errore', description: 'Inserisci un indirizzo email', variant: 'destructive' });
                      return;
                    }
                    if (password.length < 8) {
                      toast({ title: 'Errore', description: 'La password deve essere di almeno 8 caratteri', variant: 'destructive' });
                      return;
                    }
                    if (password !== confirmPassword) {
                      toast({ title: 'Errore', description: 'Le password non corrispondono', variant: 'destructive' });
                      return;
                    }
                    setStep(3);
                  }}
                >
                  Avanti
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: WiFi Configuration */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <p>Configura il nome e la password della rete Wi-Fi che il Raspberry Pi creerà per i dispositivi.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wifiSsid">Nome Rete Wi-Fi (SSID)</Label>
                <div className="relative">
                  <Wifi className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wifiSsid"
                    type="text"
                    placeholder="HACCP-Tracciabilita"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="pl-10"
                    maxLength={32}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wifiPassword">Password Wi-Fi *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wifiPassword"
                    type="password"
                    placeholder="Minimo 8 caratteri"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wifiConfirmPassword">Conferma Password Wi-Fi *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wifiConfirmPassword"
                    type="password"
                    placeholder="Ripeti la password Wi-Fi"
                    value={wifiConfirmPassword}
                    onChange={(e) => setWifiConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={loading} className="flex-1">
                  Indietro
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configurazione...
                    </>
                  ) : (
                    'Completa Setup'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✅ Account amministratore creato</p>
                <p>✅ Configurazione Wi-Fi salvata</p>
                {wifiSsid && (
                  <p className="font-medium text-foreground">
                    Riconnettiti alla rete: <strong>{wifiSsid}</strong>
                  </p>
                )}
              </div>
              <p className="text-muted-foreground">Reindirizzamento alla dashboard...</p>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FirstTimeSetup;
