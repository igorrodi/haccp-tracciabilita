#!/bin/bash

# Script per creare e avviare l'app HACCP con Docker
# Uso: ./build-and-run.sh [opzioni]

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzioni per output colorato
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }

# Variabili configurabili
APP_NAME="haccp-app"
CONTAINER_NAME="haccp-container"
IMAGE_NAME="haccp-image:latest"
HTTP_PORT="80"
HTTPS_PORT="443"
BUILD_DIR="$(pwd)"

# Funzione per mostrare aiuto
show_help() {
    cat << EOF
Script per build e deploy automatico dell'app HACCP con Docker

Uso: $0 [OPZIONI]

OPZIONI:
    -h, --help          Mostra questo aiuto
    -p, --port PORT     Porta HTTP (default: 80)
    -s, --https PORT    Porta HTTPS (default: 443)
    -n, --name NAME     Nome container (default: haccp-container)
    --clean             Rimuovi container e immagini esistenti
    --dev               Modalità sviluppo (monta volume source)
    --no-cache          Build senza cache Docker

ESEMPI:
    $0                  # Build e avvia con impostazioni default
    $0 -p 8080          # Usa porta 8080 invece di 80
    $0 --clean          # Pulisci e rebuilda tutto
    $0 --dev            # Modalità sviluppo con hot reload

EOF
}

# Parsing argomenti
CLEAN_BUILD=false
DEV_MODE=false
NO_CACHE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -p|--port)
            HTTP_PORT="$2"
            shift 2
            ;;
        -s|--https)
            HTTPS_PORT="$2"
            shift 2
            ;;
        -n|--name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        *)
            print_error "Opzione sconosciuta: $1"
            show_help
            exit 1
            ;;
    esac
done

# Funzione per verificare prerequisiti
check_prerequisites() {
    print_header "Verifica Prerequisiti"
    
    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker non è installato. Installalo prima di continuare."
        echo "Puoi usare: sudo apt-get install docker.io docker-compose"
        exit 1
    fi
    
    # Verifica Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose non è installato."
        exit 1
    fi
    
    # Verifica permessi Docker
    if ! docker ps &> /dev/null; then
        print_warning "Potrebbero servire permessi sudo per Docker"
        print_status "Prova ad aggiungere il tuo utente al gruppo docker:"
        echo "  sudo usermod -aG docker \$USER"
        echo "  newgrp docker"
    fi
    
    # Verifica che siamo nella directory giusta
    if [[ ! -f "package.json" ]] && [[ ! -f "../../package.json" ]]; then
        print_error "Script deve essere eseguito dalla root del progetto o da scripts/docker/"
        exit 1
    fi
    
    # Vai alla root del progetto se necessario
    if [[ -f "../../package.json" ]]; then
        cd ../../
        BUILD_DIR="$(pwd)"
    fi
    
    print_success "Tutti i prerequisiti sono soddisfatti"
}

# Funzione per cleanup
cleanup_existing() {
    if [[ "$CLEAN_BUILD" == "true" ]]; then
        print_header "Pulizia Container e Immagini Esistenti"
        
        # Stop e rimuovi container esistente
        if docker ps -a | grep -q "$CONTAINER_NAME"; then
            print_status "Stopping container esistente: $CONTAINER_NAME"
            docker stop "$CONTAINER_NAME" 2>/dev/null || true
            docker rm "$CONTAINER_NAME" 2>/dev/null || true
        fi
        
        # Rimuovi immagine esistente
        if docker images | grep -q "${IMAGE_NAME%:*}"; then
            print_status "Rimozione immagine esistente: $IMAGE_NAME"
            docker rmi "$IMAGE_NAME" 2>/dev/null || true
        fi
        
        # Pulizia sistema Docker
        print_status "Pulizia sistema Docker..."
        docker system prune -f
        
        print_success "Pulizia completata"
    fi
}

# Funzione per preparare l'ambiente di build
prepare_build_env() {
    print_header "Preparazione Ambiente Build"
    
    # Crea directory necessarie
    mkdir -p logs ssl proxy-config
    
    # Crea file .dockerignore se non esiste
    if [[ ! -f .dockerignore ]]; then
        print_status "Creazione .dockerignore"
        cat > .dockerignore << 'EOF'
node_modules
.git
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.swp
*.swo
*~
EOF
    fi
    
    print_success "Ambiente preparato"
}

# Funzione per build dell'immagine Docker
build_image() {
    print_header "Build Immagine Docker"
    
    BUILD_ARGS=""
    if [[ "$NO_CACHE" == "true" ]]; then
        BUILD_ARGS="--no-cache"
    fi
    
    if [[ "$DEV_MODE" == "true" ]]; then
        print_status "Building in modalità sviluppo..."
        # Build per sviluppo con hot reload
        docker build $BUILD_ARGS -f scripts/docker/Dockerfile.dev -t "${IMAGE_NAME}-dev" .
        IMAGE_NAME="${IMAGE_NAME}-dev"
    else
        print_status "Building immagine di produzione..."
        docker build $BUILD_ARGS -f scripts/docker/Dockerfile -t "$IMAGE_NAME" .
    fi
    
    # Verifica che il build sia andato a buon fine
    if docker images | grep -q "${IMAGE_NAME%:*}"; then
        print_success "Immagine Docker creata con successo: $IMAGE_NAME"
    else
        print_error "Errore durante il build dell'immagine"
        exit 1
    fi
}

