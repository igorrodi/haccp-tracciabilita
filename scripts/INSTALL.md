# Tracker HACCP - Installation Guide

## Prerequisites

- Raspberry Pi 4/5 with 64-bit OS
- Internet connection (for initial installation only)
- Works completely offline after installation

## One-Command Install

```bash
curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash
```

> **Note:** Replace `USER` with your GitHub username.

## Access

| URL | Description |
|-----|-------------|
| https://haccp.local | App |
| https://haccp.local/_/ | PocketBase Admin |

Accept the self-signed certificate on first access.

## First Time Setup

1. Open https://haccp.local/_/
2. Create an admin account for PocketBase
3. Import collections from `Settings > Import Collections` using the schema file at `/opt/haccp/pocketbase/pb_schema.json`
4. Open https://haccp.local to use the app

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

# Update
haccp-update
```

## Folder Structure

```
/opt/haccp/
├── pocketbase/
│   ├── bin/pocketbase       # Binary
│   ├── pb_data/             # Database (backup this!)
│   ├── pb_migrations/       # Schema migrations
│   └── pb_schema.json       # Schema for import
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

## Creating Releases (for maintainers)

On your development machine:

```bash
./scripts/build-release.sh
```

Then upload `release/frontend.zip` to a new GitHub Release.

## Troubleshooting

### Certificate Warning
Accept the self-signed certificate in your browser.

### Can't reach haccp.local
Ensure mDNS is working: `avahi-browse -a`

### PocketBase not starting
Check logs: `sudo journalctl -u pocketbase -n 50`

### Reset everything
```bash
sudo systemctl stop pocketbase caddy
sudo rm -rf /opt/haccp/pocketbase/pb_data/*
sudo systemctl start pocketbase caddy
```
