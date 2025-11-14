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
# FASE 5: INSTALLAZIONE SUPABASE LOCALE
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 5: Installazione Supabase Locale                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SUPABASE_DIR="$HOME/supabase-local"

print_status "Creazione directory Supabase..."
mkdir -p $SUPABASE_DIR
cd $SUPABASE_DIR

print_status "Download Supabase Docker Compose..."
cat > docker-compose.yml << 'SUPABASE_COMPOSE'
version: '3.8'

services:
  db:
    image: supabase/postgres:15.1.0.117
    container_name: supabase-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: your-super-secret-and-long-postgres-password
      POSTGRES_DB: postgres
    volumes:
      - supabase-db-data:/var/lib/postgresql/data

  kong:
    image: kong:2.8.1
    container_name: supabase-kong
    restart: unless-stopped
    ports:
      - "8000:8000"
      - "8443:8443"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_PLUGINS: request-transformer,cors,key-auth,http-log
      KONG_DNS_ORDER: LAST,A,CNAME
    volumes:
      - ./kong.yml:/var/lib/kong/kong.yml:ro
    depends_on:
      - auth
      - rest
      - realtime
      - storage

  auth:
    image: supabase/gotrue:v2.99.0
    container_name: supabase-auth
    restart: unless-stopped
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: http://localhost:8000
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:root@db:5432/postgres
      GOTRUE_SITE_URL: http://localhost:8000
      GOTRUE_URI_ALLOW_LIST: "*"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_SMTP_ADMIN_EMAIL: admin@example.com
      GOTRUE_SMTP_HOST: inbucket
      GOTRUE_SMTP_PORT: 2500
      GOTRUE_SMTP_SENDER_NAME: admin@example.com
    depends_on:
      - db

  rest:
    image: postgrest/postgrest:v11.2.0
    container_name: supabase-rest
    restart: unless-stopped
    environment:
      PGRST_DB_URI: postgres://authenticator:root@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      PGRST_DB_USE_LEGACY_GUCS: "false"
    depends_on:
      - db

  realtime:
    image: supabase/realtime:v2.25.35
    container_name: supabase-realtime
    restart: unless-stopped
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: supabase_admin
      DB_PASSWORD: root
      DB_NAME: postgres
      DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      FLY_ALLOC_ID: fly123
      FLY_APP_NAME: realtime
      SECRET_KEY_BASE: UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq
      ERL_AFLAGS: -proto_dist inet_tcp
      ENABLE_TAILSCALE: "false"
      DNS_NODES: "''"
    depends_on:
      - db

  storage:
    image: supabase/storage-api:v0.43.11
    container_name: supabase-storage
    restart: unless-stopped
    environment:
      ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      SERVICE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      DATABASE_URL: postgres://supabase_storage_admin:root@db:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
    volumes:
      - supabase-storage-data:/var/lib/storage
    depends_on:
      - db
      - rest

  studio:
    image: supabase/studio:20231123-64a766a
    container_name: supabase-studio
    restart: unless-stopped
    ports:
      - "54323:3000"
    environment:
      SUPABASE_URL: http://kong:8000
      STUDIO_PG_META_URL: http://meta:8080
      SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      SUPABASE_SERVICE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

  meta:
    image: supabase/postgres-meta:v0.68.0
    container_name: supabase-meta
    restart: unless-stopped
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: db
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: root
    depends_on:
      - db

volumes:
  supabase-db-data:
  supabase-storage-data:

networks:
  default:
    name: supabase-network
SUPABASE_COMPOSE

print_status "Creazione configurazione Kong..."
cat > kong.yml << 'KONG_CONFIG'
_format_version: "2.1"

services:
  - name: auth-v1-open
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-open
        strip_path: true
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors

  - name: auth-v1-open-callback
    url: http://auth:9999/callback
    routes:
      - name: auth-v1-open-callback
        strip_path: true
        paths:
          - /auth/v1/callback
    plugins:
      - name: cors

  - name: auth-v1-open-authorize
    url: http://auth:9999/authorize
    routes:
      - name: auth-v1-open-authorize
        strip_path: true
        paths:
          - /auth/v1/authorize
    plugins:
      - name: cors

  - name: auth-v1
    _comment: "GoTrue: /auth/v1/* -> http://auth:9999/*"
    url: http://auth:9999/
    routes:
      - name: auth-v1-all
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors

  - name: rest-v1
    _comment: "PostgREST: /rest/v1/* -> http://rest:3000/*"
    url: http://rest:3000/
    routes:
      - name: rest-v1-all
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors

  - name: realtime-v1
    _comment: "Realtime: /realtime/v1/* -> ws://realtime:4000/socket/*"
    url: http://realtime:4000/socket/
    routes:
      - name: realtime-v1-all
        strip_path: true
        paths:
          - /realtime/v1/
    plugins:
      - name: cors

  - name: storage-v1
    _comment: "Storage: /storage/v1/* -> http://storage:5000/*"
    url: http://storage:5000/
    routes:
      - name: storage-v1-all
        strip_path: true
        paths:
          - /storage/v1/
    plugins:
      - name: cors

