# Tracker HACCP - Raspberry Pi Installation

## Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash
```

**Requirements:** Raspberry Pi OS 64-bit, 2GB+ RAM

## Access

- **App:** https://haccp.local
- **Admin:** https://haccp.local/_/

## Commands

```bash
haccp-status    # Check services
haccp-backup    # Backup database
haccp-logs      # View logs
```

## Structure

```
/opt/haccp/
├── pocketbase/
│   ├── bin/pocketbase
│   ├── pb_data/          # DATABASE
│   └── pb_migrations/
├── frontend/             # React build
├── logs/
└── backups/
```

## Files

| File | Description |
|------|-------------|
| `install.sh` | Main installer |
| `pocketbase/pocketbase.service` | Systemd service |
| `caddy/Caddyfile` | Reverse proxy |
| `INSTALL.md` | Full documentation |

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
