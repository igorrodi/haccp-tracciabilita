# Tracker HACCP - Versione PocketBase (Raspberry Pi 5)

Sistema di tracciabilità HACCP leggero e standalone per Raspberry Pi 5.

## 🚀 Installazione con un Solo Comando

```bash
curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-haccp-pocketbase.sh | sudo bash
```

**Questo è tutto!** Lo script configura automaticamente:

- ✅ PocketBase backend (~15MB RAM)
- ✅ Applicazione React frontend
- ✅ HTTPS con certificato SSL
- ✅ Dominio locale `trackerhaccp.local`
- ✅ Primo accesso guidato
- ✅ Backup automatici giornalieri
- ✅ Script di aggiornamento

## 📱 Accesso

Dopo l'installazione, apri nel browser:

- **App**: `https://trackerhaccp.local`
- **Via IP**: `https://[IP-Raspberry]`
- **Admin PocketBase**: `https://trackerhaccp.local/_/`

### Primo Accesso

1. Accetta il certificato SSL self-signed
2. Segui la procedura guidata per creare l'account admin
3. Inizia ad usare l'app!

## 📊 Vantaggi rispetto a Supabase

| Caratteristica | Supabase | PocketBase |
|---------------|----------|------------|
| RAM richiesta | ~1GB | ~15MB |
| Spazio disco | ~2GB | ~30MB |
| Complessità | Docker + 5 servizi | Single binary |
| Avvio | 2-3 minuti | <1 secondo |
| Dipendenze | Docker, PostgreSQL | Nessuna |

## 📋 Comandi Utili

```bash
# Stato sistema
trackerhaccp-status

# Aggiorna da GitHub
trackerhaccp-update

# Backup manuale
trackerhaccp-backup

# Ripristina backup
trackerhaccp-restore /var/backups/trackerhaccp/trackerhaccp-backup-XXXXXXXX.tar.gz

# Logs PocketBase
sudo journalctl -u trackerhaccp -f

# Restart servizi
sudo systemctl restart trackerhaccp
sudo systemctl restart nginx
```

## 📂 Struttura Directory

```
/opt/trackerhaccp/
├── bin/pocketbase      # Binary PocketBase
└── www/                # Build React app

/var/lib/trackerhaccp/
└── pb_data/            # Database SQLite e storage

/var/backups/trackerhaccp/  # Backup automatici (ultimi 7 giorni)
```

## 🔐 Backup

### Automatico
- Eseguito ogni giorno alle 2:00
- Ultimi 7 backup mantenuti
- Directory: `/var/backups/trackerhaccp/`

### Manuale
```bash
trackerhaccp-backup
```

### Ripristino
```bash
trackerhaccp-restore /var/backups/trackerhaccp/trackerhaccp-backup-20241207-020000.tar.gz
```

## 🔄 Aggiornamento

```bash
trackerhaccp-update
```

Lo script esegue automaticamente:
1. Backup dei dati
2. Download nuova versione da GitHub
3. Rebuild dell'app React
4. Deploy della nuova versione

## 🐛 Troubleshooting

### App non carica
```bash
trackerhaccp-status
sudo journalctl -u trackerhaccp --since "10 minutes ago"
```

### Errore 502 Bad Gateway
```bash
sudo systemctl restart trackerhaccp
sudo systemctl restart nginx
```

### trackerhaccp.local non raggiungibile
```bash
# Verifica Avahi
sudo systemctl status avahi-daemon

# Usa IP diretto
hostname -I
```

### Certificato SSL non valido
Il certificato è self-signed. Accetta l'eccezione di sicurezza nel browser.

## 📊 Risorse Utilizzate

Dopo l'installazione:
- **CPU**: ~1% a riposo
- **RAM**: ~15-50MB
- **Disco**: ~100MB (senza dati)

## 📋 Requisiti

- Raspberry Pi 5 (4GB+ RAM consigliato)
- Raspberry Pi OS (64-bit) o Ubuntu Server 24.04
- Connessione internet per installazione

## 🔗 Link Utili

- [PocketBase Docs](https://pocketbase.io/docs/)
- [PocketBase JS SDK](https://github.com/pocketbase/js-sdk)
