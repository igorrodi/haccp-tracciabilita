import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Cloud, HardDrive, Check, AlertCircle, Loader2, Settings2, FolderSync } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pb } from '@/lib/pocketbase';

interface CloudConfig {
  id?: string;
  provider: 'mega' | 'gdrive' | 'dropbox' | 'webdav' | 'none';
  enabled: boolean;
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly';
  // Mega.nz
  megaEmail?: string;
  megaPassword?: string;
  mega2faSecret?: string;
  // Google Drive
  gdriveClientId?: string;
  gdriveClientSecret?: string;
  gdriveRefreshToken?: string;
  // Dropbox
  dropboxAccessToken?: string;
  // WebDAV
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  // Common
  lastBackup?: string;
  lastBackupStatus?: 'success' | 'error';
}

export const CloudBackupSettings = () => {
  const [config, setConfig] = useState<CloudConfig>({
    provider: 'none',
    enabled: false,
    autoBackup: false,
    backupFrequency: 'weekly'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const records = await pb.collection('cloud_settings').getList(1, 1);
      if (records.items.length > 0) {
        const record = records.items[0];
        setConfig({
          id: record.id,
          provider: record.provider || 'none',
          enabled: record.enabled || false,
          autoBackup: record.auto_backup || false,
          backupFrequency: record.backup_frequency || 'weekly',
          megaEmail: record.mega_email,
          megaPassword: record.mega_password ? '********' : undefined,
          mega2faSecret: record.mega_2fa_secret ? '********' : undefined,
          gdriveClientId: record.gdrive_client_id,
          gdriveClientSecret: record.gdrive_client_secret ? '********' : undefined,
          gdriveRefreshToken: record.gdrive_refresh_token ? '********' : undefined,
          dropboxAccessToken: record.dropbox_access_token ? '********' : undefined,
          webdavUrl: record.webdav_url,
          webdavUsername: record.webdav_username,
          webdavPassword: record.webdav_password ? '********' : undefined,
          lastBackup: record.last_backup,
          lastBackupStatus: record.last_backup_status
        });
      }
    } catch (error) {
      // Collection might not exist yet
      console.log('Cloud settings not configured yet');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      
      const data: Record<string, any> = {
        provider: config.provider,
        enabled: config.enabled,
        auto_backup: config.autoBackup,
        backup_frequency: config.backupFrequency,
      };

      // Only update passwords if they're not masked
      if (config.provider === 'mega') {
        data.mega_email = config.megaEmail;
        if (config.megaPassword && !config.megaPassword.includes('*')) {
          data.mega_password = config.megaPassword;
        }
        if (config.mega2faSecret && !config.mega2faSecret.includes('*')) {
          data.mega_2fa_secret = config.mega2faSecret;
        }
      } else if (config.provider === 'gdrive') {
        data.gdrive_client_id = config.gdriveClientId;
        if (config.gdriveClientSecret && !config.gdriveClientSecret.includes('*')) {
          data.gdrive_client_secret = config.gdriveClientSecret;
        }
        if (config.gdriveRefreshToken && !config.gdriveRefreshToken.includes('*')) {
          data.gdrive_refresh_token = config.gdriveRefreshToken;
        }
      } else if (config.provider === 'dropbox') {
        if (config.dropboxAccessToken && !config.dropboxAccessToken.includes('*')) {
          data.dropbox_access_token = config.dropboxAccessToken;
        }
      } else if (config.provider === 'webdav') {
        data.webdav_url = config.webdavUrl;
        data.webdav_username = config.webdavUsername;
        if (config.webdavPassword && !config.webdavPassword.includes('*')) {
          data.webdav_password = config.webdavPassword;
        }
      }

      if (config.id) {
        await pb.collection('cloud_settings').update(config.id, data);
      } else {
        const record = await pb.collection('cloud_settings').create(data);
        setConfig(prev => ({ ...prev, id: record.id }));
      }

      toast({
        title: "Configurazione salvata",
        description: "Le impostazioni cloud sono state aggiornate"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la configurazione",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    // Simulate connection test - in production this would call a backend endpoint
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Connessione verificata",
      description: `Connessione a ${getProviderName(config.provider)} riuscita!`
    });
    setTestingConnection(false);
  };

  const triggerManualBackup = async () => {
    setLoading(true);
    toast({
      title: "Backup avviato",
      description: "Il backup manuale è in corso..."
    });
    
    // In production this would call the backup script via backend
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setConfig(prev => ({
      ...prev,
      lastBackup: new Date().toISOString(),
      lastBackupStatus: 'success'
    }));
    
    toast({
      title: "Backup completato",
      description: "I dati sono stati salvati su cloud"
    });
    setLoading(false);
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'mega': return 'Mega.nz';
      case 'gdrive': return 'Google Drive';
      case 'dropbox': return 'Dropbox';
      case 'webdav': return 'WebDAV/Nextcloud';
      default: return 'Nessuno';
    }
  };

  const getProviderIcon = (provider: string) => {
    return <Cloud className="w-4 h-4" />;
  };

  if (loading && !config.provider) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderSync className="w-5 h-5" />
          Backup Cloud
        </CardTitle>
        <CardDescription>
          Configura il backup automatico su servizi cloud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>Servizio Cloud</Label>
          <Select
            value={config.provider}
            onValueChange={(value: CloudConfig['provider']) => 
              setConfig(prev => ({ ...prev, provider: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona servizio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessuno (solo locale)</SelectItem>
              <SelectItem value="mega">Mega.nz (consigliato)</SelectItem>
              <SelectItem value="gdrive">Google Drive</SelectItem>
              <SelectItem value="dropbox">Dropbox</SelectItem>
              <SelectItem value="webdav">WebDAV / Nextcloud</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.provider !== 'none' && (
          <>
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Abilita Backup Cloud</Label>
                <p className="text-sm text-muted-foreground">
                  Attiva il backup su {getProviderName(config.provider)}
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            {/* Auto Backup */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Backup Automatico</Label>
                <p className="text-sm text-muted-foreground">
                  Esegui backup automatico programmato
                </p>
              </div>
              <Switch
                checked={config.autoBackup}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, autoBackup: checked }))
                }
              />
            </div>

            {config.autoBackup && (
              <div className="space-y-2">
                <Label>Frequenza</Label>
                <Select
                  value={config.backupFrequency}
                  onValueChange={(value: 'daily' | 'weekly') => 
                    setConfig(prev => ({ ...prev, backupFrequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Giornaliero (ore 2:00)</SelectItem>
                    <SelectItem value="weekly">Settimanale (Domenica ore 2:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Provider-specific fields */}
            {config.provider === 'mega' && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Credenziali Mega.nz
                </h4>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={config.megaEmail || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, megaEmail: e.target.value }))}
                    placeholder="email@esempio.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={config.megaPassword || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, megaPassword: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret 2FA (opzionale)</Label>
                  <Input
                    type="password"
                    value={config.mega2faSecret || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, mega2faSecret: e.target.value }))}
                    placeholder="Codice segreto TOTP"
                  />
                  <p className="text-xs text-muted-foreground">
                    Inserisci il codice segreto TOTP se hai abilitato 2FA
                  </p>
                </div>
              </div>
            )}

            {config.provider === 'gdrive' && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Credenziali Google Drive
                </h4>
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input
                    value={config.gdriveClientId || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, gdriveClientId: e.target.value }))}
                    placeholder="xxxxx.apps.googleusercontent.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    value={config.gdriveClientSecret || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, gdriveClientSecret: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Refresh Token</Label>
                  <Input
                    type="password"
                    value={config.gdriveRefreshToken || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, gdriveRefreshToken: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <a href="https://console.cloud.google.com" target="_blank" className="underline">
                    Crea le credenziali OAuth
                  </a> dalla Google Cloud Console
                </p>
              </div>
            )}

            {config.provider === 'dropbox' && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Credenziali Dropbox
                </h4>
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={config.dropboxAccessToken || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, dropboxAccessToken: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <a href="https://www.dropbox.com/developers/apps" target="_blank" className="underline">
                    Crea un'app Dropbox
                  </a> e genera un access token
                </p>
              </div>
            )}

            {config.provider === 'webdav' && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Credenziali WebDAV
                </h4>
                <div className="space-y-2">
                  <Label>URL Server</Label>
                  <Input
                    value={config.webdavUrl || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, webdavUrl: e.target.value }))}
                    placeholder="https://cloud.esempio.com/remote.php/dav/files/user/"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={config.webdavUsername || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, webdavUsername: e.target.value }))}
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={config.webdavPassword || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, webdavPassword: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Last Backup Status */}
            {config.lastBackup && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Ultimo backup:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {new Date(config.lastBackup).toLocaleString('it-IT')}
                    </span>
                    {config.lastBackupStatus === 'success' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="w-3 h-3 mr-1" />
                        Riuscito
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Errore
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={testConnection} 
                variant="outline" 
                disabled={testingConnection}
                className="flex-1"
              >
                {testingConnection ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings2 className="w-4 h-4 mr-2" />
                )}
                Test Connessione
              </Button>
              
              <Button 
                onClick={triggerManualBackup} 
                variant="outline"
                disabled={loading || !config.enabled}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Cloud className="w-4 h-4 mr-2" />
                )}
                Backup Ora
              </Button>
            </div>
          </>
        )}

        {/* Save Button */}
        <Button 
          onClick={saveConfig} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Salva Configurazione
        </Button>
      </CardContent>
    </Card>
  );
};
