#!/bin/bash

# Script per configurare GitHub per aggiornamenti automatici
# Da eseguire dopo l'installazione locale

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

APP_DIR="/opt/haccp-app"

echo "🔧 Configurazione GitHub per HACCP App"
echo "========================================"
echo ""

# Verifica se l'app esiste
if [ ! -d "$APP_DIR" ]; then
    print_error "HACCP App non trovata in $APP_DIR"
    print_warning "Esegui prima lo script di installazione"
    exit 1
fi

cd $APP_DIR

# Richiedi informazioni GitHub
echo "📝 Inserisci i dati del tuo repository GitHub:"
echo ""
read -p "Username GitHub: " GITHUB_USER
read -p "Nome repository (es: haccp-app): " GITHUB_REPO_NAME
read -p "Branch (default: main): " GITHUB_BRANCH
GITHUB_BRANCH=${GITHUB_BRANCH:-main}

GITHUB_REPO="https://github.com/$GITHUB_USER/$GITHUB_REPO_NAME.git"

echo ""
print_status "Repository: $GITHUB_REPO"
print_status "Branch: $GITHUB_BRANCH"
echo ""

# Chiedi conferma
read -p "Confermi? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Operazione annullata"
    exit 0
fi

# Configura Git
print_status "Configurazione Git..."

# Configura identità Git (necessario per commit)
read -p "Nome per commit Git: " GIT_NAME
read -p "Email per commit Git: " GIT_EMAIL

git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"

# Inizializza repository se necessario
if [ ! -d ".git" ]; then
    print_status "Inizializzazione repository Git..."
    git init
    git checkout -b $GITHUB_BRANCH
fi

# Configura remote
if git remote | grep -q "origin"; then
    print_status "Aggiornamento remote origin..."
    git remote set-url origin $GITHUB_REPO
else
    print_status "Aggiunta remote origin..."
    git remote add origin $GITHUB_REPO
fi

# Crea .gitignore se non esiste
if [ ! -f ".gitignore" ]; then
    print_status "Creazione .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
dist/
build/

# Environment
.env.local
.env.*.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build
*.tsbuildinfo
EOF
fi

# Opzioni di sincronizzazione
echo ""
echo "🔄 Opzioni di sincronizzazione:"
echo "1. Push iniziale (carica il codice corrente su GitHub)"
echo "2. Pull iniziale (scarica il codice da GitHub)"
echo "3. Skip (configura solo, nessuna sincronizzazione ora)"
echo ""
read -p "Scegli un'opzione (1-3): " SYNC_OPTION

case $SYNC_OPTION in
    1)
        print_status "Push codice su GitHub..."
        
        # Aggiungi tutti i file
        git add .
        
        # Commit
        git commit -m "Initial commit from Raspberry Pi" || true
        
        # Push
        print_warning "Potrebbe essere richiesta l'autenticazione GitHub"
        echo "Se hai 2FA attivo, usa un Personal Access Token invece della password"
        echo "Genera il token su: https://github.com/settings/tokens"
        echo ""
        
        git push -u origin $GITHUB_BRANCH
        
        if [ $? -eq 0 ]; then
            print_status "Codice caricato con successo!"
        else
            print_error "Errore durante il push"
            print_warning "Riprova manualmente con: cd $APP_DIR && git push -u origin $GITHUB_BRANCH"
        fi
        ;;
        
    2)
        print_status "Pull codice da GitHub..."
        
        print_warning "Potrebbe essere richiesta l'autenticazione GitHub"
        git fetch origin
        git reset --hard origin/$GITHUB_BRANCH
        
        if [ $? -eq 0 ]; then
            print_status "Codice scaricato con successo!"
            print_status "Ricompilazione app..."
            npm install
            npm run build
            sudo systemctl reload nginx
        else
            print_error "Errore durante il pull"
        fi
        ;;
        
    3)
        print_status "Configurazione completata senza sincronizzazione"
        ;;
        
    *)
        print_error "Opzione non valida"
        exit 1
        ;;
esac

# Salva configurazione per lo script di aggiornamento
sudo tee /etc/haccp-app.conf > /dev/null <<EOF
GITHUB_REPO=$GITHUB_REPO
GITHUB_BRANCH=$GITHUB_BRANCH
GITHUB_USER=$GITHUB_USER
APP_DIR=$APP_DIR
EOF

print_status "Configurazione salvata in /etc/haccp-app.conf"

# Test connessione
echo ""
print_status "Test connessione GitHub..."
if git ls-remote $GITHUB_REPO &> /dev/null; then
    print_status "Connessione OK! ✅"
else
    print_warning "Impossibile connettersi al repository"
    print_warning "Verifica: 1) URL corretto 2) Repository esiste 3) Hai accesso"
fi

# Aggiorna script di aggiornamento per usare il branch corretto
print_status "Aggiornamento script update-haccp..."
sudo tee /usr/local/bin/update-haccp > /dev/null <<SCRIPT
#!/bin/bash
set -e

echo "🔄 Aggiornamento HACCP App da GitHub..."

# Carica configurazione
if [ -f /etc/haccp-app.conf ]; then
    source /etc/haccp-app.conf
else
    APP_DIR="/opt/haccp-app"
    GITHUB_BRANCH="main"
fi

cd \$APP_DIR

# Verifica che Git sia configurato
if [ ! -d ".git" ]; then
    echo "❌ Git non configurato. Esegui setup-github.sh"
    exit 1
fi

# Stash eventuali modifiche locali
echo "💾 Backup modifiche locali..."
git stash

# Pull da GitHub
echo "📥 Download aggiornamenti da GitHub..."
git pull origin \$GITHUB_BRANCH

if [ \$? -ne 0 ]; then
    echo "❌ Errore durante il pull da GitHub"
    git stash pop || true
    exit 1
fi

# Ripristina modifiche locali se esistono
git stash pop 2>/dev/null || true

# Aggiorna dipendenze
echo "📦 Aggiornamento dipendenze..."
npm install

# Build
echo "🔨 Build applicazione..."
npm run build

# Restart servizi
echo "🔄 Restart servizi..."
sudo systemctl reload nginx

echo "✅ Aggiornamento completato!"
echo "🌐 App disponibile su: https://haccp-app.local"
SCRIPT

sudo chmod +x /usr/local/bin/update-haccp

echo ""
echo "🎉 Configurazione GitHub completata!"
echo ""
echo "📝 Comandi utili:"
echo "  • Aggiorna da GitHub:  sudo update-haccp"
echo "  • Push modifiche:      cd $APP_DIR && git push"
echo "  • Verifica status:     cd $APP_DIR && git status"
echo ""
echo "💡 Per autenticarti con GitHub:"
echo "  1. Usa HTTPS con Personal Access Token"
echo "  2. Oppure configura SSH: https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
echo ""
echo "🔗 Repository configurato: $GITHUB_REPO"
echo ""
