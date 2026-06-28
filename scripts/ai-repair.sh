#!/bin/sh
# AI Maintenance — diagnostica e azioni correttive per HACCP Tracker
# Uso:
#   ai-repair.sh diagnose                 -> stampa JSON con stato sistema
#   ai-repair.sh fix <action>             -> applica azione: restart_pb, vacuum_db,
#                                            prune_backups, free_space, retry_backup,
#                                            restart_all, fix_perms

set -u

DATA_DIR="${DATA_DIR:-/pb/pb_data}"
BACKUP_DIR="$DATA_DIR/backups"
DB_FILE="$DATA_DIR/data.db"
RCLONE_CONF="$DATA_DIR/rclone.conf"
REMOTE_MARKER="$DATA_DIR/.rclone-remote"

json_escape() {
  # escape backslash, quote, newline, carriage return, tab
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{ORS=""} {gsub(/\n/,"\\n"); gsub(/\r/,"\\r"); gsub(/\t/,"\\t"); print}'
}

bool() { [ "$1" = "1" ] && printf "true" || printf "false"; }

diagnose() {
  # Servizi (verificati nel container)
  PB_PID=$(pgrep -f "pocketbase serve" | head -n1 || true)
  PB_UP=0; [ -n "${PB_PID:-}" ] && PB_UP=1

  HTTP_OK=0
  if wget -q --spider --tries=1 --timeout=3 http://localhost:80/api/health 2>/dev/null; then
    HTTP_OK=1
  fi

  CUPS_OK=0
  if pgrep -f cupsd >/dev/null 2>&1; then CUPS_OK=1; fi

  # Disco
  DISK_LINE=$(df -Pk "$DATA_DIR" 2>/dev/null | tail -n1)
  DISK_TOTAL_KB=$(echo "$DISK_LINE" | awk '{print $2}')
  DISK_USED_KB=$(echo "$DISK_LINE" | awk '{print $3}')
  DISK_FREE_KB=$(echo "$DISK_LINE" | awk '{print $4}')
  DISK_PCT=$(echo "$DISK_LINE" | awk '{print $5}' | tr -d '%')
  : "${DISK_TOTAL_KB:=0}"; : "${DISK_FREE_KB:=0}"; : "${DISK_PCT:=0}"

  # Database
  DB_SIZE_KB=0
  [ -f "$DB_FILE" ] && DB_SIZE_KB=$(du -k "$DB_FILE" 2>/dev/null | awk '{print $1}')
  DB_INTEGRITY="unknown"
  if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB_FILE" ]; then
    DB_INTEGRITY=$(sqlite3 "$DB_FILE" "PRAGMA quick_check;" 2>/dev/null | head -n1)
    [ -z "$DB_INTEGRITY" ] && DB_INTEGRITY="unknown"
  fi

  # Backup
  BK_COUNT=0; BK_LAST=""; BK_LAST_AGE_H=999
  if [ -d "$BACKUP_DIR" ]; then
    BK_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name 'data_*.db' 2>/dev/null | wc -l | tr -d ' ')
    BK_LAST_FILE=$(ls -1t "$BACKUP_DIR"/data_*.db 2>/dev/null | head -n1)
    if [ -n "$BK_LAST_FILE" ]; then
      BK_LAST=$(basename "$BK_LAST_FILE")
      NOW=$(date +%s)
      MTIME=$(stat -c %Y "$BK_LAST_FILE" 2>/dev/null || stat -f %m "$BK_LAST_FILE" 2>/dev/null || echo "$NOW")
      BK_LAST_AGE_H=$(( (NOW - MTIME) / 3600 ))
    fi
  fi

  # Cloud
  CLOUD_REMOTE=""
  [ -f "$REMOTE_MARKER" ] && CLOUD_REMOTE=$(cat "$REMOTE_MARKER" 2>/dev/null | tr -d '\n')
  CLOUD_CONFIGURED=0; [ -f "$RCLONE_CONF" ] && [ -s "$RCLONE_CONF" ] && CLOUD_CONFIGURED=1
  CLOUD_REACH=0
  if [ "$CLOUD_CONFIGURED" = "1" ] && [ -n "$CLOUD_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
    if rclone --config "$RCLONE_CONF" lsd "${CLOUD_REMOTE}:" --contimeout 8s --timeout 12s --retries 1 >/dev/null 2>&1; then
      CLOUD_REACH=1
    fi
  fi

  # Connettività internet (per update/AI)
  NET_OK=0
  if wget -q --spider --tries=1 --timeout=4 https://github.com 2>/dev/null; then NET_OK=1; fi

  # Permessi pb_data
  PERMS_OK=1
  [ ! -w "$DATA_DIR" ] && PERMS_OK=0

  # Schema/collezioni — usa la stessa istanza PB via HTTP locale
  COLLECTIONS_OK=0
  if [ "$HTTP_OK" = "1" ]; then
    if wget -q -O - --tries=1 --timeout=3 http://localhost:80/api/collections/users/records?perPage=1 >/dev/null 2>&1; then
      COLLECTIONS_OK=1
    fi
  fi

  cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "services": {
    "pocketbase_running": $(bool $PB_UP),
    "http_health": $(bool $HTTP_OK),
    "cups_running": $(bool $CUPS_OK),
    "collections_reachable": $(bool $COLLECTIONS_OK)
  },
  "disk": {
    "total_kb": $DISK_TOTAL_KB,
    "free_kb": $DISK_FREE_KB,
    "used_percent": $DISK_PCT
  },
  "database": {
    "size_kb": $DB_SIZE_KB,
    "integrity": "$(json_escape "$DB_INTEGRITY")"
  },
  "backups": {
    "count": $BK_COUNT,
    "last_file": "$(json_escape "$BK_LAST")",
    "last_age_hours": $BK_LAST_AGE_H
  },
  "cloud": {
    "configured": $(bool $CLOUD_CONFIGURED),
    "provider": "$(json_escape "$CLOUD_REMOTE")",
    "reachable": $(bool $CLOUD_REACH)
  },
  "network": {
    "internet": $(bool $NET_OK)
  },
  "filesystem": {
    "pb_data_writable": $(bool $PERMS_OK)
  }
}
EOF
}

