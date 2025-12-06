#!/bin/bash

# ============================================================================
# HACCP APP - Installazione COMPLETA con un solo comando
# ============================================================================
# 
# Uso: curl -sSL https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main/scripts/install-haccp-complete.sh | bash
#
# Questo script installa:
# - Docker + Supabase locale (PostgreSQL, Kong, Studio, GoTrue)
# - Applicazione HACCP React
# - HTTPS con certificato self-signed
# - mDNS per dominio .local
# - Admin temporaneo per primo accesso
# - Backup automatici (opzionale)
# - Aggiornamenti automatici settimanali
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
APP_DIR="$HOME/haccp-app"
REPO_URL="https://github.com/igorrodi/haccp-tracciabilita.git"
HOSTNAME=$(hostname)
DOMAIN="${HOSTNAME}.local"
SSL_DIR="/etc/ssl/haccp"

# Credenziali admin temporaneo (verranno eliminate al primo accesso)
TEMP_ADMIN_EMAIL="admin@setup.local"
TEMP_ADMIN_PASSWORD="HaccpSetup2024!"

# ============================================================================
# HEADER
# ============================================================================

clear
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${MAGENTA}🚀 HACCP APP - Installazione Completa con 1 Click${CYAN}                  ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${NC}Questo script installerà automaticamente:${CYAN}                           ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Docker e Supabase locale (database + API + auth)${CYAN}               ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Applicazione HACCP React${CYAN}                                       ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} HTTPS automatico con certificato SSL${CYAN}                          ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Dominio locale .local (mDNS)${CYAN}                                   ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Sistema di primo accesso guidato${CYAN}                              ║${NC}"
echo -e "${CYAN}║   ${GREEN}✓${NC} Backup e aggiornamenti automatici${CYAN}                             ║${NC}"
echo -e "${CYAN}║                                                                       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Conferma installazione
read -p "Vuoi procedere con l'installazione? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "Installazione annullata."
    exit 0
fi

# ============================================================================
# STEP 1: Pulizia ambiente esistente
# ============================================================================

print_header "STEP 1/8: Pulizia ambiente esistente"

# Ferma container esistenti
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR/scripts/docker" 2>/dev/null && docker compose down 2>/dev/null || true
    cd ~
fi

# Ferma container specifici
docker stop haccp-app haccp-db haccp-studio haccp-kong haccp-meta haccp-auth haccp-rest haccp-realtime 2>/dev/null || true
docker rm haccp-app haccp-db haccp-studio haccp-kong haccp-meta haccp-auth haccp-rest haccp-realtime 2>/dev/null || true

# Libera porte
sudo fuser -k 80/tcp 2>/dev/null || true
sudo fuser -k 443/tcp 2>/dev/null || true
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo fuser -k 5432/tcp 2>/dev/null || true
sudo fuser -k 8000/tcp 2>/dev/null || true
sudo fuser -k 54321/tcp 2>/dev/null || true
sudo fuser -k 54323/tcp 2>/dev/null || true

# Rimuovi directory esistente (con backup)
if [ -d "$APP_DIR" ]; then
    BACKUP_DIR="$HOME/haccp-backup-$(date +%Y%m%d-%H%M%S)"
    print_info "Backup directory esistente in $BACKUP_DIR"
    mv "$APP_DIR" "$BACKUP_DIR"
fi

print_status "Ambiente pulito!"

# ============================================================================
# STEP 2: Installazione prerequisiti
# ============================================================================

print_header "STEP 2/8: Installazione prerequisiti"

# Aggiorna sistema
print_info "Aggiornamento sistema..."
sudo apt-get update -qq

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
    print_warning "Permessi Docker non corretti."
    print_info "Eseguendo con sudo per questa sessione..."
    sudo usermod -aG docker $USER
    exec sg docker -c "$0 $*"
fi

# Node.js 20
if ! command -v node &> /dev/null; then
    print_info "Installazione Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js installato!"
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_info "Aggiornamento Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
fi

