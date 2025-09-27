#!/bin/sh

echo "🚀 Avvio HACCP App in modalità sviluppo..."

# Funzione per avviare il dev server
start_dev_server() {
    echo "📦 Avvio Vite dev server..."
    npm run dev -- --host 0.0.0.0 --port 5173 &
    DEV_PID=$!
    echo "Dev server PID: $DEV_PID"
}

# Funzione per build e servire con nginx
start_production_server() {
    echo "🏗️  Building per produzione..."
    npm run build
    
    echo "🚀 Avvio Nginx..."
    # Copia build in nginx
    cp -r dist/* /usr/share/nginx/html/
    
    # Avvia nginx in background
    nginx -g "daemon off;" &
    NGINX_PID=$!
    echo "Nginx PID: $NGINX_PID"
}

# Installa nginx per servire i file statici
echo "📦 Installazione Nginx..."
apk add --no-cache nginx

# Copia configurazione nginx
mkdir -p /etc/nginx/conf.d
cp scripts/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Crea directory necessarie
mkdir -p /usr/share/nginx/html
mkdir -p /var/log/nginx
mkdir -p /var/cache/nginx

# Avvia entrambi i server
start_dev_server
start_production_server

# Funzione per gestire shutdown graceful
cleanup() {
    echo "🛑 Shutdown in corso..."
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null || true
    fi
    if [ ! -z "$NGINX_PID" ]; then
        kill $NGINX_PID 2>/dev/null || true
    fi
    exit 0
}

# Gestisce segnali per shutdown graceful
trap cleanup SIGTERM SIGINT

echo "✅ HACCP App avviata!"
echo "🌐 Dev server: http://localhost:5173"
echo "🌐 Produzione: http://localhost:80"

# Mantiene il container in vita
while true; do
    # Controlla se i processi sono ancora attivi
    if [ ! -z "$DEV_PID" ] && ! kill -0 $DEV_PID 2>/dev/null; then
        echo "⚠️  Dev server si è fermato, riavvio..."
        start_dev_server
    fi
    
    if [ ! -z "$NGINX_PID" ] && ! kill -0 $NGINX_PID 2>/dev/null; then
        echo "⚠️  Nginx si è fermato, riavvio..."
        start_production_server
    fi
    
    sleep 30
done