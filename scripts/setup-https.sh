#!/bin/bash
# =============================================================
# HACCP Tracker - Setup HTTPS + haccp.local (Caddy + Avahi/mDNS)
# Idempotente: rieseguibile senza effetti collaterali
# =============================================================
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/haccp-tracker}"
DATA_DIR="${APP_DIR}/data"
CADDY_DIR="${DATA_DIR}/caddy"
CADDY_CFG_DIR="${APP_DIR}/caddy"
GITHUB_REPO="${GITHUB_REPO:-igorrodi/haccp-tracciabilita}"
GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"

log()  { echo -e "\033[0;36m[https]\033[0m $1"; }
ok()   { echo -e "\033[0;32m[✓]\033[0m $1"; }
warn() { echo -e "\033[1;33m[!]\033[0m $1"; }
err()  { echo -e "\033[0;31m[✗]\033[0m $1"; }

[ "$EUID" -eq 0 ] || { err "Esegui come root"; exit 1; }

mkdir -p "${CADDY_DIR}" "${CADDY_CFG_DIR}"

# ---------- 1. Caddyfile ----------
log "Configuro Caddyfile..."
if [ ! -f "${CADDY_CFG_DIR}/Caddyfile" ]; then
  curl -sSL --fail "${GITHUB_RAW}/scripts/caddy/Caddyfile" \
    -o "${CADDY_CFG_DIR}/Caddyfile" 2>/dev/null \
    || { err "Download Caddyfile fallito"; exit 1; }
fi
ok "Caddyfile pronto"

# ---------- 2. mDNS / haccp.local ----------
log "Configuro mDNS (haccp.local)..."
if ! command -v avahi-daemon >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y --no-install-recommends avahi-daemon avahi-utils libnss-mdns >/dev/null 2>&1 \
    || warn "Installazione avahi fallita"
fi

# Hostname → haccp (così haccp.local risolve a questo Pi)
CURRENT_HN="$(hostname)"
if [ "$CURRENT_HN" != "haccp" ]; then
  log "Cambio hostname: $CURRENT_HN → haccp"
  hostnamectl set-hostname haccp 2>/dev/null || echo "haccp" > /etc/hostname
  if ! grep -q "127.0.1.1.*haccp" /etc/hosts; then
    sed -i '/127.0.1.1/d' /etc/hosts
    echo "127.0.1.1   haccp haccp.local" >> /etc/hosts
  fi
fi

systemctl enable --now avahi-daemon >/dev/null 2>&1 || warn "avahi-daemon non avviato"
ok "mDNS attivo: haccp.local"

# ---------- 3. Compose profile https ----------
log "Avvio profilo https in docker compose..."
cd "${APP_DIR}" || { err "APP_DIR non trovato: ${APP_DIR}"; exit 1; }

if ! grep -q "profiles:" docker-compose.yml || ! grep -q "caddy:" docker-compose.yml; then
  warn "docker-compose.yml non contiene il service 'caddy' — aggiorna l'app (./update.sh)"
  exit 1
fi

docker compose --profile https pull 2>/dev/null || true
docker compose --profile https up -d --remove-orphans \
  || { err "Avvio Caddy fallito"; exit 1; }
ok "Caddy avviato (porte 80/443)"

# ---------- 4. Healthcheck ----------
log "Verifica HTTPS..."
sleep 3
if curl -ksSf https://localhost/api/health >/dev/null 2>&1; then
  ok "HTTPS funzionante: https://localhost/api/health"
else
  warn "HTTPS non risponde ancora — attendi ~10s e riprova"
fi

# ---------- 5. Esporta CA root per i client ----------
ROOT_CA="${CADDY_DIR}/pki/authorities/local/root.crt"
if [ -f "${ROOT_CA}" ]; then
  cp "${ROOT_CA}" "${DATA_DIR}/haccp-root-ca.crt"
  chmod 644 "${DATA_DIR}/haccp-root-ca.crt"
  ok "Root CA esportata: ${DATA_DIR}/haccp-root-ca.crt"
  echo "  → Installala sui dispositivi client per evitare l'avviso del browser"
fi

IP="$(hostname -I | awk '{print $1}')"
echo ""
ok "═══════════════════════════════════════════════"
ok "  ✓ HTTPS ATTIVO"
ok "═══════════════════════════════════════════════"
echo "  App HTTPS:   https://haccp.local/    o   https://${IP}/"
echo "  Health:      https://haccp.local/api/health"
echo "  CA cert:     ${DATA_DIR}/haccp-root-ca.crt"
echo ""
