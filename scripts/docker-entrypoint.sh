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

# ============================================================================
# PERSISTENCE & SCHEMA IMPORT (robust, idempotent, self-healing)
# ============================================================================
EXPECTED_COLLECTIONS="users products product_images suppliers seasons lots allergens printer_settings app_settings temperature_logs reception_logs cleaning_logs cloud_settings lot_images wifi_settings"
SCHEMA_MARKER="/pb/pb_data/.schema_imported"

# 1) Verifica che pb_data sia scrivibile (montaggio volume corretto)
if ! touch /pb/pb_data/.write_test 2>/dev/null; then
  echo "ERRORE CRITICO: /pb/pb_data non scrivibile — controlla i mount Docker"
  ls -la /pb/pb_data || true
  exit 1
fi
rm -f /pb/pb_data/.write_test
echo "Persistenza OK: /pb/pb_data scrivibile"

# 2) Valida pb_schema.json prima di toccarlo
SCHEMA_HASH=""
SCHEMA_VALID=false
if [ -f /pb/pb_schema.json ]; then
  if command -v jq >/dev/null 2>&1 && jq -e 'type=="array" and length>0' /pb/pb_schema.json >/dev/null 2>&1; then
    SCHEMA_VALID=true
    SCHEMA_HASH=$(sha256sum /pb/pb_schema.json | awk '{print $1}')
    echo "pb_schema.json valido ($(jq 'length' /pb/pb_schema.json) collezioni, hash ${SCHEMA_HASH%????????????????????????????????????????????????????????})"
  else
    echo "ATTENZIONE: pb_schema.json non valido o vuoto — import saltato"
  fi
fi

# 3) Decide se serve (re)import
IMPORT_SCHEMA=false
MISSING_COLLECTIONS=""
if [ "$SCHEMA_VALID" = "true" ]; then
  if [ ! -f "$SCHEMA_MARKER" ]; then
    IMPORT_SCHEMA=true
    echo "Schema mai importato — import iniziale"
  elif [ "$(cat "$SCHEMA_MARKER" 2>/dev/null)" != "$SCHEMA_HASH" ]; then
    IMPORT_SCHEMA=true
    echo "Schema modificato — re-import"
  elif [ ! -f /pb/pb_data/data.db ]; then
    IMPORT_SCHEMA=true
    echo "data.db assente — re-import"
  elif command -v sqlite3 >/dev/null 2>&1; then
    for collection in $EXPECTED_COLLECTIONS; do
      if ! sqlite3 /pb/pb_data/data.db "select 1 from _collections where name='${collection}' limit 1;" 2>/dev/null | grep -q 1; then
        MISSING_COLLECTIONS="$MISSING_COLLECTIONS $collection"
        IMPORT_SCHEMA=true
      fi
    done
    [ -n "$MISSING_COLLECTIONS" ] && echo "Collezioni mancanti:$MISSING_COLLECTIONS — re-import"
  fi
fi

# 4) Esegui import con retry e verifica post-import
do_schema_import() {
  pocketbase serve --http=127.0.0.1:8091 --dir=/pb/pb_data --hooksDir=/pb/pb_hooks >/tmp/pb-import.log 2>&1 &
  PB_PID=$!

  PB_READY=false
  for i in $(seq 1 30); do
    curl -sf http://127.0.0.1:8091/api/health >/dev/null 2>&1 && { PB_READY=true; break; }
    sleep 1
  done

  IMPORT_OK=false
  if [ "$PB_READY" = "true" ]; then
    AUTH_RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"identity\":\"${PB_SUPERUSER_EMAIL}\",\"password\":\"${PB_SUPERUSER_PASSWORD}\"}" \
      "http://127.0.0.1:8091/api/collections/_superusers/auth-with-password" || echo "")
    TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty' 2>/dev/null)

    if [ -n "$TOKEN" ]; then
      jq -n --slurpfile cols /pb/pb_schema.json \
        '{collections: $cols[0], deleteMissing: false}' > /tmp/import-payload.json

      HTTP_CODE=$(curl -s -o /tmp/import-result.json -w "%{http_code}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        --data-binary @/tmp/import-payload.json \
        "http://127.0.0.1:8091/api/collections/import")

      if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ Import HTTP $HTTP_CODE"
        IMPORT_OK=true
      else
        echo "  ✗ Import HTTP $HTTP_CODE:"
        cat /tmp/import-result.json 2>/dev/null || true
        echo ""
      fi
    else
      echo "  ✗ Auth superuser fallita: $AUTH_RESPONSE"
    fi
  else
    echo "  ✗ PocketBase non pronto per import"
    tail -20 /tmp/pb-import.log || true
  fi

  kill $PB_PID 2>/dev/null || true
  wait $PB_PID 2>/dev/null || true
  sleep 1
  [ "$IMPORT_OK" = "true" ]
}

verify_collections() {
  command -v sqlite3 >/dev/null 2>&1 || return 0
  [ -f /pb/pb_data/data.db ] || return 1
  for c in $EXPECTED_COLLECTIONS; do
    sqlite3 /pb/pb_data/data.db "select 1 from _collections where name='${c}' limit 1;" 2>/dev/null | grep -q 1 \
      || { echo "  ✗ Verifica fallita: manca '${c}'"; return 1; }
  done
  return 0
}

if [ "$IMPORT_SCHEMA" = "true" ]; then
  ATTEMPT=0
  IMPORT_SUCCESS=false
  while [ $ATTEMPT -lt 2 ]; do
    ATTEMPT=$((ATTEMPT+1))
    echo "Importazione schema (tentativo ${ATTEMPT}/2)..."
    if do_schema_import && verify_collections; then
      IMPORT_SUCCESS=true
      break
    fi
    echo "  → retry tra 2s..."
    sleep 2
  done

  if [ "$IMPORT_SUCCESS" = "true" ]; then
    echo "$SCHEMA_HASH" > "$SCHEMA_MARKER"
    echo "✓ Schema importato e verificato (${ATTEMPT} tent.)"
  else
    echo "✗ ERRORE: import schema fallito dopo ${ATTEMPT} tentativi."
    echo "  Avvio PocketBase comunque — usa: armbian-repair.sh --reset-schema"
    rm -f "$SCHEMA_MARKER"
  fi
fi

# 5) Sanity check finale persistenza SQLite
if [ -f /pb/pb_data/data.db ] && command -v sqlite3 >/dev/null 2>&1; then
  if ! sqlite3 /pb/pb_data/data.db "pragma integrity_check;" 2>/dev/null | grep -q '^ok$'; then
    echo "ATTENZIONE: pragma integrity_check NON ok — DB potenzialmente corrotto"
  else
    COL_COUNT=$(sqlite3 /pb/pb_data/data.db "select count(*) from _collections;" 2>/dev/null || echo "0")
    echo "✓ DB integro — ${COL_COUNT} collezioni presenti"
  fi
fi

# Start PocketBase with hooks
exec pocketbase serve \
  --http=0.0.0.0:80 \
  --dir=/pb/pb_data \
  --publicDir=/pb/pb_public \
  --hooksDir=/pb/pb_hooks
