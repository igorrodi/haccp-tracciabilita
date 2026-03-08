# Tracker HACCP - Installazione

## Requisiti
- Raspberry Pi 4/5 con OS 64-bit (ARM64)
- Connessione internet (solo per installazione)

## Installazione

```bash
curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash
```

## Accesso

| URL | Descrizione |
|-----|-------------|
| `http://<IP-RASPBERRY>` | App |
| `http://<IP-RASPBERRY>/_/` | Admin PocketBase |

## Primo avvio

1. Apri `http://<IP>/_/` e crea un account admin PocketBase
2. Importa lo schema: `Settings > Import Collections` → file `/opt/haccp/pocketbase/pb_schema.json`
3. Apri `http://<IP>` per usare l'app

## Gestione servizio

```bash
sudo systemctl status pocketbase
sudo systemctl restart pocketbase
sudo journalctl -u pocketbase -f
```

## Struttura

```
/opt/haccp/pocketbase/
├── pocketbase          # Binary
├── pb_data/            # Database
├── pb_public/          # Frontend (file statici)
├── pb_migrations/      # Migrazioni
└── pb_schema.json      # Schema per import
```
