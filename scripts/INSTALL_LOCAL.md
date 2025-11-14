# Installazione Locale HACCP App su Raspberry Pi 5

Guida completa per installare HACCP App in locale su Raspberry Pi 5 con tutte le funzionalità: Supabase locale, dominio .local, HTTPS, OCR, e web app installabile.

## 📋 Requisiti

- **Hardware**: Raspberry Pi 5 (4GB RAM minimo, 8GB consigliato)
- **Storage**: MicroSD da almeno 32GB (64GB consigliato per i backup)
- **OS**: Raspberry Pi OS Lite 64-bit (ultima versione)
- **Rete**: Connessione ethernet o WiFi configurata
- **Opzionale**: Account GitHub per aggiornamenti automatici

## 🚀 Installazione Rapida

### 1. Prepara il Sistema

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Scarica lo script di installazione
cd ~
wget https://raw.githubusercontent.com/TUO_USERNAME/TUO_REPO/main/scripts/install-raspberry-pi-local.sh
chmod +x install-raspberry-pi-local.sh
```

### 2. Installazione Base (senza GitHub)

Se hai il codice localmente in `/tmp/haccp-app`:

```bash
./install-raspberry-pi-local.sh
```

### 3. Installazione con GitHub

Per abilitare gli aggiornamenti automatici:

```bash
# Configura il repository GitHub
export GITHUB_REPO="https://github.com/TUO_USERNAME/haccp-app.git"

# Esegui l'installazione
./install-raspberry-pi-local.sh
```

⏱️ **Tempo di installazione**: circa 15-20 minuti

## 📦 Cosa Viene Installato

Lo script installa e configura automaticamente:

### Software di Base
- ✅ Node.js 20.x
- ✅ Nginx (web server)
- ✅ Docker & Docker Compose
- ✅ Git

### Servizi HACCP
- ✅ **Supabase** (database locale con PostgreSQL)
- ✅ **OCR** (Tesseract per riconoscimento testo)
- ✅ **Image Processing** (ImageMagick per ritaglio foto)
- ✅ **mDNS/Avahi** (dominio .local)
- ✅ **SSL/HTTPS** (certificati self-signed)

### Funzionalità Applicazione
- ✅ Web app React ottimizzata
- ✅ PWA installabile (funziona offline)
- ✅ Backup automatici giornalieri
- ✅ Script di aggiornamento semplificato
- ✅ Monitoraggio servizi

## 🌐 Accesso all'Applicazione

Dopo l'installazione, puoi accedere all'app da qualsiasi dispositivo nella tua rete:

### Da Browser Web

```
https://haccp-app.local          (consigliato - via mDNS)
https://192.168.1.XXX            (IP del Raspberry Pi)
https://localhost                (direttamente sul Raspberry Pi)
```

### Supabase Studio

```
http://localhost:8000            (solo dal Raspberry Pi)
http://192.168.1.XXX:8000       (dalla tua rete locale)
```

### ⚠️ Avviso Certificato SSL

Il browser mostrerà un avviso perché il certificato è self-signed. È normale e sicuro nella tua rete locale.

**Per rimuovere l'avviso:**

```bash
# Su Raspberry Pi
sudo cp /etc/ssl/haccp/cert.pem /usr/local/share/ca-certificates/haccp.crt
sudo update-ca-certificates

# Su computer Windows
# Scarica cert.pem e importalo in "Autorità di certificazione radice attendibili"

# Su Mac
# Scarica cert.pem e aggiungilo al Portachiavi con "Considera sempre attendibile"

# Su Android/iOS
# Scarica e installa il certificato dalle impostazioni di sicurezza
```

## 🔧 Comandi di Gestione

### Aggiornamento Applicazione

```bash
# Aggiorna l'app da GitHub (se configurato)
sudo update-haccp
```

Questo comando:
1. Scarica gli ultimi aggiornamenti da GitHub
2. Installa nuove dipendenze
3. Ricompila l'applicazione
4. Riavvia i servizi

### Backup e Ripristino

```bash
# Crea un backup completo
sudo backup-haccp

# I backup vengono salvati in: /opt/backups/haccp/
# Backup automatico ogni giorno alle 2:00 AM
```

**Ripristinare un backup:**

```bash
# Database
sudo docker exec -i supabase-db psql -U postgres < /opt/backups/haccp/db_TIMESTAMP.sql

