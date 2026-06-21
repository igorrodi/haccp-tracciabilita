#!/bin/bash
# HACCP Tracker - Riparazione Armbian/Ubuntu/Raspberry Pi 5
# Esegue diagnosi e riparazione di:
#   - struttura dati persistente /opt/haccp-tracker/data/pb_data
#   - vecchia cartella ./pb_data migrata automaticamente
#   - mount Docker verso /pb/pb_data
#   - superuser PocketBase e import schema collezioni
#   - test scrittura/lettura con riavvio per confermare persistenza
#   - interfaccia Wi-Fi Armbian rilevata con iw dev, es. wld0
#
# Uso consigliato:
#   sudo bash /opt/haccp-tracker/armbian-repair.sh --reset-schema --fix-wifi
#   sudo bash /opt/haccp-tracker/armbian-repair.sh --check-only

set -u

APP_DIR="${APP_DIR:-/opt/haccp-tracker}"
DATA_DIR="${APP_DIR}/data"
PB_DATA="${DATA_DIR}/pb_data"
BACKUP_DIR="${DATA_DIR}/backups"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
SCHEMA_FILE="${APP_DIR}/pb_schema.json"
GITHUB_RAW="${GITHUB_RAW:-https://raw.githubusercontent.com/igorrodi/haccp-tracciabilita/main}"
PB_URL="${PB_URL:-http://127.0.0.1}"
ADMIN_EMAIL="${PB_SUPERUSER_EMAIL:-admin@haccp.local}"
ADMIN_PASSWORD="${PB_SUPERUSER_PASSWORD:-Admin123456!}"
EXPECTED_COLLECTIONS="users products product_images suppliers seasons lots allergens printer_settings app_settings temperature_logs reception_logs cleaning_logs cloud_settings lot_images wifi_settings"

CHECK_ONLY=0
RESET_SCHEMA=0
FIX_WIFI=0
SKIP_RESTART_TEST=0

for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    --reset-schema) RESET_SCHEMA=1 ;;
    --fix-wifi) FIX_WIFI=1 ;;
    --skip-restart-test) SKIP_RESTART_TEST=1 ;;
    --app-dir=*) APP_DIR="${arg#*=}"; DATA_DIR="${APP_DIR}/data"; PB_DATA="${DATA_DIR}/pb_data"; BACKUP_DIR="${DATA_DIR}/backups"; COMPOSE_FILE="${APP_DIR}/docker-compose.yml"; SCHEMA_FILE="${APP_DIR}/pb_schema.json" ;;
  esac
done

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FIXED=0; FAIL=0; WARN=0

