#!/bin/sh
set -e

echo "Avvio HACCP App..."

# SQLite optimizations for SD cards (WAL mode, safe sync)
export POCKETBASE_PRAGMA_JOURNAL_MODE=wal
export POCKETBASE_PRAGMA_SYNCHRONOUS=normal
export POCKETBASE_PRAGMA_BUSY_TIMEOUT=5000

# Create exports directory
mkdir -p /pb/pb_data/exports

# Setup cron for rclone sync at 04:00
echo "0 4 * * * /pb/rclone-sync.sh >> /pb/pb_data/rclone-sync.log 2>&1" | crontab -
crond -b -l 8

echo "Cron configurato: rclone sync alle 04:00"

# Start PocketBase with migrations auto-apply and hooks
exec pocketbase serve \
  --http=0.0.0.0:80 \
  --dir=/pb/pb_data \
  --publicDir=/pb/pb_public \
  --migrationsDir=/pb/pb_migrations \
  --hooksDir=/pb/pb_hooks \
  --automigrate
