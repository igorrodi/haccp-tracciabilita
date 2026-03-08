#!/bin/sh
set -e

echo "Avvio HACCP App..."

# SQLite optimizations for SD cards (WAL mode, safe sync)
export POCKETBASE_PRAGMA_JOURNAL_MODE=wal
export POCKETBASE_PRAGMA_SYNCHRONOUS=normal
export POCKETBASE_PRAGMA_BUSY_TIMEOUT=5000

# Start PocketBase with migrations auto-apply
exec pocketbase serve \
  --http=0.0.0.0:80 \
  --dir=/pb/pb_data \
  --publicDir=/pb/pb_public \
  --migrationsDir=/pb/pb_migrations \
  --automigrate