fix() {
  ACTION="${1:-}"
  case "$ACTION" in
    restart_pb)
      pkill -f "pocketbase serve" 2>/dev/null || true
      echo "Richiesto restart PocketBase (entrypoint riavvierà)"
      ;;
    vacuum_db)
      command -v sqlite3 >/dev/null 2>&1 || { echo "sqlite3 non disponibile"; exit 1; }
      sqlite3 "$DB_FILE" "VACUUM;" && echo "VACUUM completato"
      ;;
    prune_backups)
      # tieni gli ultimi 10
      cd "$BACKUP_DIR" 2>/dev/null || { echo "Nessuna cartella backup"; exit 0; }
      ls -1t data_*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
      echo "Backup vecchi rimossi (mantenuti ultimi 10)"
      ;;
    free_space)
      rm -f /tmp/*.log /var/log/*.0 /var/log/*.gz 2>/dev/null || true
      [ -d "$DATA_DIR/logs.db" ] && command -v sqlite3 >/dev/null 2>&1 && \
        sqlite3 "$DATA_DIR/logs.db" "DELETE FROM _logs WHERE created < datetime('now','-7 days'); VACUUM;" 2>/dev/null || true
      echo "Spazio liberato (log temporanei, log PB > 7gg)"
      ;;
    retry_backup)
      if [ -x /pb/rclone-sync.sh ]; then
        /pb/rclone-sync.sh
      else
        echo "rclone-sync.sh non trovato"; exit 1
      fi
      ;;
    fix_perms)
      chmod -R u+rwX "$DATA_DIR" 2>/dev/null || true
      echo "Permessi reimpostati su $DATA_DIR"
      ;;
    restart_all)
      pkill -f "pocketbase serve" 2>/dev/null || true
      pkill -f cupsd 2>/dev/null || true
      echo "Servizi terminati, l'entrypoint ripartirà"
      ;;
    *)
      echo "Azione sconosciuta: $ACTION" >&2
      echo "Disponibili: restart_pb vacuum_db prune_backups free_space retry_backup fix_perms restart_all" >&2
      exit 2
      ;;
  esac
}

CMD="${1:-diagnose}"
shift 2>/dev/null || true
case "$CMD" in
  diagnose) diagnose ;;
  fix)      fix "$@" ;;
  *) echo "Uso: $0 {diagnose|fix <action>}" >&2; exit 1 ;;
esac
