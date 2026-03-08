# Tracker HACCP

Sistema di tracciabilità HACCP per la ristorazione, ottimizzato per Raspberry Pi.

## Struttura Progetto

```
├── install.sh                  # Installazione one-liner
├── update.sh                   # Aggiornamento automatico
├── docker-compose.yml          # Configurazione container ARM64
├── Dockerfile                  # Build immagine (PocketBase + frontend)
├── README.md
├── scripts/
│   ├── docker-entrypoint.sh    # Entrypoint container
│   ├── rclone-sync.sh          # Sync Google Drive (04:00)
│   └── pocketbase/
│       ├── pb_schema.json      # Schema collezioni
│       ├── pb_migrations/      # Migrazioni auto-import
│       └── pb_hooks/           # Cron hooks (CSV export 03:30)
├── src/                        # Frontend React
├── public/                     # Asset statici
└── [config files]              # Vite, Tailwind, TypeScript, etc.
```

## Installazione rapida

```bash
curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/install.sh | sudo bash
```

L'installer:
- Installa Docker se mancante
- Verifica architettura ARM64
- Chiede le credenziali Google Drive per il backup cloud
- Avvia l'app sulla porta 80

L'app sarà disponibile su `http://<IP-RASPBERRY>` e il pannello admin su `http://<IP-RASPBERRY>/_/`.

## Aggiornamento

```bash
sudo /opt/haccp-tracker/update.sh
```

### Aggiornamento automatico con Cronjob

```bash
sudo crontab -e
```

Aggiungi questa riga:

```
0 3 * * * /opt/haccp-tracker/update.sh >> /var/log/haccp-update.log 2>&1
```

## Pianificazione automatica

| Orario | Operazione |
|--------|-----------|
| **03:00** | Aggiornamento app (opzionale, via crontab) |
| **03:30** | Generazione CSV (Temperature, Ricezione, Pulizie) |
| **04:00** | Sync Google Drive (`rclone sync`, modalità mirror) |

## Comandi utili

```bash
cd /opt/haccp-tracker

docker compose logs -f        # Log in tempo reale
docker compose restart         # Riavvia
docker compose down            # Ferma
```

## Stack tecnologico

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: PocketBase (SQLite, ottimizzato WAL per SD card)
- **Backup**: Rclone → Google Drive (sync mirror)
- **Deploy**: Docker su Raspberry Pi (ARM64)

## Dati

I dati sono persistenti in `/opt/haccp-tracker/pb_data/`. Per un backup manuale:

```bash
sudo tar czf haccp-backup-$(date +%Y%m%d).tar.gz -C /opt/haccp-tracker pb_data
```

## ⚠️ .gitignore

Assicurati che il tuo `.gitignore` contenga:

```
pb_data/
.env
rclone.conf
*.local
```

**Non caricare mai** `pb_data/` (dati HACCP sensibili) o `rclone.conf` (credenziali Google) su GitHub.
