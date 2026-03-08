#!/bin/bash
# =============================================================
# HACCP Tracker - Rclone Sync to Google Drive
# Runs at 04:00, 30 minutes after CSV generation
# Uses 'rclone sync' for perfect mirror (deletes removed files)
# =============================================================
set -e

EXPORT_DIR="/pb/pb_data/exports"
BACKUP_DIR="/pb/pb_data"
RCLONE_REMOTE="gdrive:HACCP-Backup"
LOG_FILE="/pb/pb_data/rclone-sync.log"
SETTINGS_FILE="/pb/pb_data/rclone.conf"
STATUS_FILE="/pb/pb_data/exports/.rclone-status.json"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

write_status() {
  local status="$1"
  local error="${2:-}"
  cat > "$STATUS_FILE" <<EOF
{
  "lastRun": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "status": "${status}",
  "error": ${error:+\"$error\"}${error:-null}
}
EOF
}

log "=== Avvio Rclone Sync ==="

# Check rclone config exists and is not empty
if [ ! -s "$SETTINGS_FILE" ]; then
  log "ERRORE: File di configurazione rclone non trovato o vuoto: $SETTINGS_FILE"
  log "Configura Google Drive con install.sh o dalla UI dell'app."
  write_status "error" "Configurazione rclone mancante"
  exit 1
fi

# Check export directory
if [ ! -d "$EXPORT_DIR" ]; then
  log "ATTENZIONE: Directory export non trovata, creazione..."
  mkdir -p "$EXPORT_DIR"
fi

# Sync CSV exports to Google Drive (mirror mode)
log "Sync CSV exports..."
if rclone sync "$EXPORT_DIR" "$RCLONE_REMOTE/exports/" \
  --config "$SETTINGS_FILE" \
  --log-file "$LOG_FILE" \
  --log-level INFO \
  --transfers 2 \
  --low-level-retries 3 \
  --retries 3 \
  --contimeout 30s \
  --timeout 120s; then
  log "CSV sync completato"
else
  log "ERRORE nel sync CSV"
  write_status "error" "Errore sync CSV exports"
  exit 1
fi

# Sync PocketBase database backup (copy the db file into a temp dir first)
log "Sync database backup..."
DB_SYNC_DIR="/tmp/haccp-db-sync"
mkdir -p "$DB_SYNC_DIR"
cp "$BACKUP_DIR/data.db" "$DB_SYNC_DIR/data.db" 2>/dev/null || true

if [ -f "$DB_SYNC_DIR/data.db" ]; then
  if rclone sync "$DB_SYNC_DIR/" "$RCLONE_REMOTE/database/" \
    --config "$SETTINGS_FILE" \
    --log-file "$LOG_FILE" \
    --log-level INFO \
    --transfers 1; then
    log "Database sync completato"
  else
    log "ERRORE nel sync database"
    write_status "error" "Errore sync database"
    rm -rf "$DB_SYNC_DIR"
    exit 1
  fi
  rm -rf "$DB_SYNC_DIR"
else
  log "ATTENZIONE: data.db non trovato, skip sync database"
fi

write_status "success"
log "=== Sync completato con SUCCESSO ==="
exit 0
