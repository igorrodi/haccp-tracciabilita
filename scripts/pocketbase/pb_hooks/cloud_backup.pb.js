// Cloud Backup hooks (ES5). Helper in lib/cloud.js: gli handler PocketBase non vedono le funzioni top-level.
// Auto-rigenera rclone.conf ogni volta che cloud_settings cambia
onRecordAfterCreateSuccess(function(e) {
  var C = require(__hooks + "/lib/cloud.js"); var writeRcloneConf = C.writeRcloneConf, requireAdmin = C.requireAdmin, latestCloudRecord = C.latestCloudRecord, RCLONE_CONF = C.RCLONE_CONF, REMOTE_MARKER = C.REMOTE_MARKER;
  writeRcloneConf(e.record);
  e.next();
}, "cloud_settings");

onRecordAfterUpdateSuccess(function(e) {
  var C = require(__hooks + "/lib/cloud.js"); var writeRcloneConf = C.writeRcloneConf, requireAdmin = C.requireAdmin, latestCloudRecord = C.latestCloudRecord, RCLONE_CONF = C.RCLONE_CONF, REMOTE_MARKER = C.REMOTE_MARKER;
  writeRcloneConf(e.record);
  e.next();
}, "cloud_settings");

// POST /api/cloud-backup/configure — rigenera rclone.conf on demand
routerAdd("POST", "/api/cloud-backup/configure", function(e) {
  var C = require(__hooks + "/lib/cloud.js"); var writeRcloneConf = C.writeRcloneConf, requireAdmin = C.requireAdmin, latestCloudRecord = C.latestCloudRecord, RCLONE_CONF = C.RCLONE_CONF, REMOTE_MARKER = C.REMOTE_MARKER;
  if (!requireAdmin(e)) return;
  var rec = latestCloudRecord();
  if (!rec) return e.json(400, { "error": "Nessuna configurazione cloud salvata" });
  var ok = writeRcloneConf(rec);
  if (!ok) return e.json(400, { "error": "Credenziali incomplete per il provider selezionato" });
  return e.json(200, { "success": true, "provider": rec.getString("provider") });
});

// POST /api/cloud-backup/test — verifica connessione con rclone lsd
routerAdd("POST", "/api/cloud-backup/test", function(e) {
  var C = require(__hooks + "/lib/cloud.js"); var writeRcloneConf = C.writeRcloneConf, requireAdmin = C.requireAdmin, latestCloudRecord = C.latestCloudRecord, RCLONE_CONF = C.RCLONE_CONF, REMOTE_MARKER = C.REMOTE_MARKER;
  if (!requireAdmin(e)) return;
  var rec = latestCloudRecord();
  if (!rec) return e.json(400, { "error": "Nessuna configurazione cloud salvata" });
  writeRcloneConf(rec);

  var remote = "";
  try { remote = String($os.readFile(REMOTE_MARKER)); } catch (err) { remote = ""; }
  if (!remote) return e.json(400, { "error": "Provider non configurato" });

  try {
    var cmd = $os.cmd("rclone", "lsd", remote + ":", "--config", RCLONE_CONF,
      "--contimeout", "15s", "--timeout", "30s", "--retries", "1");
    var out = cmd.combinedOutput();
    var text = "";
    for (var i = 0; i < out.length; i++) text += String.fromCharCode(out[i]);
    return e.json(200, { "success": true, "provider": remote, "output": text.substring(0, 500) });
  } catch (err) {
    return e.json(500, { "success": false, "error": String(err) });
  }
});

// POST /api/cloud-backup/run — esegue rclone-sync.sh in background
routerAdd("POST", "/api/cloud-backup/run", function(e) {
  var C = require(__hooks + "/lib/cloud.js"); var writeRcloneConf = C.writeRcloneConf, requireAdmin = C.requireAdmin, latestCloudRecord = C.latestCloudRecord, RCLONE_CONF = C.RCLONE_CONF, REMOTE_MARKER = C.REMOTE_MARKER;
  if (!requireAdmin(e)) return;
  var rec = latestCloudRecord();
  if (!rec) return e.json(400, { "error": "Nessuna configurazione cloud salvata" });
  writeRcloneConf(rec);

  try {
    // Lancia in background: usa sh -c con &
    $os.cmd("sh", "-c", "/pb/rclone-sync.sh >> /pb/pb_data/rclone-sync.log 2>&1 &").run();
    return e.json(200, { "success": true, "message": "Backup avviato in background" });
  } catch (err) {
    return e.json(500, { "success": false, "error": String(err) });
  }
});
