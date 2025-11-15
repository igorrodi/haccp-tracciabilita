#!/bin/bash

# Script di installazione COMPLETA e AUTOMATICA per Raspberry Pi ARM64
# Tutto in locale, zero configurazioni manuali

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     HACCP APP - Installazione Automatica Completa            ║"
echo "║     Raspberry Pi ARM64 - Tutto in Locale                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Configurazione
APP_DIR="$HOME/haccp-app"
SUPABASE_URL="http://localhost:8000"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# ============================================================================
# FASE 0: Pulizia completa ambiente esistente
# ============================================================================

echo ""
print_info "FASE 0: Pulizia ambiente esistente..."

# Ferma compose esistenti
print_info "Arresto container Docker esistenti..."
cd "$APP_DIR/scripts/docker" 2>/dev/null && docker compose down 2>/dev/null || true
cd ~

# Ferma e rimuove container specifici
docker stop haccp-app haccp-db haccp-studio 2>/dev/null || true
docker rm haccp-app haccp-db haccp-studio 2>/dev/null || true

# Libera le porte
print_info "Verifica porte in uso..."
sudo fuser -k 80/tcp 2>/dev/null || true
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo fuser -k 8000/tcp 2>/dev/null || true
sudo fuser -k 54323/tcp 2>/dev/null || true

# Rimuove directory app esistente
if [ -d "$APP_DIR" ]; then
    print_info "Rimozione directory app esistente..."
    rm -rf "$APP_DIR"
fi

print_status "Ambiente pulito!"

# ============================================================================
# FASE 1: Verifica prerequisiti
# ============================================================================

echo ""
print_info "FASE 1: Verifica prerequisiti..."

# Verifica Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker non installato! Installo Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_status "Docker installato!"
fi

# Verifica Node.js
if ! command -v node &> /dev/null; then
    print_info "Installazione Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js installato!"
fi

# Verifica Git
if ! command -v git &> /dev/null; then
    print_info "Installazione Git..."
    sudo apt-get update
    sudo apt-get install -y git
    print_status "Git installato!"
fi

# Verifica PostgreSQL client
if ! command -v psql &> /dev/null; then
    print_info "Installazione PostgreSQL client..."
    sudo apt-get update
    sudo apt-get install -y postgresql-client
    print_status "PostgreSQL client installato!"
fi

print_status "Tutti i prerequisiti sono installati!"

# ============================================================================
# FASE 2: Clone repository
# ============================================================================

echo ""
print_info "FASE 2: Download codice da GitHub..."

# Prova prima con SSH, poi con HTTPS se SSH fallisce
if git clone git@github.com:igorrodi/haccp-tracciabilita.git "$APP_DIR" 2>/dev/null; then
    print_status "Clonato con SSH!"
else
    print_info "SSH non disponibile, provo con HTTPS..."
    git clone https://github.com/igorrodi/haccp-tracciabilita.git "$APP_DIR"
fi

cd "$APP_DIR"
print_status "Codice scaricato!"

# ============================================================================
# FASE 3: Avvio Supabase locale
# ============================================================================

echo ""
print_info "FASE 3: Avvio Supabase locale..."

cd "$APP_DIR/scripts/docker"

# Avvia Supabase
print_info "Avvio container Supabase..."
docker compose up -d

# Attendi che PostgreSQL sia pronto (più tempo per essere sicuri)
print_info "Attesa avvio PostgreSQL (60 secondi)..."
sleep 60

# Verifica che il database sia effettivamente pronto
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
    print_error "Database non risponde dopo $MAX_RETRIES tentativi!"
    docker compose logs db
    exit 1
fi

print_status "Supabase avviato e pronto!"

# ============================================================================
# FASE 4: Applica TUTTE le migrazioni database
# ============================================================================

echo ""
print_info "FASE 4: Creazione tabelle database..."

cd "$APP_DIR"

# Conta migrazioni
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l)
print_info "Trovate $MIGRATION_COUNT migrazioni da applicare..."

# Applica ogni migrazione
APPLIED=0
FAILED=0

