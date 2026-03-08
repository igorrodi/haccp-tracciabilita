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

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Avvio Rclone Sync ==="

# Check rclone config exists
if [ ! -f "$SETTINGS_FILE" ]; then
  log "ERRORE: File di configurazione rclone non trovato: $SETTINGS_FILE"
  log "Configura Google Drive dalla UI dell'app."
  exit 1
fi

# Check export directory
if [ ! -d "$EXPORT_DIR" ]; then
  log "ATTENZIONE: Directory export non trovata: $EXPORT_DIR"
  mkdir -p "$EXPORT_DIR"
fi

# Sync CSV exports to Google Drive (mirror mode)
# --delete-excluded ensures cloud mirrors local exactly
log "Sync CSV exports..."
rclone sync "$EXPORT_DIR" "$RCLONE_REMOTE/exports/" \
  --config "$SETTINGS_FILE" \
  --log-file "$LOG_FILE" \
  --log-level INFO \
  --transfers 2 \
  --low-level-retries 3 \
  --retries 3 \
  --contimeout 30s \
  --timeout 120s

# Also sync the PocketBase database backup
log "Sync database backup..."
rclone sync "$BACKUP_DIR/data.db" "$RCLONE_REMOTE/database/" \
  --config "$SETTINGS_FILE" \
  --log-file "$LOG_FILE" \
  --log-level INFO \
  --include "data.db" \
  --transfers 1

SYNC_STATUS=$?

if [ $SYNC_STATUS -eq 0 ]; then
  log "=== Sync completato con SUCCESSO ==="
else
  log "=== Sync completato con ERRORI (exit code: $SYNC_STATUS) ==="
fi

exit $SYNC_STATUS