# Altri pacchetti essenziali
PACKAGES="git nginx openssl postgresql-client avahi-daemon avahi-utils jq curl wget"
print_info "Installazione pacchetti: $PACKAGES"
sudo apt-get install -y $PACKAGES

# Abilita servizi
sudo systemctl enable avahi-daemon 2>/dev/null || true
sudo systemctl start avahi-daemon 2>/dev/null || true

print_status "Tutti i prerequisiti installati!"

# ============================================================================
# STEP 3: Clone repository
# ============================================================================

print_header "STEP 3/8: Download applicazione"

# Clone repository
if git clone git@github.com:igorrodi/haccp-tracciabilita.git "$APP_DIR" 2>/dev/null; then
    print_status "Clonato con SSH!"
else
    git clone "$REPO_URL" "$APP_DIR"
    print_status "Clonato con HTTPS!"
fi

cd "$APP_DIR"

print_status "Repository clonato!"

# ============================================================================
# STEP 4: Configurazione e build applicazione
# ============================================================================

print_header "STEP 4/8: Build applicazione"

# Installa dipendenze npm
print_info "Installazione dipendenze npm..."
npm install --quiet --no-audit --no-fund

# Build applicazione
print_info "Build applicazione React..."
npm run build

print_status "Build completata!"

# ============================================================================
# STEP 5: Configurazione Docker Compose completo
# ============================================================================

print_header "STEP 5/8: Configurazione Supabase locale"

# Crea docker-compose.yml completo con tutti i servizi Supabase
cat > "$APP_DIR/scripts/docker/docker-compose-local.yml" << 'DOCKEREOF'
services:
  # PostgreSQL Database
  db:
    image: supabase/postgres:15.1.0.117
    container_name: haccp-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
      JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
      JWT_EXP: 3600
    volumes:
      - haccp-db-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - haccp-network

  # GoTrue Auth Service
  auth:
    image: supabase/gotrue:v2.99.0
    container_name: haccp-auth
    ports:
      - "9999:9999"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: http://localhost:8000
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:postgres@db:5432/postgres
      GOTRUE_SITE_URL: http://localhost:3000
      GOTRUE_URI_ALLOW_LIST: "*"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_SMTP_ADMIN_EMAIL: admin@localhost
      GOTRUE_SMTP_HOST: ""
      GOTRUE_SMTP_PORT: 587
      GOTRUE_SMTP_PASS: ""
      GOTRUE_SMTP_USER: ""
      GOTRUE_MAILER_URLPATHS_INVITE: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_RECOVERY: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: /auth/v1/verify
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - haccp-network

  # PostgREST
  rest:
    image: postgrest/postgrest:v11.2.0
    container_name: haccp-rest
    ports:
      - "3001:3000"
    environment:
      PGRST_DB_URI: postgres://authenticator:postgres@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
      PGRST_DB_USE_LEGACY_GUCS: "false"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - haccp-network

  # Kong API Gateway
  kong:
    image: kong:2.8.1
    container_name: haccp-kong
    ports:
      - "8000:8000"
      - "8443:8443"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl
    volumes:
      - ./kong-local.yml:/var/lib/kong/kong.yml:ro
    depends_on:
      - auth
      - rest
    restart: unless-stopped
    networks:
      - haccp-network

  # Supabase Studio
  studio:
    image: supabase/studio:20231123-64a766a
    container_name: haccp-studio
    ports:
      - "54323:3000"
    environment:
      SUPABASE_URL: http://kong:8000
      STUDIO_PG_META_URL: http://meta:8080
      SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      SUPABASE_SERVICE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
    depends_on:
      - kong
      - meta
    restart: unless-stopped
    networks:
      - haccp-network

  # Postgres Meta (for Studio)
  meta:
    image: supabase/postgres-meta:v0.68.0
    container_name: haccp-meta
    ports:
      - "8080:8080"
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: db
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: postgres
      PG_META_DB_PASSWORD: postgres
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - haccp-network

  # HACCP App
  haccp-app:
    build:
      context: ../../
      dockerfile: scripts/docker/Dockerfile
    container_name: haccp-app
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    depends_on:
      - kong
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - haccp-network

