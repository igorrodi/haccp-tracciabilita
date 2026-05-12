#!/bin/sh
# HACCP Tracker - Script di verifica installazione, schema e persistenza dati
# Uso: sudo sh /opt/haccp-tracker/scripts/healthcheck.sh
# oppure dal container:  docker exec haccp-tracker-haccp-1 sh /pb/healthcheck.sh

set -u

# ---------- Config ----------
PB_HOST="${PB_HOST:-127.0.0.1}"
PB_PORT="${PB_PORT:-80}"
PB_URL="http://${PB_HOST}:${PB_PORT}"
PB_DATA_DIR="${PB_DATA_DIR:-/pb/pb_data}"
SCHEMA_FILE="${SCHEMA_FILE:-/pb/pb_schema.json}"
ADMIN_EMAIL="${PB_SUPERUSER_EMAIL:-admin@haccp.local}"
ADMIN_PASSWORD="${PB_SUPERUSER_PASSWORD:-Admin123456!}"

# Se eseguito dall'host (non dentro al container) ricalcola percorsi host
if [ ! -d "$PB_DATA_DIR" ] && [ -d "/opt/haccp-tracker/pb_data" ]; then
  PB_DATA_DIR="/opt/haccp-tracker/pb_data"
  SCHEMA_FILE="/opt/haccp-tracker/scripts/pocketbase/pb_schema.json"
fi

# ---------- Output helpers ----------
GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0
ok()   { printf "${GREEN}[ OK ]${NC} %s\n" "$1"; PASS=$((PASS+1)); }
ko()   { printf "${RED}[FAIL]${NC} %s\n" "$1"; FAIL=$((FAIL+1)); }
warn() { printf "${YEL}[WARN]${NC} %s\n" "$1"; WARN=$((WARN+1)); }
hd()   { printf "\n${BLU}== %s ==${NC}\n" "$1"; }

# ---------- 1. Sistema ----------
hd "1. Sistema host"
uname -a 2>/dev/null | head -1
if command -v docker >/dev/null 2>&1; then
  ok "Docker installato: $(docker --version)"
else
  warn "Docker non rilevato (forse stai eseguendo dentro al container)"
fi

# ---------- 2. Container ----------
hd "2. Container HACCP"
if command -v docker >/dev/null 2>&1; then
  CID=$(docker ps --filter "ancestor=ghcr.io/igorrodi/haccp-tracciabilita:latest" --format "{{.ID}}" | head -1)
  [ -z "$CID" ] && CID=$(docker ps --filter "name=haccp" --format "{{.ID}}" | head -1)
  if [ -n "$CID" ]; then
    ok "Container attivo: $CID"
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CID" 2>/dev/null || echo "n/a")
    [ "$STATUS" = "healthy" ] && ok "Healthcheck: healthy" || warn "Healthcheck: $STATUS"
  else
    ko "Nessun container HACCP in esecuzione"
  fi
fi

# ---------- 3. PocketBase API ----------
hd "3. PocketBase API ($PB_URL)"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${PB_URL}/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  ok "API health: 200"
else
  ko "API health: $HEALTH (PocketBase non raggiungibile su $PB_URL)"
fi

# Verifica binding 0.0.0.0 (deve rispondere anche su IP LAN)
LAN_IP=$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | grep -v '^127' | head -1)
if [ -n "$LAN_IP" ]; then
  LAN_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://${LAN_IP}/api/health" 2>/dev/null || echo "000")
  if [ "$LAN_HEALTH" = "200" ]; then
    ok "API raggiungibile su LAN: http://${LAN_IP}"
  else
    warn "API NON raggiungibile su http://${LAN_IP} (codice $LAN_HEALTH) — controlla che PB sia in --http=0.0.0.0:80"
  fi
fi

