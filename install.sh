#!/bin/bash
#
# Tracker HACCP - Installazione Automatica
# Usage: curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/install.sh | sudo bash
#
set -euo pipefail

readonly APP_DIR="/opt/haccp-tracker"
readonly GITHUB_REPO="igorrodi/haccp-tracciabilita"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
log_info()  { echo -e "${CYAN}[i]${NC} $1"; }

# ============================================================================
# CHECKS
# ============================================================================

[[ $EUID -eq 0 ]] || log_error "Esegui come root: curl ... | sudo bash"

# Verify ARM64 architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
    log_warn "Architettura rilevata: $ARCH — questa app è ottimizzata per ARM64 (Raspberry Pi)"
    read -rp "Continuare comunque? [y/N]: " confirm
    [[ "$confirm" =~ ^[yY]$ ]] || exit 0
fi

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
# APP DIRECTORY & PERMISSIONS
# ============================================================================

mkdir -p "${APP_DIR}/pb_data/exports"
cd "${APP_DIR}"
log_ok "Cartelle create: ${APP_DIR}/pb_data/exports/"

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

curl -sSL "${GITHUB_RAW}/update.sh" -o "${APP_DIR}/update.sh" \
    || log_warn "update.sh non scaricato (opzionale)"
chmod +x "${APP_DIR}/update.sh" 2>/dev/null || true
log_ok "update.sh scaricato"

# ============================================================================
# GOOGLE DRIVE / RCLONE CONFIGURATION
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Configurazione Backup Cloud (Google Drive)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

RCLONE_CONF="${APP_DIR}/rclone.conf"

if [ -f "$RCLONE_CONF" ]; then
    log_ok "Configurazione rclone esistente trovata"
    read -rp "Vuoi riconfigurare Google Drive? [y/N]: " reconfig
    SETUP_GDRIVE=false
    [[ "$reconfig" =~ ^[yY]$ ]] && SETUP_GDRIVE=true
else
    read -rp "Vuoi configurare il backup su Google Drive? [Y/n]: " setup_gdrive
    SETUP_GDRIVE=true
    [[ "$setup_gdrive" =~ ^[nN]$ ]] && SETUP_GDRIVE=false
fi

if [ "$SETUP_GDRIVE" = true ]; then
    echo ""
    log_info "Crea le credenziali OAuth2 su https://console.cloud.google.com"
    log_info "Abilita l'API Google Drive e crea credenziali di tipo 'OAuth 2.0 Client ID'"
    echo ""

    read -rp "  Google Client ID: " GDRIVE_CLIENT_ID
    read -rp "  Google Client Secret: " GDRIVE_CLIENT_SECRET
    read -rp "  Google Refresh Token: " GDRIVE_REFRESH_TOKEN

    if [[ -z "$GDRIVE_CLIENT_ID" || -z "$GDRIVE_CLIENT_SECRET" || -z "$GDRIVE_REFRESH_TOKEN" ]]; then
        log_warn "Credenziali incomplete — backup cloud disabilitato"
        log_warn "Puoi configurarlo dopo dall'interfaccia web (Sistema → Cloud)"
    else
        cat > "$RCLONE_CONF" <<EOF
[gdrive]
type = drive
client_id = ${GDRIVE_CLIENT_ID}
client_secret = ${GDRIVE_CLIENT_SECRET}
scope = drive.file
token = {"access_token":"","token_type":"Bearer","refresh_token":"${GDRIVE_REFRESH_TOKEN}","expiry":"2000-01-01T00:00:00.000Z"}
root_folder_id =
EOF
        chmod 600 "$RCLONE_CONF"
        log_ok "Configurazione rclone salvata (${RCLONE_CONF})"
    fi
else
    log_info "Backup cloud saltato — configurabile dopo dall'interfaccia web"
    # Create empty rclone.conf to avoid docker volume mount error
    touch "$RCLONE_CONF"
fi

# ============================================================================
# START
# ============================================================================

echo ""
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
echo "  App:       http://${IP}"
echo "  Admin:     http://${IP}/_/"
echo "  CUPS:      http://${IP}:631"
echo "  Dati:      ${APP_DIR}/pb_data/"
echo "  Exports:   ${APP_DIR}/pb_data/exports/"
echo "  Rclone:    ${APP_DIR}/rclone.conf"
echo ""
echo "  Stampante:"
echo "    Configura la stampante da: App → Sistema → Stampante"
echo "    Oppure accedi a CUPS direttamente: http://${IP}:631"
echo ""
echo "  Pianificazione automatica:"
echo "    03:30  Generazione CSV (Temperature, Ricezione, Pulizie)"
echo "    04:00  Sync Google Drive (rclone sync, modalità mirror)"
echo ""
echo "  Comandi utili:"
echo "    cd ${APP_DIR} && docker compose logs -f    # Log"
echo "    cd ${APP_DIR} && docker compose restart     # Riavvia"
echo "    ${APP_DIR}/update.sh                        # Aggiorna"
echo ""
echo "  Aggiornamento automatico (crontab opzionale):"
echo "    0 3 * * * ${APP_DIR}/update.sh >> /var/log/haccp-update.log 2>&1"
echo ""
