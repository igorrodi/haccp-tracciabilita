#!/bin/sh
# HACCP Tracker - Script di AUTO-RIPARAZIONE
# Controlla, diagnostica e ripara automaticamente problemi comuni:
#  - Container fermo / unhealthy
#  - PocketBase non in ascolto su 0.0.0.0
#  - Superuser mancante
#  - Schema collezioni non importato
#  - Wi-Fi non applicato (verifica wpa_supplicant + connettività)
#  - Permessi pb_data
#  - Volume non montato
#
# Uso (dall'host RPi):
#   sudo sh /opt/haccp-tracker/scripts/autofix.sh
#   sudo sh /opt/haccp-tracker/scripts/autofix.sh --check-only   (solo diagnosi, no modifiche)
#   sudo sh /opt/haccp-tracker/scripts/autofix.sh --reset-schema (forza re-import schema)

set -u

# ---------- Config ----------
APP_DIR="${APP_DIR:-/opt/haccp-tracker}"
# Nuova struttura: i dati vivono sotto ./data/. Fallback alla vecchia per compat.
if [ -d "${APP_DIR}/data/pb_data" ]; then
  PB_DATA="${APP_DIR}/data/pb_data"
elif [ -d "${APP_DIR}/pb_data" ]; then
  PB_DATA="${APP_DIR}/pb_data"
else
  PB_DATA="${APP_DIR}/data/pb_data"
fi
SCHEMA_FILE="${APP_DIR}/scripts/pocketbase/pb_schema.json"
[ ! -f "$SCHEMA_FILE" ] && SCHEMA_FILE="${APP_DIR}/pb_schema.json"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
ADMIN_EMAIL="${PB_SUPERUSER_EMAIL:-admin@haccp.local}"
ADMIN_PASSWORD="${PB_SUPERUSER_PASSWORD:-Admin123456!}"
PB_URL="http://127.0.0.1"
WIFI_REQ="${PB_DATA}/.wifi_config_request.json"
WIFI_APPLIED="${PB_DATA}/.wifi_config_applied.json"

# Auto-migrazione: ./pb_data → ./data/pb_data se la nuova è vuota
if [ -d "${APP_DIR}/pb_data" ] && [ ! -d "${APP_DIR}/data/pb_data" ]; then
  mkdir -p "${APP_DIR}/data"
  mv "${APP_DIR}/pb_data" "${APP_DIR}/data/pb_data" 2>/dev/null && \
    printf "[INFO] Migrazione dati: ./pb_data → ./data/pb_data completata\n"
  PB_DATA="${APP_DIR}/data/pb_data"
fi
mkdir -p "${APP_DIR}/data/backups" 2>/dev/null || true

CHECK_ONLY=0; RESET_SCHEMA=0
for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    --reset-schema) RESET_SCHEMA=1 ;;
  esac
done

# ---------- Output ----------
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'
PASS=0; FIX=0; FAIL=0
ok()   { printf "${G}[ OK ]${N} %s\n" "$1"; PASS=$((PASS+1)); }
ko()   { printf "${R}[FAIL]${N} %s\n" "$1"; FAIL=$((FAIL+1)); }
fix()  { printf "${Y}[FIX ]${N} %s\n" "$1"; FIX=$((FIX+1)); }
info() { printf "${B}[INFO]${N} %s\n" "$1"; }
hd()   { printf "\n${B}=== %s ===${N}\n" "$1"; }

run_fix() {
  if [ "$CHECK_ONLY" = "1" ]; then
    info "FIX disponibile (skip in --check-only): $1"
    return 1
  fi
  return 0
}

# Container compose helper
COMPOSE="docker compose"
docker compose version >/dev/null 2>&1 || COMPOSE="docker-compose"

container_id() {
  docker ps -a --filter "name=haccp" --format "{{.ID}}" | head -1
}

