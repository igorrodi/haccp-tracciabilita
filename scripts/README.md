# 🚀 Tracker HACCP - Installazione Raspberry Pi

Sistema di tracciabilità HACCP autogestito con HTTPS locale.

**Stack:** React + Vite + PocketBase + Caddy

---

## ⚡ Installazione Rapida (UN COMANDO)

```bash
curl -sSL https://raw.githubusercontent.com/USER/REPO/main/scripts/install.sh | sudo bash
```

Questo comando:
- Installa tutti i pacchetti necessari
- Scarica e configura PocketBase (ARM64)
- Installa Caddy come reverse proxy HTTPS
- Configura il dominio locale `haccp.local`
- Avvia tutti i servizi

**Requisiti:** Raspberry Pi OS 64-bit, 2GB+ RAM, 8GB+ storage

---

## 🌐 Accesso

| URL | Descrizione |
|-----|-------------|
| `https://haccp.local` | App principale |
| `https://haccp.local/_/` | Admin PocketBase |
| `https://192.168.x.x` | Accesso via IP |

> Accetta il certificato self-signed al primo accesso.

---

## 📁 Struttura File

```
/opt/haccp/
├── bin/pocketbase      # Backend
├── data/               # Database (BACKUP!)
├── web/                # Frontend React
├── backups/            # Backup automatici
└── logs/               # Log applicazione

/etc/caddy/Caddyfile    # Config reverse proxy
/etc/systemd/system/pocketbase.service
```

---

## 🔧 Comandi Utili

```bash
# Stato servizi
haccp-status

# Log in tempo reale
haccp-logs

# Backup database
haccp-backup

# Aggiorna frontend
haccp-update

# Controllo manuale
sudo systemctl status pocketbase caddy
sudo systemctl restart pocketbase caddy
```

---

## 🛡️ Architettura

```
Browser → https://haccp.local:443
              │
              ▼
         ┌─────────┐
         │  CADDY  │ ← HTTPS, headers, compressione
         └────┬────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
/api/* /_/*         /* (static)
    │                   │
    ▼                   ▼
PocketBase         /opt/haccp/web
:8090 (local)      index.html, assets
```

- PocketBase: solo `127.0.0.1` (non esposto)
- HTTPS obbligatorio con certificato locale
- Funziona offline senza internet

---

## 📦 Installazione Manuale (Offline)

Se non hai internet sul Raspberry Pi:

### 1. Prepara su PC

```bash
# Compila frontend
npm install && npm run build

# Scarica PocketBase ARM64
# https://pocketbase.io/docs/ → pocketbase_*_linux_arm64.zip
```

### 2. Copia su USB

```
USB/
├── pocketbase_linux_arm64.zip
├── dist/                 ← cartella build
└── install.sh            ← da scripts/
```

### 3. Su Raspberry Pi

```bash
# Monta USB e esegui
sudo mount /dev/sda1 /mnt
cd /mnt
sudo bash install.sh --offline
```

---

## 📋 File Disponibili

| File | Descrizione |
|------|-------------|
| `install.sh` | Installer principale (Caddy + PocketBase) |
| `pocketbase/pocketbase.service` | Servizio systemd |
| `caddy/Caddyfile` | Configurazione reverse proxy |
| `pocketbase/pb_schema.json` | Schema database |
| `INSTALL.md` | Documentazione dettagliata |

---

## 🔧 Comandi Utili

```bash
# Stato servizi
sudo systemctl status pocketbase nginx

# Log PocketBase
sudo journalctl -u pocketbase -f

# Backup manuale
sudo tar czf backup-$(date +%Y%m%d).tar.gz /opt/haccp-app/data

# Riavvia tutto
sudo systemctl restart pocketbase nginx
```

---

## ❓ Problemi Comuni

| Problema | Soluzione |
|----------|-----------|
| Pagina non carica | `sudo systemctl status nginx pocketbase` |
| Errore certificato | Normale, accettalo nel browser |
| Nome .local non funziona | Usa IP diretto: `https://192.168.1.X` |
| PocketBase non parte | `sudo journalctl -u pocketbase -n 50` |
