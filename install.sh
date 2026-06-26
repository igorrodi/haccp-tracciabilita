#!/bin/bash
#
# Tracker HACCP - Installazione Automatica (all-in-one)
# Usage: curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/install.sh | sudo bash
#
# Flags (passabili anche come variabili d'ambiente):
#   --purge-old              rimuove vecchie config (mai dati utente)
#   --with-caddy             installa Caddy come reverse proxy
#   --non-interactive        non chiede nulla (anche con HACCP_NONINTERACTIVE=1)
#   --skip-cleanup           salta la pulizia di vecchie config
#
set -uo pipefail

readonly APP_DIR="/opt/haccp-tracker"
readonly DATA_DIR="${APP_DIR}/data"
readonly PB_DATA="${DATA_DIR}/pb_data"
readonly BACKUP_DIR="${DATA_DIR}/backups"
readonly GITHUB_REPO="igorrodi/haccp-tracciabilita"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
readonly LIB_PATH="${APP_DIR}/scripts/system-prepare.sh"

# ---------- Flags ----------
PURGE_OLD=0
WITH_CADDY=0
NONINTERACTIVE="${HACCP_NONINTERACTIVE:-0}"
SKIP_CLEANUP=0
for arg in "$@"; do
  case "$arg" in
    --purge-old) PURGE_OLD=1 ;;
    --with-caddy) WITH_CADDY=1 ;;
    --non-interactive) NONINTERACTIVE=1 ;;
    --skip-cleanup) SKIP_CLEANUP=1 ;;
  esac
done

# ---------- Pre-flight ----------
[ "$EUID" -eq 0 ] || { echo "Esegui come root (sudo)"; exit 1; }

mkdir -p "${APP_DIR}/scripts" "${PB_DATA}/exports" "${BACKUP_DIR}"
cd "${APP_DIR}"

# Scarica/aggiorna libreria condivisa PRIMA di sourcing
curl -sSL --fail "${GITHUB_RAW}/scripts/system-prepare.sh" -o "${LIB_PATH}.tmp" 2>/dev/null \
  && mv "${LIB_PATH}.tmp" "${LIB_PATH}" || true
if [ ! -f "${LIB_PATH}" ]; then
  echo "ERRORE: libreria system-prepare.sh non disponibile"
  exit 1
fi
# shellcheck disable=SC1090
. "${LIB_PATH}"

readonly LOG_FILE="${PB_DATA}/install.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
sp_log_info "═══════════════════════════════════════════════"
sp_log_info "  TRACKER HACCP — Installazione"
sp_log_info "  $(date '+%Y-%m-%d %H:%M:%S')"
sp_log_info "═══════════════════════════════════════════════"

# ============================================================================
# 1. DETECT SYSTEM
# ============================================================================
sp_detect_system
if ! sp_is_supported_os; then
  sp_log_warn "OS non ufficialmente supportato: ${SP_OS_NAME}"
  if [ "$NONINTERACTIVE" != 1 ]; then
    read -rp "Continuare? [y/N]: " a; [[ "$a" =~ ^[yY]$ ]] || exit 0
  fi
fi

# Internet
ping -c 2 -W 5 8.8.8.8 &>/dev/null || { sp_log_err "Nessuna connessione internet"; exit 1; }
sp_log_ok "Connessione internet OK"

# Disco
FREE_KB=$(df -k / | tail -1 | awk '{print $4}')
if [ "$FREE_KB" -lt 1000000 ]; then
  sp_log_warn "Spazio libero basso: $((FREE_KB/1024)) MB"
fi

# NTP
if command -v timedatectl &>/dev/null && ! timedatectl status 2>/dev/null | grep -q 'synchronized: yes'; then
  sp_log_warn "Orologio non sincronizzato (NTP)"
fi

# ============================================================================
# 2. PACKAGES & SYSTEM PREP
# ============================================================================
sp_log_info "── Pacchetti & preparazione sistema ──"
sp_ensure_packages curl ca-certificates jq sqlite3 rsync iproute2 iw rfkill \
  hostapd dnsmasq

# Rete: NetworkManager preferito su Armbian/Ubuntu, dhcpcd su RaspiOS classico
case "${SP_OS_ID}" in
  raspbian)
    sp_ensure_packages dhcpcd5 || true
    ;;
  *)
    if [ "${SP_NETWORK_STACK}" = "networkmanager" ] || command -v nmcli &>/dev/null; then
      sp_ensure_packages network-manager || true
    fi
    ;;
esac

# Caddy NON va installato a livello host: gira in container (vedi setup-https.sh)
[ "$WITH_CADDY" -eq 1 ] && sp_log_info "Modalità HTTPS richiesta — sarà attivata dopo l'avvio"
sp_prepare_network

# ============================================================================
# 3. WEB APP INSTALL
# ============================================================================
sp_log_info "── Installazione web app ──"

# Migrazione vecchia struttura ./pb_data → ./data/pb_data
if [ -d "${APP_DIR}/pb_data" ] && [ -z "$(ls -A "${PB_DATA}" 2>/dev/null)" ]; then
  sp_log_warn "Migrazione ./pb_data → ./data/pb_data..."
  (cd "${APP_DIR}" && docker compose down 2>/dev/null) || true
  cp -a "${APP_DIR}/pb_data/." "${PB_DATA}/" \
    && mv "${APP_DIR}/pb_data" "${APP_DIR}/pb_data.old.$(date +%s)" \
    && sp_log_ok "Migrazione completata"
fi
[ -f "${APP_DIR}/rclone.conf" ] && [ ! -f "${DATA_DIR}/rclone.conf" ] && \
  mv "${APP_DIR}/rclone.conf" "${DATA_DIR}/rclone.conf"

