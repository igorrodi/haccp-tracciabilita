#!/bin/sh
# HACCP Tracker - Backup su chiavetta/disco USB
# Uso: usb-backup.sh list | usb-backup.sh run [/dev/sdX1|auto]
# Piano B: se il dispositivo scelto non c'è, usa la prima partizione USB trovata.
DATA=/pb/pb_data
MNT=/mnt/haccp-usb
STATUS=$DATA/exports/.usb-status.json
LOG=$DATA/usb-backup.log
KEEP=14

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }
status() {
  mkdir -p "$DATA/exports"
  printf '{"lastRun":"%s","status":"%s","error":%s,"device":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:+\"$2\"}${2:-null}" "${3:-}" > "$STATUS"
}

list_parts() {
  for b in /sys/block/sd*; do
    [ -e "$b" ] || continue
    name=$(basename "$b")
    # solo dischi rimovibili/USB
    case "$(readlink -f "$b")" in *usb*) ;; *) [ "$(cat "$b/removable" 2>/dev/null)" = 1 ] || continue ;; esac
    parts=$(ls -d "$b/$name"* 2>/dev/null)
    [ -n "$parts" ] || parts="$b"
    for p in $parts; do
      dev=/dev/$(basename "$p")
      [ -b "$dev" ] || continue
      size=$(( $(cat "$p/size" 2>/dev/null || echo 0) * 512 / 1048576 ))
      info=$(blkid "$dev" 2>/dev/null)
      label=$(echo "$info" | sed -n 's/.* LABEL="\([^"]*\)".*/\1/p')
      fstype=$(echo "$info" | sed -n 's/.* TYPE="\([^"]*\)".*/\1/p')
      [ -n "$fstype" ] || continue
      printf '{"device":"%s","sizeMB":%s,"label":"%s","fstype":"%s"}\n' "$dev" "$size" "$label" "$fstype"
    done
  done
}

if [ "$1" = "list" ]; then list_parts; exit 0; fi
[ "$1" = "run" ] || { echo "uso: $0 list|run [device]"; exit 2; }

DEV="${2:-auto}"
if [ "$DEV" = "auto" ] || [ ! -b "$DEV" ]; then
  [ "$DEV" != "auto" ] && log "Dispositivo $DEV non trovato, cerco un'altra chiavetta"
  DEV=$(list_parts | head -n1 | sed -n 's/.*"device":"\([^"]*\)".*/\1/p')
fi
if [ -z "$DEV" ]; then log "Nessuna chiavetta USB trovata"; status error "Nessuna chiavetta USB collegata"; exit 1; fi

mkdir -p "$MNT"
umount "$MNT" 2>/dev/null
if ! mount "$DEV" "$MNT" 2>>"$LOG"; then
  # Piano B: prova esplicitamente i filesystem comuni
  for t in vfat exfat ext4 ntfs3 ntfs; do mount -t $t "$DEV" "$MNT" 2>/dev/null && break; done
fi
if ! mountpoint -q "$MNT" 2>/dev/null && ! grep -q " $MNT " /proc/mounts; then
  log "Impossibile aprire $DEV"; status error "Impossibile leggere la chiavetta (formato non supportato?)" "$DEV"; exit 1
fi

DAY=$(date +%Y-%m-%d)
DEST="$MNT/HACCP-Backup/$DAY"
mkdir -p "$DEST" || { umount "$MNT"; status error "Chiavetta in sola lettura o piena" "$DEV"; exit 1; }
ok=1
if [ -f "$DATA/data.db" ]; then
  sqlite3 "$DATA/data.db" ".backup '$DEST/data.db'" 2>>"$LOG" || cp "$DATA/data.db" "$DEST/data.db" || ok=0
fi
[ -d "$DATA/exports" ] && { cp -r "$DATA/exports" "$DEST/" 2>>"$LOG" || ok=0; }
[ -d "$DATA/storage" ] && { cp -r "$DATA/storage" "$DEST/foto" 2>>"$LOG" || log "foto non copiate (spazio?)"; }
# copia comoda dei file per le ispezioni nella radice della chiavetta
[ -d "$DATA/exports/ispezione" ] && { mkdir -p "$MNT/HACCP-Ispezione"; cp "$DATA/exports/ispezione/"* "$MNT/HACCP-Ispezione/" 2>/dev/null; }
# rotazione: tieni gli ultimi $KEEP giorni
ls -1d "$MNT/HACCP-Backup/"*/ 2>/dev/null | sort -r | awk -v k=$KEEP 'NR>k' | while read -r d; do rm -rf "$d"; done
sync
umount "$MNT" 2>>"$LOG" || log "Attenzione: smontaggio non riuscito"
if [ $ok = 1 ]; then log "Backup USB completato su $DEV"; status success "" "$DEV"; else status error "Copia incompleta" "$DEV"; exit 1; fi
