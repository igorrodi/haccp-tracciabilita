# 🚀 Script di Installazione HACCP App

Questa directory contiene gli script per installare e deployare l'applicazione HACCP su diverse piattaforme.

## 📋 Contenuto

### 🍓 Raspberry Pi 5 con Ubuntu Server
- **`install-raspberry-pi.sh`**: Script completo per installazione su Raspberry Pi 5

### 🐳 Installazione Docker 
- **`docker/build-and-run.sh`**: **RACCOMANDATO** - Script tutto-in-uno per build e deploy automatico
- **`docker/`**: Directory con tutti i file per deployment Docker avanzato
  - `Dockerfile`: Immagine Docker ottimizzata per produzione
  - `Dockerfile.dev`: Immagine Docker per sviluppo con hot reload
  - `docker-compose.yml`: Configurazione servizi
  - `nginx.conf`: Configurazione web server
  - `install-docker.sh`: Script installazione Docker completo

## 🛠️ Utilizzo

### 🚀 Installazione Docker Semplificata (RACCOMANDATO)

**Un solo comando per tutto:**

```bash
# Dal root del progetto
chmod +x scripts/docker/build-and-run.sh
./scripts/docker/build-and-run.sh

# Opzioni disponibili:
./scripts/docker/build-and-run.sh --help           # Mostra aiuto completo
./scripts/docker/build-and-run.sh -p 8080          # Usa porta 8080 invece di 80
./scripts/docker/build-and-run.sh --dev            # Modalità sviluppo con hot reload
./scripts/docker/build-and-run.sh --clean          # Pulisci e rebuilda tutto
./scripts/docker/build-and-run.sh --no-cache       # Build senza cache Docker
```

**Lo script automaticamente:**
- ✅ Verifica prerequisiti (Docker, permessi, etc.)
- ✅ Crea l'immagine Docker dell'app (produzione o sviluppo)
- ✅ Configura Nginx con sicurezza ottimizzata  
- ✅ Avvia il container con health check automatici
- ✅ Crea script di gestione (haccp-update.sh, haccp-backup.sh, haccp-monitor.sh)
- ✅ Verifica il deployment e mostra URL di accesso
- ✅ Supporta modalità sviluppo con hot reload (Vite dev server + Nginx)

**Al termine avrai:**
- App accessibile su `http://localhost` (o porta specificata)
- Script `haccp-update.sh` per aggiornamenti
- Script `haccp-backup.sh` per backup automatici  
- Script `haccp-monitor.sh` per monitoraggio stato

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

**Script di gestione (build-and-run.sh):**
```bash
# Script generati automaticamente nella root del progetto:
./haccp-update.sh       # Aggiorna l'app (rebuild e redeploy)
./haccp-backup.sh       # Crea backup completo del container
./haccp-monitor.sh      # Mostra stato, risorse e health check

# Gestione diretta container:
docker ps               # Stato container
docker logs haccp-container    # Log applicazione
docker restart haccp-container # Riavvia container
docker stop haccp-container    # Ferma container
```

**Script di gestione (docker-compose avanzato):**
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