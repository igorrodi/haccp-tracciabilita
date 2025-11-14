# 🚀 HACCP App - Installazione Completa Raspberry Pi

## Script di Installazione Automatica

Questo script configura **TUTTO** in modo automatico sul Raspberry Pi:

✅ HACCP App da GitHub  
✅ **Supabase locale completo** (database, auth, storage, realtime)  
✅ HTTPS con certificati SSL  
✅ Dominio locale `.local` (mDNS)  
✅ OCR (riconoscimento testo)  
✅ Ritaglio e editing immagini  
✅ Backup automatico su Mega  
✅ PWA installabile  

---

## 📋 Prerequisiti

- **Raspberry Pi 5** con Raspberry Pi OS Lite (64-bit)
- **Almeno 4GB RAM** (per Supabase)
- **16GB storage minimo** disponibili
- Connessione internet
- Accesso SSH
- Account GitHub con il repository HACCP App
- (Opzionale) Account Mega.nz per backup

---

## 🚀 Installazione

### 1. Accedi al Raspberry Pi via SSH

```bash
ssh pi@raspberrypi.local
# oppure
ssh pi@[IP_DEL_RASPBERRY]
```

### 2. Scarica lo script

```bash
curl -O https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-raspberry-pi-complete.sh
```

### 3. Rendi lo script eseguibile

```bash
chmod +x install-raspberry-pi-complete.sh
```

### 4. Esegui lo script (SENZA sudo!)

```bash
./install-raspberry-pi-complete.sh
```

### 5. Segui le istruzioni interattive

Lo script ti chiederà:

- **Nome dominio locale** (es. `haccp-app` → diventerà `haccp-app.local`)
- **URL repository GitHub** (default: `https://github.com/igorrodi/haccp-tracciabilita.git`)
- **Branch GitHub** (default: `main`)
- **Configurazione backup Mega** (opzionale)
  - Email Mega
  - Password Mega

### 6. Riavvia

Alla fine dell'installazione, lo script ti chiederà se vuoi riavviare.
**Raccomandato riavviare per completare setup Docker.**

---

## 🌐 Accesso all'App

Dopo l'installazione, l'app sarà accessibile:

### Da computer/tablet/smartphone nella stessa rete:

```
https://haccp-app.local
```

### Supabase Studio (gestione database):

```
http://haccp-app.local:54323
```

oppure

```
http://[IP_DEL_RASPBERRY]:54323
```

> 💡 **Credenziali Supabase Studio**: Lascia vuote entrambe (email e password)

### Da browser (se .local non funziona):

```
https://[IP_DEL_RASPBERRY]
```

> ⚠️ **Nota certificato SSL**  
> Il certificato è self-signed, il browser mostrerà un avviso di sicurezza.  
> Clicca "Avanzate" → "Procedi comunque" per accedere.

---

## 🗄️ Supabase Locale

### Cosa è incluso?

Il setup installa un'istanza completa di Supabase sul Raspberry Pi:

- **PostgreSQL** - Database principale
- **PostgREST** - API REST automatica
- **GoTrue** - Autenticazione e gestione utenti
- **Storage** - File storage
- **Realtime** - Subscriptions in tempo reale
- **Studio** - Interface web di amministrazione

### Accesso ai servizi

| Servizio | URL | Porta |
|----------|-----|-------|
| API Gateway | `http://[IP]:8000` | 8000 |
| Studio UI | `http://[IP]:54323` | 54323 |
| PostgreSQL | `postgresql://postgres:[PASSWORD]@[IP]:5432/postgres` | 5432 |

### Credenziali predefinite

**ANON KEY** (per frontend):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

**SERVICE_ROLE KEY** (per backend):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

**Database Password**:
```
your-super-secret-and-long-postgres-password
```

> ⚠️ **IMPORTANTE**: Cambia queste credenziali in produzione!

---

## 🛠️ Comandi di Gestione

Dopo l'installazione, avrai questi comandi disponibili:

### Aggiornare l'app da GitHub

```bash
sudo update-haccp
```

Questo comando:
- Scarica gli ultimi aggiornamenti da GitHub
- Reinstalla dipendenze se necessario
- Ricompila l'app
- Riavvia Nginx

