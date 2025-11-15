#!/bin/bash

# Script per configurare SSH per GitHub sul Raspberry Pi

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Setup SSH per GitHub - Raspberry Pi                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Verifica se esiste già una chiave SSH
if [ -f "$HOME/.ssh/id_ed25519" ] || [ -f "$HOME/.ssh/id_rsa" ]; then
    print_info "Chiave SSH già esistente trovata"
    
    if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
        SSH_KEY="$HOME/.ssh/id_ed25519.pub"
    else
        SSH_KEY="$HOME/.ssh/id_rsa.pub"
    fi
    
    echo ""
    print_status "La tua chiave pubblica SSH è:"
    echo ""
    echo "=========================================="
    cat "$SSH_KEY"
    echo "=========================================="
    echo ""
else
    # Crea nuova chiave SSH
    print_info "Generazione nuova chiave SSH..."
    
    read -p "Inserisci la tua email GitHub: " GITHUB_EMAIL
    
    ssh-keygen -t ed25519 -C "$GITHUB_EMAIL" -f "$HOME/.ssh/id_ed25519" -N ""
    
    print_status "Chiave SSH creata!"
    
    SSH_KEY="$HOME/.ssh/id_ed25519.pub"
    
    echo ""
    print_status "La tua chiave pubblica SSH è:"
    echo ""
    echo "=========================================="
    cat "$SSH_KEY"
    echo "=========================================="
    echo ""
fi

# Avvia ssh-agent e aggiungi la chiave
print_info "Configurazione ssh-agent..."
eval "$(ssh-agent -s)"
ssh-add "$HOME/.ssh/id_ed25519" 2>/dev/null || ssh-add "$HOME/.ssh/id_rsa" 2>/dev/null

print_status "ssh-agent configurato!"

# Istruzioni per aggiungere la chiave a GitHub
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           AGGIUNGI LA CHIAVE A GITHUB                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
print_info "1. Copia la chiave pubblica mostrata sopra"
print_info "2. Vai su: https://github.com/settings/ssh/new"
print_info "3. Incolla la chiave nel campo 'Key'"
print_info "4. Dai un nome (es: 'raspberry-pi')"
print_info "5. Clicca 'Add SSH key'"
echo ""

read -p "Premi INVIO quando hai aggiunto la chiave a GitHub..." 

# Test connessione
print_info "Test connessione a GitHub..."
echo ""

if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    print_status "Connessione GitHub OK! ✅"
    echo ""
    print_status "Ora puoi eseguire: ./setup-app-with-local-supabase.sh"
else
    print_error "Connessione fallita"
    print_info "Verifica di aver aggiunto correttamente la chiave su GitHub"
    echo ""
    print_info "Riprova il test con: ssh -T git@github.com"
fi

echo ""
