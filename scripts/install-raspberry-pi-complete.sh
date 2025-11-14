#!/bin/bash

# ============================================================================
# HACCP App - Installazione Completa Raspberry Pi
# ============================================================================
# Script interattivo per installazione completa da zero su Raspberry Pi 5
# Include: App, HTTPS, dominio .local, OCR, ritaglio foto, backup Mega
# ============================================================================

set -e

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

clear
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║           HACCP APP - INSTALLAZIONE COMPLETA                  ║
║                    Raspberry Pi Setup                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

echo ""
print_info "Questo script installerà:"
echo "  • HACCP App da GitHub"
echo "  • HTTPS con certificati SSL"
echo "  • Dominio locale .local (mDNS)"
echo "  • OCR (riconoscimento testo)"
echo "  • Editing e ritaglio immagini"
echo "  • Backup automatico su Mega"
echo "  • PWA installabile"
echo ""

# Verifica se eseguito con sudo
if [ "$EUID" -eq 0 ]; then
   print_error "NON eseguire questo script con sudo!"
   print_info "Lo script chiederà la password quando necessario"
   exit 1
fi

# ============================================================================
# FASE 1: RACCOLTA INFORMAZIONI
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 1: Configurazione                                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Nome dominio locale
read -p "Nome dominio locale [haccp-app]: " DOMAIN_NAME
DOMAIN_NAME=${DOMAIN_NAME:-haccp-app}

# Repository GitHub
read -p "URL repository GitHub: " GITHUB_REPO
if [ -z "$GITHUB_REPO" ]; then
    print_error "URL repository obbligatorio!"
    exit 1
fi

read -p "Branch GitHub [main]: " GITHUB_BRANCH
GITHUB_BRANCH=${GITHUB_BRANCH:-main}

# Configurazione Mega per backup
read -p "Vuoi configurare backup su Mega? (y/n) [y]: " SETUP_MEGA
SETUP_MEGA=${SETUP_MEGA:-y}

if [[ $SETUP_MEGA =~ ^[Yy]$ ]]; then
    read -p "Email Mega: " MEGA_EMAIL
    read -sp "Password Mega: " MEGA_PASSWORD
    echo ""
fi

# Riepilogo
echo ""
print_info "RIEPILOGO CONFIGURAZIONE:"
echo "  • Dominio locale: ${DOMAIN_NAME}.local"
echo "  • Repository: $GITHUB_REPO"
echo "  • Branch: $GITHUB_BRANCH"
echo "  • Backup Mega: $([ "$SETUP_MEGA" = "y" ] && echo "Sì" || echo "No")"
echo ""

read -p "Confermi e prosegui? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Installazione annullata"
    exit 0
fi

# ============================================================================
# FASE 2: AGGIORNAMENTO SISTEMA E DIPENDENZE BASE
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 2: Aggiornamento sistema                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_status "Aggiornamento sistema..."
sudo apt update && sudo apt upgrade -y

print_status "Installazione pacchetti base..."
sudo apt install -y \
    curl \
    wget \
    git \
    nginx \
    ufw \
    avahi-daemon \
    avahi-utils \
    libnss-mdns \
    tesseract-ocr \
    tesseract-ocr-ita \
    imagemagick \
    python3 \
    python3-pip \
    jq \
    ca-certificates \
    gnupg \
    lsb-release

# ============================================================================
# FASE 3: INSTALLAZIONE DOCKER
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 3: Installazione Docker                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if ! command -v docker &> /dev/null; then
    print_status "Installazione Docker..."
    
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    sudo usermod -aG docker $USER
    
    print_status "Docker installato"
else
    print_info "Docker già installato"
fi

# ============================================================================
# FASE 4: INSTALLAZIONE NODE.JS
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 4: Installazione Node.js                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if ! command -v node &> /dev/null; then
    print_status "Installazione Node.js 20..."
    
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    print_status "Node.js $(node -v) installato"
else
    print_info "Node.js già installato: $(node -v)"
fi

# ============================================================================
# FASE 5: INSTALLAZIONE MEGATOOLS (se richiesto)
# ============================================================================

if [[ $SETUP_MEGA =~ ^[Yy]$ ]]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║  FASE 5: Installazione Megatools                              ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    if ! command -v megatools &> /dev/null; then
        print_status "Installazione Megatools..."
        sudo apt install -y megatools
    else
        print_info "Megatools già installato"
    fi
    
    # Crea file di configurazione Mega
    mkdir -p ~/.megarc
    cat > ~/.megarc << EOF
