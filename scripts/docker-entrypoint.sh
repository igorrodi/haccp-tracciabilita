#!/bin/sh
set -e

echo "Avvio HACCP App..."

# SQLite optimizations for SD cards (WAL mode, safe sync)
export POCKETBASE_PRAGMA_JOURNAL_MODE=wal
export POCKETBASE_PRAGMA_SYNCHRONOUS=normal
export POCKETBASE_PRAGMA_BUSY_TIMEOUT=5000

# Create required directories
mkdir -p /pb/pb_data/exports /pb/pb_data/backups

# Setup cron for rclone sync at 04:00
echo "0 4 * * * /pb/rclone-sync.sh >> /pb/pb_data/rclone-sync.log 2>&1" | crontab -
crond -b -l 8

echo "Cron configurato: rclone sync alle 04:00"
echo "Directory exports: /pb/pb_data/exports/"

# Start CUPS daemon
if command -v cupsd >/dev/null 2>&1; then
  cupsd
  echo "CUPS avviato (porta 631)"
fi

# Write build info if not present
if [ ! -f /pb/pb_data/version.json ]; then
  cat > /pb/pb_data/version.json <<EOF
{
  "last_check": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_update": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "status": "installed"
}
EOF
  echo "Version info inizializzata"
  # Mark as first run for the wizard
  touch /pb/pb_data/first_run.flag
  echo "First-run flag creato — wizard attivo"
fi

if [ -f /pb/pb_data/setup_complete.json ] && [ -f /pb/pb_data/first_run.flag ]; then
  rm -f /pb/pb_data/first_run.flag
  echo "Setup già completato — first_run.flag rimosso"
fi

# Bootstrap PocketBase dashboard superuser (first boot only)
PB_SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-admin@haccp.local}"
PB_SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-Admin123456!}"
PB_SUPERUSER_MARKER="/pb/pb_data/.superuser_bootstrapped"

if [ ! -f "$PB_SUPERUSER_MARKER" ]; then
  echo "Bootstrap dashboard admin..."
  if pocketbase superuser create "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" --dir=/pb/pb_data >/tmp/pb-superuser.log 2>&1; then
    echo "Superuser creato: ${PB_SUPERUSER_EMAIL}"
    touch "$PB_SUPERUSER_MARKER"
  elif pocketbase superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" --dir=/pb/pb_data >/tmp/pb-superuser.log 2>&1; then
    echo "Superuser aggiornato/creato: ${PB_SUPERUSER_EMAIL}"
    touch "$PB_SUPERUSER_MARKER"
  else
    if grep -qi "already exists" /tmp/pb-superuser.log; then
      echo "Superuser già presente, bootstrap completato."
      touch "$PB_SUPERUSER_MARKER"
    else
      echo "Attenzione: bootstrap superuser non riuscito."
      cat /tmp/pb-superuser.log || true
    fi
  fi
fi

# Auto-import schema on first boot (creates collections from pb_schema.json)
SCHEMA_MARKER="/pb/pb_data/.schema_imported"
IMPORT_SCHEMA=false
SCHEMA_HASH=""
if [ -f /pb/pb_schema.json ]; then
  SCHEMA_HASH=$(sha256sum /pb/pb_schema.json 2>/dev/null | awk '{print $1}')
  if [ ! -f "$SCHEMA_MARKER" ]; then
    IMPORT_SCHEMA=true
  elif [ "$(cat "$SCHEMA_MARKER" 2>/dev/null || true)" != "$SCHEMA_HASH" ]; then
    IMPORT_SCHEMA=true
  fi
fi

if [ "$IMPORT_SCHEMA" = "true" ]; then
  echo "Importazione schema collezioni..."
  pocketbase serve --http=127.0.0.1:8091 --dir=/pb/pb_data --hooksDir=/pb/pb_hooks >/tmp/pb-import.log 2>&1 &
  PB_PID=$!

  # Wait for PocketBase to be ready
  PB_READY=false
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8091/api/health >/dev/null 2>&1; then
      PB_READY=true
      break
    fi
    sleep 1
  done

  if [ "$PB_READY" = "true" ]; then
    # Authenticate as superuser
    AUTH_BODY="{\"identity\":\"${PB_SUPERUSER_EMAIL}\",\"password\":\"${PB_SUPERUSER_PASSWORD}\"}"
    AUTH_RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "$AUTH_BODY" \
      "http://127.0.0.1:8091/api/collections/_superusers/auth-with-password" || echo "")

    TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty' 2>/dev/null)

    if [ -n "$TOKEN" ]; then
      # Build import payload to a file (avoids shell quoting issues)
      jq -n --slurpfile cols /pb/pb_schema.json \
        '{collections: $cols[0], deleteMissing: false}' > /tmp/import-payload.json

      HTTP_CODE=$(curl -s -o /tmp/import-result.json -w "%{http_code}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        --data-binary @/tmp/import-payload.json \
        "http://127.0.0.1:8091/api/collections/import")

      if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
        echo "Schema collezioni importato con successo (HTTP $HTTP_CODE)"
        echo "$SCHEMA_HASH" > "$SCHEMA_MARKER"
      else
        echo "ERRORE importazione schema (HTTP $HTTP_CODE):"
        cat /tmp/import-result.json || true
        echo ""
      fi
    else
      echo "ERRORE: autenticazione superuser fallita per import schema"
      echo "Response: $AUTH_RESPONSE"
    fi
  else
    echo "ERRORE: PocketBase non raggiungibile per import schema"
    tail -20 /tmp/pb-import.log || true
  fi

  # Stop temporary PocketBase
  kill $PB_PID 2>/dev/null || true
  wait $PB_PID 2>/dev/null || true
  sleep 1
fi

echo "Schema gestito via pb_schema.json"

# Start PocketBase with hooks
exec pocketbase serve \
  --http=0.0.0.0:80 \
  --dir=/pb/pb_data \
  --publicDir=/pb/pb_public \
  --hooksDir=/pb/pb_hooks
