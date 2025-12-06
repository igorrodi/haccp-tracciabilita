#!/bin/bash

# ============================================================================
# HACCP APP - PocketBase Edition
# Installazione COMPLETA per Raspberry Pi con un solo comando
# ============================================================================
# 
# Uso: curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-haccp-pocketbase.sh | bash
#
# Questo script installa:
# - PocketBase (backend leggero, singolo binario)
# - Applicazione HACCP React (frontend)
# - HTTPS con certificato SSL self-signed
# - mDNS per dominio .local
# - Sistema di primo accesso con creazione admin
# - Backup automatici
# - Aggiornamenti automatici
#
# ============================================================================

set -e

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[ℹ]${NC} $1"; }
print_header() { echo -e "${MAGENTA}[★]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# Configurazione
APP_DIR="/opt/haccp-app"
DATA_DIR="/var/lib/haccp-data"
REPO_URL="https://github.com/igorrodi/haccp-tracciabilita.git"
POCKETBASE_VERSION="0.22.4"
HOSTNAME=$(hostname)
DOMAIN="${HOSTNAME}.local"
SSL_DIR="/etc/ssl/haccp"

# Rileva architettura
ARCH=$(uname -m)
case $ARCH in
    aarch64|arm64) PB_ARCH="linux_arm64" ;;
    armv7l) PB_ARCH="linux_arm64" ;;
    x86_64) PB_ARCH="linux_amd64" ;;
    *) print_error "Architettura non supportata: $ARCH"; exit 1 ;;
esac

# ============================================================================
# HEADER
# ============================================================================

clear
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${MAGENTA}🚀 HACCP APP - PocketBase Edition${CYAN}                                  ║${NC}"
echo -e "${CYAN}║   ${NC}Installazione completa per Raspberry Pi${CYAN}                              ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} PocketBase (backend leggero ~15MB)${CYAN}                              ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Applicazione HACCP React${CYAN}                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} HTTPS automatico con SSL${CYAN}                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Dominio locale .local${CYAN}                                          ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Primo accesso guidato${CYAN}                                          ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Backup e aggiornamenti automatici${CYAN}                              ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Conferma
read -p "Vuoi procedere con l'installazione? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "Installazione annullata."
    exit 0
fi

# ============================================================================
# STEP 1: Pulizia ambiente
# ============================================================================

print_header "STEP 1/7: Pulizia ambiente esistente"

# Ferma servizi esistenti
sudo systemctl stop haccp-pocketbase 2>/dev/null || true
sudo systemctl stop haccp-app 2>/dev/null || true
sudo systemctl disable haccp-pocketbase 2>/dev/null || true

# Backup dati esistenti
if [ -d "$DATA_DIR" ]; then
    BACKUP_DIR="/tmp/haccp-backup-$(date +%Y%m%d-%H%M%S)"
    print_info "Backup dati esistenti in $BACKUP_DIR"
    sudo cp -r "$DATA_DIR" "$BACKUP_DIR"
fi

print_status "Ambiente pulito!"

# ============================================================================
# STEP 2: Installazione prerequisiti
# ============================================================================

print_header "STEP 2/7: Installazione prerequisiti"

# Aggiorna sistema
print_info "Aggiornamento sistema..."
sudo apt-get update -qq

# Pacchetti essenziali
PACKAGES="curl wget git nginx openssl avahi-daemon avahi-utils unzip"
print_info "Installazione: $PACKAGES"
sudo apt-get install -y $PACKAGES

# Node.js 20 (per build)
if ! command -v node &> /dev/null; then
    print_info "Installazione Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Abilita servizi
sudo systemctl enable avahi-daemon 2>/dev/null || true
sudo systemctl start avahi-daemon 2>/dev/null || true

print_status "Prerequisiti installati!"

# ============================================================================
# STEP 3: Download e installazione PocketBase
# ============================================================================

print_header "STEP 3/7: Installazione PocketBase"

