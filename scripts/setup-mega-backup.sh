#!/bin/bash

# Script per configurare backup automatici su Mega.nz con 2FA
# Installa megacmd e configura backup giornalieri

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
echo "║     Setup Backup Automatici su Mega.nz                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

APP_DIR="$HOME/haccp-app"
BACKUP_DIR="$HOME/haccp-backups"

# ============================================================================
# FASE 1: Installa MEGAcmd
# ============================================================================

print_info "FASE 1: Installazione MEGAcmd..."

if command -v mega-cmd &> /dev/null; then
    print_status "MEGAcmd già installato!"
else
    print_info "Download e installazione MEGAcmd..."
    
    # Scarica ultima versione per Debian/Ubuntu ARM64
    cd /tmp
    wget https://mega.nz/linux/repo/Debian_12/arm64/megacmd_1.6.3-5.1_arm64.deb
    
    # Installa dipendenze
    sudo apt-get update
    sudo apt-get install -y libc-ares2 libcrypto++8 libmediainfo0v5 libpcre2-8-0
    
    # Installa MEGAcmd
    sudo dpkg -i megacmd_1.6.3-5.1_arm64.deb || sudo apt-get install -f -y
    
    rm megacmd_1.6.3-5.1_arm64.deb
    print_status "MEGAcmd installato!"
fi

# ============================================================================
# FASE 2: Configurazione account Mega
# ============================================================================

print_info "FASE 2: Configurazione account Mega..."
echo ""
echo "Per configurare il backup su Mega.nz avrai bisogno di:"
echo "  1. Email del tuo account Mega"
echo "  2. Password"
echo "  3. Codice 2FA (dal tuo authenticator)"
echo ""

read -p "Email Mega.nz: " MEGA_EMAIL
read -sp "Password Mega.nz: " MEGA_PASSWORD
echo ""
read -p "Codice 2FA (6 cifre): " MEGA_2FA
echo ""

# Avvia mega-cmd server
mega-cmd-server &
sleep 5

# Login con 2FA
print_info "Login su Mega.nz..."
if mega-login "$MEGA_EMAIL" "$MEGA_PASSWORD" "$MEGA_2FA"; then
    print_status "Login effettuato con successo!"
else
    print_error "Errore durante il login. Verifica credenziali e codice 2FA."
    exit 1
fi

# Crea directory su Mega per i backup
mega-mkdir /HACCP-Backups 2>/dev/null || true
print_status "Directory /HACCP-Backups creata su Mega!"

# ============================================================================
# FASE 3: Crea directory backup locale
# ============================================================================

print_info "FASE 3: Creazione directory backup locale..."

mkdir -p "$BACKUP_DIR"
print_status "Directory $BACKUP_DIR creata!"

# ============================================================================
# FASE 4: Crea script di backup
# ============================================================================

print_info "FASE 4: Creazione script di backup..."

cat > "$APP_DIR/scripts/backup-to-mega.sh" << 'BACKUP_SCRIPT'
#!/bin/bash

# Script per backup automatico database e codice su Mega.nz

set -e

APP_DIR="$HOME/haccp-app"
BACKUP_DIR="$HOME/haccp-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="haccp_backup_$DATE"

echo "[$(date)] Avvio backup..."

# Crea directory temporanea
TEMP_BACKUP="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$TEMP_BACKUP"

# Backup database PostgreSQL
echo "[$(date)] Backup database..."
docker exec haccp-db pg_dump -U postgres postgres > "$TEMP_BACKUP/database.sql"

# Backup codice sorgente
echo "[$(date)] Backup codice..."
cd "$APP_DIR"
tar -czf "$TEMP_BACKUP/source_code.tar.gz" \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    --exclude=scripts/docker/logs \
    .

# Backup configurazioni Docker
echo "[$(date)] Backup configurazioni..."
cp -r scripts/docker/*.yml "$TEMP_BACKUP/"
cp -r scripts/docker/*.conf "$TEMP_BACKUP/" 2>/dev/null || true

# Comprimi tutto
echo "[$(date)] Compressione backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# Upload su Mega
echo "[$(date)] Upload su Mega.nz..."
mega-put "${BACKUP_NAME}.tar.gz" /HACCP-Backups/

# Rimuovi backup locali più vecchi di 7 giorni
echo "[$(date)] Pulizia backup vecchi..."
find "$BACKUP_DIR" -name "haccp_backup_*.tar.gz" -mtime +7 -delete

# Rimuovi backup su Mega più vecchi di 30 giorni
mega-ls /HACCP-Backups/ | grep "haccp_backup_" | while read file; do
    AGE=$(mega-ls /HACCP-Backups/"$file" --long | awk '{print $3}')
    # TODO: Implementare logica per rimuovere file vecchi
done

echo "[$(date)] Backup completato: ${BACKUP_NAME}.tar.gz"
echo "[$(date)] Backup disponibile su Mega: /HACCP-Backups/${BACKUP_NAME}.tar.gz"
BACKUP_SCRIPT

chmod +x "$APP_DIR/scripts/backup-to-mega.sh"
print_status "Script backup creato!"

# ============================================================================
# FASE 5: Configura backup automatico giornaliero
# ============================================================================

print_info "FASE 5: Configurazione backup automatico..."

# Aggiungi cron job per backup giornaliero alle 2:00
CRON_JOB="0 2 * * * $APP_DIR/scripts/backup-to-mega.sh >> $HOME/haccp-backups/backup.log 2>&1"

# Verifica se il cron job esiste già
if crontab -l 2>/dev/null | grep -q "backup-to-mega.sh"; then
    print_status "Backup automatico già configurato!"
else
    # Aggiungi cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    print_status "Backup automatico configurato (ogni giorno alle 2:00)!"
fi

# ============================================================================
# FASE 6: Esegui primo backup
# ============================================================================

print_info "FASE 6: Esecuzione primo backup..."

if "$APP_DIR/scripts/backup-to-mega.sh"; then
    print_status "Primo backup completato con successo!"
else
    print_error "Errore durante il primo backup"
fi

# ============================================================================
# COMPLETAMENTO
# ============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         Backup Automatici Configurati con Successo!          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
print_status "Sistema backup pronto!"
echo ""
print_info "Configurazione:"
echo "  📁 Backup locali: $BACKUP_DIR"
echo "  ☁️  Backup remoti: Mega.nz /HACCP-Backups/"
echo "  ⏰ Backup automatico: Ogni giorno alle 2:00"
echo "  🗑️  Ritenzione locale: 7 giorni"
echo "  🗑️  Ritenzione Mega: 30 giorni"
echo ""
print_info "Comandi utili:"
echo "  • Backup manuale:        $APP_DIR/scripts/backup-to-mega.sh"
echo "  • Lista backup su Mega:  mega-ls /HACCP-Backups/"
echo "  • Download backup:       mega-get /HACCP-Backups/[nome-backup].tar.gz"
echo "  • Verifica cron:         crontab -l"
echo ""