# Download file con backup .prev su file esistenti
download_file() {
  local url="$1" dest="$2" required="${3:-0}"
  local tmp="${dest}.tmp"
  if curl -sSL --fail "$url" -o "$tmp" 2>/dev/null; then
    [ -f "$dest" ] && cp "$dest" "${dest}.prev"
    mv "$tmp" "$dest"
    sp_log_ok "Scaricato: $(basename "$dest")"
  else
    rm -f "$tmp"
    if [ "$required" = "1" ] && [ ! -f "$dest" ]; then
      sp_log_err "Download obbligatorio fallito: $url"; exit 1
    fi
    sp_log_warn "Download fallito (mantengo esistente): $(basename "$dest")"
  fi
}

download_file "${GITHUB_RAW}/docker-compose.yml" "${APP_DIR}/docker-compose.yml" 1
download_file "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" "${APP_DIR}/pb_schema.json" 1
download_file "${GITHUB_RAW}/update.sh" "${APP_DIR}/update.sh"
download_file "${GITHUB_RAW}/scripts/setup-hotspot.sh" "${APP_DIR}/setup-hotspot.sh"
download_file "${GITHUB_RAW}/scripts/armbian-repair.sh" "${APP_DIR}/armbian-repair.sh"
chmod +x "${APP_DIR}"/*.sh 2>/dev/null || true

# rclone.conf vuoto se non esiste (per il volume Docker)
[ ! -f "${DATA_DIR}/rclone.conf" ] && touch "${DATA_DIR}/rclone.conf" && chmod 600 "${DATA_DIR}/rclone.conf"

# Servizi systemd
for svc in haccp-watchdog haccp-wifi-watcher; do
  curl -sSL --fail "${GITHUB_RAW}/scripts/${svc}.service" -o "/etc/systemd/system/${svc}.service" 2>/dev/null \
    && sp_log_ok "Service installato: ${svc}" \
    || sp_log_warn "Service non scaricato: ${svc}"
done
systemctl daemon-reload
[ -f /etc/systemd/system/haccp-watchdog.service ] && systemctl enable haccp-watchdog.service &>/dev/null || true
[ -f /etc/systemd/system/haccp-wifi-watcher.service ] && systemctl enable --now haccp-wifi-watcher.service &>/dev/null || true

# ============================================================================
# 4. CLEANUP VECCHIE CONFIG (NO DATI)
# ============================================================================
if [ "$SKIP_CLEANUP" -ne 1 ]; then
  sp_log_info "── Pulizia vecchie configurazioni ──"
  sp_cleanup_old_configs "${APP_DIR}"
  [ "$PURGE_OLD" -eq 1 ] && sp_log_info "Modalità --purge-old attiva"
fi

# ============================================================================
# 5. START & HANDOFF AL WIZARD WEB
# ============================================================================
sp_log_info "── Avvio container ──"
(cd "${APP_DIR}" && docker compose pull 2>/dev/null && docker compose up -d --remove-orphans) \
  || { sp_log_err "Avvio container fallito"; exit 1; }
sp_log_ok "Container avviato"

echo -n "Attesa avvio PocketBase"
for i in $(seq 1 30); do
  curl -sf http://localhost/api/health &>/dev/null && { echo; sp_log_ok "PocketBase pronto"; break; }
  echo -n "."; sleep 2
done
echo ""

# Setup wizard (handoff web)
NEEDS_SETUP=false
SETUP_RESPONSE=$(curl -sf http://localhost/api/setup-check 2>/dev/null || echo '{}')
echo "$SETUP_RESPONSE" | grep -q '"needsSetup":true' && NEEDS_SETUP=true

FIRST_RUN_FLAG="${PB_DATA}/first_run.flag"
if [ "$NEEDS_SETUP" = true ]; then
  touch "$FIRST_RUN_FLAG"
  sp_log_info "Prima configurazione: avvio hotspot per wizard web..."
  if [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
    "${APP_DIR}/setup-hotspot.sh" --mode=setup || sp_log_warn "Hotspot setup fallito"
  fi
else
  sp_log_ok "Sistema già configurato"
  if command -v hostapd &>/dev/null && [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
    "${APP_DIR}/setup-hotspot.sh" --mode=normal 2>/dev/null || true
  fi
fi

# ============================================================================
# DONE
# ============================================================================
IP=$(hostname -I | awk '{print $1}')
echo ""
sp_log_ok "═══════════════════════════════════════════════"
sp_log_ok "  ✓ TRACKER HACCP INSTALLATO"
sp_log_ok "═══════════════════════════════════════════════"
echo ""
if [ "$NEEDS_SETUP" = true ]; then
  echo "  ⚡ PRIMA CONFIGURAZIONE (dal browser):"
  echo "    1. Connetti il tuo dispositivo al Wi-Fi 'HACCP-Setup-XXXXXX'"
  echo "    2. Apri:  http://haccp.local/setup   oppure   http://192.168.4.1/setup"
  echo "    3. Crea admin, configura Wi-Fi e backup cloud dal wizard web"
  echo ""
fi
echo "  App:       http://${IP}  o  http://haccp.local"
echo "  Admin PB:  http://${IP}/_/"
echo "  Dati:      ${PB_DATA}/  (PROTETTI da update/cleanup)"
echo "  Backup:    ${BACKUP_DIR}/"
echo ""
echo "  Comandi:"
echo "    ${APP_DIR}/update.sh                                  # Aggiorna"
echo "    ${APP_DIR}/armbian-repair.sh --reset-schema --fix-wifi  # Repair"
echo "    docker compose -f ${APP_DIR}/docker-compose.yml logs -f"
echo ""