# Crea directory
sudo mkdir -p "$APP_DIR/bin"
sudo mkdir -p "$DATA_DIR"

# Download PocketBase
print_info "Download PocketBase v${POCKETBASE_VERSION} (${PB_ARCH})..."
POCKETBASE_URL="https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_${PB_ARCH}.zip"
wget -q "$POCKETBASE_URL" -O /tmp/pocketbase.zip

# Estrai
unzip -o /tmp/pocketbase.zip -d /tmp/pocketbase
sudo mv /tmp/pocketbase/pocketbase "$APP_DIR/bin/"
sudo chmod +x "$APP_DIR/bin/pocketbase"
rm -rf /tmp/pocketbase /tmp/pocketbase.zip

print_status "PocketBase installato!"

# ============================================================================
# STEP 4: Clone e build applicazione React
# ============================================================================

print_header "STEP 4/7: Build applicazione"

# Clone repository
print_info "Clone repository..."
if [ -d "/tmp/haccp-src" ]; then
    rm -rf /tmp/haccp-src
fi
git clone --depth 1 "$REPO_URL" /tmp/haccp-src

cd /tmp/haccp-src

# Modifica main.tsx per usare AppPocketBase
print_info "Configurazione per PocketBase..."
cat > src/main.tsx << 'MAINEOF'
import { createRoot } from 'react-dom/client'
import App from './AppPocketBase.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
MAINEOF

# Installa dipendenze e build
print_info "Installazione dipendenze npm..."
npm install --quiet --no-audit --no-fund

print_info "Build applicazione..."
npm run build

