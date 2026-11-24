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
#   --phase1                 solo Fase 1: prepara sistema + hotspot + portale rete
#   --phase2                 solo Fase 2: installa e avvia la web app (lanciata dal portale)
#   --no-onboarding          salta il portale rete e installa subito tutto (es. con cavo)
#
# Installazione in DUE FASI (default su prima installazione):
#   Fase 1 (host, senza Docker): pacchetti, hotspot HACCP-Setup-XXXXXX e portale
#          http://192.168.4.1 per scegliere cavo / Wi-Fi esterno (anche doppia scheda)
#   Fase 2 (live dal portale): scarica e avvia la web app, poi wizard account admin
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
PHASE="all"
ONBOARDING=1
for arg in "$@"; do
  case "$arg" in
    --purge-old) PURGE_OLD=1 ;;
    --with-caddy) WITH_CADDY=1 ;;
    --non-interactive) NONINTERACTIVE=1 ;;
    --skip-cleanup) SKIP_CLEANUP=1 ;;
    --phase1) PHASE=1 ;;
    --phase2) PHASE=2; NONINTERACTIVE=1 ;;
    --no-onboarding) ONBOARDING=0 ;;
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
HAS_INTERNET=0
ping -c 2 -W 5 8.8.8.8 &>/dev/null && HAS_INTERNET=1
if [ "$HAS_INTERNET" -eq 1 ]; then
  sp_log_ok "Connessione internet OK"
elif [ "$PHASE" = "2" ]; then
  sp_log_err "Fase 2: nessuna connessione internet — collega cavo o Wi-Fi dal portale"; exit 1
elif command -v hostapd &>/dev/null && command -v dnsmasq &>/dev/null && command -v python3 &>/dev/null \
     && [ -f "${APP_DIR}/onboarding/haccp-onboarding.py" ]; then
  sp_log_warn "Nessuna connessione internet: avvio direttamente la Fase 1 (hotspot + portale rete)"
  PHASE=1
else
  sp_log_err "Nessuna connessione internet e pacchetti hotspot assenti: collega il cavo Ethernet e riprova"; exit 1
fi

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
if [ "$HAS_INTERNET" -eq 1 ]; then
sp_ensure_packages curl ca-certificates jq sqlite3 rsync iproute2 iw rfkill \
  hostapd dnsmasq python3 wpasupplicant

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
sp_install_docker
sp_prepare_network
fi

