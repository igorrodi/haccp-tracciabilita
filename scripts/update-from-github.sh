#!/bin/bash

# Script per aggiornare Tracker HACCP da GitHub
# Compatibile con installazione PocketBase su Raspberry Pi

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
echo "║        Aggiornamento Tracker HACCP da GitHub                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Configurazione
APP_NAME="trackerhaccp"
APP_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
REPO_URL="https://github.com/igorrodi/haccp-tracciabilita.git"

# ============================================================================
# FASE 1: Backup prima dell'aggiornamento
# ============================================================================

print_info "FASE 1: Backup pre-aggiornamento..."

if command -v ${APP_NAME}-backup &> /dev/null; then
    print_info "Esecuzione backup di sicurezza..."
    ${APP_NAME}-backup
    print_status "Backup completato!"
else
    print_info "Creazione backup manuale..."
    BACKUP_FILE="/var/backups/${APP_NAME}/${APP_NAME}-pre-update-$(date +%Y%m%d-%H%M%S).tar.gz"
    mkdir -p /var/backups/${APP_NAME}
    if [ -d "$DATA_DIR/pb_data" ]; then
        sudo systemctl stop ${APP_NAME} 2>/dev/null || true
        sudo tar -czf "$BACKUP_FILE" -C "$DATA_DIR" pb_data
        sudo systemctl start ${APP_NAME} 2>/dev/null || true
        print_status "Backup creato: $BACKUP_FILE"
    fi
fi

# ============================================================================
# FASE 2: Download aggiornamenti da GitHub
# ============================================================================

print_info "FASE 2: Download aggiornamenti da GitHub..."

cd /tmp
rm -rf ${APP_NAME}-update-src
git clone --depth 1 "$REPO_URL" ${APP_NAME}-update-src

print_status "Codice scaricato!"

# ============================================================================
# FASE 3: Build applicazione
# ============================================================================

print_info "FASE 3: Build applicazione..."

cd /tmp/${APP_NAME}-update-src

# Installa dipendenze e build
print_info "Installazione dipendenze npm..."
npm ci --silent 2>/dev/null || npm install --silent

print_info "Build frontend..."
npm run build

print_status "Build completata!"

# ============================================================================
# FASE 4: Deploy nuova versione
# ============================================================================

print_info "FASE 4: Deploy nuova versione..."

# Copia nuovi file
sudo rm -rf ${APP_DIR}/www/*
sudo cp -r dist/* ${APP_DIR}/www/

# Aggiorna schema PocketBase se presente
if [ -f "scripts/pocketbase/pb_schema.json" ]; then
    sudo cp scripts/pocketbase/pb_schema.json ${DATA_DIR}/
    print_info "Schema PocketBase aggiornato"
fi

print_status "File aggiornati!"

# ============================================================================
# FASE 5: Riavvio servizi
# ============================================================================

print_info "FASE 5: Riavvio servizi..."

# Riavvia PocketBase (se in esecuzione)
if systemctl is-active --quiet ${APP_NAME}; then
    sudo systemctl restart ${APP_NAME}
    print_status "PocketBase riavviato!"
fi

# Ricarica Nginx
sudo systemctl reload nginx 2>/dev/null || true

# ============================================================================
# FASE 6: Pulizia
# ============================================================================

print_info "FASE 6: Pulizia file temporanei..."

cd /
rm -rf /tmp/${APP_NAME}-update-src

print_status "Pulizia completata!"

# ============================================================================
# FASE 7: Verifica finale
# ============================================================================

print_info "FASE 7: Verifica finale..."

# Attendi avvio
sleep 2

# Verifica servizio PocketBase
if systemctl is-active --quiet ${APP_NAME}; then
    print_status "PocketBase in esecuzione!"
else
    print_error "PocketBase non risponde!"
    sudo journalctl -u ${APP_NAME} --no-pager -n 5
fi

# Test connessione app
if curl -sk -o /dev/null -w "%{http_code}" https://localhost 2>/dev/null | grep -q "200\|301\|302"; then
    print_status "App funzionante!"
elif curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null | grep -q "200\|301\|302"; then
    print_status "App funzionante (HTTP)!"
else
    print_info "App potrebbe richiedere qualche secondo per rispondere"
fi

# ============================================================================
# COMPLETAMENTO
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         Aggiornamento Completato con Successo!                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
print_status "Tracker HACCP aggiornato all'ultima versione!"
echo ""
print_info "Accesso:"
echo "  🌐 App HACCP:      https://${APP_NAME}.local"
echo "  ⚙️  Admin PocketBase: https://${APP_NAME}.local/_/"
echo ""
print_info "Comandi utili:"
echo "  • Stato sistema:   ${APP_NAME}-status"
echo "  • Backup manuale:  ${APP_NAME}-backup"
echo "  • Log PocketBase:  sudo journalctl -u ${APP_NAME} -f"
echo ""
