#!/bin/sh
set -e

# First run: import schema if pb_data is empty
if [ ! -f /pb/pb_data/data.db ]; then
    echo "Primo avvio - inizializzazione database..."
    
    # Start PocketBase temporarily to create the DB
    pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data --publicDir=/pb/pb_public &
    PB_PID=$!
    
    # Wait for PocketBase to be ready
    for i in $(seq 1 30); do
        if curl -sf http://localhost:8090/api/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    
    # Import schema
    if [ -f /pb/pb_schema.json ]; then
        echo "Importazione schema..."
        curl -sf -X POST http://localhost:8090/api/collections/import \
            -H "Content-Type: application/json" \
            -d "{\"collections\": $(cat /pb/pb_schema.json), \"deleteMissing\": false}" \
            && echo "Schema importato con successo" \
            || echo "Schema import fallito (verrà importato dopo setup admin)"
    fi
    
    # Stop temporary instance
    kill $PB_PID 2>/dev/null
    wait $PB_PID 2>/dev/null || true
    echo "Inizializzazione completata"
fi

# Start PocketBase
exec pocketbase serve --http=0.0.0.0:80 --dir=/pb/pb_data --publicDir=/pb/pb_public
