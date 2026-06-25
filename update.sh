#!/bin/bash
#
# Tracker HACCP - Aggiornamento Automatico (Fault-Tolerant)
# Usage: sudo /opt/haccp-tracker/update.sh
#
set -uo pipefail

readonly APP_DIR="/opt/haccp-tracker"
readonly DATA_DIR="${APP_DIR}/data"
readonly PB_DATA="${DATA_DIR}/pb_data"
readonly BACKUP_DIR="${DATA_DIR}/backups"
readonly DB_FILE="${PB_DATA}/data.db"
readonly SCHEMA_FILE="${APP_DIR}/pb_schema.json"
readonly GITHUB_REPO="igorrodi/haccp-tracciabilita"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
readonly VERSION_FILE="${PB_DATA}/version.json"
readonly LOG_FILE="${PB_DATA}/update.log"
readonly LIB_PATH="${APP_DIR}/scripts/system-prepare.sh"

# Migrazione automatica vecchia struttura → nuova
if [ -d "${APP_DIR}/pb_data" ] && [ ! -d "${PB_DATA}" ]; then
  mkdir -p "${DATA_DIR}"
  mv "${APP_DIR}/pb_data" "${PB_DATA}"
fi
mkdir -p "${PB_DATA}" "${BACKUP_DIR}" "${APP_DIR}/scripts"

[ "$EUID" -eq 0 ] || { echo "Esegui come root: sudo $0"; exit 1; }
cd "${APP_DIR}" || exit 1

# Scarica/aggiorna libreria condivisa
curl -sSL --fail "${GITHUB_RAW}/scripts/system-prepare.sh" -o "${LIB_PATH}.tmp" 2>/dev/null \
  && mv "${LIB_PATH}.tmp" "${LIB_PATH}" || true
if [ -f "${LIB_PATH}" ]; then
  # shellcheck disable=SC1090
  . "${LIB_PATH}"
else
  sp_log_ok()   { echo "[✓] $1"; }
  sp_log_warn() { echo "[!] $1"; }
  sp_log_err()  { echo "[✗] $1"; }
  sp_log_info() { echo "[i] $1"; }
fi

log_to_file() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"; }

echo "" >> "$LOG_FILE"
sp_log_info "═══ Aggiornamento $(date '+%Y-%m-%d %H:%M:%S') ═══" | tee -a "$LOG_FILE"

# ============================================================================
# 1. DETECT + 2. VERIFY PACKAGES (solo mancanti)
# ============================================================================
if type sp_detect_system &>/dev/null; then
  sp_detect_system
  sp_ensure_packages curl ca-certificates jq sqlite3 rsync iproute2 iw rfkill \
    hostapd dnsmasq 2>&1 | tee -a "$LOG_FILE"
  sp_install_docker 2>&1 | tee -a "$LOG_FILE"
fi

# ============================================================================
# PRE-UPDATE BACKUP DB
# ============================================================================
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/data_${TIMESTAMP}.db"
if [ -f "$DB_FILE" ]; then
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_FILE" ".backup '${BACKUP_FILE}'" \
      && sp_log_ok "Backup DB: ${BACKUP_FILE}" | tee -a "$LOG_FILE"
  else
    cp "$DB_FILE" "$BACKUP_FILE"
    [ -f "${DB_FILE}-wal" ] && cp "${DB_FILE}-wal" "${BACKUP_FILE}-wal"
    [ -f "${DB_FILE}-shm" ] && cp "${DB_FILE}-shm" "${BACKUP_FILE}-shm"
  fi
else
  sp_log_warn "Database non trovato, skip backup" | tee -a "$LOG_FILE"
fi
# Mantieni solo ultimi 5
ls -t "${BACKUP_DIR}"/data_*.db 2>/dev/null | tail -n +6 | while read -r old; do
  rm -f "$old" "${old}-wal" "${old}-shm"
done

