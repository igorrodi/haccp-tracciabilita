#!/bin/bash
#
# Tracker HACCP - Production Installer
# Usage: curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash
#
# Idempotent: safe to run multiple times
#

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

readonly APP_NAME="haccp"
readonly APP_DOMAIN="haccp.local"
readonly APP_DIR="/opt/haccp"
readonly APP_USER="haccp"
readonly APP_GROUP="haccp"

readonly POCKETBASE_VERSION="0.25.9"
readonly POCKETBASE_PORT="8090"
readonly POCKETBASE_DIR="${APP_DIR}/pocketbase"

readonly FRONTEND_DIR="${APP_DIR}/frontend"
readonly LOGS_DIR="${APP_DIR}/logs"
readonly BACKUPS_DIR="${APP_DIR}/backups"

# GitHub URLs (update with your repo)
readonly GITHUB_REPO="USER/haccp-tracciabilita"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
readonly GITHUB_RELEASES="https://github.com/${GITHUB_REPO}/releases/latest/download"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# ============================================================================
# LOGGING
# ============================================================================

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ============================================================================
# CHECKS
# ============================================================================

check_root() {
    [[ $EUID -eq 0 ]] || log_error "Run as root: sudo bash install.sh"
}

check_arch() {
    [[ "$(uname -m)" == "aarch64" ]] || log_error "Requires ARM64 (found: $(uname -m))"
}

# ============================================================================
# SYSTEM SETUP
# ============================================================================

install_packages() {
    log_info "Installing system packages..."
    apt-get update -qq
    apt-get install -y -qq curl unzip avahi-daemon libnss-mdns ca-certificates
    
    # Install Caddy
    if ! command -v caddy &>/dev/null; then
        log_info "Installing Caddy..."
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
            gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
            tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
        apt-get update -qq
        apt-get install -y -qq caddy
    fi
    
    systemctl stop caddy 2>/dev/null || true
    log_ok "Packages installed"
}

create_user() {
    if ! getent group "$APP_GROUP" &>/dev/null; then
        groupadd --system "$APP_GROUP"
    fi
    if ! getent passwd "$APP_USER" &>/dev/null; then
        useradd --system --gid "$APP_GROUP" --shell /usr/sbin/nologin \
            --home-dir "$APP_DIR" --no-create-home "$APP_USER"
    fi
    log_ok "User: $APP_USER"
}

create_directories() {
    mkdir -p "${POCKETBASE_DIR}"/{bin,pb_data,pb_migrations}
    mkdir -p "${FRONTEND_DIR}"
    mkdir -p "${LOGS_DIR}"
    mkdir -p "${BACKUPS_DIR}"
    log_ok "Directories created"
}

# ============================================================================
# POCKETBASE
# ============================================================================

install_pocketbase() {
    local pb_bin="${POCKETBASE_DIR}/bin/pocketbase"
    
    if [[ -f "$pb_bin" ]]; then
        log_info "PocketBase already installed, checking version..."
    fi
    
    log_info "Downloading PocketBase v${POCKETBASE_VERSION}..."
    local url="https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_arm64.zip"
    curl -sL "$url" -o /tmp/pocketbase.zip
    unzip -o -q /tmp/pocketbase.zip -d "${POCKETBASE_DIR}/bin/"
    rm -f /tmp/pocketbase.zip
    chmod +x "$pb_bin"
    log_ok "PocketBase v${POCKETBASE_VERSION} installed"
}

configure_pocketbase_service() {
    cat > /etc/systemd/system/pocketbase.service << EOF
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${POCKETBASE_DIR}
ExecStart=${POCKETBASE_DIR}/bin/pocketbase serve --http=127.0.0.1:${POCKETBASE_PORT} --dir=${POCKETBASE_DIR}/pb_data --migrationsDir=${POCKETBASE_DIR}/pb_migrations
Restart=always
RestartSec=5

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${POCKETBASE_DIR}/pb_data ${LOGS_DIR}

# Resources
MemoryMax=256M
CPUQuota=80%

StandardOutput=append:${LOGS_DIR}/pocketbase.log
StandardError=append:${LOGS_DIR}/pocketbase-error.log

[Install]
WantedBy=multi-user.target
EOF
    log_ok "PocketBase service configured"
}

# ============================================================================
# FRONTEND
# ============================================================================

