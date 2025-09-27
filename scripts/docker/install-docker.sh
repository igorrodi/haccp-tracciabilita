#!/bin/bash

# Script di installazione HACCP App tramite Docker
# Supporta Ubuntu, Debian, CentOS, e Raspberry Pi OS

set -e

echo "🐳 Avvio installazione HACCP App con Docker..."

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Verifica se è root
if [[ $EUID -eq 0 ]]; then
   print_warning "Script eseguito come root. Raccomandato eseguire come utente normale."
fi

# Rileva distribuzione
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        print_error "Non riesco a rilevare la distribuzione OS"
        exit 1
    fi
    print_status "OS rilevato: $OS $VERSION"
}

# Installa Docker
install_docker() {
    print_header "Installazione Docker"
    
    case $OS in
        ubuntu|debian|raspbian)
            # Aggiorna indice pacchetti
            sudo apt-get update
            
            # Installa dipendenze
            sudo apt-get install -y \
                apt-transport-https \
                ca-certificates \
                curl \
                gnupg \
                lsb-release
            
            # Aggiungi chiave GPG ufficiale Docker
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            
            # Configura repository
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Installa Docker Engine
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel|fedora)
            # Installa yum-utils
            sudo yum install -y yum-utils
            
            # Configura repository
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            
            # Installa Docker Engine
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        *)
            print_error "Distribuzione OS non supportata: $OS"
            exit 1
            ;;
    esac
}

# Configura Docker
setup_docker() {
    print_header "Configurazione Docker"
    
    # Avvia Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Aggiungi utente al gruppo docker
    sudo usermod -aG docker $USER
    
    # Configura Docker per Raspberry Pi (se necessario)
    if grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        print_status "Configurazione specifica per Raspberry Pi..."
        
        # Ottimizzazioni memoria
        echo '{"log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}, "storage-driver": "overlay2"}' | sudo tee /etc/docker/daemon.json > /dev/null
        
        sudo systemctl restart docker
    fi
    
    print_status "Docker installato e configurato!"
}

# Verifica installazione Docker
verify_docker() {
    print_header "Verifica installazione Docker"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker non installato correttamente"
        exit 1
    fi
    
    # Test Docker (potrebbe richiedere logout/login per permessi gruppo)
    if docker --version &> /dev/null; then
        print_status "✅ Docker version: $(docker --version)"
    else
        print_warning "Docker installato ma potrebbero servire permessi gruppo. Prova a disconnetterti e ricollegarti."
    fi
    
    if docker compose version &> /dev/null; then
        print_status "✅ Docker Compose version: $(docker compose version)"
    else
        print_warning "Docker Compose non disponibile"
    fi
}

# Deploy applicazione HACCP
deploy_haccp() {
    print_header "Deploy HACCP App"
    
    # Crea directory per il progetto
    DEPLOY_DIR="$HOME/haccp-app-docker"
    mkdir -p $DEPLOY_DIR
    cd $DEPLOY_DIR
    
    # Copia i file Docker necessari (assumendo che siano nella directory scripts/docker)
    if [ -d "../../scripts/docker" ]; then
        cp -r ../../scripts/docker/* .
        cp -r ../../* . 2>/dev/null || true
    else
        print_warning "File Docker non trovati. Assicurati che i file del progetto siano presenti."
        print_status "Creazione file docker-compose.yml di base..."
        
        # Crea docker-compose di base se i file non esistono
        cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  haccp-app:
    image: nginx:alpine
    container_name: haccp-app
    ports:
      - "80:80"
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF
    fi
    
    print_status "Directory deploy: $DEPLOY_DIR"
}

# Avvia applicazione
start_application() {
    print_header "Avvio HACCP App"
    
    cd $DEPLOY_DIR
    
    # Build e avvio container
    if [ -f "Dockerfile" ]; then
        print_status "Building immagine Docker..."
        docker compose up --build -d
    else
        print_status "Avvio con immagine base..."
        docker compose up -d
    fi
    
    # Verifica stato
    sleep 10
    if docker compose ps | grep -q "Up"; then
        print_status "✅ HACCP App avviata correttamente!"
        
        # Ottieni IP del sistema
        LOCAL_IP=$(hostname -I | awk '{print $1}')
        echo ""
        echo "🌐 Applicazione disponibile su:"
        echo "   http://localhost"
        echo "   http://$LOCAL_IP"
        echo ""
        
        # Mostra log
        print_status "Log dell'applicazione:"
        docker compose logs --tail=20
        
    else
        print_error "Errore nell'avvio dell'applicazione"
        docker compose logs
        exit 1
    fi
}

# Crea script di gestione
create_management_scripts() {
    print_header "Creazione script di gestione"
    
    # Script di aggiornamento
    cat > $DEPLOY_DIR/update.sh <<'EOF'
#!/bin/bash
echo "🔄 Aggiornamento HACCP App..."
docker compose pull
docker compose up --build -d
echo "✅ Aggiornamento completato!"
EOF
    
    # Script di backup
    cat > $DEPLOY_DIR/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/backup_$BACKUP_DATE"
mkdir -p $BACKUP_DIR

echo "💾 Creazione backup..."
docker compose exec haccp-app tar -czf /tmp/app_backup.tar.gz /usr/share/nginx/html
docker cp haccp-app:/tmp/app_backup.tar.gz $BACKUP_DIR/
echo "✅ Backup creato in $BACKUP_DIR/"
EOF
    
    # Script di monitoraggio
    cat > $DEPLOY_DIR/monitor.sh <<'EOF'
#!/bin/bash
echo "📊 Stato HACCP App:"
docker compose ps
echo ""
echo "💻 Utilizzo risorse:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""
echo "📋 Log recenti:"
docker compose logs --tail=10
EOF
    
    # Rendi eseguibili
    chmod +x $DEPLOY_DIR/*.sh
    
    print_status "Script di gestione creati:"
    print_status "  - update.sh: Aggiorna l'applicazione"
    print_status "  - backup.sh: Crea backup"
    print_status "  - monitor.sh: Monitora l'applicazione"
}

# Funzione principale
main() {
    print_header "Installazione HACCP App con Docker"
    
    detect_os
    
    # Verifica se Docker è già installato
    if command -v docker &> /dev/null; then
        print_status "Docker già installato"
        verify_docker
    else
        install_docker
        setup_docker
        verify_docker
    fi
    
    deploy_haccp
    start_application
    create_management_scripts
    
    print_header "🎉 Installazione completata!"
    echo ""
    print_status "✅ HACCP App è ora attiva e funzionante"
    print_status "📁 Directory progetto: $DEPLOY_DIR"
    print_status "🔧 Comandi utili:"
    echo "  - docker compose logs -f    # Visualizza log in tempo reale"
    echo "  - docker compose restart    # Riavvia applicazione"
    echo "  - docker compose down       # Ferma applicazione"
    echo "  - ./update.sh              # Aggiorna applicazione"
    echo "  - ./monitor.sh             # Monitora stato"
    echo ""
    print_warning "⚠️  Se hai modificato i permessi del gruppo docker, potrebbe essere necessario disconnettersi e ricollegarsi"
}

# Esegui funzione principale
main "$@"