### Backup manuale su Mega

```bash
sudo backup-haccp
```

Crea un backup e lo carica su Mega.nz.  
**Backup automatico**: Ogni notte alle 2:00 AM.

### Monitorare lo stato

```bash
sudo monitor-haccp
```

Mostra:
- Stato Nginx
- Scadenza certificati SSL
- Dominio .local attivo
- Spazio disco
- Ultimo aggiornamento

### Gestione Supabase

```bash
# Avviare Supabase
cd ~/supabase-local
docker compose up -d

# Fermare Supabase
cd ~/supabase-local
docker compose down

# Riavviare Supabase
cd ~/supabase-local
docker compose restart

# Vedere log Supabase
cd ~/supabase-local
docker compose logs -f

# Vedere solo log del database
cd ~/supabase-local
docker compose logs -f db

# Backup database
pg_dump -h localhost -U postgres -d postgres > backup.sql

# Restore database
psql -h localhost -U postgres -d postgres < backup.sql
```

### Altri comandi utili

```bash
# Riavviare Nginx
sudo systemctl restart nginx

# Vedere log Nginx
sudo journalctl -u nginx -f

# Vedere log backup
tail -f /var/log/haccp-backup.log

# Test dominio .local
avahi-browse -t _http._tcp
```

---

## 📱 Installare come PWA

1. Apri l'app nel browser: `https://haccp-app.local`
2. Nel menu del browser, cerca "Installa app" o "Aggiungi a Home"
3. L'app verrà installata come applicazione nativa

---

## 🗄️ Setup Database Iniziale

Dopo l'installazione, devi configurare il database:

### 1. Accedi a Supabase Studio

```
http://[IP_RASPBERRY]:54323
```

Lascia vuote le credenziali (premi semplicemente "Sign in")

### 2. Applica le Migrations

Nella cartella `supabase/migrations` del progetto trovi tutte le migrations SQL.

**Opzione A - Dalla Studio UI:**
1. Vai su SQL Editor
2. Copia il contenuto di ogni migration
3. Esegui in ordine cronologico

**Opzione B - Da terminale:**
```bash
cd /opt/haccp-app

# Installa Supabase CLI
npm install -g supabase

# Collega al progetto locale
supabase link --project-ref local

# Applica tutte le migrations
supabase db push
```

### 3. Crea Primo Utente Admin

1. Apri l'app: `https://haccp-app.local`
2. Registra un nuovo account
3. In Supabase Studio, vai su Authentication → Users
4. Trova il tuo utente, copia l'ID
5. In SQL Editor, esegui:

```sql
-- Inserisci ruolo admin
INSERT INTO public.user_roles (user_id, role, authorized_by)
VALUES ('TUO-USER-ID', 'admin', 'TUO-USER-ID');
```

6. Ricarica l'app - ora sei admin!

---

## 🔧 Funzionalità Installate

### OCR (Riconoscimento Testo)

L'app può riconoscere testo da immagini usando Tesseract OCR.

**Lingue installate**:
- Italiano
- Inglese

### Editing Immagini

ImageMagick è installato per operazioni come:
- Ritaglio foto
- Resize
- Conversione formati
- Watermark

### Backup Automatico

Se configurato, ogni notte alle 2:00 AM viene eseguito un backup automatico:

- Codice sorgente (esclusi `node_modules` e `dist`)
- Configurazioni Nginx
- Certificati SSL

Backup salvati su: `/HACCP-Backups` su Mega.nz

---

## 🔐 Sicurezza

### Firewall (UFW)

Porte aperte:
- **22** - SSH
- **80** - HTTP (redirect a HTTPS)
- **443** - HTTPS
- **5353** - mDNS

### Certificati SSL

