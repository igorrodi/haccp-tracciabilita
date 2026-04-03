#!/bin/bash
#
# setup-hotspot.sh — Gestione hotspot Wi-Fi per HACCP Tracker
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

for arg in "$@"; do
  case "$arg" in
    --mode=*)    MODE="${arg#*=}" ;;
    --ssid=*)    SSID="${arg#*=}" ;;
    --password=*) PASSWORD="${arg#*=}" ;;
  esac
done

# ============================================================================
# GENERATE SETUP SSID (if mode=setup)
# ============================================================================

if [ "$MODE" = "setup" ]; then
  # Generate SSID from wlan0 MAC last 6 hex chars
  MAC_SUFFIX=""
  if [ -f /sys/class/net/wlan0/address ]; then
    MAC_SUFFIX=$(cat /sys/class/net/wlan0/address | tr -d ':' | tail -c 7 | head -c 6 | tr '[:lower:]' '[:upper:]')
  fi
  if [ -z "$MAC_SUFFIX" ]; then
    MAC_SUFFIX=$(head -c 3 /dev/urandom | xxd -p | head -c 6 | tr '[:lower:]' '[:upper:]')
  fi
  SSID="HACCP-Setup-${MAC_SUFFIX}"
  PASSWORD=""
  log_info "Modalità SETUP — SSID aperto: ${SSID}"
else
  # Normal mode: use provided or defaults
  [ -z "$SSID" ] && SSID="HACCP-Tracciabilita"
  [ -z "$PASSWORD" ] && PASSWORD="cambia123"
  log_info "Modalità NORMALE — SSID: ${SSID}"
fi

# ============================================================================
# INSTALL DEPENDENCIES
# ============================================================================

log_info "Verifica dipendenze..."

PACKAGES_NEEDED=""
for pkg in hostapd dnsmasq ufw; do
  if ! dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
    PACKAGES_NEEDED="$PACKAGES_NEEDED $pkg"
  fi
done

if [ -n "$PACKAGES_NEEDED" ]; then
  log_info "Installazione:${PACKAGES_NEEDED}"
  apt-get update -qq
  apt-get install -y -qq $PACKAGES_NEEDED
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
# CONFIGURE STATIC IP ON wlan0
# ============================================================================

log_info "Configurazione IP statico su wlan0..."

# Remove any existing wlan0 static config
if [ -f /etc/dhcpcd.conf ]; then
  sed -i '/^# HACCP-HOTSPOT-START/,/^# HACCP-HOTSPOT-END/d' /etc/dhcpcd.conf
fi

cat >> /etc/dhcpcd.conf <<'DHCP'
# HACCP-HOTSPOT-START
interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
# HACCP-HOTSPOT-END
DHCP

log_ok "wlan0 → 192.168.4.1/24"

# ============================================================================
# CONFIGURE DNSMASQ
# ============================================================================

log_info "Configurazione dnsmasq..."

cat > /etc/dnsmasq.d/haccp-hotspot.conf <<DNSMASQ
# HACCP Tracker hotspot DNS/DHCP
interface=wlan0
bind-interfaces
dhcp-range=192.168.4.50,192.168.4.150,255.255.255.0,24h
# Resolve haccp.local to gateway
address=/haccp.local/192.168.4.1
# No upstream DNS — isolated network
no-resolv
no-poll
DNSMASQ

log_ok "dnsmasq configurato (192.168.4.50-150, haccp.local)"

# ============================================================================
# CONFIGURE HOSTAPD
# ============================================================================

log_info "Configurazione hostapd..."

if [ "$MODE" = "setup" ] || [ -z "$PASSWORD" ]; then
  # Open network (no WPA)
  cat > /etc/hostapd/hostapd.conf <<HOSTAPD
interface=wlan0
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
interface=wlan0
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

# Point hostapd to config
sed -i 's|^#DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd 2>/dev/null || true

# ============================================================================
# CONFIGURE UFW FIREWALL
# ============================================================================

log_info "Configurazione firewall..."

ufw --force reset >/dev/null 2>&1 || true
ufw default deny incoming >/dev/null 2>&1
ufw default allow outgoing >/dev/null 2>&1

# Allow HTTP from hotspot subnet only
ufw allow from 192.168.4.0/24 to any port 80 proto tcp >/dev/null 2>&1
# Allow DHCP/DNS on hotspot
ufw allow from 192.168.4.0/24 to any port 53 proto udp >/dev/null 2>&1
ufw allow from 192.168.4.0/24 to any port 67 proto udp >/dev/null 2>&1
# Allow SSH from anywhere (management)
ufw allow 22/tcp >/dev/null 2>&1

ufw --force enable >/dev/null 2>&1
log_ok "Firewall configurato (HTTP solo da 192.168.4.0/24)"

# ============================================================================
# ENABLE AND START SERVICES
# ============================================================================

log_info "Avvio servizi..."

systemctl unmask hostapd 2>/dev/null || true
systemctl enable hostapd dnsmasq
systemctl restart dhcpcd 2>/dev/null || true
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
