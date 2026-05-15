#!/bin/bash
#
# setup-hotspot.sh — Gestione hotspot Wi-Fi per HACCP Tracker
# Compatible with Raspberry Pi OS Bookworm (NetworkManager) and legacy (dhcpcd)
# Usage: sudo setup-hotspot.sh --mode=setup|normal [--ssid=NAME] [--password=PASS]
#
set -euo pipefail

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
# PARSE ARGUMENTS
# ============================================================================

MODE="normal"
SSID=""
PASSWORD=""
WIFI_IFACE=""

for arg in "$@"; do
  case "$arg" in
    --mode=*)    MODE="${arg#*=}" ;;
    --ssid=*)    SSID="${arg#*=}" ;;
    --password=*) PASSWORD="${arg#*=}" ;;
    --iface=*)   WIFI_IFACE="${arg#*=}" ;;
  esac
done

# ============================================================================
# AUTO-DETECT WI-FI INTERFACE
# ============================================================================
# Su Armbian/Ubuntu su Pi5 l'interfaccia può chiamarsi wld0, wlx*, wlp*…
# Rileviamo dinamicamente invece di assumere wlan0.

if [ -z "$WIFI_IFACE" ] && command -v iw &>/dev/null; then
  WIFI_IFACE=$(iw dev 2>/dev/null | awk '$1=="Interface"{print $2; exit}')