# ============================================================================
# FASE 1 — HOTSPOT + PORTALE RETE (nativo, senza Docker)
# ============================================================================
ONB_FLAG="${DATA_DIR}/.onboarding_active"
start_onboarding() {
  sp_log_info "── FASE 1: preparazione rete (hotspot + portale) ──"
  mkdir -p "${APP_DIR}/onboarding"
  if [ "$HAS_INTERNET" -eq 1 ]; then
    for f in haccp-onboarding.py index.html; do
      curl -sSL --fail "${GITHUB_RAW}/scripts/onboarding/${f}" -o "${APP_DIR}/onboarding/${f}.tmp" 2>/dev/null \
        && mv "${APP_DIR}/onboarding/${f}.tmp" "${APP_DIR}/onboarding/${f}" || rm -f "${APP_DIR}/onboarding/${f}.tmp"
    done
    curl -sSL --fail "${GITHUB_RAW}/scripts/setup-hotspot.sh" -o "${APP_DIR}/setup-hotspot.sh" 2>/dev/null || true
    curl -sSL --fail "${GITHUB_RAW}/install.sh" -o "${APP_DIR}/install.sh.tmp" 2>/dev/null \
      && mv "${APP_DIR}/install.sh.tmp" "${APP_DIR}/install.sh" || rm -f "${APP_DIR}/install.sh.tmp"
    curl -sSL --fail "${GITHUB_RAW}/scripts/haccp-onboarding.service" -o /etc/systemd/system/haccp-onboarding.service 2>/dev/null || true
    # Pre-scarico immagini: la Fase 2 sarà veloce anche se la rete cambia
    curl -sSL --fail "${GITHUB_RAW}/docker-compose.yml" -o "${APP_DIR}/docker-compose.yml" 2>/dev/null \
      && (cd "${APP_DIR}" && docker compose pull 2>/dev/null) && sp_log_ok "Immagini web app pre-scaricate" || true
  fi
  chmod +x "${APP_DIR}"/*.sh 2>/dev/null || true
  [ -f "${APP_DIR}/onboarding/haccp-onboarding.py" ] || { sp_log_err "Portale onboarding non disponibile"; exit 1; }

  # Scheda hotspot: la prima Wi-Fi; con doppia scheda la seconda resta client
  AP_IFACE=$(iw dev 2>/dev/null | awk '$1=="Interface"{print $2}' | sort | head -1)
  [ -n "$AP_IFACE" ] || { sp_log_err "Nessuna scheda Wi-Fi per l'hotspot"; exit 1; }
  WIFI_COUNT=$(iw dev 2>/dev/null | awk '$1=="Interface"' | wc -l)
  sp_log_ok "Schede Wi-Fi: ${WIFI_COUNT} (hotspot su ${AP_IFACE})"

  # Libera la porta 80 (container eventualmente attivo)
  (cd "${APP_DIR}" && docker compose down 2>/dev/null) || true
  "${APP_DIR}/setup-hotspot.sh" --mode=setup --iface="${AP_IFACE}" || sp_log_warn "Hotspot: verifica manuale necessaria"
  # Captive portal: tutti i domini puntano al portale
  if [ -d /etc/dnsmasq.d ]; then
    echo "address=/#/192.168.4.1" > /etc/dnsmasq.d/haccp-captive.conf
    systemctl restart dnsmasq 2>/dev/null || true
  fi

  printf 'HACCP_AP_IFACE=%s\n' "$AP_IFACE" > "${DATA_DIR}/onboarding.env"
  touch "$ONB_FLAG"
  rm -f "${DATA_DIR}/onboarding_state.json" "${DATA_DIR}/phase2-install.log.rc"
  systemctl daemon-reload
  systemctl enable haccp-onboarding.service &>/dev/null || true
  systemctl restart haccp-onboarding.service \
    || { sp_log_err "Portale non avviato (journalctl -u haccp-onboarding)"; exit 1; }

  echo ""
  sp_log_ok "═══════════════════════════════════════════════"
  sp_log_ok "  ✓ FASE 1 COMPLETATA — sistema preparato"
  sp_log_ok "═══════════════════════════════════════════════"
  echo "  1. Collega telefono/tablet al Wi-Fi 'HACCP-Setup-XXXXXX'"
  echo "  2. Si apre la pagina di preparazione (o vai su http://192.168.4.1)"
  echo "  3. Scegli cavo o Wi-Fi esterno → l'app si installa in automatico (Fase 2)"
  echo "  Log Fase 2: ${DATA_DIR}/phase2-install.log"
  echo ""
  exit 0
}

stop_onboarding() {
  [ -f "$ONB_FLAG" ] || return 0
  sp_log_info "Chiusura portale Fase 1..."
  rm -f "$ONB_FLAG" /etc/dnsmasq.d/haccp-captive.conf
  systemctl disable --now haccp-onboarding.service &>/dev/null || true
  systemctl restart dnsmasq 2>/dev/null || true
}

FRESH_INSTALL=1
[ -f "${PB_DATA}/setup_complete.json" ] || [ -f "${PB_DATA}/data.db" ] && FRESH_INSTALL=0
if [ "$PHASE" = "1" ] || { [ "$PHASE" = "all" ] && [ "$ONBOARDING" -eq 1 ] && [ "$FRESH_INSTALL" -eq 1 ]; }; then
  start_onboarding
fi

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
download_file "${GITHUB_RAW}/scripts/setup-https.sh" "${APP_DIR}/setup-https.sh"
mkdir -p "${APP_DIR}/caddy"
download_file "${GITHUB_RAW}/scripts/caddy/Caddyfile" "${APP_DIR}/caddy/Caddyfile"
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
# Fase 2 da portale: rete app, nome locale e admin scelti in Fase 1
ONB_ENV="${DATA_DIR}/onboarding.env"
APP_HOST="localhost"
if [ "$PHASE" = "2" ] && [ -f "$ONB_ENV" ]; then
  # shellcheck disable=SC1090
  . "$ONB_ENV"
  export HACCP_DOMAIN HACCP_APP_SSID HACCP_APP_WIFI_PASSWORD
  # La web app è esposta SOLO sulla rete Wi-Fi creata dal dispositivo
  touch "${APP_DIR}/.env"
  sed -i '/^HACCP_BIND_IP=/d' "${APP_DIR}/.env"
  echo "HACCP_BIND_IP=192.168.4.1" >> "${APP_DIR}/.env"
  APP_HOST="192.168.4.1"
  # Docker parte solo quando l'IP dell'hotspot esiste (altrimenti il bind fallisce al boot)
  mkdir -p /etc/systemd/system/docker.service.d
  cat > /etc/systemd/system/docker.service.d/haccp-hotspot.conf <<'DROPIN'
[Unit]
After=hostapd.service dnsmasq.service network-online.target
Wants=hostapd.service
[Service]
ExecStartPre=/bin/sh -c 'for i in $(seq 1 30); do ip -4 addr | grep -q "192.168.4.1/" && exit 0; sleep 1; done; exit 0'
DROPIN
  systemctl daemon-reload
  sp_log_ok "App visibile solo sulla rete ${HACCP_APP_SSID:-hotspot} (${HACCP_DOMAIN:-haccp.local})"
fi

sp_log_info "── Avvio container ──"
(cd "${APP_DIR}" && docker compose pull 2>/dev/null) || sp_log_warn "Pull immagini fallito (uso cache locale)"
stop_onboarding
(cd "${APP_DIR}" && docker compose up -d --remove-orphans) \
  || { sp_log_err "Avvio container fallito"; exit 1; }
sp_log_ok "Container avviato"

echo -n "Attesa avvio PocketBase"
for i in $(seq 1 30); do
  curl -sf "http://${APP_HOST}/api/health" &>/dev/null && { echo; sp_log_ok "PocketBase pronto"; break; }
  echo -n "."; sleep 2
done
echo ""

# Account amministratore creato nel portale di Fase 1: applicato una sola volta
ADMIN_FILE="${DATA_DIR}/admin_bootstrap.json"
if [ "$PHASE" = "2" ] && [ -f "$ADMIN_FILE" ]; then
  sp_log_info "Creazione account amministratore..."
  PAYLOAD=$(python3 - "$ADMIN_FILE" <<'PY'
import json, os, sys
a = json.load(open(sys.argv[1]))
a.update({"wifi_ssid": os.environ.get("HACCP_APP_SSID", ""), "wifi_password": os.environ.get("HACCP_APP_WIFI_PASSWORD", ""), "skip_wifi": True})
print(json.dumps(a))
PY
)
  ADMIN_OK=0
  for i in $(seq 1 10); do
    CODE=$(HACCP_APP_SSID="${HACCP_APP_SSID:-}" HACCP_APP_WIFI_PASSWORD="${HACCP_APP_WIFI_PASSWORD:-}" \
      curl -s -o /tmp/haccp-admin.out -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      --data-binary "$PAYLOAD" "http://${APP_HOST}/api/complete-setup" 2>/dev/null || echo 000)
    if [ "$CODE" = "200" ] || { [ "$CODE" = "403" ] && grep -q "completato" /tmp/haccp-admin.out; }; then
      ADMIN_OK=1; break
    fi
    sleep 3
  done
  unset PAYLOAD; rm -f /tmp/haccp-admin.out
  if [ "$ADMIN_OK" -eq 1 ]; then
    rm -f "$ADMIN_FILE"
    sp_log_ok "Account amministratore creato (stessa email/password anche per il pannello /_/)"
  else
    sp_log_err "Creazione amministratore non riuscita (codice ${CODE}): riprova dal portale"; exit 1
  fi
fi

# Setup wizard (handoff web)
NEEDS_SETUP=false
SETUP_RESPONSE=$(curl -sf "http://${APP_HOST}/api/setup-check" 2>/dev/null || echo '{}')
echo "$SETUP_RESPONSE" | grep -q '"needsSetup":true' && NEEDS_SETUP=true

FIRST_RUN_FLAG="${PB_DATA}/first_run.flag"
if [ "$NEEDS_SETUP" = true ]; then
  touch "$FIRST_RUN_FLAG"
  sp_log_info "Prima configurazione: avvio hotspot per wizard web..."
  if [ "$PHASE" = "2" ]; then
    # Rete già scelta in Fase 1: non toccare Wi-Fi/hotspot (scheda singola resterebbe offline)
    sp_log_ok "Rete configurata in Fase 1 — hotspot invariato"
  elif [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
    "${APP_DIR}/setup-hotspot.sh" --mode=setup || sp_log_warn "Hotspot setup fallito"
  fi
else
  sp_log_ok "Sistema già configurato"
  if [ "$PHASE" != "2" ] && [ ! -f "$ONB_ENV" ] && command -v hostapd &>/dev/null && [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
    "${APP_DIR}/setup-hotspot.sh" --mode=normal 2>/dev/null || true
  fi
fi

# Setup HTTPS + haccp.local (opzionale)
if [ "$WITH_CADDY" -eq 1 ] && [ -x "${APP_DIR}/setup-https.sh" ]; then
  sp_log_info "── Attivazione HTTPS + haccp.local ──"
  APP_DIR="${APP_DIR}" HACCP_DOMAIN="${HACCP_DOMAIN:-haccp.local}" "${APP_DIR}/setup-https.sh" || sp_log_warn "Setup HTTPS fallito"
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
if [ "$WITH_CADDY" -eq 1 ]; then
  echo "  App:       https://haccp.local/  o  https://${IP}/  (HTTPS attivo)"
  echo "  CA cert:   ${DATA_DIR}/haccp-root-ca.crt"
else
  echo "  App:       http://${IP}  o  http://haccp.local"
  echo "  HTTPS:     attivalo con  sudo ${APP_DIR}/setup-https.sh"
fi
echo "  Admin PB:  http://${IP}/_/"
echo "  Dati:      ${PB_DATA}/  (PROTETTI da update/cleanup)"
echo "  Backup:    ${BACKUP_DIR}/"
echo ""
echo "  Comandi:"
echo "    ${APP_DIR}/update.sh                                  # Aggiorna"
echo "    ${APP_DIR}/armbian-repair.sh --reset-schema --fix-wifi  # Repair"
echo "    docker compose -f ${APP_DIR}/docker-compose.yml logs -f"
echo ""
