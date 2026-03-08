#!/bin/bash
#
# Tracker HACCP - Minimal Installer
# Usage: curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash
#
# PocketBase serves everything: API + frontend (via pb_public)
#

set -euo pipefail

# ============================================================================
# CONFIG
# ============================================================================

readonly APP_DIR="/opt/haccp"
readonly PB_VERSION="0.25.9"
readonly PB_DIR="${APP_DIR}/pocketbase"
readonly PB_BIN="${PB_DIR}/pocketbase"
readonly PB_PUBLIC="${PB_DIR}/pb_public"

readonly GITHUB_REPO="USER/haccp-tracciabilita"
readonly GITHUB_RELEASES="https://github.com/${GITHUB_REPO}/releases/latest/download"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ============================================================================
# CHECKS
# ============================================================================

[[ $EUID -eq 0 ]] || log_error "Esegui come root: sudo bash install.sh"
[[ "$(uname -m)" == "aarch64" ]] || log_error "Richiede ARM64 (trovato: $(uname -m))"

# ============================================================================
# INSTALL
# ============================================================================

# Packages
apt-get update -qq && apt-get install -y -qq curl unzip
log_ok "Pacchetti installati"

# Directories
mkdir -p "${PB_DIR}/pb_data" "${PB_DIR}/pb_migrations" "${PB_PUBLIC}"
log_ok "Cartelle create"

# PocketBase binary
echo "Scaricamento PocketBase v${PB_VERSION}..."
curl -sL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_arm64.zip" -o /tmp/pb.zip
unzip -o -q /tmp/pb.zip -d "${PB_DIR}/"
rm -f /tmp/pb.zip
chmod +x "${PB_BIN}"
log_ok "PocketBase v${PB_VERSION} installato"

# Frontend
echo "Scaricamento frontend..."
if curl -sL "${GITHUB_RELEASES}/frontend.zip" -o /tmp/frontend.zip 2>/dev/null; then
    rm -rf "${PB_PUBLIC:?}"/*
    unzip -o -q /tmp/frontend.zip -d "${PB_PUBLIC}/"
    rm -f /tmp/frontend.zip
    log_ok "Frontend installato in pb_public"
else
    echo "<h1>Tracker HACCP - In attesa del frontend</h1>" > "${PB_PUBLIC}/index.html"
    log_ok "Frontend placeholder creato"
fi

# Schema
if curl -sL "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" -o "${PB_DIR}/pb_schema.json" 2>/dev/null; then
    log_ok "Schema scaricato"
fi

# ============================================================================
# SYSTEMD SERVICE
# ============================================================================

cat > /etc/systemd/system/pocketbase.service << EOF
[Unit]
Description=PocketBase - Tracker HACCP
After=network.target

[Service]
Type=simple
ExecStart=${PB_BIN} serve --http=0.0.0.0:80 --dir=${PB_DIR}/pb_data --migrationsDir=${PB_DIR}/pb_migrations --publicDir=${PB_PUBLIC}
WorkingDirectory=${PB_DIR}
Restart=always
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pocketbase
systemctl restart pocketbase
log_ok "Servizio PocketBase attivo sulla porta 80"

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
echo ""
