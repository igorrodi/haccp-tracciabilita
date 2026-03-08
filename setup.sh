#!/bin/bash
#
# Tracker HACCP - Docker Setup
# Esegui: chmod +x setup.sh && sudo ./setup.sh
#
set -euo pipefail

echo "━━━ Tracker HACCP Setup ━━━"

# Installa Docker se mancante
if ! command -v docker &>/dev/null; then
    echo "Installazione Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

# Crea cartella dati
mkdir -p pb_data

# Build e avvio
echo "Build e avvio container..."
docker compose up -d --build

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✓ Tracker HACCP attivo"
echo "  App:   http://${IP}"
echo "  Admin: http://${IP}/_/"
