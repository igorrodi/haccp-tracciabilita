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
    var rtok = (rec.getString("gdrive_refresh_token") || "").trim();
    if (!rtok) return null;
    var token;
    if (rtok.charAt(0) === "{") {
      // Token completo incollato da `rclone authorize "drive"` (accesso classico)
      token = rtok.replace(/\s*\n\s*/g, "");
    } else {
      if (!cid || !csec) return null;
      token = '{"access_token":"","token_type":"Bearer","refresh_token":"' +
        rtok + '","expiry":"0001-01-01T00:00:00Z"}';
    }
    conf = "[gdrive]\ntype = drive\n";
    if (cid && csec) conf += "client_id = " + cid + "\nclient_secret = " + csec + "\n";
    conf += "scope = drive\ntoken = " + token + "\n";
  } else if (provider === "onedrive") {
    remoteName = "onedrive";
    var otok = (rec.getString("onedrive_token") || "").trim().replace(/\s*\n\s*/g, "");
    if (!otok || otok.charAt(0) !== "{") return null;
    var driveId = rec.getString("onedrive_drive_id");
    var driveType = rec.getString("onedrive_drive_type") || "personal";
    if (!driveId) {
      // Ricava l'ID del disco OneDrive dal token appena incollato
      try {
        var at = JSON.parse(otok).access_token;
        var res = $http.send({
          url: "https://graph.microsoft.com/v1.0/me/drive",
          method: "GET",
          headers: { "Authorization": "Bearer " + at },
          timeout: 20
        });
        if (res.statusCode === 200 && res.json && res.json.id) {
          driveId = res.json.id;
          driveType = res.json.driveType || driveType;
          try { $os.writeFile("/pb/pb_data/.onedrive-drive", driveId + "\n" + driveType, 0o600); } catch (wErr) {}
        } else {
          console.log("OneDrive: lettura disco fallita HTTP " + res.statusCode);
        }
      } catch (odErr) {
        console.log("OneDrive: errore lettura disco: " + odErr);
      }
      if (!driveId) {
        try {
          var cached = String($os.readFile("/pb/pb_data/.onedrive-drive")).split("\n");
          driveId = cached[0]; driveType = cached[1] || driveType;
        } catch (cErr) {}
      }
    }
    if (!driveId) return null;
    conf = "[onedrive]\ntype = onedrive\ntoken = " + otok +
      "\ndrive_id = " + driveId + "\ndrive_type = " + driveType + "\n";
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
    var recs = $app.findRecordsByFilter("cloud_settings", 'id != ""', "", 1, 0);
    if (recs && recs.length > 0) return recs[0];
  } catch (err) {
    console.log("cloud_settings query error: " + err);
  }
  return null;
}


module.exports = { writeRcloneConf: writeRcloneConf, requireAdmin: requireAdmin, latestCloudRecord: latestCloudRecord, RCLONE_CONF: RCLONE_CONF, REMOTE_MARKER: REMOTE_MARKER };