# ---------- 0. Pre-flight ----------
hd "0. Pre-flight"
[ "$(id -u)" = "0" ] || { ko "Esegui come root (sudo)"; exit 2; }
command -v docker >/dev/null 2>&1 || { ko "Docker non installato"; exit 2; }
[ -d "$APP_DIR" ] || { ko "Directory $APP_DIR non trovata"; exit 2; }
[ -f "$COMPOSE_FILE" ] || { ko "docker-compose.yml non trovato in $APP_DIR"; exit 2; }
[ -f "$SCHEMA_FILE" ] || { ko "pb_schema.json non trovato"; exit 2; }
ok "Pre-flight OK"

# ---------- 1. Volume pb_data ----------
hd "1. Volume dati ($PB_DATA)"
if [ ! -d "$PB_DATA" ]; then
  ko "$PB_DATA non esiste"
  if run_fix "creare directory $PB_DATA"; then
    mkdir -p "$PB_DATA/exports" "$PB_DATA/backups"
    chmod 755 "$PB_DATA"
    fix "Directory pb_data creata"
  fi
else
  ok "Directory esistente"
  # permessi
  if [ ! -w "$PB_DATA" ]; then
    ko "pb_data non scrivibile"
    if run_fix "correggere permessi"; then chmod -R u+rwX "$PB_DATA"; fix "Permessi corretti"; fi
  fi
fi

# ---------- 2. Container ----------
hd "2. Container"
CID=$(container_id)
if [ -z "$CID" ]; then
  ko "Nessun container HACCP presente"
  if run_fix "avviare container con docker compose up -d"; then
    (cd "$APP_DIR" && $COMPOSE up -d) && fix "Container avviato" || ko "Avvio fallito"
  fi
else
  STATE=$(docker inspect --format='{{.State.Status}}' "$CID" 2>/dev/null)
  if [ "$STATE" = "running" ]; then
    ok "Container running ($CID)"
  else
    ko "Container in stato: $STATE"
    if run_fix "restart container"; then
      docker start "$CID" >/dev/null && fix "Container riavviato"
    fi
  fi
fi

# Attendi healthcheck
info "Attendo PocketBase su porta 80..."
READY=0
for i in $(seq 1 30); do
  if curl -sf "${PB_URL}/api/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 2
done
if [ "$READY" = "1" ]; then
  ok "PocketBase risponde"
else
  ko "PocketBase NON raggiungibile su porta 80"
  if run_fix "force-recreate container"; then
    (cd "$APP_DIR" && $COMPOSE up -d --force-recreate) && fix "Container ricreato"
    sleep 8
  fi
fi

# ---------- 3. Binding 0.0.0.0 ----------
hd "3. Binding rete (LAN reachability)"
LAN_IP=$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | grep -v '^127' | head -1)
if [ -n "$LAN_IP" ]; then
  if curl -sf -m 5 "http://${LAN_IP}/api/health" >/dev/null 2>&1; then
    ok "API raggiungibile su http://${LAN_IP}"
  else
    ko "API NON raggiungibile su LAN ($LAN_IP) — PocketBase potrebbe ascoltare solo su 127.0.0.1"
    if run_fix "force-recreate (entrypoint usa --http=0.0.0.0:80)"; then
      (cd "$APP_DIR" && $COMPOSE up -d --force-recreate) && fix "Container ricreato"
    fi
  fi
else
  info "Nessun IP LAN rilevato"
fi

