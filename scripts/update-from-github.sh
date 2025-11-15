#!/bin/bash

# Script per aggiornare l'applicazione da GitHub
# Esegue pull, rebuild e riavvio automatico

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
echo "║     Aggiornamento HACCP App da GitHub                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

APP_DIR="$HOME/haccp-app"

# ============================================================================
# FASE 1: Backup prima dell'aggiornamento
# ============================================================================

print_info "FASE 1: Backup pre-aggiornamento..."

if [ -f "$APP_DIR/scripts/backup-to-mega.sh" ]; then
    print_info "Esecuzione backup di sicurezza..."
    "$APP_DIR/scripts/backup-to-mega.sh"
    print_status "Backup completato!"
else
    print_info "Script backup non trovato, continuo senza backup..."
fi

# ============================================================================
# FASE 2: Pull da GitHub
# ============================================================================

print_info "FASE 2: Download aggiornamenti da GitHub..."

cd "$APP_DIR"

# Salva modifiche locali (se presenti)
if [ -n "$(git status --porcelain)" ]; then
    print_info "Salvataggio modifiche locali..."
    git stash push -m "Auto-stash before update $(date +%Y%m%d_%H%M%S)"
fi

# Pull da GitHub
print_info "Pull da GitHub..."
git pull origin main

print_status "Codice aggiornato!"

# ============================================================================
# FASE 3: Aggiorna dipendenze
# ============================================================================

print_info "FASE 3: Aggiornamento dipendenze..."

if [ -f "package.json" ]; then
    print_info "Installazione nuove dipendenze npm..."
    npm install --quiet
    print_status "Dipendenze aggiornate!"
fi

# ============================================================================
# FASE 4: Applica nuove migrazioni database
# ============================================================================

print_info "FASE 4: Verifica nuove migrazioni database..."

if [ -d "supabase/migrations" ]; then
    print_info "Applicazione migrazioni..."
    
    # Ottieni ID container database
    DB_CONTAINER=$(docker compose -f scripts/docker/docker-compose.yml ps -q db)
    
    if [ -n "$DB_CONTAINER" ]; then
        # Applica ogni migrazione
        for migration in supabase/migrations/*.sql; do
            if [ -f "$migration" ]; then
                FILENAME=$(basename "$migration")
                print_info "Applico: $FILENAME"
                
                docker exec -i "$DB_CONTAINER" \
                    psql -U postgres -d postgres < "$migration" 2>&1 | grep -v "NOTICE:" | grep -v "^$" || true
            fi
        done
        print_status "Migrazioni applicate!"
    else
        print_error "Database non in esecuzione!"
    fi
fi

# ============================================================================
# FASE 5: Rebuild applicazione
# ============================================================================

print_info "FASE 5: Rebuild applicazione..."

# Build frontend
print_info "Build frontend..."
npm run build

# Rebuild immagine Docker
print_info "Rebuild immagine Docker..."
docker build -t haccp-app:latest -f scripts/docker/Dockerfile .

print_status "Build completata!"

# ============================================================================
# FASE 6: Riavvio servizi
# ============================================================================

print_info "FASE 6: Riavvio servizi..."

cd scripts/docker

# Ferma app
print_info "Stop container app..."
docker stop haccp-app 2>/dev/null || true
docker rm haccp-app 2>/dev/null || true

# Riavvia con docker-compose
print_info "Avvio nuova versione..."
docker compose up -d

# Attendi che l'app sia pronta
print_info "Attesa avvio app (10 secondi)..."
sleep 10

# Verifica che sia in esecuzione
if docker ps | grep -q "haccp-app"; then
    print_status "App riavviata con successo!"
else
    print_error "Errore avvio app!"
    docker logs haccp-app
    exit 1
fi

# ============================================================================
# FASE 7: Verifica finale
# ============================================================================

print_info "FASE 7: Verifica finale..."

# Test connessione app
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
echo "║         Aggiornamento Completato con Successo!               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
print_status "HACCP App aggiornata all'ultima versione!"
echo ""
print_info "Versione corrente:"
git log -1 --oneline
echo ""
print_info "Servizi disponibili:"
echo "  🌐 App HACCP: http://localhost:3000"
echo "  🗄️  Supabase Studio: http://localhost:54323"
echo ""
print_info "Comandi utili:"
echo "  • Visualizza log:  docker logs -f haccp-app"
echo "  • Riavvia app:     docker restart haccp-app"
echo "  • Verifica stato:  docker ps"
echo ""
