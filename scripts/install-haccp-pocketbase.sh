#!/bin/bash

# ============================================================================
# TRACKER HACCP - PocketBase Edition
# Installazione COMPLETA per Raspberry Pi 5 con un solo comando
# ============================================================================
# 
# Uso: curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-haccp-pocketbase.sh | sudo bash
#
# Questo script installa:
# - PocketBase (backend leggero, singolo binario)
# - Applicazione HACCP React (frontend)
# - HTTPS con certificato SSL self-signed
# - mDNS per dominio trackerhaccp.local
# - Primo accesso guidato con creazione admin
# - Backup automatici giornalieri
# - Script di aggiornamento da GitHub
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
APP_NAME="trackerhaccp"
APP_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
REPO_URL="https://github.com/igorrodi/haccp-tracciabilita.git"
POCKETBASE_VERSION="0.22.22"
DOMAIN="${APP_NAME}.local"
SSL_DIR="/etc/ssl/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"

# Rileva architettura
ARCH=$(uname -m)
case $ARCH in
    aarch64|arm64) PB_ARCH="linux_arm64" ;;
    armv7l) PB_ARCH="linux_arm64" ;;
    x86_64) PB_ARCH="linux_amd64" ;;
    *) print_error "Architettura non supportata: $ARCH"; exit 1 ;;
esac

# ============================================================================
# VERIFICA ROOT
# ============================================================================

if [[ $EUID -ne 0 ]]; then
   print_error "Questo script deve essere eseguito come root (sudo)"
   exit 1
fi

# ============================================================================
# HEADER
# ============================================================================

clear
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${MAGENTA}🚀 TRACKER HACCP - PocketBase Edition${CYAN}                              ║${NC}"
echo -e "${CYAN}║   ${NC}Installazione automatica per Raspberry Pi 5${CYAN}                         ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} PocketBase backend (~15MB RAM)${CYAN}                                  ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Applicazione HACCP React${CYAN}                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} HTTPS automatico con SSL${CYAN}                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Dominio locale: ${YELLOW}${DOMAIN}${CYAN}                              ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Primo accesso guidato${CYAN}                                          ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Backup automatici giornalieri${CYAN}                                  ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Aggiornamenti da GitHub${CYAN}                                        ║${NC}"
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
# STEP 1: Pulizia e preparazione
# ============================================================================

print_header "STEP 1/8: Preparazione ambiente"

# Ferma servizi esistenti
systemctl stop ${APP_NAME} 2>/dev/null || true
systemctl stop haccp-pocketbase 2>/dev/null || true
systemctl stop pocketbase 2>/dev/null || true
systemctl disable ${APP_NAME} 2>/dev/null || true
systemctl disable haccp-pocketbase 2>/dev/null || true
systemctl disable pocketbase 2>/dev/null || true

# Backup dati esistenti se presenti
if [ -d "$DATA_DIR/pb_data" ] && [ "$(ls -A $DATA_DIR/pb_data 2>/dev/null)" ]; then
    BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    print_info "Backup dati esistenti in /tmp/${APP_NAME}-backup-${BACKUP_TIMESTAMP}"
    mkdir -p /tmp/${APP_NAME}-backup-${BACKUP_TIMESTAMP}
    cp -r "$DATA_DIR/pb_data" /tmp/${APP_NAME}-backup-${BACKUP_TIMESTAMP}/
fi

print_status "Ambiente preparato!"

# ============================================================================
# STEP 2: Installazione prerequisiti
# ============================================================================

print_header "STEP 2/8: Installazione prerequisiti"

# Aggiorna sistema
print_info "Aggiornamento sistema..."
apt-get update -qq

# Pacchetti essenziali
PACKAGES="curl wget git nginx openssl avahi-daemon avahi-utils unzip"
print_info "Installazione: $PACKAGES"
apt-get install -y $PACKAGES > /dev/null

# Node.js 20 (per build)
if ! command -v node &> /dev/null; then
    print_info "Installazione Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
    apt-get install -y nodejs > /dev/null
fi

print_info "Node.js: $(node --version) | NPM: $(npm --version)"

# Abilita servizi
systemctl enable avahi-daemon 2>/dev/null || true
systemctl start avahi-daemon 2>/dev/null || true

print_status "Prerequisiti installati!"

# ============================================================================
# STEP 3: Creazione utente e directory
# ============================================================================

print_header "STEP 3/8: Configurazione sistema"

# Crea utente sistema
if ! id "${APP_NAME}" &>/dev/null; then
    useradd --system --home-dir "$APP_DIR" --shell /bin/false ${APP_NAME}
    print_status "Utente ${APP_NAME} creato"
else
    print_info "Utente ${APP_NAME} già esistente"
fi

# Crea directory
mkdir -p "$APP_DIR/bin"
mkdir -p "$APP_DIR/www"
mkdir -p "$DATA_DIR/pb_data"
mkdir -p "$BACKUP_DIR"
mkdir -p "$SSL_DIR"