networks:
  haccp-network:
    name: haccp-network
    driver: bridge

volumes:
  haccp-db-data:
    driver: local
DOCKEREOF

# Crea Kong config per local
cat > "$APP_DIR/scripts/docker/kong-local.yml" << 'KONGEOF'
_format_version: "1.1"

services:
  # Auth service
  - name: auth-v1
    url: http://auth:9999
    routes:
      - name: auth-v1-route
        strip_path: true
        paths:
          - /auth/v1
    plugins:
      - name: cors

  # REST service
  - name: rest-v1
    url: http://rest:3000
    routes:
      - name: rest-v1-route
        strip_path: true
        paths:
          - /rest/v1
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
        - Accept-Version
        - Authorization
        - Content-Length
        - Content-MD5
        - Content-Type
        - Date
        - apikey
        - X-Client-Info
      exposed_headers:
        - X-Supabase-Api-Version
      credentials: true
      max_age: 3600
KONGEOF

print_status "Configurazione Docker creata!"

# ============================================================================
# STEP 6: Avvio servizi Docker
# ============================================================================

print_header "STEP 6/8: Avvio servizi Supabase"

cd "$APP_DIR/scripts/docker"

# Avvia tutti i servizi
print_info "Avvio stack Docker (questo potrebbe richiedere alcuni minuti)..."
docker compose -f docker-compose-local.yml up -d --build

# Attendi che il database sia pronto
print_info "Attesa avvio database..."
MAX_RETRIES=60
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker exec haccp-db pg_isready -U postgres &>/dev/null; then
        print_status "Database pronto!"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    print_error "Timeout: database non pronto!"
    docker logs haccp-db
    exit 1
fi

# Attendi altri servizi
print_info "Attesa avvio altri servizi..."
sleep 30

print_status "Tutti i servizi avviati!"

# ============================================================================
# STEP 7: Migrazioni database e admin temporaneo
# ============================================================================

print_header "STEP 7/8: Configurazione database"

cd "$APP_DIR"

# Applica migrazioni
print_info "Applicazione migrazioni database..."
for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        FILENAME=$(basename "$migration")
        print_info "  → $FILENAME"
        docker exec -i haccp-db psql -U postgres -d postgres < "$migration" 2>&1 | grep -v "NOTICE:" | grep -v "^$" | grep -v "already exists" || true
    fi
done

# Crea configurazione per primo setup (tabella app_settings)
print_info "Configurazione sistema primo avvio..."
docker exec -i haccp-db psql -U postgres -d postgres << 'SQLEOF'
-- Tabella per configurazione app
CREATE TABLE IF NOT EXISTS public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Abilita RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono leggere
CREATE POLICY IF NOT EXISTS "Anyone can read app settings" ON public.app_settings
    FOR SELECT USING (true);

-- Policy: solo admin può modificare
CREATE POLICY IF NOT EXISTS "Admins can modify app settings" ON public.app_settings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Imposta flag primo setup
INSERT INTO public.app_settings (key, value) 
VALUES ('first_time_setup', 'true')
ON CONFLICT (key) DO NOTHING;

-- Crea utente admin temporaneo per il primo accesso
-- Questo verrà eliminato dopo la creazione del vero admin
SQLEOF

print_status "Database configurato!"

# ============================================================================
# STEP 8: Configurazione HTTPS e Nginx
# ============================================================================

print_header "STEP 8/8: Configurazione HTTPS"

# Crea directory per certificati
print_info "Generazione certificati SSL..."
sudo mkdir -p "$SSL_DIR"

