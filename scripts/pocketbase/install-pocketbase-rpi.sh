#!/bin/bash

# =============================================================================
# HACCP App - Installazione PocketBase per Raspberry Pi 5
# Versione standalone leggera senza Supabase
# =============================================================================

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_header() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }

# Variabili
POCKETBASE_VERSION="0.22.22"
INSTALL_DIR="/opt/haccp-app"
DATA_DIR="/var/lib/haccp-data"
APP_USER="haccp"
DOMAIN="haccp-app.local"

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     HACCP App - Installazione PocketBase (Raspberry Pi 5)    ║"
echo "║                    Versione Standalone                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verifica che sia eseguito come root
if [[ $EUID -ne 0 ]]; then
   print_error "Questo script deve essere eseguito come root (sudo)"
   exit 1
fi

# Verifica architettura ARM64
ARCH=$(uname -m)
if [[ "$ARCH" != "aarch64" ]]; then
    print_warning "Architettura rilevata: $ARCH (atteso: aarch64)"
    print_info "Lo script continuerà ma potrebbero esserci problemi"
fi

# =============================================================================
# STEP 1: Aggiornamento sistema e installazione dipendenze
# =============================================================================
print_header "Step 1: Installazione dipendenze"

apt-get update
apt-get install -y curl wget git nginx unzip avahi-daemon

print_status "Dipendenze installate"

# =============================================================================
# STEP 2: Creazione utente e directory
# =============================================================================
print_header "Step 2: Creazione utente e directory"

# Crea utente se non esiste
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false "$APP_USER"
    print_status "Utente $APP_USER creato"
else
    print_info "Utente $APP_USER già esistente"
fi

# Crea directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$INSTALL_DIR/pb_data"

print_status "Directory create"

# =============================================================================
# STEP 3: Download e installazione PocketBase
# =============================================================================
print_header "Step 3: Download PocketBase"

cd /tmp
POCKETBASE_URL="https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_arm64.zip"

print_info "Download PocketBase v${POCKETBASE_VERSION}..."
wget -q "$POCKETBASE_URL" -O pocketbase.zip

unzip -o pocketbase.zip -d "$INSTALL_DIR"
rm pocketbase.zip

chmod +x "$INSTALL_DIR/pocketbase"
print_status "PocketBase installato in $INSTALL_DIR"

# =============================================================================
# STEP 4: Clone e build applicazione React
# =============================================================================
print_header "Step 4: Download e build applicazione"

# Installa Node.js se non presente
if ! command -v node &> /dev/null; then
    print_info "Installazione Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

print_info "Node.js version: $(node --version)"
print_info "NPM version: $(npm --version)"

# Clone repository
cd /tmp
rm -rf haccp-app-build
git clone https://github.com/igorrodi/haccp-tracciabilita.git haccp-app-build
cd haccp-app-build

# Copia schema PocketBase
cp scripts/pocketbase/pb_schema.json "$INSTALL_DIR/"

# Modifica main.tsx per usare PocketBase
print_info "Configurazione per PocketBase..."
cat > src/main.tsx << 'EOF'
import { createRoot } from 'react-dom/client'
import AppPocketBase from './AppPocketBase.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<AppPocketBase />);
EOF

# Installa dipendenze e build
print_info "Installazione dipendenze npm..."
npm ci --silent

print_info "Build applicazione..."
npm run build