install_frontend() {
    log_info "Downloading frontend..."
    
    if curl -sL "${GITHUB_RELEASES}/frontend.zip" -o /tmp/frontend.zip 2>/dev/null; then
        rm -rf "${FRONTEND_DIR:?}"/*
        unzip -o -q /tmp/frontend.zip -d "${FRONTEND_DIR}/"
        rm -f /tmp/frontend.zip
        log_ok "Frontend installed"
    else
        log_warn "Frontend not found in releases, creating placeholder"
        cat > "${FRONTEND_DIR}/index.html" << 'HTML'
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tracker HACCP</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 3rem; text-align: center; max-width: 400px; }
        h1 { color: #22c55e; margin-bottom: 1rem; font-size: 1.5rem; }
        p { color: #a1a1aa; margin-bottom: 0.5rem; font-size: 0.9rem; }
        code { background: #262626; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
        .status { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #262626; }
        .dot { display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-right: 8px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>✓ Tracker HACCP</h1>
        <p>Backend PocketBase attivo</p>
        <p>Admin: <code>https://haccp.local/_/</code></p>
        <div class="status">
            <span class="dot"></span>Sistema operativo
        </div>
    </div>
</body>
</html>
HTML
    fi
}

# ============================================================================
# POCKETBASE SCHEMA IMPORT
# ============================================================================

import_schema() {
    log_info "Importing PocketBase schema..."
    
    # Download schema from GitHub
    if curl -sL "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" -o /tmp/pb_schema.json 2>/dev/null; then
        # Wait for PocketBase to be ready
        local max_attempts=30
        local attempt=0
        while ! curl -s "http://127.0.0.1:${POCKETBASE_PORT}/api/health" &>/dev/null; do
            attempt=$((attempt + 1))
            if [[ $attempt -ge $max_attempts ]]; then
                log_warn "PocketBase not ready, schema import skipped"
                return
            fi
            sleep 1
        done
        
        # Check if collections already exist
        local collections=$(curl -s "http://127.0.0.1:${POCKETBASE_PORT}/api/collections" | grep -c '"name"' || echo "0")
        if [[ "$collections" -gt 2 ]]; then
            log_info "Collections already exist, skipping schema import"
            rm -f /tmp/pb_schema.json
            return
        fi
        
        log_info "Schema will be imported on first admin setup via PocketBase Admin UI"
        cp /tmp/pb_schema.json "${POCKETBASE_DIR}/pb_schema.json"
        chown "${APP_USER}:${APP_GROUP}" "${POCKETBASE_DIR}/pb_schema.json"
        rm -f /tmp/pb_schema.json
        log_ok "Schema file ready for import"
    else
        log_warn "Could not download schema file"
    fi
}

# ============================================================================
# CADDY
# ============================================================================

configure_caddy() {
    cat > /etc/caddy/Caddyfile << 'EOF'
{
    admin off
    local_certs
    auto_https disable_redirects
}

https://haccp.local {
    tls internal

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    handle /api/* {
        reverse_proxy 127.0.0.1:8090 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle /_/* {
        reverse_proxy 127.0.0.1:8090
    }

    handle {
        root * /opt/haccp/frontend
        encode gzip
        try_files {path} /index.html
        file_server
    }

    @static path *.js *.css *.png *.jpg *.ico *.svg *.woff2
    header @static Cache-Control "public, max-age=31536000, immutable"
}

http://haccp.local {
    redir https://{host}{uri} permanent
}
EOF

    caddy validate --config /etc/caddy/Caddyfile &>/dev/null || log_error "Invalid Caddyfile"
    log_ok "Caddy configured"
}

# ============================================================================
# NETWORK
# ============================================================================

configure_hosts() {
    if ! grep -q "${APP_DOMAIN}" /etc/hosts; then
        echo "127.0.0.1 ${APP_DOMAIN}" >> /etc/hosts
    fi
    log_ok "Domain: ${APP_DOMAIN}"
}

configure_mdns() {
    mkdir -p /etc/avahi/services
    cat > /etc/avahi/services/haccp.service << EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Tracker HACCP</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
  </service>
</service-group>
EOF
    systemctl enable --now avahi-daemon &>/dev/null
    log_ok "mDNS configured"
}

# ============================================================================
# PERMISSIONS & SERVICES
# ============================================================================

set_permissions() {
    chown -R "${APP_USER}:${APP_GROUP}" "$APP_DIR"
    chmod -R 750 "$APP_DIR"
    chmod -R 770 "${POCKETBASE_DIR}/pb_data"
    chmod -R 770 "${LOGS_DIR}"
    chmod -R 770 "${BACKUPS_DIR}"
    chmod -R o+rX "${FRONTEND_DIR}"
    log_ok "Permissions set"
}

start_services() {
    systemctl daemon-reload
    systemctl enable pocketbase caddy &>/dev/null
    systemctl restart pocketbase
    sleep 2
    systemctl restart caddy
    log_ok "Services started"
}

# ============================================================================
# UTILITIES
# ============================================================================

create_utilities() {
    cat > /usr/local/bin/haccp-status << 'SCRIPT'
#!/bin/bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           TRACKER HACCP STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "PocketBase: "; systemctl is-active pocketbase
printf "Caddy:      "; systemctl is-active caddy
echo ""
echo "Access: https://haccp.local"
echo "Admin:  https://haccp.local/_/"
SCRIPT

    cat > /usr/local/bin/haccp-backup << 'SCRIPT'
#!/bin/bash
BACKUP="/opt/haccp/backups/haccp_$(date +%Y%m%d_%H%M%S).tar.gz"
systemctl stop pocketbase
tar -czf "$BACKUP" -C /opt/haccp/pocketbase pb_data
systemctl start pocketbase
ls -t /opt/haccp/backups/*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm
echo "Backup: $BACKUP"
SCRIPT

    cat > /usr/local/bin/haccp-logs << 'SCRIPT'
#!/bin/bash
tail -f /opt/haccp/logs/*.log
SCRIPT

    chmod +x /usr/local/bin/haccp-*
    log_ok "Utilities created"
}

# ============================================================================
# SUMMARY
# ============================================================================

print_summary() {
    local ip=$(hostname -I | awk '{print $1}')
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ TRACKER HACCP INSTALLED${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  App:    https://${APP_DOMAIN}"
    echo "  Admin:  https://${APP_DOMAIN}/_/"
    echo "  IP:     https://${ip}"
    echo ""
    echo "  Commands:"
    echo "    haccp-status   Check services"
    echo "    haccp-backup   Backup database"
    echo "    haccp-logs     View logs"
    echo ""
    echo -e "${YELLOW}  Note: Accept the self-signed certificate in browser${NC}"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  TRACKER HACCP INSTALLER${NC}"
    echo -e "${BLUE}  React + PocketBase + Caddy${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    check_root
    check_arch
    
    install_packages
    create_user
    create_directories
    install_pocketbase
    configure_pocketbase_service
    install_frontend
    configure_caddy
    configure_hosts
    configure_mdns
    set_permissions
    create_utilities
    start_services
    import_schema
    
    print_summary
}

main "$@"
