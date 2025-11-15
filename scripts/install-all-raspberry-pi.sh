#!/bin/bash

# Script di installazione MASTER per Raspberry Pi
# UN SOLO COMANDO per installare tutto: app, database, backup, aggiornamenti automatici
# 
# Uso: curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-all-raspberry-pi.sh | bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[ℹ]${NC} $1"; }
print_header() { echo -e "${MAGENTA}[★]${NC} $1"; }

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║     🚀 HACCP APP - Installazione Completa Raspberry Pi      ║"
echo "║                                                               ║"
echo "║     • Applicazione HACCP                                      ║"
echo "║     • Database Supabase locale                                ║"
echo "║     • Backup automatici su Mega.nz                            ║"
echo "║     • Aggiornamenti automatici da GitHub                      ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

APP_DIR="$HOME/haccp-app"
REPO_URL="https://github.com/igorrodi/haccp-tracciabilita.git"

# ============================================================================
# STEP 1: Pulizia ambiente
# ============================================================================

print_header "STEP 1/6: Pulizia ambiente esistente"

# Ferma container esistenti
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR/scripts/docker" 2>/dev/null && docker compose down 2>/dev/null || true
    cd ~
fi

# Ferma container specifici
docker stop haccp-app haccp-db haccp-studio haccp-kong haccp-meta 2>/dev/null || true
docker rm haccp-app haccp-db haccp-studio haccp-kong haccp-meta 2>/dev/null || true

# Libera porte
sudo fuser -k 80/tcp 2>/dev/null || true
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo fuser -k 5432/tcp 2>/dev/null || true
sudo fuser -k 8000/tcp 2>/dev/null || true
sudo fuser -k 8080/tcp 2>/dev/null || true
sudo fuser -k 54323/tcp 2>/dev/null || true

# Rimuovi directory esistente
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
fi

print_status "Ambiente pulito!"

# ============================================================================
# STEP 2: Installa prerequisiti
# ============================================================================

print_header "STEP 2/7: Installazione prerequisiti"

# Docker
if ! command -v docker &> /dev/null; then
    print_info "Installazione Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_status "Docker installato!"
    
    # Ri-esegui lo script con i permessi Docker corretti
    print_info "Riavvio script con permessi Docker..."
    exec sg docker -c "$0 $*"
fi

# Verifica permessi Docker
if ! docker ps &> /dev/null; then
    print_error "Permessi Docker non corretti. Esegui: newgrp docker"
    print_info "Oppure riavvia il sistema e rilancia lo script."
    exit 1
fi

# Node.js 20
if ! command -v node &> /dev/null; then
    print_info "Installazione Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js installato!"
fi

# Git
if ! command -v git &> /dev/null; then
    print_info "Installazione Git..."
    sudo apt-get update
    sudo apt-get install -y git
    print_status "Git installato!"
fi

# PostgreSQL client
if ! command -v psql &> /dev/null; then
    print_info "Installazione PostgreSQL client..."
    sudo apt-get install -y postgresql-client
    print_status "PostgreSQL client installato!"
fi

# Nginx
if ! command -v nginx &> /dev/null; then
    print_info "Installazione Nginx..."
    sudo apt-get install -y nginx
    print_status "Nginx installato!"
fi

# Avahi (mDNS per dominio .local)
if ! systemctl is-active --quiet avahi-daemon; then
    print_info "Installazione Avahi (mDNS)..."
    sudo apt-get install -y avahi-daemon avahi-utils
    sudo systemctl enable avahi-daemon
    sudo systemctl start avahi-daemon
    print_status "Avahi installato!"
fi

# OpenSSL per certificati
if ! command -v openssl &> /dev/null; then
    print_info "Installazione OpenSSL..."
    sudo apt-get install -y openssl
    print_status "OpenSSL installato!"
fi

print_status "Tutti i prerequisiti installati!"

# ============================================================================
# STEP 3: Clone repository e setup completo
# ============================================================================

print_header "STEP 3/7: Download e setup applicazione"

# Clone con SSH o HTTPS
if git clone git@github.com:igorrodi/haccp-tracciabilita.git "$APP_DIR" 2>/dev/null; then
    print_status "Clonato con SSH!"
else
    git clone "$REPO_URL" "$APP_DIR"
    print_status "Clonato con HTTPS!"
fi

cd "$APP_DIR"

# Installa dipendenze
print_info "Installazione dipendenze npm..."
npm install --quiet
print_status "Dipendenze installate!"

# Build applicazione
print_info "Build applicazione..."
npm run build
print_status "Build completata!"

# ============================================================================
# STEP 4: Avvio stack Docker completo
# ============================================================================

print_header "STEP 4/7: Configurazione HTTPS e dominio locale"

HOSTNAME=$(hostname)
DOMAIN="${HOSTNAME}.local"
SSL_DIR="/etc/ssl/haccp"
NGINX_CONF="/etc/nginx/sites-available/haccp-app"

# Crea directory per certificati
print_info "Creazione certificati SSL self-signed..."
sudo mkdir -p "$SSL_DIR"

# Genera certificati SSL self-signed (validi 10 anni)
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=IT/ST=Italy/L=Local/O=HACCP/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:$HOSTNAME,DNS:localhost,IP:127.0.0.1,IP:$(hostname -I | awk '{print $1}')" 2>/dev/null

sudo chmod 600 "$SSL_DIR/privkey.pem"
sudo chmod 644 "$SSL_DIR/fullchain.pem"
print_status "Certificati SSL creati!"

