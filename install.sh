#!/bin/bash
#
# Tracker HACCP - Installazione Automatica
# Usage: curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/install.sh | sudo bash
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
# PRE-FLIGHT CHECKS
# ============================================================================

[[ $EUID -eq 0 ]] || log_error "Esegui come root: curl ... | sudo bash"

# Check OS compatibility (RaspberryPi OS, Debian, Ubuntu, Armbian)
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_LIKE="${ID_LIKE:-}"
  OS_NAME="${PRETTY_NAME:-$OS_ID}"
  case "$OS_ID $OS_LIKE" in
    *raspbian*|*debian*|*ubuntu*|*armbian*)
      log_ok "OS compatibile rilevato: $OS_NAME"
      ;;
    *)
      log_warn "OS non testato ufficialmente: $OS_NAME (supportati: RaspiOS, Debian, Ubuntu, Armbian)"
      read -rp "Continuare comunque? [y/N]: " confirm
      [[ "$confirm" =~ ^[yY]$ ]] || exit 0
      ;;
  esac
else
  log_warn "Impossibile verificare la versione del sistema operativo"
fi

# Check internet connectivity
if ! ping -c 2 -W 5 8.8.8.8 &>/dev/null; then
  log_error "Nessuna connessione internet. Collega il cavo Ethernet e riprova."
fi
log_ok "Connessione internet verificata"

# Check disk space (minimum 500MB free)
FREE_KB=$(df -k / | tail -1 | awk '{print $4}')
if [ "$FREE_KB" -lt 500000 ]; then
  log_error "Spazio su disco insufficiente ($(( FREE_KB / 1024 )) MB liberi, minimo 500 MB)"
fi
log_ok "Spazio su disco sufficiente ($(( FREE_KB / 1024 )) MB liberi)"

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

# Nuova struttura: separa codice (${APP_DIR}) dai dati (${APP_DIR}/data)
mkdir -p "${APP_DIR}/data/pb_data/exports" "${APP_DIR}/data/backups"
cd "${APP_DIR}"
log_ok "Struttura cartelle creata:"
log_ok "  Codice:  ${APP_DIR}/"
log_ok "  Dati:    ${APP_DIR}/data/pb_data/"
log_ok "  Backup:  ${APP_DIR}/data/backups/"

# Migrazione automatica da vecchia struttura (./pb_data → ./data/pb_data)
if [ -d "${APP_DIR}/pb_data" ] && [ -z "$(ls -A "${APP_DIR}/data/pb_data" 2>/dev/null)" ]; then
  log_warn "Trovata vecchia struttura ./pb_data — migrazione in corso..."
  # Stop container se attivo
  (cd "${APP_DIR}" && docker compose down 2>/dev/null) || true
  # Sposta contenuto preservando attributi
  if cp -a "${APP_DIR}/pb_data/." "${APP_DIR}/data/pb_data/"; then
    mv "${APP_DIR}/pb_data" "${APP_DIR}/pb_data.old.$(date +%s)"
    log_ok "Migrazione completata. Vecchia cartella rinominata in pb_data.old.*"
  else
    log_warn "Migrazione fallita — verifica manualmente ${APP_DIR}/pb_data"
  fi
fi

# Migrazione rclone.conf nella nuova posizione
if [ -f "${APP_DIR}/rclone.conf" ] && [ ! -f "${APP_DIR}/data/rclone.conf" ]; then
  mv "${APP_DIR}/rclone.conf" "${APP_DIR}/data/rclone.conf"
  log_ok "rclone.conf spostato in ${APP_DIR}/data/"
fi

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

curl -sSL "${GITHUB_RAW}/scripts/setup-hotspot.sh" -o "${APP_DIR}/setup-hotspot.sh" \
    || log_warn "setup-hotspot.sh non scaricato (opzionale)"
chmod +x "${APP_DIR}/setup-hotspot.sh" 2>/dev/null || true
log_ok "setup-hotspot.sh scaricato"

curl -sSL "${GITHUB_RAW}/scripts/armbian-repair.sh" -o "${APP_DIR}/armbian-repair.sh" \
    || log_warn "armbian-repair.sh non scaricato (opzionale)"
