#!/bin/bash
#
# Tracker HACCP - Production Installer for Raspberry Pi
# Single command: curl -sSL https://raw.githubusercontent.com/USER/REPO/main/scripts/install.sh | sudo bash
#
# Architecture: React + PocketBase + Caddy (HTTPS)
# Target: Raspberry Pi OS 64-bit (ARM64)
#

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

APP_NAME="haccp"
APP_DOMAIN="haccp.local"
APP_DIR="/opt/haccp"
APP_USER="haccp"
APP_GROUP="haccp"

POCKETBASE_VERSION="0.25.9"
POCKETBASE_PORT="8090"

# GitHub raw URL for assets (update with your repo)
GITHUB_RAW_URL="https://raw.githubusercontent.com/USER/REPO/main"
GITHUB_RELEASES_URL="https://github.com/USER/REPO/releases/latest/download"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# FUNCTIONS
# ============================================================================

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_architecture() {
    ARCH=$(uname -m)
    if [[ "$ARCH" != "aarch64" ]]; then
        log_error "This script requires ARM64 architecture (found: $ARCH)"
        exit 1
    fi
    log_ok "Architecture: ARM64"
}

check_os() {
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot detect OS"
        exit 1
    fi
    source /etc/os-release
    if [[ "$ID" != "debian" && "$ID" != "raspbian" ]]; then
        log_warn "Untested OS: $ID (continuing anyway)"
    fi
    log_ok "OS: $PRETTY_NAME"
}

# ============================================================================
# INSTALLATION
# ============================================================================

install_packages() {
    log_info "Updating system packages..."
    apt-get update -qq
    
    log_info "Installing required packages..."
    apt-get install -y -qq \
        curl \
        wget \
        unzip \
        avahi-daemon \
        libnss-mdns \
        debian-keyring \
        debian-archive-keyring \
        apt-transport-https \
        ca-certificates
    
    log_ok "System packages installed"
}

install_caddy() {
    log_info "Installing Caddy..."
    
    # Add Caddy GPG key
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
    
    # Add Caddy repository
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    
    apt-get update -qq
    apt-get install -y -qq caddy
    
    # Stop Caddy until configured
    systemctl stop caddy 2>/dev/null || true
    
    log_ok "Caddy installed"
}

create_user() {
    log_info "Creating application user..."
    
    if ! getent group "$APP_GROUP" > /dev/null 2>&1; then
        groupadd --system "$APP_GROUP"
    fi
    
    if ! getent passwd "$APP_USER" > /dev/null 2>&1; then
        useradd --system --gid "$APP_GROUP" --shell /usr/sbin/nologin \
            --home-dir "$APP_DIR" --no-create-home "$APP_USER"
    fi
    
    log_ok "User $APP_USER created"
}

create_directories() {
    log_info "Creating directory structure..."
    
    mkdir -p "$APP_DIR"/{bin,data,web,backups,logs,ssl}
    
    log_ok "Directories created at $APP_DIR"
}

install_pocketbase() {
    log_info "Downloading PocketBase v${POCKETBASE_VERSION}..."
    
    local pb_url="https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_arm64.zip"
    local tmp_zip="/tmp/pocketbase.zip"
    
    curl -sL "$pb_url" -o "$tmp_zip"
    unzip -o -q "$tmp_zip" -d "$APP_DIR/bin/"
    rm -f "$tmp_zip"
    chmod +x "$APP_DIR/bin/pocketbase"
    
    log_ok "PocketBase installed"
}