print_status "Directory create!"

# ============================================================================
# STEP 4: Download e installazione PocketBase
# ============================================================================

print_header "STEP 4/8: Installazione PocketBase"

POCKETBASE_URL="https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_${PB_ARCH}.zip"

print_info "Download PocketBase v${POCKETBASE_VERSION} (${PB_ARCH})..."
wget -q "$POCKETBASE_URL" -O /tmp/pocketbase.zip

# Estrai e installa
unzip -o /tmp/pocketbase.zip -d /tmp/pocketbase > /dev/null
mv /tmp/pocketbase/pocketbase "$APP_DIR/bin/"
chmod +x "$APP_DIR/bin/pocketbase"
rm -rf /tmp/pocketbase /tmp/pocketbase.zip

print_status "PocketBase installato in $APP_DIR/bin/"

# ============================================================================
# STEP 5: Clone e build applicazione React
# ============================================================================

print_header "STEP 5/8: Build applicazione React"

# Clone repository
print_info "Clone repository..."
rm -rf /tmp/${APP_NAME}-src
git clone --depth 1 "$REPO_URL" /tmp/${APP_NAME}-src

cd /tmp/${APP_NAME}-src

# Configura main.tsx per PocketBase
print_info "Configurazione per PocketBase..."
cat > src/main.tsx << 'MAINEOF'
import { createRoot } from 'react-dom/client'
import App from './AppPocketBase.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
MAINEOF

# Installa dipendenze e build
print_info "Installazione dipendenze npm..."
npm ci --silent --no-audit --no-fund 2>/dev/null || npm install --silent --no-audit --no-fund

print_info "Build applicazione..."
npm run build

