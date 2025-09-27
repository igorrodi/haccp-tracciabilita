#!/bin/bash

# Script di installazione HACCP App per Raspberry Pi 5 con Ubuntu Server
# Autore: Script automatico per deploy HACCP

set -e

echo "🚀 Avvio installazione HACCP App su Raspberry Pi 5..."

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verifica se è root
if [[ $EUID -eq 0 ]]; then
   print_error "Questo script non deve essere eseguito come root!"
   exit 1
fi

# Aggiorna sistema
print_status "Aggiornamento sistema..."
sudo apt update && sudo apt upgrade -y

# Installa dipendenze di sistema
print_status "Installazione dipendenze di sistema..."
sudo apt install -y curl wget git nginx ufw

# Installa Node.js 20.x
print_status "Installazione Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifica installazione Node.js
node_version=$(node --version)
npm_version=$(npm --version)
print_status "Node.js installato: $node_version"
print_status "npm installato: $npm_version"

# Crea directory per l'applicazione
APP_DIR="/var/www/haccp-app"
print_status "Creazione directory applicazione: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clona o copia il progetto (assumendo che il codice sia già presente)
print_status "Preparazione codice applicazione..."
if [ -d "/tmp/haccp-app" ]; then
    cp -r /tmp/haccp-app/* $APP_DIR/
else
    print_warning "Codice non trovato in /tmp/haccp-app. Copiare manualmente il progetto in $APP_DIR"
fi

cd $APP_DIR

# Installa dipendenze npm
print_status "Installazione dipendenze npm..."
npm install

# Build dell'applicazione
print_status "Build dell'applicazione React..."
npm run build

# Configura Nginx
print_status "Configurazione Nginx..."
sudo tee /etc/nginx/sites-available/haccp-app > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    
    server_name _;
    root $APP_DIR/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss;
    
    # Handle client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
EOF

# Abilita il sito
sudo ln -sf /etc/nginx/sites-available/haccp-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configurazione Nginx
print_status "Test configurazione Nginx..."
sudo nginx -t

# Avvia e abilita servizi
print_status "Avvio servizi..."
sudo systemctl enable nginx
sudo systemctl restart nginx

# Configura firewall
print_status "Configurazione firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Crea script di aggiornamento
print_status "Creazione script di aggiornamento..."
sudo tee /usr/local/bin/update-haccp-app > /dev/null <<'EOF'
#!/bin/bash
cd /var/www/haccp-app
git pull origin main 2>/dev/null || echo "Git pull non disponibile, aggiornamento manuale necessario"
npm install
npm run build
sudo systemctl reload nginx
echo "Applicazione HACCP aggiornata!"
EOF

sudo chmod +x /usr/local/bin/update-haccp-app

# Crea servizio systemd per auto-start (opzionale)
print_status "Configurazione servizio di monitoraggio..."
sudo tee /etc/systemd/system/haccp-monitor.service > /dev/null <<EOF
[Unit]
Description=HACCP App Monitor
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'curl -f http://localhost/ > /dev/null || systemctl restart nginx'
User=www-data

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/haccp-monitor.timer > /dev/null <<EOF
[Unit]
Description=Run HACCP App Monitor every 5 minutes
Requires=haccp-monitor.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl enable --now haccp-monitor.timer

# Ottimizzazioni per Raspberry Pi
print_status "Applicazione ottimizzazioni per Raspberry Pi..."
# Aumenta swap se necessario
SWAP_SIZE=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_SIZE" -lt 1024 ]; then
    print_warning "Memoria swap bassa. Considerare di aumentarla per build più stabili."
fi

# Log delle prestazioni
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf > /dev/null

# Informazioni finali
print_status "✅ Installazione completata!"
echo ""
echo "📍 Posizione applicazione: $APP_DIR"
echo "🌐 URL applicazione: http://$(hostname -I | awk '{print $1}')"
echo "📋 Log Nginx: /var/log/nginx/"
echo "🔄 Per aggiornare l'app: sudo /usr/local/bin/update-haccp-app"
echo ""
print_warning "Ricorda di configurare le variabili Supabase in $APP_DIR/.env se necessario"

# Status finale
systemctl is-active --quiet nginx && print_status "✅ Nginx attivo" || print_error "❌ Nginx non attivo"
sudo ufw status | grep -q "Status: active" && print_status "✅ Firewall attivo" || print_warning "⚠️ Firewall non configurato"

print_status "🎉 HACCP App è ora disponibile!"