# ---------- 4. Auth superuser ----------
hd "4. Autenticazione superuser"
if [ "$HEALTH" = "200" ]; then
  AUTH_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    "${PB_URL}/api/collections/_superusers/auth-with-password" 2>/dev/null)
  TOKEN=$(echo "$AUTH_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  if [ -n "$TOKEN" ]; then
    ok "Login superuser ${ADMIN_EMAIL} riuscito"
  else
    ko "Login superuser fallito: $AUTH_RESP"
    TOKEN=""
  fi
else
  warn "Skip auth (PB non raggiungibile)"
  TOKEN=""
fi

# ---------- 5. Schema collezioni ----------
hd "5. Schema collezioni"
EXPECTED="users products product_images suppliers seasons lots allergens printer_settings app_settings temperature_logs reception_logs cleaning_logs cloud_settings lot_images wifi_settings"

if [ -n "$TOKEN" ]; then
  COLS_JSON=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
    "${PB_URL}/api/collections?perPage=100" 2>/dev/null)
  PRESENT=$(echo "$COLS_JSON" | tr ',' '\n' | sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | sort -u)
  echo "Collezioni presenti:"
  echo "$PRESENT" | sed 's/^/   - /'
  MISSING=""
  for c in $EXPECTED; do
    echo "$PRESENT" | grep -qx "$c" || MISSING="$MISSING $c"
  done
  if [ -z "$MISSING" ]; then
    ok "Tutte le 15 collezioni HACCP presenti"
  else
    ko "Collezioni MANCANTI:$MISSING"
    echo "    -> Lo schema non è stato importato. Controlla i log: docker logs <container> | grep -i schema"
  fi
else
  warn "Skip verifica collezioni (no token)"
fi

# ---------- 6. Persistenza dati ----------
hd "6. Persistenza dati ($PB_DATA_DIR)"
if [ -d "$PB_DATA_DIR" ]; then
  ok "Directory dati esiste"
  [ -f "$PB_DATA_DIR/data.db" ] && ok "data.db presente ($(du -h "$PB_DATA_DIR/data.db" | awk '{print $1}'))" || ko "data.db MANCANTE"
  [ -f "$PB_DATA_DIR/.superuser_bootstrapped" ] && ok "Marker superuser presente" || warn "Marker superuser assente"
  [ -f "$PB_DATA_DIR/.schema_imported" ] && ok "Marker schema importato (hash: $(cat "$PB_DATA_DIR/.schema_imported" | cut -c1-12)...)" || warn "Marker schema assente — l'import potrebbe non essere mai riuscito"
  [ -f "$PB_DATA_DIR/setup_complete.json" ] && ok "Setup wizard completato" || warn "Wizard di setup non ancora completato"
  [ -d "$PB_DATA_DIR/storage" ] && ok "Cartella storage (file uploads) presente" || warn "Cartella storage assente (nessun upload ancora?)"
else
  ko "Directory dati $PB_DATA_DIR NON ESISTE — il volume non è montato!"
fi

# ---------- 7. Test scrittura/lettura record ----------
hd "7. Test write/read su 'suppliers'"
if [ -n "$TOKEN" ]; then
  TEST_NAME="healthcheck-$(date +%s)"
  CREATE=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"name\":\"${TEST_NAME}\",\"notes\":\"created by healthcheck.sh\"}" \
    "${PB_URL}/api/collections/suppliers/records" 2>/dev/null)
  REC_ID=$(echo "$CREATE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  if [ -n "$REC_ID" ]; then
    ok "Record creato (id=$REC_ID)"
    READ=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections/suppliers/records/${REC_ID}" 2>/dev/null)
    echo "$READ" | grep -q "$TEST_NAME" && ok "Record letto correttamente" || ko "Record non leggibile"
    curl -s -X DELETE -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections/suppliers/records/${REC_ID}" >/dev/null 2>&1
    ok "Record di test rimosso"
  else
    ko "Creazione record fallita: $CREATE"
  fi
else
  warn "Skip test scrittura (no token)"
fi

# ---------- 8. Frontend statico ----------
hd "8. Frontend"
FE=$(curl -s -o /dev/null -w "%{http_code}" "${PB_URL}/" 2>/dev/null || echo "000")
[ "$FE" = "200" ] && ok "Frontend servito (200)" || ko "Frontend non servito (HTTP $FE)"

# ---------- Riepilogo ----------
hd "Riepilogo"
printf "${GREEN}OK: %d${NC}   ${YEL}WARN: %d${NC}   ${RED}FAIL: %d${NC}\n" "$PASS" "$WARN" "$FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
