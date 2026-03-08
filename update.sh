#!/bin/bash
#
# Tracker HACCP - Aggiornamento Automatico
# Usage: sudo /opt/haccp-tracker/update.sh
#
set -euo pipefail

readonly APP_DIR="/opt/haccp-tracker"
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -eq 0 ]] || log_error "Esegui come root: sudo ./update.sh"
cd "${APP_DIR}" || log_error "Cartella ${APP_DIR} non trovata"

echo "Aggiornamento Tracker HACCP..."

docker compose pull
log_ok "Immagine aggiornata"

docker compose up -d --remove-orphans
log_ok "Container riavviato"

docker image prune -f
log_ok "Immagini inutilizzate rimosse"

echo ""
log_ok "Aggiornamento completato"