download_frontend() {
    log_info "Downloading frontend assets..."
    
    # Option 1: Download from GitHub releases (pre-built)
    if curl -sL "${GITHUB_RELEASES_URL}/frontend.zip" -o /tmp/frontend.zip 2>/dev/null; then
        unzip -o -q /tmp/frontend.zip -d "$APP_DIR/web/"
        rm -f /tmp/frontend.zip
        log_ok "Frontend downloaded from releases"
    else
        # Option 2: Create placeholder
        log_warn "Frontend not found in releases, creating placeholder..."
        cat > "$APP_DIR/web/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tracker HACCP</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
        .container { text-align: center; padding: 2rem; }
        h1 { color: #22c55e; margin-bottom: 1rem; }
        p { color: #94a3b8; }
        code { background: #1e293b; padding: 0.5rem 1rem; border-radius: 0.5rem; display: inline-block; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✓ Tracker HACCP Installato</h1>
        <p>Il backend PocketBase è attivo.</p>
        <p>Carica i file frontend in:</p>
        <code>/opt/haccp/web/</code>
    </div>
</body>
</html>
HTMLEOF
    fi
}

configure_pocketbase_service() {
    log_info "Configuring PocketBase service..."
    
    cat > /etc/systemd/system/pocketbase.service << EOF
[Unit]
Description=PocketBase Backend
Documentation=https://pocketbase.io/docs/
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}

ExecStart=${APP_DIR}/bin/pocketbase serve \\
    --http=127.0.0.1:${POCKETBASE_PORT} \\
    --dir=${APP_DIR}/data \\
    --publicDir=${APP_DIR}/web

Restart=always
RestartSec=5
StartLimitInterval=60
StartLimitBurst=3

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/data ${APP_DIR}/logs

# Resource limits
MemoryMax=256M
CPUQuota=80%

# Logging
StandardOutput=append:${APP_DIR}/logs/pocketbase.log
StandardError=append:${APP_DIR}/logs/pocketbase-error.log

[Install]
WantedBy=multi-user.target
EOF
    
    log_ok "PocketBase service configured"
}

configure_caddy() {
    log_info "Configuring Caddy..."
    
    cat > /etc/caddy/Caddyfile << EOF
# ============================================================================
# Tracker HACCP - Caddy Configuration
# Local HTTPS with automatic self-signed certificates
# ============================================================================

{
    # Global options
    admin off
    auto_https disable_redirects
    
    # Local CA for self-signed certs
    local_certs
    
    # Logging
    log {
        output file ${APP_DIR}/logs/caddy-access.log
        format json
    }
}

# Main site - HTTPS
https://${APP_DOMAIN} {
    # TLS with local self-signed certificate
    tls internal
    
    # Security headers
    header {
        # HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # XSS protection
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
        # Remove server header
        -Server
    }
    
    # API proxy to PocketBase
    handle /api/* {
        reverse_proxy 127.0.0.1:${POCKETBASE_PORT} {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    
    # PocketBase admin UI
    handle /_/* {
        reverse_proxy 127.0.0.1:${POCKETBASE_PORT} {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    
    # Static frontend files
    handle {
        root * ${APP_DIR}/web
        
        # Enable compression
        encode gzip zstd
        
        # SPA fallback - serve index.html for all routes
        try_files {path} /index.html
        
        file_server {
            # Cache static assets
            precompressed gzip br
        }
    }
    
    # Cache control for static assets
    @static path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.svg *.woff *.woff2
    header @static Cache-Control "public, max-age=31536000, immutable"
    
    # No cache for HTML
    @html path *.html /
    header @html Cache-Control "no-cache, no-store, must-revalidate"
}

# HTTP redirect to HTTPS
http://${APP_DOMAIN} {
    redir https://{host}{uri} permanent
}
EOF
    
    # Validate Caddy config
    if caddy validate --config /etc/caddy/Caddyfile 2>/dev/null; then
        log_ok "Caddy configuration valid"
    else
        log_error "Caddy configuration invalid"
        exit 1
    fi
}

configure_local_domain() {
    log_info "Configuring local domain..."
    
    # Add to /etc/hosts if not present
    if ! grep -q "${APP_DOMAIN}" /etc/hosts; then
        echo "127.0.0.1 ${APP_DOMAIN}" >> /etc/hosts
    fi
    
    # Configure hostname
    hostnamectl set-hostname "${APP_NAME}" 2>/dev/null || true
    
    # Configure Avahi for mDNS (.local discovery)
    cat > /etc/avahi/services/haccp.service << EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Tracker HACCP</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF
    
    systemctl enable avahi-daemon
    systemctl restart avahi-daemon
    
    log_ok "Local domain ${APP_DOMAIN} configured"
}

set_permissions() {
    log_info "Setting permissions..."
    
    chown -R "${APP_USER}:${APP_GROUP}" "$APP_DIR"
    chmod -R 750 "$APP_DIR"
    chmod -R 770 "$APP_DIR/data"
    chmod -R 770 "$APP_DIR/logs"
    chmod -R 770 "$APP_DIR/backups"
    chmod 755 "$APP_DIR/bin/pocketbase"
    
    # Caddy needs read access to web files
    chmod -R o+rX "$APP_DIR/web"
    
    log_ok "Permissions set"
}

enable_services() {
    log_info "Enabling services..."
    
    systemctl daemon-reload
    
    # Enable and start PocketBase
    systemctl enable pocketbase
    systemctl start pocketbase
    
    # Wait for PocketBase to start
    sleep 2
    
    # Enable and start Caddy
    systemctl enable caddy
    systemctl start caddy
    
    log_ok "Services enabled and started"
}

create_utility_scripts() {
    log_info "Creating utility scripts..."
    
    # Status script
    cat > /usr/local/bin/haccp-status << 'EOF'
#!/bin/bash
echo "═══════════════════════════════════════════════════════════════"
echo "                    TRACKER HACCP STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Services:"
printf "  PocketBase: "; systemctl is-active pocketbase
printf "  Caddy:      "; systemctl is-active caddy
printf "  Avahi:      "; systemctl is-active avahi-daemon
echo ""
echo "Resources:"
echo "  Disk: $(df -h /opt/haccp | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo "  Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo ""
echo "Access: https://haccp.local"
echo "Admin:  https://haccp.local/_/"
echo "═══════════════════════════════════════════════════════════════"
EOF

    # Backup script
    cat > /usr/local/bin/haccp-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/haccp/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/haccp_${TIMESTAMP}.tar.gz"

echo "Creating backup..."
systemctl stop pocketbase
tar -czf "$BACKUP_FILE" -C /opt/haccp data/
systemctl start pocketbase

# Keep last 7 backups
ls -t ${BACKUP_DIR}/haccp_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo "Backup created: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
EOF

    # Logs script
    cat > /usr/local/bin/haccp-logs << 'EOF'
#!/bin/bash
case "${1:-all}" in
    pocketbase|pb) tail -f /opt/haccp/logs/pocketbase.log ;;
    caddy|web)     tail -f /opt/haccp/logs/caddy-access.log ;;
    errors|err)    tail -f /opt/haccp/logs/pocketbase-error.log ;;
    *)             journalctl -u pocketbase -u caddy -f ;;
esac
EOF

    # Update script
    cat > /usr/local/bin/haccp-update << 'EOF'
#!/bin/bash
echo "Updating frontend..."
TEMP_DIR=$(mktemp -d)
RELEASES_URL="https://github.com/USER/REPO/releases/latest/download"

if curl -sL "${RELEASES_URL}/frontend.zip" -o "${TEMP_DIR}/frontend.zip"; then
    rm -rf /opt/haccp/web/*
    unzip -q "${TEMP_DIR}/frontend.zip" -d /opt/haccp/web/
    chown -R haccp:haccp /opt/haccp/web
    rm -rf "$TEMP_DIR"
    systemctl reload caddy
    echo "Update complete!"
else
    echo "Error: Could not download update"
    rm -rf "$TEMP_DIR"
    exit 1
fi
EOF

    chmod +x /usr/local/bin/haccp-*
    
    log_ok "Utility scripts created"
}

verify_installation() {
    log_info "Verifying installation..."
    
    local errors=0
    
    # Check PocketBase
    if systemctl is-active --quiet pocketbase; then
        log_ok "PocketBase is running"
    else
        log_error "PocketBase is not running"
        ((errors++))
    fi
    
    # Check Caddy
    if systemctl is-active --quiet caddy; then
        log_ok "Caddy is running"
    else
        log_error "Caddy is not running"
        ((errors++))
    fi
    
    # Check HTTPS
    sleep 2
    if curl -ksI "https://127.0.0.1" 2>/dev/null | grep -q "200\|301\|302"; then
        log_ok "HTTPS is working"
    else
        log_warn "HTTPS may need a moment to initialize"
    fi
    
    return $errors
}

print_summary() {
    local IP_ADDR
    IP_ADDR=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║          ✓ TRACKER HACCP INSTALLATO CON SUCCESSO!               ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Accesso:${NC}"
    echo "  🌐 App:    https://${APP_DOMAIN}"
    echo "  🔧 Admin:  https://${APP_DOMAIN}/_/"
    echo "  📍 IP:     https://${IP_ADDR}"
    echo ""
    echo -e "${BLUE}Comandi utili:${NC}"
    echo "  haccp-status  → Stato dei servizi"
    echo "  haccp-backup  → Crea backup"
    echo "  haccp-logs    → Visualizza log"
    echo "  haccp-update  → Aggiorna frontend"
    echo ""
    echo -e "${BLUE}Cartelle:${NC}"
    echo "  ${APP_DIR}/web     → Frontend"
    echo "  ${APP_DIR}/data    → Database PocketBase"
    echo "  ${APP_DIR}/backups → Backup"
    echo ""
    echo -e "${YELLOW}Nota: Accetta il certificato self-signed nel browser.${NC}"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║            TRACKER HACCP - INSTALLER                             ║${NC}"
    echo -e "${BLUE}║            React + PocketBase + Caddy                            ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    check_architecture
    check_os
    
    install_packages
    install_caddy
    create_user
    create_directories
    install_pocketbase
    download_frontend
    configure_pocketbase_service
    configure_caddy
    configure_local_domain
    set_permissions
    create_utility_scripts
    enable_services
    verify_installation
    print_summary
}

main "$@"
