#!/bin/bash

# Script di installazione completa HACCP App per Raspberry Pi 5
# Include: Supabase locale, dominio .local, HTTPS, OCR, installazione PWA
# OS supportato: Raspberry Pi OS Lite (64-bit)

set -e

echo "🚀 Installazione completa HACCP App su Raspberry Pi 5..."

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

# Verifica non root
if [[ $EUID -eq 0 ]]; then
   print_error "Non eseguire questo script come root!"
   exit 1
fi

# Configurazione
APP_NAME="haccp-app"
APP_DIR="/opt/$APP_NAME"
LOCAL_DOMAIN="${APP_NAME}.local"
SUPABASE_DIR="/opt/supabase"
GITHUB_REPO="${GITHUB_REPO:-}"

# ========================================
# 1. AGGIORNAMENTO SISTEMA E DIPENDENZE BASE
# ========================================
print_header "Aggiornamento Sistema"
sudo apt update && sudo apt upgrade -y

print_status "Installazione dipendenze di sistema..."
sudo apt install -y \
    curl wget git nginx ufw \
    avahi-daemon avahi-utils \
    build-essential \
    tesseract-ocr tesseract-ocr-ita \
    libtesseract-dev \
    imagemagick \
    python3 python3-pip \
    jq

# ========================================
# 2. INSTALLAZIONE DOCKER
# ========================================
print_header "Installazione Docker"

if ! command -v docker &> /dev/null; then
    print_status "Installazione Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Aggiungi utente al gruppo docker
    sudo usermod -aG docker $USER
    print_warning "Logout/login necessario per permessi Docker"
else
    print_status "Docker già installato"
fi

# Installa Docker Compose
if ! command -v docker compose &> /dev/null; then
    print_status "Installazione Docker Compose..."
    sudo apt install -y docker-compose-plugin
else
    print_status "Docker Compose già installato"
fi

# ========================================
# 3. INSTALLAZIONE NODE.JS
# ========================================
print_header "Installazione Node.js"

if ! command -v node &> /dev/null; then
    print_status "Installazione Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    print_status "Node.js già installato: $(node --version)"
fi

# ========================================
# 4. SETUP SUPABASE LOCALE
# ========================================
print_header "Setup Supabase Locale"

sudo mkdir -p $SUPABASE_DIR
sudo chown $USER:$USER $SUPABASE_DIR
cd $SUPABASE_DIR

# Clone Supabase (se non esiste)
if [ ! -d "$SUPABASE_DIR/supabase" ]; then
    print_status "Download Supabase..."
    git clone --depth 1 https://github.com/supabase/supabase
fi

cd $SUPABASE_DIR/supabase/docker

# Copia e configura .env
if [ ! -f .env ]; then
    cp .env.example .env
    
    # Genera password casuali
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 32)
    ANON_KEY=$(openssl rand -base64 32)
    SERVICE_ROLE_KEY=$(openssl rand -base64 32)
    
    # Aggiorna .env
    sed -i "s/your-super-secret-jwt-token-with-at-least-32-characters-long/$JWT_SECRET/g" .env
    sed -i "s/POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/g" .env
    
    print_status "File .env configurato"
    print_warning "Salva queste credenziali:"
    echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
    echo "JWT_SECRET=$JWT_SECRET"
fi

# Avvia Supabase
print_status "Avvio Supabase..."
sudo docker compose up -d

# Attendi che Supabase sia pronto
print_status "Attendo avvio Supabase (60s)..."
sleep 60

# ========================================
# 5. SETUP APPLICAZIONE HACCP
# ========================================
print_header "Setup Applicazione HACCP"

sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone/copia progetto
if [ -n "$GITHUB_REPO" ]; then
    print_status "Clone da GitHub: $GITHUB_REPO"
    if [ -d "$APP_DIR/.git" ]; then
        cd $APP_DIR
        git pull
    else
        git clone $GITHUB_REPO $APP_DIR
        cd $APP_DIR
    fi