- Certificati self-signed con validità 365 giorni
- Posizione: `/etc/ssl/haccp/`
- Rinnovo: manuale (o usa Let's Encrypt per produzione)

---

## 🐛 Troubleshooting

### Supabase non si avvia

**Verifica status containers:**

```bash
cd ~/supabase-local
docker compose ps
```

**Visualizza log per errori:**

```bash
cd ~/supabase-local
docker compose logs
```

**Problemi comuni:**
- **Memoria insufficiente**: Raspberry Pi ha meno di 4GB RAM
- **Porta occupata**: Altra app usa porta 8000 o 5432
- **Permessi Docker**: Utente non nel gruppo `docker`

**Soluzioni:**

```bash
# Aggiungi utente a docker group
sudo usermod -aG docker $USER
newgrp docker

# Libera porte
sudo lsof -i :8000
sudo lsof -i :5432
sudo kill -9 [PID]

# Ricrea containers
cd ~/supabase-local
docker compose down -v
docker compose up -d
```

### L'app non si connette a Supabase

**Verifica configurazione client:**

```bash
cat /opt/haccp-app/src/integrations/supabase/client.ts
```

Deve contenere la logica per `http://localhost:8000` o `http://[hostname]:8000`

**Test connessione:**

```bash
curl http://localhost:8000/rest/v1/
```

Dovrebbe rispondere con informazioni sull'API.

### Il dominio .local non funziona

**Verifica che Avahi sia attivo:**

```bash
sudo systemctl status avahi-daemon
```

**Test mDNS:**

```bash
avahi-browse -t _http._tcp
```

Dovresti vedere "HACCP App" nella lista.

### L'app non carica

**Controlla Nginx:**

```bash
sudo systemctl status nginx
sudo nginx -t
```

**Visualizza log errori:**

```bash
sudo journalctl -u nginx -n 50
```

### Backup Mega non funziona

**Verifica credenziali:**

```bash
cat ~/.megarc
```

**Test manuale:**

```bash
megatools df
```

### Rigenerare certificati SSL

```bash
sudo rm -rf /etc/ssl/haccp/*
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/haccp/private.key \
    -out /etc/ssl/haccp/certificate.crt \
    -subj "/C=IT/ST=Italy/L=City/O=HACCP/CN=haccp-app.local"
sudo systemctl reload nginx
```

---

## 📊 Prestazioni e Risorse

### Requisiti minimi

- **RAM**: 4GB (8GB raccomandati per Supabase)
- **Storage**: 16GB liberi (database può crescere)
- **CPU**: Raspberry Pi 5 (Pi 4 funziona ma più lento)
- **Rete**: 100Mbps+ per accesso remoto fluido

### Monitoraggio risorse

```bash
# Uso RAM
free -h

# Uso disco
df -h

# Uso CPU
htop

# Container Docker
docker stats
```

### Ottimizzazioni Supabase

Se Supabase è lento, puoi ridurre i servizi:

```bash
cd ~/supabase-local
nano docker-compose.yml
```

Commenta servizi non necessari (es: `studio` se usi solo l'API)

---

## 🔄 Aggiornamento da Versione Precedente

Se hai già una versione installata:

1. **Backup dati importanti**
2. **Rimuovi installazione precedente:**

```bash
sudo rm -rf /opt/haccp-app
sudo rm /etc/nginx/sites-enabled/haccp-app
sudo rm /etc/nginx/sites-available/haccp-app
```

3. **Esegui nuovo script di installazione**

---

## 📞 Supporto

- **Repository**: [GitHub](https://github.com/igorrodi/haccp-tracciabilita)
- **Issues**: [GitHub Issues](https://github.com/igorrodi/haccp-tracciabilita/issues)

---

## 📝 Note Finali

### Produzione

Per un ambiente di produzione, considera:

1. **Certificati Let's Encrypt** invece di self-signed
2. **Dominio reale** invece di `.local`
3. **Backup regolari** del database Supabase
4. **Monitoring** (Prometheus, Grafana)
5. **Cambia credenziali** di default di Supabase

### Sicurezza Supabase

**Cambia password database:**

```bash
cd ~/supabase-local
nano docker-compose.yml
```

Modifica `POSTGRES_PASSWORD` e riavvia.

**Cambia JWT secrets:**

Nel `docker-compose.yml`, cambia:
- `GOTRUE_JWT_SECRET`
- `PGRST_JWT_SECRET`

Poi rigenera le chiavi ANON e SERVICE_ROLE con il nuovo secret.

### Sviluppo

Per sviluppo locale:

```bash
cd /opt/haccp-app
npm run dev
```

L'app sarà disponibile su `http://localhost:8080`

---

**Buon lavoro con HACCP App! 🎉**
