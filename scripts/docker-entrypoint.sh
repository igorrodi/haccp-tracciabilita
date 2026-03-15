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

echo "Migrazioni automatiche abilitate (--automigrate)"

# Start PocketBase with migrations auto-apply and hooks
exec pocketbase serve \
  --http=0.0.0.0:80 \
  --dir=/pb/pb_data \
  --publicDir=/pb/pb_public \
  --migrationsDir=/pb/pb_migrations \
  --hooksDir=/pb/pb_hooks \
  --automigrate