# Applicazione
sudo tar -xzf /opt/backups/haccp/app_TIMESTAMP.tar.gz -C /opt/
sudo systemctl restart nginx
```

### Monitoraggio

```bash
# Verifica stato servizi
sudo monitor-haccp

# Log in tempo reale
sudo journalctl -u nginx -f              # Log Nginx
sudo journalctl -u supabase -f           # Log Supabase
```

### Controllo Servizi

```bash
# Nginx
sudo systemctl status nginx
sudo systemctl restart nginx

# Supabase
sudo systemctl status supabase
sudo systemctl restart supabase

# Verifica container Docker
sudo docker ps
```

## 📱 Installare l'App come PWA

L'app può essere installata come una vera app su dispositivi mobili e desktop:

### Su Android/iOS
1. Apri `https://haccp-app.local` in Chrome/Safari
2. Tocca il menu del browser (⋮ o condividi)
3. Seleziona "Aggiungi a schermata Home" o "Installa app"
4. L'app apparirà come icona sulla home screen

### Su Desktop (Chrome/Edge)
1. Apri `https://haccp-app.local`
2. Clicca sull'icona di installazione (+) nella barra degli indirizzi
3. Conferma l'installazione
4. L'app si aprirà in una finestra dedicata

### Vantaggi PWA
- ✅ Funziona offline
- ✅ Avvio rapido dalla home screen
- ✅ Notifiche push (se configurate)
- ✅ Aspetto nativo senza browser

## 🔐 Configurazione Supabase

### Accesso a Supabase Studio

1. Apri `http://192.168.1.XXX:8000` (IP del tuo Raspberry Pi)
2. Le credenziali sono salvate in: `/opt/supabase/supabase/docker/.env`

### Importare il Database Esistente

Se hai già un database Supabase cloud:

```bash
# 1. Esporta il database dal cloud (dal Supabase Dashboard)
# Scarica il dump SQL

# 2. Copia il file sul Raspberry Pi
scp database_dump.sql pi@haccp-app.local:/tmp/

# 3. Importa nel database locale
sudo docker exec -i supabase-db psql -U postgres < /tmp/database_dump.sql
```

### Configurare Email (SMTP)

Per inviare email di conferma/inviti:

```bash
# Edita la configurazione Supabase
sudo nano /opt/supabase/supabase/docker/.env

# Aggiungi configurazione SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SENDER_NAME=HACCP App

# Riavvia Supabase
sudo systemctl restart supabase
```

## 🛠️ Configurazione Avanzata

### Cambiare il Nome del Dominio

```bash
# Edita /etc/avahi/services/haccp-app.service
sudo nano /etc/avahi/services/haccp-app.service

# Cambia il nome e riavvia
sudo systemctl restart avahi-daemon
```

### Aumentare le Performance

```bash
# Aumenta la memoria per PostgreSQL
sudo nano /opt/supabase/supabase/docker/docker-compose.yml

# Modifica sotto postgres:
environment:
  - POSTGRES_SHARED_BUFFERS=512MB
  - POSTGRES_EFFECTIVE_CACHE_SIZE=2GB

sudo systemctl restart supabase
```

### Backup su Storage Esterno

```bash
# Monta un disco USB
sudo mkdir -p /mnt/backup
sudo mount /dev/sda1 /mnt/backup

# Modifica script di backup
sudo nano /usr/local/bin/backup-haccp

# Cambia BACKUP_DIR="/mnt/backup/haccp"
```

## 🐛 Risoluzione Problemi

### L'app non è raggiungibile via .local

```bash
# Verifica che avahi sia attivo
sudo systemctl status avahi-daemon
sudo systemctl restart avahi-daemon

# Testa la risoluzione del nome
avahi-resolve -n haccp-app.local

# Verifica che il servizio sia pubblicato
avahi-browse -a -t
```

### Supabase non si avvia

```bash
# Verifica i log
cd /opt/supabase/supabase/docker
sudo docker compose logs

# Riavvia i container
sudo docker compose down
sudo docker compose up -d

# Verifica lo spazio disco
df -h
```

### Errori di Certificato SSL

```bash
# Rigenera i certificati
sudo rm -rf /etc/ssl/haccp/*
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/haccp/key.pem \
    -out /etc/ssl/haccp/cert.pem \
    -subj "/C=IT/ST=Italy/L=Local/O=HACCP/CN=haccp-app.local"

sudo systemctl restart nginx
```

