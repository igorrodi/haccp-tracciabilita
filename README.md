# Tracker HACCP

Sistema di tracciabilità HACCP per la ristorazione, ottimizzato per Raspberry Pi.

## Installazione rapida

```bash
curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/install.sh | sudo bash
```

L'app sarà disponibile su `http://<IP-RASPBERRY>` e il pannello admin su `http://<IP-RASPBERRY>/_/`.

## Aggiornamento

```bash
sudo /opt/haccp-tracker/update.sh
```

### Aggiornamento automatico con Cronjob

Per aggiornare automaticamente ogni notte alle 3:00:

```bash
sudo crontab -e
```

Aggiungi questa riga:

```
0 3 * * * /opt/haccp-tracker/update.sh >> /var/log/haccp-update.log 2>&1
```

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
- **Deploy**: Docker su Raspberry Pi (ARM64)

## Dati

I dati sono persistenti in `/opt/haccp-tracker/pb_data/`. Per un backup manuale:

```bash
sudo tar czf haccp-backup-$(date +%Y%m%d).tar.gz -C /opt/haccp-tracker pb_data
```