ok() { printf "${GREEN}[ OK ]${NC} %s\n" "$1"; PASS=$((PASS+1)); }
fix() { printf "${YELLOW}[FIX ]${NC} %s\n" "$1"; FIXED=$((FIXED+1)); }
ko() { printf "${RED}[FAIL]${NC} %s\n" "$1"; FAIL=$((FAIL+1)); }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; WARN=$((WARN+1)); }
info() { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
hd() { printf "\n${BLUE}=== %s ===${NC}\n" "$1"; }

do_fix() {
  if [ "$CHECK_ONLY" = "1" ]; then
    info "Riparazione disponibile ma saltata in --check-only: $1"
    return 1
  fi
  return 0
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

container_id() {
  local cid=""
  if [ -f "$COMPOSE_FILE" ]; then
    cid=$(cd "$APP_DIR" && $COMPOSE ps -q haccp 2>/dev/null | head -1)
  fi
  [ -z "$cid" ] && cid=$(docker ps -a --filter "name=haccp" --format "{{.ID}}" | head -1)
  echo "$cid"
}

wait_pb() {
  local seconds="${1:-60}"
  local loops=$((seconds / 2))
  [ "$loops" -lt 1 ] && loops=1
  for i in $(seq 1 "$loops"); do
    if curl -sf "${PB_URL}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

pb_token() {
  local response=""
  response=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    "${PB_URL}/api/collections/_superusers/auth-with-password" 2>/dev/null || true)
  echo "$response" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' | head -1
}

missing_collections() {
  local token="$1"
  local cols present missing c
  cols=$(curl -s -H "Authorization: Bearer ${token}" "${PB_URL}/api/collections?perPage=200" 2>/dev/null || true)
  present=$(echo "$cols" | tr ',' '\n' | sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | sort -u)
  missing=""
  for c in $EXPECTED_COLLECTIONS; do
    echo "$present" | grep -qx "$c" || missing="$missing $c"
  done
  echo "$missing"
}

detect_wifi_iface() {
  local iw_iface=""
  if command -v iw >/dev/null 2>&1; then
    iw_iface=$(iw dev 2>/dev/null | awk '$1=="Interface"{print $2; exit}')
  fi
  if [ -z "$iw_iface" ]; then
    for iface in /sys/class/net/*/wireless; do
      [ -d "$iface" ] || continue
      iw_iface=$(basename "$(dirname "$iface")")
      break
    done
  fi
  if [ -z "$iw_iface" ]; then
    for cand in wld0 wlan0 wlp2s0 wlp3s0 wlx0; do
      [ -d "/sys/class/net/$cand" ] && iw_iface="$cand" && break
    done
  fi
  echo "$iw_iface"
}

hd "0. Pre-flight Armbian/Ubuntu"
[ "$(id -u)" = "0" ] || { ko "Esegui come root: sudo bash $0"; exit 2; }
command -v docker >/dev/null 2>&1 || { ko "Docker non installato"; exit 2; }
COMPOSE=$(compose_cmd)
[ -n "$COMPOSE" ] || { ko "Docker Compose non disponibile"; exit 2; }

if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_TEXT="${PRETTY_NAME:-${ID:-unknown}} ${ID_LIKE:-}"
  case "$OS_TEXT" in
    *Armbian*|*armbian*|*Ubuntu*|*ubuntu*|*Debian*|*debian*|*Raspberry*|*raspbian*) ok "OS compatibile: ${PRETTY_NAME:-$OS_TEXT}" ;;
    *) warn "OS non testato: ${PRETTY_NAME:-$OS_TEXT}" ;;
  esac
else
  warn "File /etc/os-release non trovato"
fi

WIFI_IFACE=$(detect_wifi_iface)
if [ -n "$WIFI_IFACE" ]; then
  ok "Interfaccia Wi-Fi rilevata: ${WIFI_IFACE}"
else
  warn "Nessuna interfaccia Wi-Fi rilevata con iw dev/sysfs"
fi

hd "1. Cartelle dati persistenti"
if [ ! -d "$APP_DIR" ]; then
  if do_fix "creare ${APP_DIR}"; then
    mkdir -p "$APP_DIR" || { ko "Impossibile creare $APP_DIR"; exit 2; }
    fix "Cartella app creata: $APP_DIR"
  fi
fi

if [ -d "${APP_DIR}/pb_data" ] && { [ ! -d "$PB_DATA" ] || [ -z "$(ls -A "$PB_DATA" 2>/dev/null)" ]; }; then
  if do_fix "migrare ${APP_DIR}/pb_data verso ${PB_DATA}"; then
    mkdir -p "$DATA_DIR"
    if [ -f "$COMPOSE_FILE" ]; then (cd "$APP_DIR" && $COMPOSE down >/dev/null 2>&1) || true; fi
    cp -a "${APP_DIR}/pb_data/." "$PB_DATA/" && mv "${APP_DIR}/pb_data" "${APP_DIR}/pb_data.old.$(date +%s)"
    fix "Migrazione completata: dati spostati in ${PB_DATA}"
  fi
fi

if [ ! -d "$PB_DATA" ]; then
  if do_fix "creare ${PB_DATA}"; then
    mkdir -p "$PB_DATA/exports" "$PB_DATA/backups" "$BACKUP_DIR"
    fix "Cartelle dati create"
  fi
else
  ok "Cartella dati presente: $PB_DATA"
fi

if [ -d "$PB_DATA" ]; then
  if [ ! -w "$PB_DATA" ]; then
    if do_fix "correggere permessi ${PB_DATA}"; then
      chmod -R u+rwX "$PB_DATA"
      fix "Permessi dati corretti"
    fi
  else
    ok "Cartella dati scrivibile"
  fi
fi

mkdir -p "$BACKUP_DIR" 2>/dev/null || true
[ -f "${DATA_DIR}/rclone.conf" ] || { [ "$CHECK_ONLY" = "1" ] || touch "${DATA_DIR}/rclone.conf" 2>/dev/null || true; }

hd "2. File installazione e compose"
if [ ! -f "$COMPOSE_FILE" ]; then
  ko "docker-compose.yml mancante"
  if do_fix "scaricare docker-compose.yml ufficiale"; then
    curl -fsSL "${GITHUB_RAW}/docker-compose.yml" -o "$COMPOSE_FILE" && fix "docker-compose.yml scaricato" || ko "Download docker-compose.yml fallito"
  fi
else
  ok "docker-compose.yml presente"
fi

if [ -f "$COMPOSE_FILE" ]; then
  if grep -q "./data/pb_data:/pb/pb_data" "$COMPOSE_FILE"; then
    ok "Volume dati corretto: ./data/pb_data -> /pb/pb_data"
  else
    ko "Volume dati non allineato alla nuova struttura"
    if do_fix "aggiornare mount in docker-compose.yml"; then
      cp "$COMPOSE_FILE" "${COMPOSE_FILE}.bak.$(date +%s)"
      sed -i 's#\./pb_data:/pb/pb_data#./data/pb_data:/pb/pb_data#g; s#\./backups:/pb/pb_data/backups#./data/backups:/pb/pb_data/backups#g; s#\./rclone.conf:/pb/pb_data/rclone.conf#./data/rclone.conf:/pb/pb_data/rclone.conf#g' "$COMPOSE_FILE"
      if grep -q "./data/pb_data:/pb/pb_data" "$COMPOSE_FILE"; then
        fix "docker-compose.yml aggiornato"
      else
        warn "Non ho potuto correggere automaticamente il compose: verifica la sezione volumes"
      fi
    fi
  fi
fi

if [ ! -f "$SCHEMA_FILE" ]; then
  ko "pb_schema.json mancante in ${SCHEMA_FILE}"
  if do_fix "scaricare pb_schema.json"; then
    curl -fsSL "${GITHUB_RAW}/scripts/pocketbase/pb_schema.json" -o "$SCHEMA_FILE" && fix "pb_schema.json scaricato" || ko "Download schema fallito"
  fi
else
  ok "pb_schema.json presente"
fi

hd "3. Container PocketBase"
if [ -f "$COMPOSE_FILE" ] && [ "$CHECK_ONLY" != "1" ]; then
  (cd "$APP_DIR" && $COMPOSE up -d --remove-orphans) >/dev/null 2>&1 || ko "docker compose up fallito"
fi

CID=$(container_id)
if [ -z "$CID" ]; then
  ko "Container HACCP non trovato"
else
  STATE=$(docker inspect --format '{{.State.Status}}' "$CID" 2>/dev/null || echo unknown)
  [ "$STATE" = "running" ] && ok "Container in esecuzione: $CID" || ko "Container non running: $STATE"
  MOUNTS=$(docker inspect --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' "$CID" 2>/dev/null || true)
  if echo "$MOUNTS" | grep -q "${PB_DATA} -> /pb/pb_data"; then
    ok "Mount persistente corretto verso /pb/pb_data"
  else
    warn "Mount /pb/pb_data non confermato; mount rilevati:\n${MOUNTS}"
  fi
fi

if wait_pb 80; then
  ok "PocketBase risponde su ${PB_URL}/api/health"
else
  ko "PocketBase non risponde su ${PB_URL}/api/health"
fi

hd "4. Superuser e schema database"
TOKEN=$(pb_token)
if [ -z "$TOKEN" ] && [ -n "$CID" ]; then
  ko "Login superuser fallito con ${ADMIN_EMAIL}"
  if do_fix "creare/aggiornare superuser PocketBase"; then
    docker exec "$CID" pocketbase superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --dir=/pb/pb_data >/tmp/haccp-superuser.log 2>&1 \
      && fix "Superuser PocketBase creato/aggiornato" \
      || { ko "Superuser upsert fallito"; cat /tmp/haccp-superuser.log 2>/dev/null || true; }
    sleep 2
    TOKEN=$(pb_token)
  fi
fi

if [ -n "$TOKEN" ]; then
  ok "Login superuser OK"
else
  ko "Impossibile ottenere token superuser: import schema non possibile"
fi

if [ "$RESET_SCHEMA" = "1" ] && [ -d "$PB_DATA" ]; then
  if do_fix "rimuovere marker schema per re-import"; then
    rm -f "${PB_DATA}/.schema_imported"
    fix "Marker schema rimosso"
  fi
fi

MISSING=""
if [ -n "$TOKEN" ]; then
  MISSING=$(missing_collections "$TOKEN")
  if [ -z "$MISSING" ]; then
    ok "Tutte le collezioni HACCP sono presenti"
  else
    ko "Collezioni mancanti:${MISSING}"
  fi
fi

if { [ -n "$MISSING" ] || [ "$RESET_SCHEMA" = "1" ]; } && [ -n "$CID" ] && [ -n "$TOKEN" ]; then
  if do_fix "importare schema collezioni da pb_schema.json"; then
    docker exec -i -e PB_SUPERUSER_EMAIL="$ADMIN_EMAIL" -e PB_SUPERUSER_PASSWORD="$ADMIN_PASSWORD" "$CID" sh <<'IN_CONTAINER'
set -u
AUTH=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"identity\":\"${PB_SUPERUSER_EMAIL}\",\"password\":\"${PB_SUPERUSER_PASSWORD}\"}" \
  "http://127.0.0.1/api/collections/_superusers/auth-with-password" || true)
TOKEN=$(echo "$AUTH" | jq -r '.token // empty' 2>/dev/null)
[ -n "$TOKEN" ] || { echo "Token superuser non ottenuto"; exit 1; }
jq -n --slurpfile cols /pb/pb_schema.json '{collections:$cols[0],deleteMissing:false}' > /tmp/haccp-import-schema.json || exit 1
HTTP=$(curl -s -o /tmp/haccp-import-result.json -w "%{http_code}" \
  -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
  --data-binary @/tmp/haccp-import-schema.json \
  "http://127.0.0.1/api/collections/import")
if [ "$HTTP" = "200" ] || [ "$HTTP" = "204" ]; then
  sha256sum /pb/pb_schema.json 2>/dev/null | awk '{print $1}' > /pb/pb_data/.schema_imported
  exit 0
fi
cat /tmp/haccp-import-result.json 2>/dev/null || true
echo "HTTP $HTTP"
exit 1
IN_CONTAINER
    if [ "$?" = "0" ]; then
      fix "Schema PocketBase importato"
      sleep 2
      TOKEN=$(pb_token)
      MISSING=$(missing_collections "$TOKEN")
      [ -z "$MISSING" ] && ok "Verifica post-import OK" || ko "Restano mancanti:${MISSING}"
    else
      ko "Import schema fallito"
    fi
  fi
fi

hd "5. Test persistenza dati"
if [ -d "$PB_DATA" ]; then
  [ -f "${PB_DATA}/data.db" ] && ok "Database SQLite presente: ${PB_DATA}/data.db" || warn "data.db non ancora presente"
  if [ -f "${PB_DATA}/data.db" ] && [ "$CHECK_ONLY" != "1" ]; then
    TS=$(date '+%Y%m%d_%H%M%S')
    if command -v sqlite3 >/dev/null 2>&1; then
      sqlite3 "${PB_DATA}/data.db" ".backup '${BACKUP_DIR}/pre-repair-${TS}.db'" 2>/dev/null && fix "Backup SQLite creato: ${BACKUP_DIR}/pre-repair-${TS}.db" || warn "Backup sqlite3 non riuscito"
    else
      cp "${PB_DATA}/data.db" "${BACKUP_DIR}/pre-repair-${TS}.db" 2>/dev/null && fix "Backup file creato: ${BACKUP_DIR}/pre-repair-${TS}.db" || true
    fi
  fi
fi

if [ -n "$TOKEN" ]; then
  TEST_NAME="persist-armbian-$(date +%s)"
  CREATE=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"name\":\"${TEST_NAME}\",\"notes\":\"armbian repair persistence probe\"}" \
    "${PB_URL}/api/collections/suppliers/records" 2>/dev/null || true)
  RID=$(echo "$CREATE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  if [ -n "$RID" ]; then
    ok "Scrittura DB OK (record test $RID)"
    if [ "$SKIP_RESTART_TEST" != "1" ] && [ "$CHECK_ONLY" != "1" ]; then
      (cd "$APP_DIR" && $COMPOSE restart haccp >/dev/null 2>&1) && fix "Container riavviato per test persistenza" || warn "Restart container non riuscito"
      if wait_pb 80; then
        TOKEN=$(pb_token)
        READ=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections/suppliers/records/${RID}" 2>/dev/null || true)
        echo "$READ" | grep -q "$TEST_NAME" && ok "Persistenza dopo riavvio OK" || ko "Record non trovato dopo riavvio: persistenza non confermata"
      else
        ko "PocketBase non torna online dopo restart"
      fi
    fi
    [ -n "$TOKEN" ] && curl -s -X DELETE -H "Authorization: Bearer ${TOKEN}" "${PB_URL}/api/collections/suppliers/records/${RID}" >/dev/null 2>&1 || true
  else
    ko "Scrittura DB fallita: $CREATE"
  fi
fi

hd "6. Wi-Fi Armbian / hotspot"
if [ -n "$WIFI_IFACE" ]; then
  if [ -f /etc/dnsmasq.d/haccp-hotspot.conf ]; then
    grep -q "interface=${WIFI_IFACE}" /etc/dnsmasq.d/haccp-hotspot.conf && ok "dnsmasq usa ${WIFI_IFACE}" || warn "dnsmasq non usa ${WIFI_IFACE}"
    grep -q '^bind-interfaces' /etc/dnsmasq.d/haccp-hotspot.conf && ok "dnsmasq ha bind-interfaces" || warn "dnsmasq senza bind-interfaces"
  else
    info "dnsmasq hotspot non ancora configurato"
  fi

  if ip -4 addr show dev "$WIFI_IFACE" 2>/dev/null | grep -q '192\.168\.4\.1/24'; then
    ok "${WIFI_IFACE} ha IP statico 192.168.4.1/24"
  else
    warn "${WIFI_IFACE} non ha IP 192.168.4.1/24"
  fi

  if [ "$FIX_WIFI" = "1" ] || [ -f "${PB_DATA}/first_run.flag" ]; then
    if do_fix "applicare hotspot su ${WIFI_IFACE}"; then
      if [ -x "${APP_DIR}/setup-hotspot.sh" ]; then
        MODE="normal"
        [ -f "${PB_DATA}/first_run.flag" ] && MODE="setup"
        "${APP_DIR}/setup-hotspot.sh" --mode="$MODE" --iface="$WIFI_IFACE" && fix "Hotspot configurato su ${WIFI_IFACE}" || ko "setup-hotspot.sh fallito"
      else
        ko "${APP_DIR}/setup-hotspot.sh non trovato o non eseguibile"
      fi
    fi
  else
    info "Per applicare anche la configurazione hotspot esegui con --fix-wifi"
  fi
fi

if [ -f "${APP_DIR}/scripts/haccp-wifi-watcher.service" ] && [ ! -f /etc/systemd/system/haccp-wifi-watcher.service ]; then
  if do_fix "installare haccp-wifi-watcher.service"; then
    cp "${APP_DIR}/scripts/haccp-wifi-watcher.service" /etc/systemd/system/haccp-wifi-watcher.service
    systemctl daemon-reload
    systemctl enable --now haccp-wifi-watcher.service >/dev/null 2>&1 && fix "Wi-Fi watcher installato" || warn "Wi-Fi watcher non avviato"
  fi
elif systemctl list-unit-files haccp-wifi-watcher.service >/dev/null 2>&1; then
  systemctl is-active --quiet haccp-wifi-watcher.service && ok "Wi-Fi watcher attivo" || warn "Wi-Fi watcher non attivo"
fi

hd "Riepilogo"
printf "${GREEN}OK: %d${NC}   ${YELLOW}FIX: %d${NC}   ${YELLOW}WARN: %d${NC}   ${RED}FAIL: %d${NC}\n" "$PASS" "$FIXED" "$WARN" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Comando consigliato: sudo bash ${APP_DIR}/armbian-repair.sh --reset-schema --fix-wifi"
  exit 1
fi
exit 0