[Login]
Username = $MEGA_EMAIL
Password = $MEGA_PASSWORD
EOF
    chmod 600 ~/.megarc
    print_status "Configurazione Mega completata"
fi

# ============================================================================
# FASE 6: CLONE E BUILD APP
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 6: Download e Build App                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

APP_DIR="/opt/haccp-app"

if [ -d "$APP_DIR" ]; then
    print_warning "Directory $APP_DIR già esistente"
    read -p "Vuoi rimuoverla e reinstallare? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo rm -rf $APP_DIR
    else
        print_error "Installazione annullata"
        exit 1
    fi
fi

print_status "Clone repository da GitHub..."
sudo git clone -b $GITHUB_BRANCH $GITHUB_REPO $APP_DIR

sudo chown -R $USER:$USER $APP_DIR
cd $APP_DIR

print_status "Installazione dipendenze..."
npm install

print_status "Build applicazione..."
npm run build

# ============================================================================
# FASE 7: CONFIGURAZIONE mDNS per dominio .local
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 7: Configurazione dominio .local                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_status "Configurazione Avahi per ${DOMAIN_NAME}.local..."

sudo tee /etc/avahi/services/haccp-app.service > /dev/null <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">HACCP App su %h</name>
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

sudo systemctl restart avahi-daemon
print_status "Dominio ${DOMAIN_NAME}.local configurato"

# ============================================================================
# FASE 8: GENERAZIONE CERTIFICATI SSL
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 8: Generazione certificati SSL                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SSL_DIR="/etc/ssl/haccp"
sudo mkdir -p $SSL_DIR

print_status "Generazione certificati SSL self-signed..."

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $SSL_DIR/private.key \
    -out $SSL_DIR/certificate.crt \
    -subj "/C=IT/ST=Italy/L=City/O=HACCP/OU=IT/CN=${DOMAIN_NAME}.local" \
    -addext "subjectAltName = DNS:${DOMAIN_NAME}.local,DNS:*.${DOMAIN_NAME}.local,IP:$(hostname -I | awk '{print $1}')"

sudo chmod 600 $SSL_DIR/private.key
sudo chmod 644 $SSL_DIR/certificate.crt

print_status "Certificati SSL generati"

# ============================================================================
# FASE 9: CONFIGURAZIONE NGINX
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 9: Configurazione Nginx                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_status "Configurazione Nginx..."

sudo tee /etc/nginx/sites-available/haccp-app > /dev/null <<EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME}.local _;
    
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN_NAME}.local _;
    
    # SSL Configuration
    ssl_certificate $SSL_DIR/certificate.crt;
    ssl_certificate_key $SSL_DIR/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # PWA support
    add_header Service-Worker-Allowed "/" always;
    
    root $APP_DIR/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Handle manifest and service worker
    location ~ ^/(manifest\.json|service-worker\.js|sw\.js)$ {
        add_header Cache-Control "no-cache";
        try_files \$uri =404;
    }
    
    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/haccp-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

print_status "Nginx configurato"

# ============================================================================
# FASE 10: CONFIGURAZIONE FIREWALL
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 10: Configurazione Firewall                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_status "Configurazione firewall..."

sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5353/udp  # mDNS

print_status "Firewall configurato"

# ============================================================================
# FASE 11: SCRIPT DI GESTIONE
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 11: Creazione script di gestione                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Script di aggiornamento
print_status "Creazione script update-haccp..."
sudo tee /usr/local/bin/update-haccp > /dev/null <<'SCRIPT'
#!/bin/bash
set -e

echo "🔄 Aggiornamento HACCP App da GitHub..."

cd /opt/haccp-app

# Backup configurazioni locali
git stash

# Pull da GitHub
git pull origin $(git branch --show-current)

# Ripristina eventuali modifiche locali
git stash pop 2>/dev/null || true

# Aggiorna dipendenze e rebuild
npm install
npm run build

# Riavvia Nginx
sudo systemctl reload nginx

echo "✅ Aggiornamento completato!"
SCRIPT

sudo chmod +x /usr/local/bin/update-haccp

# Script di backup
if [[ $SETUP_MEGA =~ ^[Yy]$ ]]; then
    print_status "Creazione script backup-haccp..."
    sudo tee /usr/local/bin/backup-haccp > /dev/null <<'SCRIPT'