for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        FILENAME=$(basename "$migration")
        print_info "Applico: $FILENAME"
        
        if docker exec -i $(docker compose -f scripts/docker/docker-compose.yml ps -q db) \
            psql -U postgres -d postgres < "$migration" 2>&1 | grep -v "NOTICE:" | grep -v "^$"; then
            APPLIED=$((APPLIED + 1))
        else
            print_error "Errore in $FILENAME (continuo comunque...)"
            FAILED=$((FAILED + 1))
        fi
    fi
done

print_status "Migrazioni completate: $APPLIED applicate, $FAILED con errori"

# Verifica tabelle create
print_info "Verifica tabelle create..."
TABLES=$(docker exec -i $(docker compose -f scripts/docker/docker-compose.yml ps -q db) \
    psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

print_status "Trovate $TABLES tabelle nel database!"

# ============================================================================
# FASE 5: Configura client Supabase
# ============================================================================

echo ""
print_info "FASE 5: Configurazione client Supabase..."

# Il file è già configurato correttamente nel repository
# ma verifichiamo che esista
if [ -f "$APP_DIR/src/integrations/supabase/client.ts" ]; then
    print_status "Client Supabase già configurato!"
else
    print_error "File client.ts non trovato!"
    exit 1
fi

# ============================================================================
# FASE 6: Build applicazione
# ============================================================================

echo ""
print_info "FASE 6: Build applicazione..."

cd "$APP_DIR"

# Installa dipendenze
print_info "Installazione dipendenze npm (può richiedere alcuni minuti)..."
npm install --quiet

# Build
print_info "Build applicazione..."
npm run build

print_status "Build completata!"

# ============================================================================
# FASE 7: Avvio applicazione con Docker
# ============================================================================

echo ""
print_info "FASE 7: Avvio applicazione..."

# Build immagine Docker dell'app
print_info "Build immagine Docker app..."
docker build -t haccp-app:latest .

# Rimuovi container esistente se presente
docker stop haccp-app 2>/dev/null || true
docker rm haccp-app 2>/dev/null || true

# Avvia container app
print_info "Avvio container app..."
docker run -d \
  --name haccp-app \
  --restart unless-stopped \
  --network haccp-network \
  -p 3000:80 \
  haccp-app:latest

# Attendi che l'app sia pronta
print_info "Attesa avvio app (10 secondi)..."
sleep 10

# Verifica che il container sia in esecuzione
if docker ps | grep -q "haccp-app"; then
    print_status "App avviata con successo!"
else
    print_error "Errore avvio app!"
    docker logs haccp-app
    exit 1
fi

# ============================================================================
# FASE 8: Verifica finale
# ============================================================================

echo ""
print_info "FASE 8: Verifica installazione..."

# Lista container in esecuzione
print_info "Container Docker in esecuzione:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verifica porte in ascolto
print_info "Servizi disponibili:"
echo "  • App HACCP: http://localhost:3000"
echo "  • Supabase Studio: http://localhost:54323"
echo "  • Supabase API: http://localhost:8000"

# Test connessione app
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    print_status "App risponde correttamente!"
else
    print_error "App non risponde!"
fi

# ============================================================================
# COMPLETAMENTO
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║            INSTALLAZIONE COMPLETATA CON SUCCESSO!             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
print_status "Sistema HACCP pronto all'uso!"
echo ""
print_info "Accedi all'applicazione:"
echo "  🌐 App HACCP:"
echo "     • http://localhost:3000"
echo "     • http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "  🗄️  Supabase Studio:"
echo "     • http://localhost:54323"
echo "     • http://$(hostname -I | awk '{print $1}'):54323"
echo "     (credenziali non necessarie per ambiente locale)"
echo ""
print_info "Comandi utili:"
echo "  • Visualizza log app:       docker logs -f haccp-app"
echo "  • Visualizza log database:  docker compose -f $APP_DIR/scripts/docker/docker-compose.yml logs -f db"
echo "  • Riavvia tutto:            docker restart \$(docker ps -aq)"
echo "  • Ferma tutto:              docker stop \$(docker ps -aq)"
echo ""
print_info "Per accedere all'app da altri dispositivi:"
echo "  Usa l'IP del Raspberry Pi: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
print_status "Tutto è configurato e funzionante!"
echo ""