fi
if [ -z "$WIFI_IFACE" ]; then
  # Fallback: cerca prima interfaccia wireless in /sys/class/net
  for iface in /sys/class/net/*/wireless; do
    [ -d "$iface" ] || continue
    WIFI_IFACE=$(basename "$(dirname "$iface")")
    break
  done
fi
if [ -z "$WIFI_IFACE" ]; then
  # Ultimo fallback: pattern comuni
  for cand in wlan0 wld0 wlp2s0 wlp3s0; do
    if [ -d "/sys/class/net/$cand" ]; then
      WIFI_IFACE="$cand"
      break
    fi
  done
fi
[ -z "$WIFI_IFACE" ] && log_error "Nessuna interfaccia Wi-Fi trovata (iw dev / /sys/class/net)"
log_ok "Interfaccia Wi-Fi rilevata: ${WIFI_IFACE}"

# ============================================================================
# GENERATE SETUP SSID (if mode=setup)
# ============================================================================

if [ "$MODE" = "setup" ]; then
  # Generate SSID from interface MAC last 6 hex chars
  MAC_SUFFIX=""
  if [ -f "/sys/class/net/${WIFI_IFACE}/address" ]; then
    MAC_SUFFIX=$(cat "/sys/class/net/${WIFI_IFACE}/address" | tr -d ':' | tail -c 7 | head -c 6 | tr '[:lower:]' '[:upper:]')
  fi
  if [ -z "$MAC_SUFFIX" ]; then
    MAC_SUFFIX=$(od -An -tx1 -N3 /dev/urandom | tr -d ' \n' | head -c 6 | tr '[:lower:]' '[:upper:]')
  fi
  SSID="HACCP-Setup-${MAC_SUFFIX}"
  PASSWORD=""
  log_info "Modalità SETUP — SSID aperto: ${SSID}"
else
  [ -z "$SSID" ] && SSID="HACCP-Tracciabilita"
  [ -z "$PASSWORD" ] && PASSWORD="cambia123"
  log_info "Modalità NORMALE — SSID: ${SSID}"
fi

# ============================================================================
# DETECT NETWORK MANAGER (Bookworm uses NetworkManager, not dhcpcd)
# ============================================================================

USE_NM=false
if command -v nmcli &>/dev/null && systemctl is-active --quiet NetworkManager 2>/dev/null; then
  USE_NM=true
  log_info "Rilevato NetworkManager (RPi OS Bookworm)"
elif command -v dhcpcd &>/dev/null; then
  log_info "Rilevato dhcpcd (RPi OS legacy)"
else
  log_warn "Nessun network manager rilevato — configurazione manuale IP"
fi

# ============================================================================
# INSTALL DEPENDENCIES
# ============================================================================

log_info "Verifica dipendenze..."

PACKAGES_NEEDED=""
for pkg in hostapd dnsmasq; do
  if ! dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
    PACKAGES_NEEDED="$PACKAGES_NEEDED $pkg"
  fi
done

# UFW is optional — don't fail if not installable
UFW_AVAILABLE=false
if dpkg -l ufw 2>/dev/null | grep -q "^ii"; then
  UFW_AVAILABLE=true
elif [ -n "$PACKAGES_NEEDED" ]; then
  PACKAGES_NEEDED="$PACKAGES_NEEDED ufw"
fi

if [ -n "$PACKAGES_NEEDED" ]; then
  log_info "Installazione:${PACKAGES_NEEDED}"
  apt-get update -qq
  apt-get install -y -qq $PACKAGES_NEEDED
  # Re-check UFW after install
  dpkg -l ufw 2>/dev/null | grep -q "^ii" && UFW_AVAILABLE=true
  log_ok "Dipendenze installate"
else
  log_ok "Tutte le dipendenze presenti"
fi

# ============================================================================
# STOP SERVICES BEFORE CONFIGURATION
# ============================================================================

systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# ============================================================================
# CONFIGURE STATIC IP ON ${WIFI_IFACE}
# ============================================================================

log_info "Configurazione IP statico su ${WIFI_IFACE}..."

if [ "$USE_NM" = true ]; then
  # NetworkManager (Bookworm / Armbian / Ubuntu)
  nmcli connection delete "HACCP-Hotspot" 2>/dev/null || true

  # Disable NM management on the wifi iface so hostapd can drive it
  cat > /etc/NetworkManager/conf.d/haccp-hotspot.conf <<NMCONF
[keyfile]
unmanaged-devices=interface-name:${WIFI_IFACE}
NMCONF

  systemctl restart NetworkManager
  sleep 2

  # Manual static IP via iproute2
  ip addr flush dev "${WIFI_IFACE}" 2>/dev/null || true
  ip addr add 192.168.4.1/24 dev "${WIFI_IFACE}" 2>/dev/null || true
  ip link set "${WIFI_IFACE}" up
  log_ok "${WIFI_IFACE} → 192.168.4.1/24 (NetworkManager: ${WIFI_IFACE} unmanaged)"

  # Netplan (Ubuntu/Armbian): scrivi config se presente
  if [ -d /etc/netplan ]; then
    cat > /etc/netplan/99-haccp-hotspot.yaml <<NETPLAN
network:
  version: 2
  renderer: NetworkManager
  wifis:
    ${WIFI_IFACE}:
      dhcp4: false
      addresses: [192.168.4.1/24]
      optional: true
NETPLAN
    chmod 600 /etc/netplan/99-haccp-hotspot.yaml
    netplan apply 2>/dev/null || true
  fi
else
  # Legacy dhcpcd
  if [ -f /etc/dhcpcd.conf ]; then
    sed -i '/^# HACCP-HOTSPOT-START/,/^# HACCP-HOTSPOT-END/d' /etc/dhcpcd.conf
  fi

  cat >> /etc/dhcpcd.conf <<DHCP
# HACCP-HOTSPOT-START
interface ${WIFI_IFACE}
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
# HACCP-HOTSPOT-END
DHCP

  systemctl restart dhcpcd 2>/dev/null || true
  ip addr add 192.168.4.1/24 dev "${WIFI_IFACE}" 2>/dev/null || true
  ip link set "${WIFI_IFACE}" up 2>/dev/null || true
  log_ok "${WIFI_IFACE} → 192.168.4.1/24 (dhcpcd)"
fi

# ============================================================================
# CONFIGURE DNSMASQ
# ============================================================================

log_info "Configurazione dnsmasq..."

# Disabilita stub DNS di systemd-resolved sulla porta 53 se presente,
# altrimenti dnsmasq fallisce ad aprire :53 (conflitto bind).
if systemctl is-active --quiet systemd-resolved 2>/dev/null; then
  mkdir -p /etc/systemd/resolved.conf.d
  cat > /etc/systemd/resolved.conf.d/haccp-hotspot.conf <<'RESOLVED'
[Resolve]
DNSStubListener=no
RESOLVED
  systemctl restart systemd-resolved 2>/dev/null || true
fi

cat > /etc/dnsmasq.d/haccp-hotspot.conf <<DNSMASQ
# HACCP Tracker hotspot DNS/DHCP
interface=${WIFI_IFACE}
bind-interfaces
except-interface=lo
dhcp-range=192.168.4.50,192.168.4.150,255.255.255.0,24h
# Resolve haccp.local to gateway
address=/haccp.local/192.168.4.1
# No upstream DNS — isolated network
no-resolv
no-poll
DNSMASQ

log_ok "dnsmasq configurato su ${WIFI_IFACE} (192.168.4.50-150, haccp.local)"

# ============================================================================
# CONFIGURE HOSTAPD
# ============================================================================

log_info "Configurazione hostapd..."

if [ "$MODE" = "setup" ] || [ -z "$PASSWORD" ]; then
  # Open network (no WPA)
  cat > /etc/hostapd/hostapd.conf <<HOSTAPD
interface=${WIFI_IFACE}
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
# Open network — no WPA
HOSTAPD
  log_ok "hostapd configurato (APERTO)"
else
  # WPA2 protected
  cat > /etc/hostapd/hostapd.conf <<HOSTAPD
interface=${WIFI_IFACE}
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${PASSWORD}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
HOSTAPD
  log_ok "hostapd configurato (WPA2)"
fi

# Point hostapd to config (works on both Bookworm and older)
if [ -f /etc/default/hostapd ]; then
  sed -i 's|^#\?DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd
fi

# ============================================================================
# CONFIGURE FIREWALL (optional — UFW)
# ============================================================================

if [ "$UFW_AVAILABLE" = true ]; then
  log_info "Configurazione firewall..."

  ufw --force reset >/dev/null 2>&1 || true
  ufw default deny incoming >/dev/null 2>&1
  ufw default allow outgoing >/dev/null 2>&1

  # Allow HTTP from hotspot subnet
  ufw allow from 192.168.4.0/24 to any port 80 proto tcp >/dev/null 2>&1
  # Allow CUPS from hotspot subnet
  ufw allow from 192.168.4.0/24 to any port 631 proto tcp >/dev/null 2>&1
  # Allow DHCP/DNS on hotspot
  ufw allow from 192.168.4.0/24 to any port 53 proto udp >/dev/null 2>&1
  ufw allow from 192.168.4.0/24 to any port 67 proto udp >/dev/null 2>&1
  # Allow SSH from anywhere (management)
  ufw allow 22/tcp >/dev/null 2>&1

  ufw --force enable >/dev/null 2>&1
  log_ok "Firewall configurato (HTTP + CUPS da 192.168.4.0/24)"
else
  log_warn "UFW non disponibile — firewall non configurato"
fi

# ============================================================================
# ENABLE AND START SERVICES
# ============================================================================

log_info "Avvio servizi..."

systemctl unmask hostapd 2>/dev/null || true
systemctl enable hostapd dnsmasq

if [ "$USE_NM" = false ]; then
  systemctl restart dhcpcd 2>/dev/null || true
fi
sleep 2
systemctl start dnsmasq
systemctl start hostapd

log_ok "Servizi hotspot avviati"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$MODE" = "setup" ]; then
  echo -e "${GREEN}  HOTSPOT SETUP ATTIVO${NC}"
  echo ""
  echo "  SSID:     ${SSID} (APERTO)"
  echo "  Gateway:  192.168.4.1"
  echo "  Web App:  http://haccp.local  oppure  http://192.168.4.1"
  echo ""
  echo "  Connettiti al Wi-Fi e apri il browser per configurare."
else
  echo -e "${GREEN}  HOTSPOT WI-FI ATTIVO${NC}"
  echo ""
  echo "  SSID:     ${SSID}"
  echo "  Password: ${PASSWORD}"
  echo "  Gateway:  192.168.4.1"
  echo "  Web App:  http://haccp.local  oppure  http://192.168.4.1"
fi
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