#!/bin/bash
set -e

BACKUP_DIR="/tmp/haccp-backup-$(date +%Y%m%d_%H%M%S)"
APP_DIR="/opt/haccp-app"

echo "💾 Backup HACCP App su Mega..."

# Crea directory di backup
mkdir -p $BACKUP_DIR

# Backup codice (esclusi node_modules e dist)
tar czf $BACKUP_DIR/app-code.tar.gz \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    -C $APP_DIR .

# Backup configurazioni Nginx
sudo tar czf $BACKUP_DIR/nginx-config.tar.gz \
    /etc/nginx/sites-available/haccp-app \
    /etc/ssl/haccp

# Upload su Mega
megatools upload --path /HACCP-Backups $BACKUP_DIR/*.tar.gz

# Pulizia
rm -rf $BACKUP_DIR

echo "✅ Backup completato e caricato su Mega!"
SCRIPT

    sudo chmod +x /usr/local/bin/backup-haccp
    
    # Configura cron per backup giornaliero
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-haccp >> /var/log/haccp-backup.log 2>&1") | crontab -
    print_status "Backup automatico configurato (ogni notte alle 2:00)"
fi

# Script di monitoraggio
print_status "Creazione script monitor-haccp..."
sudo tee /usr/local/bin/monitor-haccp > /dev/null <<'SCRIPT'
#!/bin/bash

echo "📊 Stato HACCP App"
echo "===================="
echo ""

echo "🌐 Nginx:"
sudo systemctl status nginx --no-pager | grep "Active:"

echo ""
echo "🔒 SSL Certificati:"
sudo openssl x509 -in /etc/ssl/haccp/certificate.crt -noout -dates | grep "notAfter"

echo ""
echo "📡 Dominio .local:"
avahi-browse -t _http._tcp | grep HACCP || echo "Servizio non trovato"

echo ""
echo "💾 Spazio disco:"
df -h /opt/haccp-app | tail -1

echo ""
echo "🔄 Ultimo aggiornamento Git:"
cd /opt/haccp-app && git log -1 --format="%cd - %s" --date=short
SCRIPT

sudo chmod +x /usr/local/bin/monitor-haccp

print_status "Script di gestione creati"

# ============================================================================
# COMPLETAMENTO
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅ INSTALLAZIONE COMPLETATA!                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

IP_ADDRESS=$(hostname -I | awk '{print $1}')

cat << EOF
🎉 HACCP App installata e configurata con successo!

📱 ACCESSO ALL'APP:
   • HTTPS (raccomandato): https://${DOMAIN_NAME}.local
   • IP diretto HTTPS:     https://${IP_ADDRESS}
   • IP diretto HTTP:      http://${IP_ADDRESS}

🔧 FUNZIONALITÀ INSTALLATE:
   ✓ App HACCP completa
   ✓ HTTPS con certificati SSL
   ✓ Dominio locale ${DOMAIN_NAME}.local
   ✓ OCR (Tesseract) per riconoscimento testo
   ✓ ImageMagick per editing foto
   ✓ PWA installabile
$([ "$SETUP_MEGA" = "y" ] && echo "   ✓ Backup automatico su Mega (ogni notte alle 2:00)")

🛠️  COMANDI UTILI:
   • Aggiorna app:        sudo update-haccp
$([ "$SETUP_MEGA" = "y" ] && echo "   • Backup manuale:      sudo backup-haccp")
   • Monitora stato:      sudo monitor-haccp
   • Restart Nginx:       sudo systemctl restart nginx
   • Visualizza log:      sudo journalctl -u nginx -f

⚠️  NOTE IMPORTANTI:
   1. Il certificato SSL è self-signed, il browser mostrerà un avviso
      (clicca "Avanzate" > "Procedi comunque")
   2. Per accedere da altri dispositivi nella rete:
      - Accetta il certificato nel browser
      - Oppure usa http://${IP_ADDRESS} (senza HTTPS)
   3. Per riavvio completo esegui: sudo reboot

📚 DOCUMENTAZIONE:
   • Supabase Dashboard: https://supabase.com/dashboard
   • Repository GitHub:  $GITHUB_REPO

EOF

print_warning "RIAVVIO RACCOMANDATO per completare l'installazione Docker"
read -p "Vuoi riavviare ora? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Riavvio in corso..."
    sudo reboot
else
    print_info "Ricordati di riavviare quando possibile con: sudo reboot"
fi