chmod +x "${APP_DIR}/armbian-repair.sh" 2>/dev/null || true
log_ok "armbian-repair.sh scaricato"

# ============================================================================
# GOOGLE DRIVE / RCLONE CONFIGURATION
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Configurazione Backup Cloud (Google Drive)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

RCLONE_CONF="${APP_DIR}/data/rclone.conf"

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
# SYSTEMD SERVICES (Watchdog + WiFi Watcher)
# ============================================================================

echo ""
log_info "Installazione servizi systemd..."

curl -sSL "${GITHUB_RAW}/scripts/haccp-watchdog.service" -o /etc/systemd/system/haccp-watchdog.service \
    || log_warn "Watchdog non installato (opzionale)"

curl -sSL "${GITHUB_RAW}/scripts/haccp-wifi-watcher.service" -o /etc/systemd/system/haccp-wifi-watcher.service \
    || log_warn "WiFi watcher non installato (opzionale)"

systemctl daemon-reload

if [ -f /etc/systemd/system/haccp-watchdog.service ]; then
  systemctl enable haccp-watchdog.service
  log_ok "Watchdog systemd installato e abilitato"
fi

if [ -f /etc/systemd/system/haccp-wifi-watcher.service ]; then
  systemctl enable --now haccp-wifi-watcher.service
  log_ok "WiFi watcher systemd installato e avviato"
fi

# ============================================================================
# START CONTAINER
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
# FIRST-BOOT WIZARD (HOTSPOT)
# ============================================================================

FIRST_RUN_FLAG="${APP_DIR}/data/pb_data/first_run.flag"

# Create first_run.flag if no admin user exists yet
# We check via the setup-check API endpoint
NEEDS_SETUP=false
SETUP_RESPONSE=$(curl -sf http://localhost/api/setup-check 2>/dev/null || echo '{}')
if echo "$SETUP_RESPONSE" | grep -q '"needsSetup":true'; then
  NEEDS_SETUP=true
fi

if [ "$NEEDS_SETUP" = true ] || [ -f "$FIRST_RUN_FLAG" ]; then
  # Mark first run
  touch "$FIRST_RUN_FLAG"

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  PRIMA CONFIGURAZIONE — Wizard Hotspot Wi-Fi${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  log_info "Avvio hotspot Wi-Fi aperto per il wizard di configurazione..."
  log_info "Dopo la configurazione, l'hotspot verrà protetto con password."
  echo ""

  if [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
    "${APP_DIR}/setup-hotspot.sh" --mode=setup
  else
    log_warn "setup-hotspot.sh non trovato — wizard hotspot saltato"
    log_warn "Configura il Wi-Fi manualmente dopo l'installazione"
  fi
else
  log_info "Sistema già configurato — wizard hotspot saltato"

  # Start hotspot in normal mode if hostapd is installed
  if command -v hostapd &>/dev/null && [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
    log_info "Avvio hotspot in modalità normale..."
    "${APP_DIR}/setup-hotspot.sh" --mode=normal 2>/dev/null || true
  fi
fi

# ============================================================================
# DONE
# ============================================================================

IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ TRACKER HACCP INSTALLATO${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$FIRST_RUN_FLAG" ]; then
  echo "  ⚡ PRIMA CONFIGURAZIONE:"
  echo "    1. Connettiti al Wi-Fi 'HACCP-Setup-XXXXXX' (aperto)"
  echo "    2. Apri http://haccp.local/setup  o  http://192.168.4.1/setup"
  echo "    3. Crea l'account admin e configura il Wi-Fi"
  echo ""
fi

echo "  App:       http://${IP}  o  http://haccp.local"
echo "  Admin PB:  http://${IP}/_/"
echo "  CUPS:      http://${IP}:631"
echo "  Dati:      ${APP_DIR}/data/pb_data/"
echo "  Exports:   ${APP_DIR}/data/pb_data/exports/"
echo "  Backup:    ${APP_DIR}/data/backups/"
echo "  Rclone:    ${APP_DIR}/data/rclone.conf"
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
