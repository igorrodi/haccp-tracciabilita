#!/bin/bash
#
# Tracker HACCP - Installazione Automatica
# Usage: curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/install.sh | sudo bash
#
set -euo pipefail

readonly APP_DIR="/opt/haccp-tracker"
readonly GITHUB_REPO="USER/haccp-tracciabilita"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ============================================================================
# CHECKS
# ============================================================================

[[ $EUID -eq 0 ]] || log_error "Esegui come root: curl ... | sudo bash"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  TRACKER HACCP - Installazione${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# DOCKER
# ============================================================================

if command -v docker &>/dev/null; then
    log_ok "Docker già installato ($(docker --version | awk '{print $3}' | tr -d ','))"
else
    echo "Installazione Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    log_ok "Docker installato"
fi

# Verifica Docker Compose (plugin v2)
if docker compose version &>/dev/null; then
    log_ok "Docker Compose disponibile"
else
    log_error "Docker Compose non trovato. Aggiorna Docker: curl -fsSL https://get.docker.com | sh"
fi

# ============================================================================
# APP DIRECTORY
# ============================================================================

mkdir -p "${APP_DIR}/pb_data"
cd "${APP_DIR}"
log_ok "Cartella ${APP_DIR} pronta"

# ============================================================================
# DOWNLOAD FILES
# ============================================================================

echo "Scaricamento configurazione..."

curl -sSL "${GITHUB_RAW}/docker-compose.yml" -o "${APP_DIR}/docker-compose.yml" \
    || log_error "Impossibile scaricare docker-compose.yml"
log_ok "docker-compose.yml scaricato"

curl -sSL "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" -o "${APP_DIR}/pb_schema.json" \
    || log_error "Impossibile scaricare pb_schema.json"
log_ok "pb_schema.json scaricato"

# ============================================================================
# START
# ============================================================================

echo "Avvio container..."
docker compose pull 2>/dev/null || true
docker compose up -d --remove-orphans
log_ok "Container avviato"

# Attendi che PocketBase sia pronto
echo -n "Attesa avvio PocketBase"
for i in $(seq 1 30); do
    if curl -sf http://localhost/api/health &>/dev/null; then
        echo ""
        log_ok "PocketBase pronto"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# ============================================================================
# DONE
# ============================================================================

IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ TRACKER HACCP INSTALLATO${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  App:    http://${IP}"
echo "  Admin:  http://${IP}/_/"
echo "  Dati:   ${APP_DIR}/pb_data/"
echo ""
echo "  Comandi utili:"
echo "    cd ${APP_DIR} && docker compose logs -f    # Log"
echo "    cd ${APP_DIR} && docker compose restart     # Riavvia"
echo "    cd ${APP_DIR} && docker compose down        # Ferma"
echo "    cd ${APP_DIR} && docker compose pull && docker compose up -d  # Aggiorna"
echo ""
