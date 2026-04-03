// Hook: POST /api/complete-setup
// Removes first_run.flag and applies WiFi config after wizard completion
// PocketBase Goja engine — ES5 only

routerAdd("POST", "/api/complete-setup", function(e) {
  // Verify authenticated admin
  var authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { "error": "Non autenticato" });
  }

  var role = authRecord.getString("role");
  if (role !== "admin") {
    return e.json(403, { "error": "Solo gli amministratori possono completare il setup" });
  }

  // Remove first_run flag
  try {
    $os.exec("rm", "-f", "/pb/pb_data/first_run.flag");
    console.log("first_run.flag rimosso");
  } catch (err) {
    console.log("Errore rimozione first_run.flag: " + err);
  }

  // Apply WiFi config if setup-hotspot.sh exists
  var body = $apis.requestInfo(e).body;
  var ssid = "";
  var password = "";

  if (body) {
    ssid = body.wifi_ssid || "";
    password = body.wifi_password || "";
  }

  if (ssid) {
    try {
      var args = ["--mode=normal", "--ssid=" + ssid];
      if (password && password.length >= 8) {
        args.push("--password=" + password);
      }
      $os.exec("/opt/haccp-tracker/setup-hotspot.sh", args[0], args[1], args[2] || "");
      console.log("Hotspot riconfigurato: SSID=" + ssid);
    } catch (err) {
      console.log("Errore applicazione hotspot: " + err);
      // Non-blocking — hotspot might not be available in container
    }
  }

  return e.json(200, { "success": true, "message": "Setup completato" });
});
