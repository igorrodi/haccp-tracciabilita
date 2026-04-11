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
if [ ! -f "$SCHEMA_MARKER" ] && [ -f /pb/pb_schema.json ]; then
  echo "Importazione schema collezioni..."
  # Start PocketBase temporarily to import schema
  pocketbase serve --http=127.0.0.1:8091 --dir=/pb/pb_data --hooksDir=/pb/pb_hooks &
  PB_PID=$!

  # Wait for PocketBase to be ready
  for i in $(seq 1 30); do
    if wget -q --spider http://127.0.0.1:8091/api/health 2>/dev/null; then
      break
    fi
    sleep 1
  done

  # Import schema via admin API
  if wget -q --spider http://127.0.0.1:8091/api/health 2>/dev/null; then
    # Authenticate as superuser
    AUTH_RESPONSE=$(wget -qO- --post-data="{\"identity\":\"${PB_SUPERUSER_EMAIL}\",\"password\":\"${PB_SUPERUSER_PASSWORD}\"}" \
      --header="Content-Type: application/json" \
      "http://127.0.0.1:8091/api/admins/auth-with-password" 2>/dev/null || echo "")

    if echo "$AUTH_RESPONSE" | grep -q "token"; then
      TOKEN=$(echo "$AUTH_RESPONSE" | sed 's/.*"token":"\([^"]*\)".*/\1/')

      # Import collections
      SCHEMA_CONTENT=$(cat /pb/pb_schema.json)
      IMPORT_RESULT=$(wget -qO- --method=PUT \
        --body-data="{\"collections\":${SCHEMA_CONTENT},\"deleteMissing\":false}" \
        --header="Content-Type: application/json" \
        --header="Authorization: ${TOKEN}" \
        "http://127.0.0.1:8091/api/collections/import" 2>/dev/null || echo "error")

      if echo "$IMPORT_RESULT" | grep -qi "error"; then
        echo "Attenzione: importazione schema parziale o fallita"
        echo "$IMPORT_RESULT"
      else
        echo "Schema collezioni importato con successo"
        touch "$SCHEMA_MARKER"
      fi
    else
      echo "Attenzione: autenticazione superuser fallita per import schema"
    fi
  else
    echo "Attenzione: PocketBase non raggiungibile per import schema"
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
