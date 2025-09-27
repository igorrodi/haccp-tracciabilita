# 🚀 Script di Installazione HACCP App

Questa directory contiene gli script per installare e deployare l'applicazione HACCP su diverse piattaforme.

## 📋 Contenuto

### 🍓 Raspberry Pi 5 con Ubuntu Server
- **`install-raspberry-pi.sh`**: Script completo per installazione su Raspberry Pi 5

### 🐳 Installazione Docker
- **`docker/`**: Directory con tutti i file per deployment Docker
  - `Dockerfile`: Immagine Docker ottimizzata
  - `docker-compose.yml`: Configurazione servizi
  - `nginx.conf`: Configurazione web server
  - `install-docker.sh`: Script automatico installazione Docker

## 🛠️ Utilizzo

### Installazione su Raspberry Pi 5

```bash
# 1. Scarica e prepara lo script
wget -O install-raspberry-pi.sh https://raw.githubusercontent.com/your-repo/haccp-app/main/scripts/install-raspberry-pi.sh
chmod +x install-raspberry-pi.sh

# 2. Copia il codice dell'app in /tmp/haccp-app/
cp -r /path/to/haccp-app /tmp/

# 3. Esegui l'installazione
./install-raspberry-pi.sh
```

**Cosa fa lo script:**
- ✅ Aggiorna il sistema Ubuntu
- ✅ Installa Node.js 20.x e dipendenze
- ✅ Configura Nginx come web server
- ✅ Build e deploy dell'applicazione React
- ✅ Configura firewall e sicurezza
- ✅ Crea script di aggiornamento automatico
- ✅ Ottimizzazioni specifiche per Raspberry Pi

### Installazione con Docker

```bash
# 1. Scarica lo script Docker
wget -O install-docker.sh https://raw.githubusercontent.com/your-repo/haccp-app/main/scripts/docker/install-docker.sh
chmod +x install-docker.sh

# 2. Esegui l'installazione
./install-docker.sh
```

**Cosa fa lo script:**
- ✅ Rileva automaticamente la distribuzione OS
- ✅ Installa Docker e Docker Compose
- ✅ Configura Docker per l'utente corrente
- ✅ Build e deploy dell'applicazione in container
- ✅ Crea script di gestione (update, backup, monitor)
- ✅ Ottimizzazioni per Raspberry Pi se rilevato

## 🎯 Sistemi Supportati

### Raspberry Pi Script
- ✅ Raspberry Pi 5 con Ubuntu Server 22.04+
- ✅ Ubuntu Server 20.04/22.04
- ✅ Debian 11/12

### Docker Script
- ✅ Ubuntu 18.04/20.04/22.04
- ✅ Debian 10/11/12
- ✅ CentOS 7/8
- ✅ RHEL 7/8/9
- ✅ Fedora 35+
- ✅ Raspberry Pi OS

## 🔧 Post-Installazione

### Raspberry Pi

Dopo l'installazione, l'app sarà disponibile su:
- `http://IP_DEL_RASPBERRY`
- `http://localhost` (se accesso locale)

**Script di gestione:**
```bash
# Aggiorna l'applicazione
sudo /usr/local/bin/update-haccp-app

# Controlla stato Nginx
sudo systemctl status nginx

# Visualizza log
sudo tail -f /var/log/nginx/access.log
```

### Docker

Dopo l'installazione, l'app sarà disponibile su:
- `http://localhost`
- `http://IP_DEL_SERVER`

**Script di gestione:**
```bash
cd ~/haccp-app-docker

# Aggiorna applicazione
./update.sh

# Monitora stato
./monitor.sh

# Crea backup
./backup.sh

# Gestione manuale
docker compose logs -f      # Log in tempo reale
docker compose restart     # Riavvia
docker compose down        # Ferma
```

## ⚙️ Configurazione

### Variabili d'Ambiente

L'applicazione utilizza le seguenti variabili per Supabase:
- `VITE_SUPABASE_URL`: URL del progetto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chiave pubblica Supabase

Queste sono già configurate nel codice per il progetto `domzjvvfcalyzphrizfw`.

### Personalizzazioni

**Raspberry Pi:**
- Nginx config: `/etc/nginx/sites-available/haccp-app`
- App directory: `/var/www/haccp-app`
- Log: `/var/log/nginx/`

**Docker:**
- Config: `~/haccp-app-docker/docker-compose.yml`
- Log: `~/haccp-app-docker/logs/`
- SSL certs: `~/haccp-app-docker/ssl/`

## 🔐 Sicurezza

Entrambi gli script implementano:
- ✅ Firewall configurato (UFW)
- ✅ Headers di sicurezza HTTP
- ✅ Nginx hardening
- ✅ Utenti non-root per servizi
- ✅ Compressione Gzip
- ✅ Cache ottimizzata
- ✅ Health checks

## 🚨 Risoluzione Problemi

### Problemi Comuni

**Raspberry Pi:**
```bash
# Nginx non si avvia
sudo nginx -t                    # Test config
sudo systemctl status nginx     # Stato servizio

# App non si carica
sudo tail -f /var/log/nginx/error.log

# Memoria insufficiente durante build
sudo dphys-swapfile swapoff
sudo dphys-swapfile swapon
```

**Docker:**
```bash
# Container non si avvia
docker compose logs haccp-app

# Problemi permessi
sudo usermod -aG docker $USER
# Poi logout/login

# Porta già in uso
docker compose down
sudo netstat -tlnp | grep :80
```

### Log e Debug

**Raspberry Pi:**
- Nginx access: `/var/log/nginx/access.log`
- Nginx error: `/var/log/nginx/error.log`
- System: `sudo journalctl -u nginx`

**Docker:**
- App logs: `docker compose logs haccp-app`
- Container stats: `docker stats`
- System: `docker system df`

## 📞 Supporto

Per problemi o domande:
1. Controlla i log per errori specifici
2. Verifica che tutti i servizi siano attivi
3. Testa la connettività di rete
4. Controlla le configurazioni Supabase

## 🔄 Aggiornamenti

**Raspberry Pi:**
```bash
# Aggiornamento automatico
sudo /usr/local/bin/update-haccp-app

# Aggiornamento manuale
cd /var/www/haccp-app
npm install
npm run build
sudo systemctl reload nginx
```

**Docker:**
```bash
# Aggiornamento automatico
./update.sh

# Aggiornamento manuale
docker compose pull
docker compose up --build -d
```