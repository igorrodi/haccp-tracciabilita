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
curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/install.sh | sudo bash
```

L'installer:
- Verifica Raspberry Pi OS Bookworm, connessione internet e spazio disco
- Installa Docker se mancante
- Verifica architettura ARM64
- Chiede le credenziali Google Drive per il backup cloud
- Installa il watchdog systemd per il riavvio automatico
- Se è la prima installazione, avvia un **hotspot Wi-Fi aperto** per il wizard

## Prima Configurazione (Wizard Hotspot)

Al primo avvio dopo l'installazione:

1. Il Raspberry Pi crea una rete Wi-Fi aperta: **HACCP-Setup-XXXXXX**
2. Connettiti a questa rete dal tuo smartphone/tablet/PC
3. Apri il browser e vai a: `http://haccp.local/setup` oppure `http://192.168.4.1/setup`
4. Il wizard ti guiderà nella creazione dell'account admin e nella configurazione del Wi-Fi
5. Dopo il setup, l'hotspot si riavvia **protetto con password WPA2**
6. Riconnettiti alla nuova rete con la password che hai scelto

> **Nota sicurezza**: la rete hotspot è isolata (nessun accesso a internet). Il Raspberry Pi usa la porta Ethernet per internet (aggiornamenti, backup cloud).

## Gestione Wi-Fi dalla Dashboard Admin

Dopo la configurazione iniziale, l'admin può modificare SSID e password Wi-Fi da:
**App → Sistema → Wi-Fi**

Le modifiche vengono applicate immediatamente: hostapd e dnsmasq vengono riavviati automaticamente.

L'app sarà disponibile su `http://haccp.local` e il pannello admin PocketBase su `http://<IP>/_/`.

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
