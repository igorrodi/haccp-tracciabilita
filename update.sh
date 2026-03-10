#!/bin/bash
#
# Tracker HACCP - Aggiornamento Automatico (Fault-Tolerant)
# Usage: sudo /opt/haccp-tracker/update.sh
#
# Features:
#   - Pre-update backup of SQLite database
#   - Rollback on failure
#   - Schema download with integrity check
#   - Version tracking
#
set -uo pipefail

readonly APP_DIR="/opt/haccp-tracker"
readonly BACKUP_DIR="${APP_DIR}/pb_data/backups"
readonly DB_FILE="${APP_DIR}/pb_data/data.db"
readonly SCHEMA_FILE="${APP_DIR}/pb_schema.json"
readonly GITHUB_REPO="igorrodi/haccp-tracciabilita"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
readonly VERSION_FILE="${APP_DIR}/pb_data/version.json"
readonly LOG_FILE="${APP_DIR}/pb_data/update.log"

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_ok()    { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"; }
log_error() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"; }
log_warn()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
log_info()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${CYAN}[i]${NC} $1" | tee -a "$LOG_FILE"; }

# ============================================================================
# CHECKS
# ============================================================================

[[ $EUID -eq 0 ]] || { echo "Esegui come root: sudo ./update.sh"; exit 1; }
cd "${APP_DIR}" || { echo "Cartella ${APP_DIR} non trovata"; exit 1; }

echo "" >> "$LOG_FILE"
log_info "═══ Inizio aggiornamento ═══"

# ============================================================================
# PRE-UPDATE BACKUP
# ============================================================================

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/data_${TIMESTAMP}.db"

if [ -f "$DB_FILE" ]; then
  # Use SQLite's .backup for a consistent copy (WAL-safe)
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_FILE" ".backup '${BACKUP_FILE}'"
    log_ok "Backup database (sqlite3 .backup): ${BACKUP_FILE}"
  else
    # Fallback: file copy
    cp "$DB_FILE" "$BACKUP_FILE"
    # Also copy WAL/SHM if present
    [ -f "${DB_FILE}-wal" ] && cp "${DB_FILE}-wal" "${BACKUP_FILE}-wal"
    [ -f "${DB_FILE}-shm" ] && cp "${DB_FILE}-shm" "${BACKUP_FILE}-shm"
    log_ok "Backup database (copia file): ${BACKUP_FILE}"
  fi
else
  log_warn "Database non trovato, skip backup"
fi

# Keep only last 5 backups
ls -t "${BACKUP_DIR}"/data_*.db 2>/dev/null | tail -n +6 | while read old; do
  rm -f "$old" "${old}-wal" "${old}-shm"
done
log_ok "Pulizia backup vecchi completata (max 5 conservati)"

# ============================================================================
# DOWNLOAD UPDATED SCHEMA
# ============================================================================

SCHEMA_TMP="${SCHEMA_FILE}.tmp"
if curl -sSL --fail "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" -o "$SCHEMA_TMP" 2>/dev/null; then
  # Validate JSON
  if python3 -c "import json; json.load(open('${SCHEMA_TMP}'))" 2>/dev/null || \
     python -c "import json; json.load(open('${SCHEMA_TMP}'))" 2>/dev/null; then
    mv "$SCHEMA_TMP" "$SCHEMA_FILE"
    log_ok "Schema aggiornato"
  else
    rm -f "$SCHEMA_TMP"
    log_warn "Schema scaricato non valido (JSON malformato), mantenuto precedente"
  fi
else
  rm -f "$SCHEMA_TMP"
  log_warn "Download schema fallito, mantenuto precedente"
fi

# ============================================================================
# PULL & RESTART
# ============================================================================

# Save current image digest for comparison
OLD_DIGEST=$(docker compose images -q haccp 2>/dev/null || echo "none")

if docker compose pull 2>&1 | tee -a "$LOG_FILE"; then
  log_ok "Immagine scaricata"
else
  log_error "Pull fallito — mantenuta versione corrente"
  # Don't exit, the current image might still work
fi

NEW_DIGEST=$(docker compose images -q haccp 2>/dev/null || echo "none")

if [ "$OLD_DIGEST" = "$NEW_DIGEST" ] && [ "$OLD_DIGEST" != "none" ]; then
  log_info "Nessun aggiornamento disponibile (stessa immagine)"
  
  # Update version file with check timestamp
  cat > "$VERSION_FILE" <<EOF
{
  "last_check": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_update": "$(jq -r '.last_update // empty' "$VERSION_FILE" 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "status": "up_to_date",
  "image_digest": "${NEW_DIGEST}"
}
EOF
  log_ok "Aggiornamento completato (nessuna modifica)"
  exit 0
fi

# Restart with new image
if docker compose up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"; then
  log_ok "Container riavviato con nuova immagine"
else
  log_error "Riavvio fallito — tentativo rollback"
  
  # Rollback: restore database backup
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$DB_FILE"
    [ -f "${BACKUP_FILE}-wal" ] && cp "${BACKUP_FILE}-wal" "${DB_FILE}-wal"
    [ -f "${BACKUP_FILE}-shm" ] && cp "${BACKUP_FILE}-shm" "${DB_FILE}-shm"
    log_warn "Database ripristinato dal backup"
  fi
  
  # Try to restart with whatever is available
  docker compose up -d 2>/dev/null || true
  
  cat > "$VERSION_FILE" <<EOF
{
  "last_check": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_update": "$(jq -r '.last_update // empty' "$VERSION_FILE" 2>/dev/null || echo "unknown")",
  "status": "rollback",
  "error": "Riavvio fallito, rollback effettuato"
}
EOF
  exit 1
fi

# ============================================================================
# POST-UPDATE HEALTH CHECK
# ============================================================================

log_info "Verifica salute post-aggiornamento..."
HEALTHY=false
for i in $(seq 1 20); do
  if curl -sf http://localhost/api/health &>/dev/null; then
    HEALTHY=true
    break
  fi
  sleep 3
done

if [ "$HEALTHY" = true ]; then
  log_ok "Health check superato"
else
  log_error "Health check fallito dopo 60s — tentativo rollback"
  
  if [ -f "$BACKUP_FILE" ]; then
    docker compose down 2>/dev/null || true
    cp "$BACKUP_FILE" "$DB_FILE"
    [ -f "${BACKUP_FILE}-wal" ] && cp "${BACKUP_FILE}-wal" "${DB_FILE}-wal"
    [ -f "${BACKUP_FILE}-shm" ] && cp "${BACKUP_FILE}-shm" "${DB_FILE}-shm"
    docker compose up -d 2>/dev/null || true
    log_warn "Rollback completato"
  fi
  
  cat > "$VERSION_FILE" <<EOF
{
  "last_check": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_update": "$(jq -r '.last_update // empty' "$VERSION_FILE" 2>/dev/null || echo "unknown")",
  "status": "failed",
  "error": "Health check fallito post-aggiornamento"
}
EOF
  exit 1
fi

# ============================================================================
# CLEANUP & VERSION
# ============================================================================

docker image prune -f >> "$LOG_FILE" 2>&1
log_ok "Immagini inutilizzate rimosse"

# Write version info
cat > "$VERSION_FILE" <<EOF
{
  "last_check": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_update": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "status": "updated",
  "image_digest": "${NEW_DIGEST}"
}
EOF

log_ok "═══ Aggiornamento completato con successo ═══"