# ---------- 4. Superuser ----------
hd "4. Superuser PocketBase"
TOKEN=""
if curl -sf "${PB_URL}/api/health" >/dev/null 2>&1; then
  AUTH=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    "${PB_URL}/api/collections/_superusers/auth-with-password" 2>/dev/null)
  TOKEN=$(echo "$AUTH" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  if [ -n "$TOKEN" ]; then
    ok "Login superuser OK"
  else
    ko "Login superuser fallito"
    CID=$(container_id)
    if [ -n "$CID" ] && run_fix "ricreare superuser via pocketbase upsert"; then
      docker exec "$CID" pocketbase superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --dir=/pb/pb_data \
        && fix "Superuser ricreato" \
        && rm -f "${PB_DATA}/.superuser_bootstrapped" \
        && touch "${PB_DATA}/.superuser_bootstrapped"
      # ritenta auth
      sleep 2
      AUTH=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
        "${PB_URL}/api/collections/_superusers/auth-with-password" 2>/dev/null)
      TOKEN=$(echo "$AUTH" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
      [ -n "$TOKEN" ] && ok "Login superuser ora funziona" || ko "Login ancora fallito"
    fi
  fi
fi

# ---------- 5. Schema collezioni ----------
hd "5. Schema collezioni"
EXPECTED="users products product_images suppliers seasons lots allergens printer_settings app_settings temperature_logs reception_logs cleaning_logs cloud_settings lot_images wifi_settings"
NEED_IMPORT=0

if [ "$RESET_SCHEMA" = "1" ]; then
  info "Forzo re-import schema (--reset-schema)"
  rm -f "${PB_DATA}/.schema_imported"
  NEED_IMPORT=1
fi

if [ -n "$TOKEN" ]; then
  COLS=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections?perPage=200" 2>/dev/null)
  PRESENT=$(echo "$COLS" | tr ',' '\n' | sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | sort -u)
  MISSING=""
  for c in $EXPECTED; do
    echo "$PRESENT" | grep -qx "$c" || MISSING="$MISSING $c"
  done
  if [ -z "$MISSING" ]; then
    ok "Tutte le 15 collezioni presenti"
  else
    ko "Collezioni mancanti:$MISSING"
    NEED_IMPORT=1
  fi
fi

if [ "$NEED_IMPORT" = "1" ] && [ -n "$TOKEN" ] && run_fix "importare schema dal file pb_schema.json"; then
  if ! command -v jq >/dev/null 2>&1; then
    info "jq non installato sull'host, uso il container"
    CID=$(container_id)
    PAYLOAD=$(docker exec "$CID" sh -c "jq -n --slurpfile c /pb/pb_schema.json '{collections:\$c[0],deleteMissing:false}'" 2>/dev/null)
  else
    PAYLOAD=$(jq -n --slurpfile c "$SCHEMA_FILE" '{collections:$c[0],deleteMissing:false}')
  fi
  if [ -n "$PAYLOAD" ]; then
    HTTP=$(echo "$PAYLOAD" | curl -s -o /tmp/imp.json -w "%{http_code}" \
      -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
      --data-binary @- "${PB_URL}/api/collections/import")
    if [ "$HTTP" = "204" ] || [ "$HTTP" = "200" ]; then
      fix "Schema importato (HTTP $HTTP)"
      sha256sum "$SCHEMA_FILE" 2>/dev/null | awk '{print $1}' > "${PB_DATA}/.schema_imported"
    else
      ko "Import fallito (HTTP $HTTP): $(cat /tmp/imp.json 2>/dev/null)"
    fi
  fi
fi

# ---------- 6. Test write/read ----------
hd "6. Test scrittura/lettura DB"
if [ -n "$TOKEN" ]; then
  TS=$(date +%s)
  CR=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"name\":\"autofix-${TS}\",\"notes\":\"autofix probe\"}" \
    "${PB_URL}/api/collections/suppliers/records" 2>/dev/null)
  RID=$(echo "$CR" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  if [ -n "$RID" ]; then
    ok "Write OK (id=$RID)"
    curl -s -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections/suppliers/records/${RID}" | grep -q "$RID" \
      && ok "Read OK" || ko "Read fallita"
    curl -s -X DELETE -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections/suppliers/records/${RID}" >/dev/null
  else
    ko "Write fallita: $CR"
  fi
fi

# ---------- 7. Wi-Fi ----------
hd "7. Configurazione Wi-Fi"
WIFI_SVC_OK=0
if systemctl is-enabled haccp-wifi-watcher.service >/dev/null 2>&1; then
  ok "Servizio haccp-wifi-watcher abilitato"
  if systemctl is-active haccp-wifi-watcher.service >/dev/null 2>&1; then
    ok "Servizio haccp-wifi-watcher attivo"
    WIFI_SVC_OK=1
  else
    ko "Servizio non attivo"
    if run_fix "avviare haccp-wifi-watcher"; then
      systemctl start haccp-wifi-watcher.service && fix "Servizio avviato" && WIFI_SVC_OK=1
    fi
  fi
else
  ko "Servizio haccp-wifi-watcher non installato"
  WATCHER_FILE="${APP_DIR}/scripts/haccp-wifi-watcher.service"
  if [ -f "$WATCHER_FILE" ] && run_fix "installare il servizio systemd"; then
    cp "$WATCHER_FILE" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now haccp-wifi-watcher.service && fix "Servizio installato e avviato" && WIFI_SVC_OK=1
  fi
fi

# Verifica configurazione corrente Wi-Fi
if [ -f "$WIFI_REQ" ]; then
  REQ_SSID=$(sed -n 's/.*"wifi_ssid":"\([^"]*\)".*/\1/p' "$WIFI_REQ")
  info "Ultima richiesta Wi-Fi: SSID='$REQ_SSID'"
  if [ -f "$WIFI_APPLIED" ]; then
    APP_SSID=$(sed -n 's/.*"wifi_ssid":"\([^"]*\)".*/\1/p' "$WIFI_APPLIED")
    if [ "$REQ_SSID" = "$APP_SSID" ]; then
      ok "Configurazione Wi-Fi applicata (SSID='$APP_SSID')"
    else
      ko "Wi-Fi richiesto '$REQ_SSID' ma applicato '$APP_SSID'"
    fi
  else
    ko "Richiesta Wi-Fi presente ma mai applicata (.wifi_config_applied.json mancante)"
    [ "$WIFI_SVC_OK" = "1" ] && info "Il watcher dovrebbe applicarla entro 30s — riprova lo script"
  fi
else
  info "Nessuna richiesta Wi-Fi pendente (file $WIFI_REQ assente)"
fi

# Stato connessione attuale
if command -v iwgetid >/dev/null 2>&1; then
  CUR_SSID=$(iwgetid -r 2>/dev/null)
  [ -n "$CUR_SSID" ] && ok "Connesso al Wi-Fi: $CUR_SSID" || info "Non connesso a un SSID Wi-Fi"
elif command -v nmcli >/dev/null 2>&1; then
  CUR_SSID=$(nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes:' | cut -d: -f2)
  [ -n "$CUR_SSID" ] && ok "Connesso al Wi-Fi: $CUR_SSID" || info "Non connesso"
fi

# Test connettività internet
if curl -sf -m 5 https://www.google.com -o /dev/null; then
  ok "Connettività Internet OK"
else
  info "Nessuna Internet (può essere normale se solo LAN locale)"
fi

# ---------- 8. Frontend ----------
hd "8. Frontend"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${PB_URL}/")
[ "$HTTP" = "200" ] && ok "Frontend servito" || ko "Frontend non servito (HTTP $HTTP)"

# ---------- 9. Marker setup ----------
hd "9. Stato setup wizard"
[ -f "${PB_DATA}/setup_complete.json" ] && ok "Setup wizard completato" || info "Setup wizard non ancora completato (apri http://${LAN_IP:-IP-DEL-PI})"

# ---------- Riepilogo ----------
hd "Riepilogo"
printf "${G}OK: %d${N}   ${Y}Riparati: %d${N}   ${R}Falliti: %d${N}\n" "$PASS" "$FIX" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Alcuni problemi non risolti automaticamente. Suggerimenti:"
  echo "  - Logs:       docker logs haccp-tracker-haccp-1 --tail 100"
  echo "  - Reset full: cd $APP_DIR && $COMPOSE down && rm -rf pb_data && $COMPOSE up -d"
  echo "  - Re-import schema: sudo sh $0 --reset-schema"
  exit 1
fi
exit 0