else
    print_warning "GITHUB_REPO non configurato"
    print_status "Copia manuale del progetto in $APP_DIR"
    if [ -d "/tmp/$APP_NAME" ]; then
        cp -r /tmp/$APP_NAME/* $APP_DIR/
    fi
    cd $APP_DIR
fi

# Configura variabili ambiente per Supabase locale
print_status "Configurazione variabili ambiente..."
cat > $APP_DIR/.env.local << EOF
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=local
EOF

# Installa dipendenze
print_status "Installazione dipendenze npm..."
npm install

# Build applicazione
print_status "Build applicazione..."
npm run build

# ========================================
# 6. CONFIGURAZIONE DOMINIO LOCALE (.local)
# ========================================
print_header "Configurazione Dominio Locale"

print_status "Configurazione mDNS/Avahi per $LOCAL_DOMAIN..."

# Configura avahi per pubblicare il servizio
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
print_status "Dominio locale configurato: http://$LOCAL_DOMAIN"

# ========================================
# 7. CONFIGURAZIONE HTTPS CON CERTIFICATI SELF-SIGNED
# ========================================
print_header "Configurazione HTTPS"

SSL_DIR="/etc/ssl/haccp"
sudo mkdir -p $SSL_DIR

if [ ! -f "$SSL_DIR/cert.pem" ]; then
    print_status "Generazione certificati SSL self-signed..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $SSL_DIR/key.pem \
        -out $SSL_DIR/cert.pem \
        -subj "/C=IT/ST=Italy/L=Local/O=HACCP/CN=$LOCAL_DOMAIN" \
        -addext "subjectAltName=DNS:$LOCAL_DOMAIN,DNS:*.local,IP:127.0.0.1"
    
    print_status "Certificati SSL generati"
    print_warning "Per evitare warning del browser, importa il certificato:"
    print_warning "  sudo cp $SSL_DIR/cert.pem /usr/local/share/ca-certificates/haccp.crt"
    print_warning "  sudo update-ca-certificates"
else
    print_status "Certificati SSL già presenti"
fi

# ========================================
# 8. CONFIGURAZIONE NGINX
# ========================================
print_header "Configurazione Nginx"

sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $LOCAL_DOMAIN _;
    
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name $LOCAL_DOMAIN _;
    root $APP_DIR/dist;
    index index.html;
    
    # SSL Configuration
    ssl_certificate $SSL_DIR/cert.pem;
    ssl_certificate_key $SSL_DIR/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # PWA Support - Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
        proxy_cache_bypass \$http_pragma;
        proxy_cache_revalidate on;
        expires off;
        access_log off;
    }
    
    # PWA Support - Manifest
    location /manifest.json {
        add_header Cache-Control "no-cache";
        add_header Content-Type "application/manifest+json";
    }
    
    # Handle client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Proxy Supabase API
    location /supabase/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOF

# Abilita il sito
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test e restart Nginx
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

print_status "Nginx configurato e avviato"

# ========================================
# 9. CONFIGURAZIONE FIREWALL
# ========================================
print_header "Configurazione Firewall"

sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5353/udp  # mDNS

print_status "Firewall configurato"

# ========================================
# 10. SCRIPT DI AGGIORNAMENTO
# ========================================
print_header "Creazione Script di Gestione"

# Script di aggiornamento
sudo tee /usr/local/bin/update-haccp > /dev/null <<'SCRIPT'
#!/bin/bash
set -e

echo "🔄 Aggiornamento HACCP App..."

APP_DIR="/opt/haccp-app"
cd $APP_DIR

# Pull da GitHub se configurato
if [ -d ".git" ]; then
    echo "📥 Pull da GitHub..."
    git pull
else
    echo "⚠️  Git non configurato, copia manuale necessaria"
fi

# Aggiorna dipendenze e rebuild
echo "📦 Aggiornamento dipendenze..."
npm install

echo "🔨 Build applicazione..."
npm run build

# Restart servizi
echo "🔄 Restart servizi..."
sudo systemctl reload nginx

echo "✅ Aggiornamento completato!"
SCRIPT

sudo chmod +x /usr/local/bin/update-haccp

# Script di backup
sudo tee /usr/local/bin/backup-haccp > /dev/null <<'SCRIPT'
#!/bin/bash
set -e

BACKUP_DIR="/opt/backups/haccp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "💾 Backup HACCP App..."

sudo mkdir -p $BACKUP_DIR

# Backup database Supabase
echo "📊 Backup database..."
sudo docker exec supabase-db pg_dumpall -U postgres > $BACKUP_DIR/db_$TIMESTAMP.sql

# Backup applicazione
echo "📁 Backup applicazione..."
sudo tar -czf $BACKUP_DIR/app_$TIMESTAMP.tar.gz -C /opt haccp-app

# Mantieni solo ultimi 7 backup
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completato: $BACKUP_DIR"
SCRIPT

sudo chmod +x /usr/local/bin/backup-haccp

# Script di monitoraggio
sudo tee /usr/local/bin/monitor-haccp > /dev/null <<'SCRIPT'
#!/bin/bash

echo "📊 Status HACCP App"
echo "===================="

# Nginx
echo -n "Nginx: "
systemctl is-active --quiet nginx && echo "✅ Attivo" || echo "❌ Inattivo"

# Supabase
echo -n "Supabase: "
sudo docker ps | grep -q supabase-db && echo "✅ Attivo" || echo "❌ Inattivo"

# Avahi
echo -n "mDNS: "
systemctl is-active --quiet avahi-daemon && echo "✅ Attivo" || echo "❌ Inattivo"

# Spazio disco
echo ""
echo "💾 Spazio disco:"
df -h / | tail -1 | awk '{print "  Usato: "$3" / "$2" ("$5")"}'

# Memoria
echo ""
echo "🧠 Memoria:"
free -h | grep Mem | awk '{print "  Usato: "$3" / "$2}'

# Uptime
echo ""
echo "⏱️  Uptime: $(uptime -p)"
SCRIPT

sudo chmod +x /usr/local/bin/monitor-haccp

# ========================================
# 11. CONFIGURAZIONE AUTO-START
# ========================================
print_header "Configurazione Auto-Start"

# Systemd service per Supabase
sudo tee /etc/systemd/system/supabase.service > /dev/null <<EOF
[Unit]
Description=Supabase Docker Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$SUPABASE_DIR/supabase/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable supabase.service

# Cron per backup automatico (ogni giorno alle 2:00)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-haccp") | crontab -

print_status "Auto-start configurato"

# ========================================
# 12. CONFIGURAZIONE GIT (se disponibile)
# ========================================
if [ -n "$GITHUB_REPO" ]; then
    print_header "Configurazione Git"
    
    cd $APP_DIR
    
    if [ ! -d ".git" ]; then
        git init
        git remote add origin $GITHUB_REPO
        git fetch
        git checkout -b main
        git branch --set-upstream-to=origin/main main
    fi
    
    print_status "Git configurato"
fi

# ========================================
# RIEPILOGO INSTALLAZIONE
# ========================================
print_header "Installazione Completata!"

IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "🎉 HACCP App installata con successo!"
echo ""
echo "📍 Accesso:"
echo "   • Locale:  https://localhost"
echo "   • Rete:    https://$IP_ADDRESS"
echo "   • mDNS:    https://$LOCAL_DOMAIN"
echo ""
echo "🗄️  Supabase:"
echo "   • Studio:  http://localhost:8000"
echo "   • API:     http://localhost:8000"
echo ""
echo "🔧 Comandi utili:"
echo "   • Aggiorna:     sudo update-haccp"
echo "   • Backup:       sudo backup-haccp"
echo "   • Monitor:      sudo monitor-haccp"
echo "   • Logs Nginx:   sudo tail -f /var/log/nginx/error.log"
echo "   • Logs Supabase: cd $SUPABASE_DIR/supabase/docker && sudo docker compose logs -f"
echo ""
echo "📁 Percorsi:"
echo "   • App:        $APP_DIR"
echo "   • Supabase:   $SUPABASE_DIR"
echo "   • Backups:    /opt/backups/haccp"
echo ""
echo "⚠️  Note importanti:"
echo "   1. Il certificato SSL è self-signed, il browser mostrerà un avviso"
echo "   2. Importa il certificato per evitare avvisi: $SSL_DIR/cert.pem"
echo "   3. Backup automatico ogni giorno alle 2:00"
echo "   4. Per aggiornamenti da GitHub: configura GITHUB_REPO"
echo ""
print_warning "Riavvia il sistema per applicare tutte le modifiche: sudo reboot"
echo ""

# Salva info installazione
sudo tee /opt/haccp-app/INSTALL_INFO.txt > /dev/null <<EOF
HACCP App - Informazioni Installazione
========================================
Data installazione: $(date)
Sistema: $(uname -a)
Node.js: $(node --version)
Docker: $(docker --version)

Accessi:
- App: https://$LOCAL_DOMAIN
- Supabase: http://localhost:8000

Comandi:
- update-haccp: Aggiorna applicazione
- backup-haccp: Backup completo
- monitor-haccp: Stato servizi
EOF

print_status "Installazione salvata in $APP_DIR/INSTALL_INFO.txt"