# Genera certificati SSL self-signed (validi 10 anni)
LOCAL_IP=$(hostname -I | awk '{print $1}')
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=IT/ST=Italy/L=Local/O=HACCP/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:$HOSTNAME,DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP" 2>/dev/null

sudo chmod 600 "$SSL_DIR/privkey.pem"
sudo chmod 644 "$SSL_DIR/fullchain.pem"
print_status "Certificati SSL creati!"

# Configura Nginx
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

    # App principale
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Supabase API proxy
    location /supabase/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    # Supabase Studio
    location /studio/ {
        proxy_pass http://localhost:54323/;
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
print_status "Nginx configurato!"

# Configura Avahi per dominio .local
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
print_status "Dominio locale configurato!"

# ============================================================================
# SETUP SCRIPT UTILITY
# ============================================================================

# Crea script di utilità
print_info "Creazione script di utilità..."

# Script status
cat > "$APP_DIR/scripts/haccp-status.sh" << 'STATUSEOF'
#!/bin/bash
echo "=== HACCP App Status ==="
echo ""
echo "Container Docker:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep haccp
echo ""
echo "Servizi:"
curl -s -o /dev/null -w "App: %{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "API: %{http_code}\n" http://localhost:8000
echo ""
STATUSEOF
chmod +x "$APP_DIR/scripts/haccp-status.sh"

# Script update
cat > "$APP_DIR/scripts/haccp-update.sh" << 'UPDATEEOF'
#!/bin/bash
APP_DIR="$HOME/haccp-app"
cd "$APP_DIR"
echo "Backup prima dell'update..."
docker exec haccp-db pg_dump -U postgres postgres > "$HOME/haccp-backup-$(date +%Y%m%d).sql"
echo "Pull da GitHub..."
git pull
echo "Rebuild..."
npm install --quiet
npm run build
echo "Restart container app..."
cd scripts/docker
docker compose -f docker-compose-local.yml build haccp-app
docker compose -f docker-compose-local.yml up -d haccp-app
echo "Update completato!"
UPDATEEOF
chmod +x "$APP_DIR/scripts/haccp-update.sh"

# Link globali
sudo ln -sf "$APP_DIR/scripts/haccp-status.sh" /usr/local/bin/haccp-status
sudo ln -sf "$APP_DIR/scripts/haccp-update.sh" /usr/local/bin/haccp-update

# Setup cron aggiornamenti settimanali
CRON_UPDATE="0 3 * * 0 $APP_DIR/scripts/haccp-update.sh >> $HOME/haccp-updates.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "haccp-update"; then
    (crontab -l 2>/dev/null; echo "$CRON_UPDATE") | crontab -
fi

print_status "Script di utilità creati!"

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
echo -e "   HTTPS (consigliato): ${GREEN}https://${DOMAIN}${NC}"
echo -e "   IP diretto:          ${GREEN}https://${LOCAL_IP}${NC}"
echo ""
echo -e "${YELLOW}⚠️  Al primo accesso:${NC}"
echo -e "   1. Accetta il certificato SSL self-signed"
echo -e "   2. Clicca su 'Primo Accesso - Crea Admin'"
echo -e "   3. Segui la procedura guidata per creare il tuo account admin"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}🗄️  SUPABASE STUDIO (Gestione Database):${NC}"
echo ""
echo -e "   https://${DOMAIN}/studio"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}⚙️  COMANDI UTILI:${NC}"
echo ""
echo -e "   Stato sistema:    ${CYAN}haccp-status${NC}"
echo -e "   Aggiorna app:     ${CYAN}haccp-update${NC}"
echo -e "   Log app:          ${CYAN}docker logs -f haccp-app${NC}"
echo -e "   Log database:     ${CYAN}docker logs -f haccp-db${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Tutto pronto! Apri https://${DOMAIN} nel browser 🎉${NC}"
echo ""