plugins:
  - name: cors
    config:
      origins:
        - "*"
      methods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Authorization
        - Content-Type
        - X-Client-Info
        - apikey
      exposed_headers:
        - X-Total-Count
      credentials: true
      max_age: 3600
KONG_CONFIG

print_status "Avvio Supabase locale..."
docker compose up -d

print_status "Attesa avvio servizi Supabase (60 secondi)..."
sleep 60

# Verifica che i servizi siano avviati
if docker ps | grep -q "supabase-db"; then
    print_status "Supabase avviato correttamente"
else
    print_error "Errore nell'avvio di Supabase"
    docker compose logs
    exit 1
fi

print_status "Supabase locale configurato su:"
print_info "  • API: http://localhost:8000"
print_info "  • Studio: http://localhost:54323"
print_info "  • DB: postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5432/postgres"

# ============================================================================
# FASE 6: INSTALLAZIONE MEGATOOLS (se richiesto)
# ============================================================================

if [[ $SETUP_MEGA =~ ^[Yy]$ ]]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║  FASE 6: Installazione Megatools                              ║"
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
# FASE 7: CLONE E BUILD APP
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 7: Download e Build App                                 ║"
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

print_status "Configurazione client Supabase per uso locale..."

# Modifica client.ts per usare Supabase locale
cat > $APP_DIR/src/integrations/supabase/client.ts << 'EOF'
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Use local Supabase instance - detect if accessing via localhost or remote IP
const getSupabaseUrl = () => {
  const hostname = window.location.hostname;
  // If accessing via localhost, use localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return "http://localhost:8000";
  }
  // If accessing via remote IP or .local domain, use that IP/hostname
  return `http://${hostname}:8000`;
};

const SUPABASE_URL = getSupabaseUrl();
// Default Supabase local ANON key
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
EOF

print_status "Build applicazione..."
npm run build

# ============================================================================
# FASE 8: CONFIGURAZIONE mDNS per dominio .local
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
# FASE 9: GENERAZIONE CERTIFICATI SSL
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 9: Generazione certificati SSL                          ║"
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
# FASE 10: CONFIGURAZIONE NGINX
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 10: Configurazione Nginx                                ║"
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
    
    # Proxy Supabase API
    location ~* ^/supabase/(.*) {
        proxy_pass http://localhost:8000/\$1;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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
# FASE 11: CONFIGURAZIONE FIREWALL
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 11: Configurazione Firewall                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_status "Configurazione firewall..."

sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5353/udp  # mDNS
sudo ufw allow 8000/tcp  # Supabase API
sudo ufw allow 54323/tcp # Supabase Studio

print_status "Firewall configurato"

# ============================================================================
# FASE 12: SCRIPT DI GESTIONE
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  FASE 12: Creazione script di gestione                        ║"
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

# Riavvia servizi
sudo systemctl reload nginx

# Riavvia Supabase se necessario
cd $HOME/supabase-local && docker compose restart

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
echo "🗄️  Supabase:"
cd $HOME/supabase-local && docker compose ps

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

🗄️  SUPABASE LOCALE:
   • API:    http://${IP_ADDRESS}:8000
   • Studio: http://${IP_ADDRESS}:54323
   • DB:     postgresql://postgres:your-super-secret-and-long-postgres-password@${IP_ADDRESS}:5432/postgres

🔧 FUNZIONALITÀ INSTALLATE:
   ✓ App HACCP completa
   ✓ Supabase locale (database, auth, storage, realtime)
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
   • Restart Supabase:    cd ~/supabase-local && docker compose restart
   • Visualizza log:      sudo journalctl -u nginx -f
   • Log Supabase:        cd ~/supabase-local && docker compose logs -f

⚠️  NOTE IMPORTANTI:
   1. Il certificato SSL è self-signed, il browser mostrerà un avviso
      (clicca "Avanzate" > "Procedi comunque")
   2. Per accedere da altri dispositivi nella rete:
      - Accetta il certificato nel browser
      - Oppure usa http://${IP_ADDRESS} (senza HTTPS)
   3. Supabase Studio: http://${IP_ADDRESS}:54323
      (lascia le credenziali vuote per accedere)
   4. Per riavvio completo esegui: sudo reboot

📚 CREDENZIALI SUPABASE LOCALE:
   • ANON KEY:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   • SERVICE KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   • DB PASSWORD: your-super-secret-and-long-postgres-password
   
📝 PROSSIMI PASSI:
   1. Accedi a Supabase Studio: http://${IP_ADDRESS}:54323
   2. Esegui le migrations del progetto
   3. Crea il primo utente admin nell'app
   
📚 DOCUMENTAZIONE:
   • Repository GitHub:  $GITHUB_REPO
   • Supabase Docs:      https://supabase.com/docs

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