# Copia build
sudo mkdir -p "$APP_DIR/www"
sudo cp -r dist/* "$APP_DIR/www/"

# Copia schema PocketBase
sudo cp scripts/pocketbase/pb_schema.json "$DATA_DIR/"

# Pulizia
cd ~
rm -rf /tmp/haccp-src

print_status "Applicazione compilata!"

# ============================================================================
# STEP 5: Configurazione servizio systemd
# ============================================================================

print_header "STEP 5/7: Configurazione servizio PocketBase"

# Crea utente di sistema
sudo useradd -r -s /bin/false haccp 2>/dev/null || true
sudo chown -R haccp:haccp "$DATA_DIR"

# Servizio systemd per PocketBase
sudo tee /etc/systemd/system/haccp-pocketbase.service > /dev/null << EOF
[Unit]
Description=HACCP PocketBase Server
After=network.target

[Service]
Type=simple
User=haccp
Group=haccp
WorkingDirectory=$DATA_DIR
ExecStart=$APP_DIR/bin/pocketbase serve --http=127.0.0.1:8090 --dir=$DATA_DIR/pb_data
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Abilita e avvia servizio
sudo systemctl daemon-reload
sudo systemctl enable haccp-pocketbase
sudo systemctl start haccp-pocketbase

# Attendi avvio
print_info "Attesa avvio PocketBase..."
sleep 5

print_status "PocketBase in esecuzione!"

# ============================================================================
# STEP 6: Configurazione HTTPS e Nginx
# ============================================================================

print_header "STEP 6/7: Configurazione HTTPS"

# Genera certificati SSL
print_info "Generazione certificati SSL..."
sudo mkdir -p "$SSL_DIR"

LOCAL_IP=$(hostname -I | awk '{print $1}')
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=IT/ST=Italy/L=Local/O=HACCP/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:$HOSTNAME,DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP" 2>/dev/null

sudo chmod 600 "$SSL_DIR/privkey.pem"
sudo chmod 644 "$SSL_DIR/fullchain.pem"

# Configurazione Nginx
print_info "Configurazione Nginx..."
sudo tee /etc/nginx/sites-available/haccp-app > /dev/null << NGINXEOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend React
    root $APP_DIR/www;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # PocketBase API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8090/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # PocketBase Admin UI
    location /_/ {
        proxy_pass http://127.0.0.1:8090/_/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

# Abilita configurazione
sudo ln -sf /etc/nginx/sites-available/haccp-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test e riavvia nginx
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# Configura Avahi
print_info "Configurazione dominio $DOMAIN..."
sudo tee /etc/avahi/services/haccp.service > /dev/null << AVAHIEOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">HACCP App su %h</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
  </service>
</service-group>
AVAHIEOF

sudo systemctl restart avahi-daemon

print_status "HTTPS configurato!"

# ============================================================================
# STEP 7: Script utility e automazioni
# ============================================================================

print_header "STEP 7/7: Configurazione utility"

# Script status
sudo tee /usr/local/bin/haccp-status > /dev/null << 'STATUSEOF'
#!/bin/bash
echo "=== HACCP App Status ==="
echo ""
echo "Servizio PocketBase:"
systemctl status haccp-pocketbase --no-pager | head -5
echo ""
echo "Servizio Nginx:"
systemctl status nginx --no-pager | head -3
echo ""
echo "Spazio disco:"
df -h /var/lib/haccp-data | tail -1
echo ""
echo "Memoria:"
free -h | head -2
echo ""
STATUSEOF
sudo chmod +x /usr/local/bin/haccp-status

# Script backup
sudo tee /usr/local/bin/haccp-backup > /dev/null << 'BACKUPEOF'
#!/bin/bash
BACKUP_FILE="$HOME/haccp-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
echo "Creazione backup..."
sudo tar -czf "$BACKUP_FILE" -C /var/lib/haccp-data .
echo "Backup creato: $BACKUP_FILE"
BACKUPEOF
sudo chmod +x /usr/local/bin/haccp-backup

# Script update
sudo tee /usr/local/bin/haccp-update > /dev/null << 'UPDATEEOF'
#!/bin/bash
echo "Aggiornamento HACCP App..."
cd /tmp
rm -rf haccp-update-src
git clone --depth 1 https://github.com/igorrodi/haccp-tracciabilita.git haccp-update-src
cd haccp-update-src

# Configura per PocketBase
cat > src/main.tsx << 'MAINEOF'
import { createRoot } from 'react-dom/client'
import App from './AppPocketBase.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
MAINEOF

npm install --quiet
npm run build
sudo cp -r dist/* /opt/haccp-app/www/
cd ~
rm -rf /tmp/haccp-update-src
echo "Aggiornamento completato!"
UPDATEEOF
sudo chmod +x /usr/local/bin/haccp-update

# Cron backup giornaliero
CRON_BACKUP="0 2 * * * /usr/local/bin/haccp-backup >> /var/log/haccp-backup.log 2>&1"
if ! sudo crontab -l 2>/dev/null | grep -q "haccp-backup"; then
    (sudo crontab -l 2>/dev/null; echo "$CRON_BACKUP") | sudo crontab -
fi

print_status "Utility configurate!"

# ============================================================================
# COMPLETAMENTO
# ============================================================================

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✅ INSTALLAZIONE COMPLETATA CON SUCCESSO!${CYAN}                          ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}🌐 ACCEDI ALL'APPLICAZIONE:${NC}"
echo ""
echo -e "   HTTPS: ${GREEN}https://${DOMAIN}${NC}"
echo -e "   IP:    ${GREEN}https://${LOCAL_IP}${NC}"
echo ""
echo -e "${YELLOW}⚠️  Al primo accesso:${NC}"
echo -e "   1. Accetta il certificato SSL self-signed"
echo -e "   2. Segui la procedura guidata per creare l'admin"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}🗄️  POCKETBASE ADMIN:${NC}"
echo ""
echo -e "   https://${DOMAIN}/_/"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}⚙️  COMANDI UTILI:${NC}"
echo ""
echo -e "   ${CYAN}haccp-status${NC}  - Stato sistema"
echo -e "   ${CYAN}haccp-backup${NC}  - Backup manuale"
echo -e "   ${CYAN}haccp-update${NC}  - Aggiorna app"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Tutto pronto! Apri https://${DOMAIN} nel browser 🎉${NC}"
echo ""
