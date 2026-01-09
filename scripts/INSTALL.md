# Tracker HACCP - Installation

## One-Command Install

```bash
curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash
```

## Access

| URL | Description |
|-----|-------------|
| https://haccp.local | App |
| https://haccp.local/_/ | PocketBase Admin |

Accept the self-signed certificate on first access.

## Service Management

```bash
# Status
haccp-status
sudo systemctl status pocketbase caddy

# Restart
sudo systemctl restart pocketbase caddy

# Logs
haccp-logs
sudo journalctl -u pocketbase -f

# Backup
haccp-backup
```

## Folder Structure

```
/opt/haccp/
├── pocketbase/
│   ├── bin/pocketbase       # Binary
│   ├── pb_data/             # Database (backup this!)
│   └── pb_migrations/       # Schema migrations
├── frontend/                # React build
├── logs/                    # Application logs
└── backups/                 # Automatic backups

/etc/caddy/Caddyfile         # Reverse proxy config
/etc/systemd/system/pocketbase.service
```

## Architecture

```
Browser → https://haccp.local:443
                    │
                    ▼
              ┌──────────┐
              │  CADDY   │  HTTPS + Security Headers
              └────┬─────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    /api/* /_/*           /* (static)
         │                   │
         ▼                   ▼
    PocketBase          /opt/haccp/frontend
    127.0.0.1:8090
```

- PocketBase: localhost only (not exposed)
- HTTPS: self-signed certificate (works offline)
- Security headers enabled
