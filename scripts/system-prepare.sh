#!/bin/bash
# Tracker HACCP - Libreria condivisa per detect/prepare/cleanup del sistema
# Sourced da install.sh, update.sh, armbian-repair.sh
# shellcheck disable=SC2034,SC2155

# ---------- Colori e logging ----------
if [ -z "${_SP_LOGGING_LOADED:-}" ]; then
  readonly _SP_LOGGING_LOADED=1
  readonly SP_GREEN='\033[0;32m'
  readonly SP_RED='\033[0;31m'
  readonly SP_YELLOW='\033[1;33m'
  readonly SP_CYAN='\033[0;36m'
  readonly SP_NC='\033[0m'
fi

sp_log_ok()    { echo -e "${SP_GREEN}[✓]${SP_NC} $1"; }
sp_log_warn() { echo -e "${SP_YELLOW}[!]${SP_NC} $1"; }
sp_log_err()  { echo -e "${SP_RED}[✗]${SP_NC} $1"; }
sp_log_info() { echo -e "${SP_CYAN}[i]${SP_NC} $1"; }

# ---------- Variabili globali popolate da detect_system ----------
SP_OS_ID=""
SP_OS_LIKE=""
SP_OS_NAME=""
SP_BOARD=""
SP_ARCH=""
SP_NETWORK_STACK=""   # networkmanager | netplan | dhcpcd | unknown
SP_WIFI_IFACE=""

# ---------- 1. DETECT ----------
sp_detect_system() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    SP_OS_ID="${ID:-unknown}"
    SP_OS_LIKE="${ID_LIKE:-}"
    SP_OS_NAME="${PRETTY_NAME:-$SP_OS_ID}"
  fi
  SP_ARCH="$(uname -m)"
  if [ -r /proc/device-tree/model ]; then
    SP_BOARD="$(tr -d '\0' </proc/device-tree/model 2>/dev/null || echo unknown)"
  else
    SP_BOARD="generic"
  fi

  # Network stack detection
  if systemctl is-active --quiet NetworkManager 2>/dev/null; then
    SP_NETWORK_STACK="networkmanager"
  elif [ -d /etc/netplan ] && ls /etc/netplan/*.yaml &>/dev/null; then
    SP_NETWORK_STACK="netplan"
  elif systemctl is-active --quiet dhcpcd 2>/dev/null; then
    SP_NETWORK_STACK="dhcpcd"
  else
    SP_NETWORK_STACK="unknown"
  fi

  SP_WIFI_IFACE="$(sp_detect_wifi_iface)"

  sp_log_info "OS:      ${SP_OS_NAME}"
  sp_log_info "Board:   ${SP_BOARD}"
  sp_log_info "Arch:    ${SP_ARCH}"
  sp_log_info "Network: ${SP_NETWORK_STACK}"
  sp_log_info "Wi-Fi:   ${SP_WIFI_IFACE:-non rilevata}"
}

sp_detect_wifi_iface() {
  local iface=""
  if command -v iw &>/dev/null; then
    iface="$(iw dev 2>/dev/null | awk '$1=="Interface"{print $2; exit}')"
  fi
  if [ -z "$iface" ]; then
    for d in /sys/class/net/*/wireless; do
      [ -e "$d" ] || continue
      iface="$(basename "$(dirname "$d")")"; break
    done
  fi
  if [ -z "$iface" ]; then
    for cand in wld0 wlan0 wlp2s0 wlp3s0; do
      [ -d "/sys/class/net/$cand" ] && { iface="$cand"; break; }
    done
  fi
  echo "$iface"
}

sp_is_supported_os() {
  case "${SP_OS_ID} ${SP_OS_LIKE}" in
    *raspbian*|*debian*|*ubuntu*|*armbian*) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------- 2. PACKAGES & PREPARE ----------
SP_APT_UPDATED=0
sp_apt_update_once() {
  [ "$SP_APT_UPDATED" -eq 1 ] && return 0
  sp_log_info "Aggiornamento indici APT..."
  DEBIAN_FRONTEND=noninteractive apt-get update -qq || sp_log_warn "apt-get update parziale"
  SP_APT_UPDATED=1
}

sp_pkg_installed() { dpkg -s "$1" &>/dev/null; }