# Funzione per avviare il container
start_container() {
    print_header "Avvio Container"
    
    # Stop container esistente se è in esecuzione
    if docker ps | grep -q "$CONTAINER_NAME"; then
        print_status "Stopping container esistente..."
        docker stop "$CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
    fi
    
    DOCKER_OPTS=""
    
    if [[ "$DEV_MODE" == "true" ]]; then
        print_status "Avvio in modalità sviluppo con volume mounting..."
        DOCKER_OPTS="-v $(pwd)/src:/app/src -v $(pwd)/public:/app/public"
        # In dev mode, mappa anche la porta 5173 per Vite dev server
        docker run -d \
            --name "$CONTAINER_NAME" \
            -p "$HTTP_PORT:80" \
            -p "5173:5173" \
            $DOCKER_OPTS \
            --restart unless-stopped \
            --health-cmd="curl -f http://localhost/ || exit 1" \
            --health-interval=30s \
            --health-timeout=10s \
            --health-retries=3 \
            "$IMAGE_NAME"
    else
        print_status "Avvio in modalità produzione..."
        docker run -d \
            --name "$CONTAINER_NAME" \
            -p "$HTTP_PORT:80" \
            -p "$HTTPS_PORT:443" \
            -v "$(pwd)/logs:/var/log/nginx" \
            -v "$(pwd)/ssl:/etc/nginx/ssl:ro" \
            --restart unless-stopped \
            --health-cmd="curl -f http://localhost/ || exit 1" \
            --health-interval=30s \
            --health-timeout=10s \
            --health-retries=3 \
            "$IMAGE_NAME"
    fi
    
    # Verifica che il container sia in esecuzione
    sleep 5
    if docker ps | grep -q "$CONTAINER_NAME"; then
        print_success "Container avviato con successo: $CONTAINER_NAME"
    else
        print_error "Errore durante l'avvio del container"
        print_status "Controllando i log..."
        docker logs "$CONTAINER_NAME"
        exit 1
    fi
}

# Funzione per verificare il deployment
verify_deployment() {
    print_header "Verifica Deployment"
    
    # Ottieni IP del sistema
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    # Test connessione HTTP
    print_status "Testing connessione HTTP..."
    sleep 10  # Aspetta che nginx si avvii completamente
    
    if curl -f -s "http://localhost:$HTTP_PORT" > /dev/null; then
        print_success "✅ App HACCP accessibile via HTTP"
    else
        print_warning "❌ Connessione HTTP fallita"
    fi
    
    # Mostra informazioni di accesso
    echo ""
    print_header "🚀 HACCP App Deploy Completato!"
    echo ""
    echo "📋 Informazioni di accesso:"
    echo "   🌐 URL Locale:    http://localhost:$HTTP_PORT"
    echo "   🌐 URL Rete:      http://$LOCAL_IP:$HTTP_PORT"
    if [[ "$DEV_MODE" == "true" ]]; then
        echo "   🔧 Dev Server:    http://localhost:5173"
    fi
    echo ""
    echo "📊 Comandi utili:"
    echo "   📋 Stato:        docker ps"
    echo "   📜 Log:          docker logs $CONTAINER_NAME"
    echo "   🔄 Restart:      docker restart $CONTAINER_NAME"
    echo "   🛑 Stop:         docker stop $CONTAINER_NAME"
    echo "   🗑️  Remove:       docker rm $CONTAINER_NAME"
    echo ""
    
    # Mostra log recenti
    print_status "Log recenti del container:"
    docker logs --tail 20 "$CONTAINER_NAME"
}

# Funzione per creare script di gestione
create_management_scripts() {
    print_header "Creazione Script di Gestione"
    
    # Script di aggiornamento
    cat > haccp-update.sh << 'EOF'
#!/bin/bash
echo "🔄 Aggiornamento HACCP App..."
./scripts/docker/build-and-run.sh --clean
echo "✅ Aggiornamento completato!"
EOF
    chmod +x haccp-update.sh
    
    # Script di backup
    cat > haccp-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
echo "💾 Creazione backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
docker export haccp-container > "$BACKUP_DIR/haccp-container.tar"
cp -r logs ssl "$BACKUP_DIR/"
echo "✅ Backup completato in $BACKUP_DIR"
EOF
    chmod +x haccp-backup.sh
    
    # Script di monitoraggio
    cat > haccp-monitor.sh << 'EOF'
#!/bin/bash
echo "📊 Stato HACCP App"
echo "=================="
docker ps --filter name=haccp-container --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "💾 Utilizzo risorse:"
docker stats haccp-container --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""
echo "🔍 Health check:"
docker inspect haccp-container | jq '.[0].State.Health.Status' 2>/dev/null || echo "N/A"
EOF
    chmod +x haccp-monitor.sh
    
    print_success "Script di gestione creati: haccp-update.sh, haccp-backup.sh, haccp-monitor.sh"
}

# Funzione principale
main() {
    print_header "🐳 HACCP App - Docker Build & Deploy"
    print_status "Container: $CONTAINER_NAME | Porta: $HTTP_PORT | Modalità: $([ "$DEV_MODE" == "true" ] && echo "sviluppo" || echo "produzione")"
    
    check_prerequisites
    cleanup_existing
    prepare_build_env
    build_image
    start_container
    verify_deployment
    create_management_scripts
    
    print_success "🎉 Deploy completato con successo!"
}

# Gestione segnali per cleanup
trap 'print_error "Script interrotto"; exit 1' INT TERM

# Avvia script principale
main "$@"