# ============================================================================
# DOWNLOAD SCHEMA + SCRIPTS
# ============================================================================
SCHEMA_TMP="${SCHEMA_FILE}.tmp"
if curl -sSL --fail "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" -o "$SCHEMA_TMP" 2>/dev/null; then
  if command -v jq &>/dev/null && jq empty "$SCHEMA_TMP" 2>/dev/null; then
    mv "$SCHEMA_TMP" "$SCHEMA_FILE" && sp_log_ok "Schema aggiornato" | tee -a "$LOG_FILE"
  elif head -c 1 "$SCHEMA_TMP" | grep -q '^\['; then
    mv "$SCHEMA_TMP" "$SCHEMA_FILE"
  else
    rm -f "$SCHEMA_TMP"
    sp_log_warn "Schema scaricato non valido" | tee -a "$LOG_FILE"
  fi
fi

for f in armbian-repair.sh setup-hotspot.sh; do
  curl -sSL --fail "${GITHUB_RAW}/scripts/${f}" -o "${APP_DIR}/${f}" 2>/dev/null \
    && chmod +x "${APP_DIR}/${f}" || true
done

# ============================================================================
# PULL & RESTART
# ============================================================================
OLD_DIGEST=$(docker compose images -q haccp 2>/dev/null || echo "none")
docker compose pull 2>&1 | tee -a "$LOG_FILE" || sp_log_warn "Pull parziale" | tee -a "$LOG_FILE"
NEW_DIGEST=$(docker compose images -q haccp 2>/dev/null || echo "none")

if [ "$OLD_DIGEST" = "$NEW_DIGEST" ] && [ "$OLD_DIGEST" != "none" ]; then
  sp_log_info "Nessun aggiornamento immagine" | tee -a "$LOG_FILE"
  PREV_UPDATE=$(grep -o '"last_update":"[^"]*"' "$VERSION_FILE" 2>/dev/null | cut -d'"' -f4 || date -u '+%Y-%m-%dT%H:%M:%SZ')
  cat > "$VERSION_FILE" <<EOF
{"last_check":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","last_update":"${PREV_UPDATE}","status":"up_to_date","image_digest":"${NEW_DIGEST}"}
EOF
  # Cleanup leggero comunque
  docker image prune -f &>/dev/null || true
  exit 0
fi

if ! docker compose up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"; then
  sp_log_err "Riavvio fallito — rollback" | tee -a "$LOG_FILE"
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$DB_FILE"
    [ -f "${BACKUP_FILE}-wal" ] && cp "${BACKUP_FILE}-wal" "${DB_FILE}-wal"
    [ -f "${BACKUP_FILE}-shm" ] && cp "${BACKUP_FILE}-shm" "${DB_FILE}-shm"
  fi
  docker compose up -d 2>/dev/null || true
  cat > "$VERSION_FILE" <<EOF
{"last_check":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","status":"rollback","error":"Riavvio fallito"}
EOF
  exit 1
fi

# ============================================================================
# HEALTH CHECK
# ============================================================================
HEALTHY=false
for i in $(seq 1 20); do
  curl -sf http://localhost/api/health &>/dev/null && { HEALTHY=true; break; }
  sleep 3
done

if [ "$HEALTHY" != true ]; then
  sp_log_err "Health check fallito — rollback" | tee -a "$LOG_FILE"
  if [ -f "$BACKUP_FILE" ]; then
    docker compose down 2>/dev/null || true
    cp "$BACKUP_FILE" "$DB_FILE"
    [ -f "${BACKUP_FILE}-wal" ] && cp "${BACKUP_FILE}-wal" "${DB_FILE}-wal"
    [ -f "${BACKUP_FILE}-shm" ] && cp "${BACKUP_FILE}-shm" "${DB_FILE}-shm"
    docker compose up -d 2>/dev/null || true
  fi
  cat > "$VERSION_FILE" <<EOF
{"last_check":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","status":"failed","error":"Health check fallito"}
EOF
  exit 1
fi

# ============================================================================
# CLEANUP LEGGERO (NON tocca dati, NON rilancia wizard)
# ============================================================================
docker image prune -f >> "$LOG_FILE" 2>&1 || true
# Log vecchi >30gg
find "${PB_DATA}/logs" -type f -mtime +30 -delete 2>/dev/null || true

cat > "$VERSION_FILE" <<EOF
{"last_check":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","last_update":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","status":"updated","image_digest":"${NEW_DIGEST}"}
EOF
sp_log_ok "═══ Aggiornamento completato ═══" | tee -a "$LOG_FILE"