sp_ensure_packages() {
  local missing=()
  for p in "$@"; do
    sp_pkg_installed "$p" || missing+=("$p")
  done
  if [ ${#missing[@]} -eq 0 ]; then
    sp_log_ok "Pacchetti già presenti: $*"
    return 0
  fi
  sp_apt_update_once
  sp_log_info "Installazione mancanti: ${missing[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    -o Dpkg::Options::=--force-confnew \
    -o Dpkg::Options::=--force-confdef \
    "${missing[@]}" || { sp_log_err "Installazione pacchetti fallita"; return 1; }
  sp_log_ok "Installati: ${missing[*]}"
}

sp_install_docker() {
  if command -v docker &>/dev/null; then
    sp_log_ok "Docker presente ($(docker --version 2>/dev/null | awk '{print $3}' | tr -d ','))"
  else
    sp_log_info "Installazione Docker..."
    curl -fsSL https://get.docker.com | sh || { sp_log_err "Install Docker fallito"; return 1; }
  fi
  systemctl enable --now docker &>/dev/null || true
  if ! docker compose version &>/dev/null; then
    sp_log_warn "Docker Compose plugin v2 non trovato. Provo apt..."
    sp_ensure_packages docker-compose-plugin || sp_log_err "Compose plugin assente"
  fi
  sp_log_ok "Docker Compose disponibile"
}

sp_prepare_network() {
  local iface="${SP_WIFI_IFACE:-}"

  # rfkill unblock wifi
  if command -v rfkill &>/dev/null; then
    rfkill unblock wifi 2>/dev/null || true
  fi

  # Disabilita wpa_supplicant sull'interfaccia hotspot
  if [ -n "$iface" ]; then
    systemctl disable --now "wpa_supplicant@${iface}.service" 2>/dev/null || true
  fi

  # Disabilita stub DNS systemd-resolved (porta 53 per dnsmasq)
  if systemctl is-active --quiet systemd-resolved 2>/dev/null; then
    mkdir -p /etc/systemd/resolved.conf.d
    cat > /etc/systemd/resolved.conf.d/haccp-no-stub.conf <<EOF
[Resolve]
DNSStubListener=no
EOF
    systemctl restart systemd-resolved 2>/dev/null || true
    sp_log_ok "systemd-resolved stub DNS disabilitato"
  fi

  # ip_forward persistente
  if [ ! -f /etc/sysctl.d/99-haccp.conf ] || ! grep -q '^net.ipv4.ip_forward=1' /etc/sysctl.d/99-haccp.conf 2>/dev/null; then
    echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-haccp.conf
    sysctl -p /etc/sysctl.d/99-haccp.conf &>/dev/null || true
    sp_log_ok "IP forwarding abilitato"
  fi

  # Apri porte UFW se attivo
  if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    for port in 80/tcp 443/tcp 631/tcp 53/udp 67/udp; do
      ufw allow "$port" &>/dev/null || true
    done
    sp_log_ok "Porte UFW aperte (80,443,631,53/udp,67/udp)"
  fi
}

# ---------- 4. CLEANUP SICURO ----------
# Path PROTETTI: mai cancellabili
sp_is_protected_path() {
  local p="$1"
  case "$p" in
    */data|*/data/*) return 0 ;;
    */pb_data|*/pb_data/*) return 0 ;;
    */backups|*/backups/*) return 0 ;;
    *rclone.conf) return 0 ;;
    *.db|*.db-wal|*.db-shm) return 0 ;;
    /|/root|/home|/etc|/var|/usr|/boot|/bin|/sbin|/lib*) return 0 ;;
  esac
  return 1
}

sp_safe_remove() {
  local target="$1"
  if [ -z "$target" ] || [ ! -e "$target" ]; then return 0; fi
  if sp_is_protected_path "$target"; then
    sp_log_warn "RIFIUTATO (path protetto): $target"
    return 1
  fi
  rm -rf "$target" && sp_log_ok "Rimosso: $target"
}

# Backup difensivo prima di rimozioni multiple
sp_backup_before_cleanup() {
  local backup_dir="$1"; shift
  local files=("$@")
  [ ${#files[@]} -eq 0 ] && return 0
  local existing=()
  for f in "${files[@]}"; do [ -e "$f" ] && existing+=("$f"); done
  [ ${#existing[@]} -eq 0 ] && return 0
  mkdir -p "$backup_dir"
  local tarball="${backup_dir}/cleanup_$(date +%Y%m%d_%H%M%S).tar.gz"
  tar -czf "$tarball" "${existing[@]}" 2>/dev/null && \
    sp_log_ok "Backup pre-cleanup: $tarball"
}

sp_cleanup_old_configs() {
  local app_dir="$1"
  local data_dir="${app_dir}/data"
  local backup_dir="${data_dir}/backups"

  sp_log_info "Pulizia vecchie configurazioni (dati utente protetti)..."

  # Lista candidati alla rimozione (NON dati)
  local candidates=(
    "${app_dir}/Dockerfile.old"
    "${app_dir}/docker-compose.yml.bak"
    "${app_dir}/pb_hooks"
    "${app_dir}/pb_migrations"
  )
  # File .bak/.tmp nella root
  for f in "${app_dir}"/*.bak "${app_dir}"/*.tmp; do
    [ -e "$f" ] && candidates+=("$f")
  done

  sp_backup_before_cleanup "$backup_dir" "${candidates[@]}"
  for c in "${candidates[@]}"; do
    [ -e "$c" ] && sp_safe_remove "$c"
  done

  # pb_data.old.* più vecchi di 30 giorni (mai i dati attivi)
  find "${app_dir}" -maxdepth 1 -name 'pb_data.old.*' -type d -mtime +30 2>/dev/null | while read -r old; do
    sp_safe_remove "$old"
  done

  # Servizio systemd legacy
  if [ -f /etc/systemd/system/haccp.service ]; then
    systemctl disable --now haccp.service 2>/dev/null || true
    rm -f /etc/systemd/system/haccp.service
    systemctl daemon-reload
    sp_log_ok "Servizio legacy haccp.service rimosso"
  fi

  # rclone.conf legacy nella root (già migrato in data/)
  if [ -f "${app_dir}/rclone.conf" ] && [ -f "${data_dir}/rclone.conf" ]; then
    rm -f "${app_dir}/rclone.conf"
    sp_log_ok "rclone.conf legacy rimosso (già in data/)"
  fi

  # Docker: container orfani non più gestiti da compose
  if command -v docker &>/dev/null; then
    docker ps -a --filter "name=haccp-" --format '{{.Names}}' 2>/dev/null | while read -r c; do
      # tieni solo quelli del compose corrente
      if ! docker compose -f "${app_dir}/docker-compose.yml" ps --services 2>/dev/null | grep -q "$c"; then
        # rimozione solo se non in esecuzione attiva dal compose
        :
      fi
    done
    docker image prune -f &>/dev/null || true
    sp_log_ok "Immagini Docker inutilizzate rimosse"
  fi
}
