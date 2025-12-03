# HACCP App - Versione PocketBase (Standalone)

Versione leggera dell'applicazione HACCP che utilizza **PocketBase** invece di Supabase.  
Ideale per Raspberry Pi 5 e installazioni locali con risorse limitate.

## 🎯 Vantaggi rispetto a Supabase

| Caratteristica | Supabase | PocketBase |
|---------------|----------|------------|
| RAM richiesta | ~1GB | ~50MB |
| Spazio disco | ~2GB | ~30MB |
| Complessità | Docker + 5 servizi | Single binary |
| Dipendenze | Docker, PostgreSQL | Nessuna |
| Avvio | 2-3 minuti | <1 secondo |

## 📦 Requisiti

- Raspberry Pi 5 (4GB+ RAM consigliato) o qualsiasi Linux ARM64
- Ubuntu Server 24.04 o Raspberry Pi OS (64-bit)
- Connessione internet per installazione

## 🚀 Installazione Automatica

```bash
curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/pocketbase/install-pocketbase-rpi.sh | sudo bash
```

## 🔧 Cosa viene installato

1. **PocketBase** - Database SQLite con API REST e auth integrata
2. **Nginx** - Web server per servire l'app React
3. **Certificato SSL** - Self-signed per HTTPS locale
4. **mDNS (Avahi)** - Accesso via `haccp-app.local`

## 📱 Accesso

Dopo l'installazione:

- **App**: `https://haccp-app.local` o `https://[IP-Raspberry]`
- **Admin PocketBase**: `https://haccp-app.local/_/`

### Primo accesso

1. Vai su `https://haccp-app.local/_/` 
2. Crea l'account admin di PocketBase
3. Torna all'app e registra il primo utente

## 📋 Comandi Utili

```bash
# Verifica stato servizi
haccp-status

# Aggiorna l'applicazione
haccp-update

# Backup manuale
haccp-backup

# Restart servizi
sudo systemctl restart pocketbase
sudo systemctl restart nginx

# Logs
sudo journalctl -u pocketbase -f
sudo journalctl -u nginx -f
```

## 📂 Struttura Directory

```
/opt/haccp-app/
├── pocketbase          # Binary PocketBase
├── pb_data/            # Database e file
│   ├── data.db         # SQLite database
│   └── storage/        # File uploads
└── www/                # Build React app

/var/backups/haccp/     # Backup automatici
```

## 🔐 Backup e Restore

### Backup Automatico
- Eseguito ogni giorno alle 2:00
- Ultimi 7 backup mantenuti
- Directory: `/var/backups/haccp/`

### Restore
```bash
# Stop servizio
sudo systemctl stop pocketbase

# Restore
tar -xzf /var/backups/haccp/haccp_backup_XXXXXXXX_XXXXXX.tar.gz -C /opt/haccp-app/

# Restart
sudo systemctl start pocketbase
```

## ⚙️ Configurazione Avanzata

### Cambiare porta PocketBase
```bash
sudo nano /etc/systemd/system/pocketbase.service
# Modifica --http=127.0.0.1:8090
sudo systemctl daemon-reload
sudo systemctl restart pocketbase
```

### Aggiungere collezioni PocketBase

1. Accedi a `https://haccp-app.local/_/`
2. Vai su "Collections"
3. Crea le collezioni necessarie:
   - `products` (prodotti)
   - `lots` (lotti)
   - `suppliers` (fornitori)
   - `categories` (categorie)

## 🔄 Aggiornamento

```bash
haccp-update
```

Oppure manualmente:
```bash
cd /tmp
git clone https://github.com/igorrodi/haccp-tracciabilita.git
cd haccp-tracciabilita
npm ci && npm run build
sudo cp -r dist/* /opt/haccp-app/www/
```

## 🐛 Troubleshooting

### App non carica
```bash
# Verifica servizi
haccp-status

# Verifica logs
sudo journalctl -u pocketbase --since "10 minutes ago"
sudo journalctl -u nginx --since "10 minutes ago"
```

### Errore 502 Bad Gateway
```bash
# PocketBase non risponde
sudo systemctl restart pocketbase
```

### Certificato SSL non valido
Il certificato è self-signed. Accetta l'eccezione nel browser.

### haccp-app.local non raggiungibile
```bash
# Verifica Avahi
sudo systemctl status avahi-daemon

# Usa IP diretto
hostname -I
```

## 📊 Risorse Utilizzate

Dopo l'installazione:
- **CPU**: ~1% a riposo
- **RAM**: ~50-100MB
- **Disco**: ~100MB (senza dati)

## 🔗 Link Utili

- [PocketBase Docs](https://pocketbase.io/docs/)
- [PocketBase JS SDK](https://github.com/pocketbase/js-sdk)