# Copia build
cp -r dist/* "$INSTALL_DIR/www/"
mkdir -p "$INSTALL_DIR/www"
cp -r dist/* "$INSTALL_DIR/www/"

print_status "Applicazione builddata e copiata"

# Cleanup
cd /
rm -rf /tmp/haccp-app-build

# =============================================================================
# STEP 5: Configurazione systemd per PocketBase
# =============================================================================
print_header "Step 5: Configurazione servizio PocketBase"

cat > /etc/systemd/system/pocketbase.service << EOF
[Unit]
Description=PocketBase HACCP Database
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
ExecStart=$INSTALL_DIR/pocketbase serve --http=127.0.0.1:8090 --dir=$INSTALL_DIR/pb_data
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/pb_data $DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

# Imposta permessi
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

systemctl daemon-reload
systemctl enable pocketbase
systemctl start pocketbase

print_status "Servizio PocketBase avviato"

# =============================================================================
# STEP 6: Configurazione Nginx
# =============================================================================
print_header "Step 6: Configurazione Nginx"

# Genera certificato SSL self-signed
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/haccp.key \
    -out /etc/nginx/ssl/haccp.crt \
    -subj "/C=IT/ST=Italia/L=Local/O=HACCP/CN=$DOMAIN" 2>/dev/null

cat > /etc/nginx/sites-available/haccp-app << EOF
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN _;
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN _;

    ssl_certificate /etc/nginx/ssl/haccp.crt;
    ssl_certificate_key /etc/nginx/ssl/haccp.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root $INSTALL_DIR/www;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # React app - SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # PocketBase API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8090/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # PocketBase admin UI (opzionale)
    location /_/ {
        proxy_pass http://127.0.0.1:8090/_/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Abilita sito
ln -sf /etc/nginx/sites-available/haccp-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test e restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

print_status "Nginx configurato"

# =============================================================================
# STEP 7: Configurazione mDNS (Avahi)
# =============================================================================
print_header "Step 7: Configurazione mDNS"

# Configura hostname
hostnamectl set-hostname haccp-app

cat > /etc/avahi/services/haccp.service << EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>HACCP App</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
  </service>
</service-group>
EOF

systemctl restart avahi-daemon
print_status "mDNS configurato - accessibile via $DOMAIN"

# =============================================================================
# STEP 8: Script di utility
# =============================================================================
print_header "Step 8: Creazione script di utility"

# Script di aggiornamento
cat > /usr/local/bin/haccp-update << 'EOF'
#!/bin/bash
set -e
echo "Aggiornamento HACCP App..."
cd /tmp
rm -rf haccp-app-update
git clone https://github.com/igorrodi/haccp-tracciabilita.git haccp-app-update
cd haccp-app-update

# Configura per PocketBase
cat > src/main.tsx << 'MAINEOF'
import { createRoot } from 'react-dom/client'
import AppPocketBase from './AppPocketBase.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<AppPocketBase />);
MAINEOF

npm ci --silent
npm run build
cp -r dist/* /opt/haccp-app/www/
rm -rf /tmp/haccp-app-update
echo "Aggiornamento completato!"
EOF

# Script di backup
cat > /usr/local/bin/haccp-backup << EOF
#!/bin/bash
BACKUP_DIR="/var/backups/haccp"
mkdir -p "\$BACKUP_DIR"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
tar -czf "\$BACKUP_DIR/haccp_backup_\$TIMESTAMP.tar.gz" -C "$INSTALL_DIR" pb_data
echo "Backup creato: \$BACKUP_DIR/haccp_backup_\$TIMESTAMP.tar.gz"
# Mantieni solo ultimi 7 backup
ls -t "\$BACKUP_DIR"/haccp_backup_*.tar.gz | tail -n +8 | xargs -r rm
EOF

# Script di stato
cat > /usr/local/bin/haccp-status << 'EOF'
#!/bin/bash
echo "=== HACCP App Status ==="
echo ""
echo "PocketBase:"
systemctl status pocketbase --no-pager -l | head -5
echo ""
echo "Nginx:"
systemctl status nginx --no-pager -l | head -5
echo ""
echo "Disk usage:"
du -sh /opt/haccp-app/pb_data 2>/dev/null || echo "N/A"
echo ""
echo "Memory usage:"
free -h | head -2
EOF

chmod +x /usr/local/bin/haccp-update
chmod +x /usr/local/bin/haccp-backup
chmod +x /usr/local/bin/haccp-status

print_status "Script di utility creati"

# =============================================================================
# STEP 9: Configurazione backup automatico
# =============================================================================
print_header "Step 9: Configurazione backup automatico"

# Cron job per backup giornaliero
(crontab -l 2>/dev/null | grep -v haccp-backup; echo "0 2 * * * /usr/local/bin/haccp-backup") | crontab -

print_status "Backup automatico configurato (ogni giorno alle 2:00)"

# =============================================================================
# COMPLETATO
# =============================================================================
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║            INSTALLAZIONE COMPLETATA CON SUCCESSO!            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}📱 Accesso all'applicazione:${NC}"
echo "   • https://$DOMAIN"
echo "   • https://$IP_ADDRESS"
echo ""
echo -e "${BLUE}🔧 Admin PocketBase:${NC}"
echo "   • https://$DOMAIN/_/"
echo "   • Crea il primo admin al primo accesso"
echo ""
echo -e "${BLUE}📋 Comandi utili:${NC}"
echo "   • haccp-status   - Verifica stato servizi"
echo "   • haccp-update   - Aggiorna applicazione"
echo "   • haccp-backup   - Esegui backup manuale"
echo ""
echo -e "${BLUE}📂 Directory:${NC}"
echo "   • App:     $INSTALL_DIR"
echo "   • Dati:    $INSTALL_DIR/pb_data"
echo "   • Backup:  /var/backups/haccp"
echo ""
echo -e "${BLUE}🔐 Servizi:${NC}"
echo "   • systemctl status pocketbase"
echo "   • systemctl status nginx"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   1. Accetta il certificato SSL self-signed nel browser"
echo "   2. Accedi a https://$DOMAIN/_/ per creare l'admin PocketBase"
echo "   3. Registra il primo utente nell'app"
echo ""
print_status "Installazione completata!"
