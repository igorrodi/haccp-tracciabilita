// Cloud Backup hooks: generate rclone.conf from cloud_settings, test, run.
// PocketBase Goja engine — ES5 only.

var RCLONE_CONF = "/pb/pb_data/rclone.conf";
var REMOTE_MARKER = "/pb/pb_data/.rclone-remote";

function obscurePassword(plain) {
  if (!plain) return "";
  try {
    var out = $os.cmd("rclone", "obscure", plain).output();
    // output returns Uint8Array
    var s = "";
    for (var i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
    return s.replace(/\s+$/g, "");
  } catch (err) {
    console.log("rclone obscure failed: " + err);
    return plain;
  }
}

function buildRcloneConf(rec) {
  var provider = rec.getString("provider");
  if (!provider || provider === "none") return null;

  var conf = "";
  var remoteName = "";

  if (provider === "mega") {
    remoteName = "mega";
    var email = rec.getString("mega_email");
    var pw = rec.getString("mega_password");
    if (!email || !pw) return null;
    conf =
      "[mega]\ntype = mega\nuser = " + email +
      "\npass = " + obscurePassword(pw) + "\n";
  } else if (provider === "gdrive") {
    remoteName = "gdrive";
    var cid = rec.getString("gdrive_client_id");
    var csec = rec.getString("gdrive_client_secret");
    var rtok = rec.getString("gdrive_refresh_token");
    if (!cid || !csec || !rtok) return null;
    var token = '{"access_token":"","token_type":"Bearer","refresh_token":"' +
      rtok + '","expiry":"0001-01-01T00:00:00Z"}';
    conf =
      "[gdrive]\ntype = drive\nclient_id = " + cid +
      "\nclient_secret = " + csec +
      "\nscope = drive\ntoken = " + token + "\n";
  } else if (provider === "dropbox") {
    remoteName = "dropbox";
    var dtok = rec.getString("dropbox_access_token");
    if (!dtok) return null;
    conf =
      "[dropbox]\ntype = dropbox\ntoken = {\"access_token\":\"" +
      dtok + "\"}\n";
  } else if (provider === "webdav") {
    remoteName = "webdav";
    var url = rec.getString("webdav_url");
    var user = rec.getString("webdav_username");
    var pass = rec.getString("webdav_password");
    if (!url) return null;
    conf =
      "[webdav]\ntype = webdav\nurl = " + url +
      "\nvendor = nextcloud\nuser = " + (user || "") +
      "\npass = " + obscurePassword(pass || "") + "\n";
  } else {
    return null;
  }
  return { conf: conf, remote: remoteName };
}

function writeRcloneConf(rec) {
  var built = buildRcloneConf(rec);
  if (!built) return false;
  try {
    $os.writeFile(RCLONE_CONF, built.conf, 0o600);
    $os.writeFile(REMOTE_MARKER, built.remote, 0o644);
    console.log("rclone.conf rigenerato per provider: " + built.remote);
    return true;
  } catch (err) {
    console.log("Errore scrittura rclone.conf: " + err);
    return false;
  }
}

// Auto-rigenera rclone.conf ogni volta che cloud_settings cambia
onRecordAfterCreateSuccess(function(e) {
  writeRcloneConf(e.record);
  e.next();
}, "cloud_settings");

onRecordAfterUpdateSuccess(function(e) {
  writeRcloneConf(e.record);
  e.next();
}, "cloud_settings");

function requireAdmin(e) {
  var auth = e.auth;
  if (!auth || auth.getString("role") !== "admin") {
    e.json(403, { "error": "Solo gli amministratori possono usare questa funzione" });
    return false;
  }
  return true;
}

function latestCloudRecord() {
  try {
    var recs = $app.findRecordsByFilter("cloud_settings", 'id != ""', "-created", 1, 0);
    if (recs && recs.length > 0) return recs[0];
  } catch (err) {
    console.log("cloud_settings query error: " + err);
  }
  return null;
}

// POST /api/cloud-backup/configure — rigenera rclone.conf on demand
routerAdd("POST", "/api/cloud-backup/configure", function(e) {
  if (!requireAdmin(e)) return;
  var rec = latestCloudRecord();
  if (!rec) return e.json(400, { "error": "Nessuna configurazione cloud salvata" });
  var ok = writeRcloneConf(rec);
  if (!ok) return e.json(400, { "error": "Credenziali incomplete per il provider selezionato" });
  return e.json(200, { "success": true, "provider": rec.getString("provider") });
});

// POST /api/cloud-backup/test — verifica connessione con rclone lsd
routerAdd("POST", "/api/cloud-backup/test", function(e) {
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
