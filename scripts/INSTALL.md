# 🚀 Tracker HACCP - Guida Installazione Rapida

Sistema di tracciabilità HACCP per Raspberry Pi con HTTPS locale.

---

## ⚡ Installazione con UN COMANDO

```bash
curl -sSL https://raw.githubusercontent.com/USER/REPO/main/scripts/install.sh | sudo bash
```

**Requisiti:**
- Raspberry Pi 3/4/5 con OS 64-bit
- Connessione internet (solo per installazione)
- 2GB+ RAM, 8GB+ storage

---

## 🌐 Accesso all'App

Dopo l'installazione:

| Servizio | URL |
|----------|-----|
| **App** | https://haccp.local |
| **Admin PocketBase** | https://haccp.local/_/ |
| **Via IP** | https://192.168.x.x |

> ⚠️ **Nota:** Accetta il certificato self-signed nel browser al primo accesso.

---

## 🔧 Gestione Servizi

### Comandi Rapidi

```bash
# Stato completo
haccp-status

# Visualizza log
haccp-logs           # Tutti
haccp-logs pocketbase   # Solo PocketBase
haccp-logs caddy        # Solo Caddy

# Backup database
haccp-backup

# Aggiorna frontend
haccp-update
```

### Controllo Servizi

```bash
# Stato
sudo systemctl status pocketbase
sudo systemctl status caddy

# Riavvio
sudo systemctl restart pocketbase
sudo systemctl restart caddy

# Log in tempo reale
sudo journalctl -u pocketbase -f
sudo journalctl -u caddy -f
```

---

## 📁 Struttura Cartelle

```
/opt/haccp/
├── bin/           # PocketBase binary
│   └── pocketbase
├── data/          # Database PocketBase (IMPORTANTE!)
│   ├── pb_data/
│   └── pb_migrations/
├── web/           # Frontend React (file statici)
│   ├── index.html
│   └── assets/
├── backups/       # Backup automatici
├── logs/          # Log applicazione
│   ├── pocketbase.log
│   └── caddy-access.log
└── ssl/           # Certificati (gestiti da Caddy)
```

---

## 🛡️ Architettura Sicurezza

```
┌─────────────────────────────────────────────────────┐
│                    INTERNET                          │
│                       ❌                             │
│              (non esposto pubblicamente)             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                 RETE LOCALE                          │
│                                                      │
│   Browser ──────► https://haccp.local                │
│                          │                           │
│                          ▼                           │
│   ┌─────────────────────────────────────────────┐   │
│   │              CADDY (porta 443)               │   │
│   │  • HTTPS con certificato self-signed        │   │
│   │  • Security headers                          │   │
│   │  • Compressione gzip/brotli                  │   │
│   └─────────────────────────────────────────────┘   │
│                          │                           │
│          ┌───────────────┴───────────────┐          │
│          │                               │          │
│          ▼                               ▼          │
│   ┌─────────────┐               ┌─────────────┐    │
│   │   /api/*    │               │    /*       │    │
│   │   /_/*      │               │  Frontend   │    │
│   └──────┬──────┘               └──────┬──────┘    │
│          │                              │          │
│          ▼                              ▼          │
│   ┌─────────────┐               ┌─────────────┐    │
│   │ PocketBase  │               │ File Statici│    │
│   │ :8090       │               │ /opt/haccp  │    │
│   │ (localhost) │               │ /web        │    │
│   └─────────────┘               └─────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Sicurezza Implementata

- ✅ PocketBase ascolta solo su `127.0.0.1` (non esposto)
- ✅ HTTPS obbligatorio con redirect automatico
- ✅ Security headers (HSTS, X-Frame-Options, etc.)
- ✅ Certificati self-signed generati localmente
- ✅ Funziona offline (no dipendenze esterne)
- ✅ Servizi isolati con systemd hardening
- ✅ Limiti risorse per Raspberry Pi

---

## 💾 Backup e Ripristino

### Backup Manuale

```bash
# Crea backup
haccp-backup

# I backup sono in /opt/haccp/backups/
ls -la /opt/haccp/backups/
```

### Ripristino

```bash
# Stop servizi
sudo systemctl stop pocketbase

# Ripristina
sudo tar -xzf /opt/haccp/backups/haccp_YYYYMMDD_HHMMSS.tar.gz -C /opt/haccp/

# Riavvia
sudo systemctl start pocketbase
```

### Backup Automatico (Cron)

```bash
# Aggiungi backup giornaliero alle 3:00
echo "0 3 * * * root /usr/local/bin/haccp-backup" | sudo tee /etc/cron.d/haccp-backup
```

---

## 🔄 Aggiornamento Frontend

```bash
# Metodo 1: Script automatico
haccp-update

# Metodo 2: Manuale
# 1. Compila l'app sul tuo PC: npm run build
# 2. Copia i file su Raspberry Pi
scp -r dist/* pi@haccp.local:/opt/haccp/web/

# 3. Ricarica Caddy
sudo systemctl reload caddy
```

---

## ❓ Risoluzione Problemi

| Problema | Soluzione |
|----------|-----------|
| `haccp.local` non funziona | Usa IP: `https://192.168.x.x` |
| Errore certificato | Accetta il certificato nel browser |
| Pagina bianca | Verifica: `ls /opt/haccp/web/` |
| PocketBase non parte | `sudo journalctl -u pocketbase -n 50` |
| Caddy errore | `sudo caddy validate --config /etc/caddy/Caddyfile` |
| Permessi negati | `sudo chown -R haccp:haccp /opt/haccp` |

### Log Diagnostici

```bash
# Log completo
haccp-logs

# Errori PocketBase
cat /opt/haccp/logs/pocketbase-error.log

# Test configurazione Caddy
sudo caddy validate --config /etc/caddy/Caddyfile
```

---

## 📋 File di Configurazione

| File | Descrizione |
|------|-------------|
| `/etc/systemd/system/pocketbase.service` | Servizio PocketBase |
| `/etc/caddy/Caddyfile` | Configurazione Caddy |
| `/etc/avahi/services/haccp.service` | mDNS discovery |
| `/etc/hosts` | Mapping haccp.local |

---

## 🗑️ Disinstallazione

```bash
# Stop servizi
sudo systemctl stop pocketbase caddy
sudo systemctl disable pocketbase caddy

# Rimuovi servizi
sudo rm /etc/systemd/system/pocketbase.service
sudo systemctl daemon-reload

# Rimuovi app (ATTENZIONE: cancella tutti i dati!)
sudo rm -rf /opt/haccp

# Rimuovi utility
sudo rm /usr/local/bin/haccp-*

# Rimuovi utente
sudo userdel -r haccp 2>/dev/null
```