# Copia build e schema
cp -r dist/* "$APP_DIR/www/"
cp scripts/pocketbase/pb_schema.json "$DATA_DIR/" 2>/dev/null || true

# Pulizia
cd /
rm -rf /tmp/${APP_NAME}-src

print_status "Applicazione React compilata!"

# ============================================================================
# STEP 6: Configurazione servizio systemd
# ============================================================================

print_header "STEP 6/8: Configurazione servizio PocketBase"

# Imposta permessi
chown -R ${APP_NAME}:${APP_NAME} "$APP_DIR"
chown -R ${APP_NAME}:${APP_NAME} "$DATA_DIR"

# Crea servizio systemd
cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=Tracker HACCP - PocketBase Server
After=network.target

[Service]
Type=simple
User=${APP_NAME}
Group=${APP_NAME}
WorkingDirectory=$DATA_DIR
ExecStart=$APP_DIR/bin/pocketbase serve --http=127.0.0.1:8090 --dir=$DATA_DIR/pb_data
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

# Abilita e avvia servizio
systemctl daemon-reload
systemctl enable ${APP_NAME}
systemctl start ${APP_NAME}

# Attendi avvio
print_info "Attesa avvio PocketBase..."
sleep 3

# Verifica che sia in esecuzione
if systemctl is-active --quiet ${APP_NAME}; then
    print_status "PocketBase in esecuzione!"
else
    print_error "PocketBase non si è avviato correttamente"
    journalctl -u ${APP_NAME} --no-pager -n 10
    exit 1
fi

# ============================================================================
# STEP 7: Configurazione HTTPS e Nginx
# ============================================================================

print_header "STEP 7/8: Configurazione HTTPS e Nginx"

# Genera certificati SSL
LOCAL_IP=$(hostname -I | awk '{print $1}')
print_info "Generazione certificato SSL per $DOMAIN..."

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=IT/ST=Italy/L=Local/O=TrackerHACCP/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP" 2>/dev/null

chmod 600 "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"

# Configurazione Nginx
print_info "Configurazione Nginx..."
cat > /etc/nginx/sites-available/${APP_NAME} << NGINXEOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN _;
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN _;

    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

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

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Abilita configurazione
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test e riavvia nginx
nginx -t && systemctl restart nginx
systemctl enable nginx

# Configura hostname e mDNS
print_info "Configurazione mDNS per $DOMAIN..."
hostnamectl set-hostname ${APP_NAME}

cat > /etc/avahi/services/${APP_NAME}.service << AVAHIEOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Tracker HACCP</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
  </service>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>
</service-group>
AVAHIEOF

systemctl restart avahi-daemon

print_status "HTTPS e mDNS configurati!"

# ============================================================================
# STEP 8: Script utility e backup automatico
# ============================================================================

print_header "STEP 8/8: Script utility e automazioni"

# Script status
cat > /usr/local/bin/${APP_NAME}-status << 'STATUSEOF'
#!/bin/bash
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║               TRACKER HACCP - Status Sistema                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Servizio PocketBase:"
systemctl status trackerhaccp --no-pager | head -5
echo ""
echo "🌐 Servizio Nginx:"
systemctl status nginx --no-pager | head -3
echo ""
echo "💾 Spazio disco:"
df -h /var/lib/trackerhaccp | tail -1
echo ""
echo "🧠 Memoria:"
free -h | head -2
echo ""
echo "🔗 Accesso: https://trackerhaccp.local"
echo ""
STATUSEOF
chmod +x /usr/local/bin/${APP_NAME}-status

# Script backup
cat > /usr/local/bin/${APP_NAME}-backup << BACKUPEOF
#!/bin/bash
BACKUP_FILE="${BACKUP_DIR}/${APP_NAME}-backup-\$(date +%Y%m%d-%H%M%S).tar.gz"
echo "Creazione backup..."
systemctl stop ${APP_NAME}
tar -czf "\$BACKUP_FILE" -C "$DATA_DIR" pb_data
systemctl start ${APP_NAME}
echo "✓ Backup creato: \$BACKUP_FILE"
# Mantieni solo ultimi 7 backup
ls -t ${BACKUP_DIR}/${APP_NAME}-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm
BACKUPEOF
chmod +x /usr/local/bin/${APP_NAME}-backup

# Script update
cat > /usr/local/bin/${APP_NAME}-update << 'UPDATEEOF'
#!/bin/bash
echo "Aggiornamento Tracker HACCP..."

# Backup prima dell'aggiornamento
/usr/local/bin/trackerhaccp-backup

cd /tmp
rm -rf trackerhaccp-update-src
git clone --depth 1 https://github.com/igorrodi/haccp-tracciabilita.git trackerhaccp-update-src
cd trackerhaccp-update-src

# Configura per PocketBase
cat > src/main.tsx << 'MAINEOF'
import { createRoot } from 'react-dom/client'
import App from './AppPocketBase.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
MAINEOF

npm ci --silent 2>/dev/null || npm install --silent
npm run build

# Copia nuova build
sudo cp -r dist/* /opt/trackerhaccp/www/

# Pulizia
cd /
rm -rf /tmp/trackerhaccp-update-src

echo "✓ Aggiornamento completato!"
echo "  Apri https://trackerhaccp.local per verificare"
UPDATEEOF
chmod +x /usr/local/bin/${APP_NAME}-update

# Script restore
cat > /usr/local/bin/${APP_NAME}-restore << RESTOREEOF
#!/bin/bash
if [ -z "\$1" ]; then
    echo "Uso: ${APP_NAME}-restore <file-backup.tar.gz>"
    echo ""
    echo "Backup disponibili:"
    ls -lh ${BACKUP_DIR}/${APP_NAME}-backup-*.tar.gz 2>/dev/null || echo "Nessun backup trovato"
    exit 1
fi

if [ ! -f "\$1" ]; then
    echo "File non trovato: \$1"
    exit 1
fi

echo "Ripristino da \$1..."
systemctl stop ${APP_NAME}
rm -rf $DATA_DIR/pb_data
tar -xzf "\$1" -C $DATA_DIR
chown -R ${APP_NAME}:${APP_NAME} $DATA_DIR
systemctl start ${APP_NAME}
echo "✓ Ripristino completato!"
RESTOREEOF
chmod +x /usr/local/bin/${APP_NAME}-restore

# Cron backup giornaliero alle 2:00
CRON_BACKUP="0 2 * * * /usr/local/bin/${APP_NAME}-backup >> /var/log/${APP_NAME}-backup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "${APP_NAME}-backup"; then
    (crontab -l 2>/dev/null; echo "$CRON_BACKUP") | crontab -
    print_info "Backup automatico configurato (ogni giorno alle 2:00)"
fi

print_status "Script utility creati!"

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
echo -e "   HTTPS:  ${GREEN}https://${DOMAIN}${NC}"
echo -e "   IP:     ${GREEN}https://${LOCAL_IP}${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}🔐 PRIMO ACCESSO:${NC}"
echo ""
echo -e "   1. Apri ${GREEN}https://${DOMAIN}${NC} nel browser"
echo -e "   2. Accetta il certificato SSL self-signed"
echo -e "   3. Segui la procedura guidata per creare l'admin"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}🗄️  POCKETBASE ADMIN (opzionale):${NC}"
echo ""
echo -e "   ${GREEN}https://${DOMAIN}/_/${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}⚙️  COMANDI UTILI:${NC}"
echo ""
echo -e "   ${CYAN}${APP_NAME}-status${NC}   - Stato sistema"
echo -e "   ${CYAN}${APP_NAME}-backup${NC}   - Backup manuale"
echo -e "   ${CYAN}${APP_NAME}-update${NC}   - Aggiorna da GitHub"
echo -e "   ${CYAN}${APP_NAME}-restore${NC}  - Ripristina backup"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}📂 DIRECTORY:${NC}"
echo ""
echo -e "   App:     ${CYAN}$APP_DIR${NC}"
echo -e "   Dati:    ${CYAN}$DATA_DIR${NC}"
echo -e "   Backup:  ${CYAN}$BACKUP_DIR${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}🎉 Tutto pronto! Apri https://${DOMAIN} nel browser${NC}"
echo ""
