# Piano: install.sh + update.sh "all-in-one"

Obiettivo: un installer/updater robusto che rileva il sistema, prepara l'ambiente, installa/configura la web app, pulisce vecchie config senza toccare i dati utente, e infine lascia il wizard al sito.

## 1. Rilevamento sistema & parametri
- Rileva OS via `/etc/os-release` (RaspiOS, Debian, Ubuntu, Armbian) e applica:
  - package manager: `apt` (default), variabili `APT_OPTS="-y -o Dpkg::Options::=--force-confnew"`
  - rilevamento init: assicura `systemd`
  - rilevamento arch: `aarch64/arm64` raccomandato (warn altrimenti)
  - rilevamento board: Raspberry Pi vs Armbian SBC (legge `/proc/device-tree/model`)
  - rilevamento interfaccia Wi-Fi: `iw dev` → `$WIFI_IFACE` (es. `wld0` su Pi5/Armbian, fallback `wlan0`)
  - rilevamento NetworkManager vs dhcpcd vs Netplan per applicare config corrette
- Pre-flight: root, internet, RAM ≥ 1GB (warn), disco ≥ 1GB libero, tempo NTP sincronizzato (warn).

## 2. Pacchetti & preparazione sistema
- Aggiorna indici APT una sola volta, poi installa solo i mancanti (check con `dpkg -s`):
  - core: `curl ca-certificates jq sqlite3 rsync iproute2 iw rfkill`
  - hotspot/DNS: `hostapd dnsmasq`
  - rete (in base a quello che esiste): `network-manager` **oppure** `dhcpcd5` (no entrambi)
  - reverse proxy futuro: `caddy` (opzionale, flag `--with-caddy`)
  - Docker via `get.docker.com` se assente; abilita servizio
  - Docker Compose plugin v2 verificato
- Prepara sistema per le funzionalità app:
  - sblocca radio Wi-Fi: `rfkill unblock wifi`
  - disabilita `wpa_supplicant@$WIFI_IFACE` quando si usa hostapd
  - disabilita stub DNS di `systemd-resolved` (porta 53 libera per dnsmasq)
  - abilita `ip_forward` (sysctl persistente)
  - apre porte firewall se `ufw` attivo: 80, 443, 53/udp, 67/udp, 631
  - aggiunge utente corrente al gruppo `docker` (se non root login)
  - timezone Europe/Rome (configurabile)

## 3. Installazione & configurazione web app
- Crea struttura: `${APP_DIR}/` (codice), `${APP_DIR}/data/{pb_data,backups}` (dati).
- Migra automaticamente vecchio `./pb_data` → `./data/pb_data` (già presente, manteniamo).
- Scarica da GitHub raw: `docker-compose.yml`, `pb_schema.json`, `update.sh`, `setup-hotspot.sh`, `armbian-repair.sh` (con controllo integrità e backup `.prev` su file esistenti).
- Installa servizi systemd: `haccp-watchdog`, `haccp-wifi-watcher`.
- `docker compose pull && up -d --remove-orphans`.
- Attende `/api/health` (timeout 60s).

## 4. Pulizia vecchie config (SENZA toccare dati)
Lista PROTETTA (mai toccata): `${APP_DIR}/data/`, `pb_data*`, `backups/`, `rclone.conf`, `*.db*`, `.env` utente.

Da rimuovere se presenti:
- container/immagini Docker orfani: `docker compose down --remove-orphans`, `docker image prune -f`, vecchi container `haccp-*` non gestiti da compose
- vecchi file in `${APP_DIR}/` non più usati: `Dockerfile.old`, `pb_hooks/` a root, `*.bak`, `*.tmp`, `pb_data.old.*` più vecchi di 30gg (con conferma o flag `--purge-old`)
- vecchi servizi systemd dismessi: `haccp.service` legacy (solo se esiste e non più referenziato)
- vecchie regole NetworkManager/dhcpcd in conflitto con `$WIFI_IFACE`
- vecchio `rclone.conf` in `${APP_DIR}/` (già spostato in `data/`)

Backup difensivo: prima di qualsiasi rimozione, snapshot in `${APP_DIR}/data/backups/cleanup_<timestamp>.tar.gz` dei file che stiamo per cancellare.

## 5. Handoff al wizard web
- Verifica `/api/setup-check` → se `needsSetup=true`, crea `first_run.flag` e avvia `setup-hotspot.sh --mode=setup` (hotspot aperto `HACCP-Setup-XXXXXX`).
- Stampa istruzioni finali: URL `http://haccp.local/setup` o `http://192.168.4.1/setup`. Tutta la configurazione applicativa (admin, Wi-Fi client, backup cloud) avviene dal wizard web — l'installer non chiede più credenziali interattive (rimuoviamo il prompt Google Drive: si configura da UI).

## update.sh (allineato)
- Stessi step 1, 2 (solo verifica + installa mancanti), pull immagine, restart, health-check, rollback DB on failure (già presente).
- Aggiunge step di pulizia leggera (immagini orfane, log >30gg in `pb_data/logs/`).
- NON tocca dati utente, NON rilancia il wizard se già configurato.

## File modificati
- `install.sh` — riscritto con sezioni 1-5, idempotente, flag `--purge-old`, `--with-caddy`, `--non-interactive`.
- `update.sh` — aggiunta sezione check pacchetti + pulizia leggera.
- `scripts/system-prepare.sh` (nuovo) — funzioni condivise (detect_os, detect_wifi_iface, ensure_packages, prepare_network, cleanup_old) richiamabili anche da `armbian-repair.sh`.

## Note tecniche
- Tutte le rimozioni passano da una funzione `safe_remove()` che rifiuta path dentro la lista protetta.
- L'installer è completamente non-interattivo se eseguito con `HACCP_NONINTERACTIVE=1` (utile per CI/cron).
- Log centralizzato in `${APP_DIR}/data/pb_data/install.log` e `update.log`.