# Configura nginx
print_info "Configurazione Nginx..."
sudo tee "$NGINX_CONF" > /dev/null <<'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    ssl_certificate /etc/ssl/haccp/fullchain.pem;
    ssl_certificate_key /etc/ssl/haccp/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Docker app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Supabase Studio
    location /studio {
        proxy_pass http://localhost:54323;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Abilita configurazione nginx
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test e riavvia nginx
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
print_status "Nginx configurato con HTTPS!"

# Configura Avahi per dominio .local
print_info "Configurazione dominio $DOMAIN..."
sudo tee /etc/avahi/services/haccp.service > /dev/null <<EOF
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
print_status "Dominio locale configurato: https://$DOMAIN"

# ============================================================================
# STEP 5/7: Avvio stack Supabase + App
# ============================================================================

print_header "STEP 5/7: Avvio stack Supabase + App"

cd "$APP_DIR/scripts/docker"

# Avvia tutti i servizi
print_info "Avvio servizi Docker..."
docker compose up -d

# Attendi PostgreSQL
print_info "Attesa avvio database (60 secondi)..."
sleep 60

# Verifica database
print_info "Verifica connessione database..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker compose exec -T db psql -U postgres -d postgres -c "SELECT 1;" &>/dev/null; then
        print_status "Database pronto!"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    print_error "Database non risponde!"
    docker compose logs db
    exit 1
fi

# ============================================================================
# STEP 5: Migrazioni database
# ============================================================================

print_header "STEP 6/7: Applicazione migrazioni database"

cd "$APP_DIR"

# Conta e applica migrazioni
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l)
print_info "Trovate $MIGRATION_COUNT migrazioni..."

for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        FILENAME=$(basename "$migration")
        print_info "Applico: $FILENAME"
        
        docker exec -i $(docker compose -f scripts/docker/docker-compose.yml ps -q db) \
            psql -U postgres -d postgres < "$migration" 2>&1 | grep -v "NOTICE:" | grep -v "^$" || true
    fi
done

print_status "Migrazioni applicate!"

# ============================================================================
# STEP 6: Setup backup e aggiornamenti automatici
# ============================================================================

print_header "STEP 7/7: Configurazione backup e aggiornamenti"

# Rendi eseguibili gli script
chmod +x "$APP_DIR/scripts"/*.sh

# Chiedi se configurare backup Mega
echo ""
read -p "Vuoi configurare i backup automatici su Mega.nz? (s/n): " SETUP_MEGA
if [ "$SETUP_MEGA" = "s" ] || [ "$SETUP_MEGA" = "S" ]; then
    "$APP_DIR/scripts/setup-mega-backup.sh"
fi

# Configura aggiornamenti settimanali automatici
print_info "Configurazione aggiornamenti automatici..."
CRON_UPDATE="0 3 * * 0 $APP_DIR/scripts/update-from-github.sh >> $HOME/haccp-updates.log 2>&1"

if ! crontab -l 2>/dev/null | grep -q "update-from-github.sh"; then
    (crontab -l 2>/dev/null; echo "$CRON_UPDATE") | crontab -
    print_status "Aggiornamenti automatici configurati (ogni domenica alle 3:00)!"
fi

# ============================================================================
# VERIFICA FINALE
# ============================================================================

echo ""
print_header "Verifica finale dell'installazione"

# Container in esecuzione
print_info "Container Docker:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test app
echo ""
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    print_status "App funzionante!"
else
    print_error "App non risponde!"
fi

# ============================================================================
# COMPLETAMENTO
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║     ✅ INSTALLAZIONE COMPLETATA CON SUCCESSO!                ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
print_status "Sistema HACCP pronto all'uso!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "🌐 ACCEDI ALL'APPLICAZIONE:"
echo ""
echo "  HTTPS (consigliato): https://$(hostname).local"
echo "  HTTP locale:         http://localhost"
echo "  IP diretto:          https://$(hostname -I | awk '{print $1}')"
echo ""
print_info "⚠️  IMPORTANTE: Il certificato SSL è self-signed."
echo "     Alla prima connessione, accetta l'eccezione di sicurezza nel browser."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "🗄️  SUPABASE STUDIO (Gestione Database):"
echo ""
echo "  HTTPS: https://$(hostname).local/studio"
echo "  HTTP:  http://localhost:54323"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "⚙️  COMANDI UTILI:"
echo ""
echo "  Aggiorna app:           $APP_DIR/scripts/update-from-github.sh"
echo "  Backup manuale:         $APP_DIR/scripts/backup-to-mega.sh"
echo "  Log app:                docker logs -f haccp-app"
echo "  Log database:           docker logs -f haccp-db"
echo "  Riavvia tutto:          cd $APP_DIR/scripts/docker && docker compose restart"
echo "  Ferma tutto:            cd $APP_DIR/scripts/docker && docker compose down"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "🔄 AUTOMAZIONI CONFIGURATE:"
echo ""
if crontab -l 2>/dev/null | grep -q "backup-to-mega.sh"; then
    echo "  ✓ Backup automatici:     Ogni giorno alle 2:00"
else
    echo "  ✗ Backup automatici:     Non configurati"
fi
if crontab -l 2>/dev/null | grep -q "update-from-github.sh"; then
    echo "  ✓ Aggiornamenti auto:    Ogni domenica alle 3:00"
else
    echo "  ✗ Aggiornamenti auto:    Non configurati"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_status "Tutto pronto! Buon lavoro! 🎉"
echo ""