### Performance Lente

```bash
# Verifica utilizzo risorse
htop

# Ottimizza Node.js
export NODE_OPTIONS="--max-old-space-size=2048"

# Ridimensiona cache Nginx
sudo nano /etc/nginx/nginx.conf
# Aggiungi: proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=cache:10m;
```

### L'app non si aggiorna

```bash
# Verifica configurazione Git
cd /opt/haccp-app
git status
git remote -v

# Aggiornamento manuale
git pull origin main
npm install
npm run build
sudo systemctl reload nginx
```

## 📊 Monitoraggio e Log

### Location dei Log

```bash
# Nginx
/var/log/nginx/access.log
/var/log/nginx/error.log

# Supabase
cd /opt/supabase/supabase/docker
sudo docker compose logs -f

# Sistema
sudo journalctl -xe
```

### Statistiche d'Uso

```bash
# Spazio disco
df -h

# Memoria
free -h

# Processi
htop

# Temperatura CPU (importante per Raspberry Pi)
vcgencmd measure_temp
```

## 🔄 Aggiornamento Sistema

```bash
# Aggiorna Raspberry Pi OS
sudo apt update && sudo apt upgrade -y

# Aggiorna Docker
sudo apt install --only-upgrade docker-ce docker-ce-cli

# Aggiorna Supabase
cd /opt/supabase/supabase
git pull
cd docker
sudo docker compose pull
sudo docker compose up -d
```

## 💾 Migrazione da Cloud a Locale

Se stai migrando da Supabase Cloud a installazione locale:

1. **Esporta il database dal cloud**
   - Dashboard Supabase → Database → Export

2. **Esporta i file da Storage**
   ```bash
   # Usa Supabase CLI
   supabase storage download --project-ref TUO_PROJECT_REF
   ```

3. **Importa nel sistema locale**
   ```bash
   # Database
   sudo docker exec -i supabase-db psql -U postgres < export.sql
   
   # Storage (copia i file nella cartella corretta)
   sudo docker cp ./storage-files supabase-storage:/var/lib/storage/
   ```

4. **Aggiorna variabili ambiente nell'app**
   - Le variabili sono già configurate per puntare a localhost

## 🆘 Supporto

### Risorse Utili
- 📖 [Documentazione Supabase](https://supabase.com/docs)
- 📖 [Guida Raspberry Pi](https://www.raspberrypi.com/documentation/)
- 📖 [PWA Best Practices](https://web.dev/progressive-web-apps/)

### File di Configurazione Importanti

```
/opt/haccp-app/              # Applicazione
/opt/supabase/               # Supabase
/etc/nginx/sites-available/  # Configurazione Nginx
/etc/ssl/haccp/              # Certificati SSL
/etc/avahi/services/         # Servizi mDNS
/opt/backups/haccp/          # Backup
```

### Comandi Rapidi di Diagnostica

```bash
# Test completo del sistema
sudo monitor-haccp
curl -k https://localhost
sudo systemctl status nginx supabase avahi-daemon
sudo docker ps
```

## ⚡ Ottimizzazioni per Produzione

### 1. Usa SSD invece di MicroSD
- Molto più veloce e affidabile
- Collega un SSD USB 3.0 al Raspberry Pi

### 2. Overclock Raspberry Pi 5
```bash
# Edita config.txt
sudo nano /boot/firmware/config.txt

# Aggiungi (con dissipatore!)
arm_freq=2800
over_voltage=8
```

### 3. Abilita Swap su SSD
```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=4096
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 4. Backup automatico su Cloud
```bash
# Installa rclone per backup su Google Drive/Dropbox
curl https://rclone.org/install.sh | sudo bash
rclone config

# Aggiungi al cron
0 3 * * * rclone sync /opt/backups/haccp remote:haccp-backup
```

## 📝 Note Finali

- ✅ Il sistema è pronto per uso in produzione su rete locale
- ✅ Tutti i servizi si avviano automaticamente al boot
- ✅ I backup vengono eseguiti automaticamente ogni notte
- ✅ Gli aggiornamenti sono semplificati con `update-haccp`
- ⚠️ Considera l'uso di un UPS per il Raspberry Pi
- ⚠️ Configura un sistema di monitoring esterno per downtime

**Buon lavoro con HACCP App! 🎉**
