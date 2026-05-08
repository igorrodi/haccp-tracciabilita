// Hook: POST /api/complete-setup
// Removes first_run.flag and writes WiFi config request for host-side application
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
    $os.remove("/pb/pb_data/first_run.flag");
    console.log("first_run.flag rimosso");
  } catch (err) {
    console.log("Errore rimozione first_run.flag (potrebbe non esistere): " + err);
  }

  // Write WiFi config request to shared volume for host-side watcher
  var body = e.requestInfo().body;
  var ssid = "";
  var password = "";

  if (body) {
    ssid = body.wifi_ssid || "";
    password = body.wifi_password || "";
  }

  if (ssid) {
    var configContent = JSON.stringify({
      ssid: ssid,
      password: password || "",
      mode: "normal",
      timestamp: new Date().toISOString(),
      source: "complete-setup"
    });

    try {
      $os.writeFile("/pb/pb_data/.wifi_config_request.json", configContent, 0o644);
      console.log("WiFi config request scritto per host-side: SSID=" + ssid);
    } catch (err) {
      console.log("Errore scrittura WiFi config request: " + err);
    }
  }

  return e.json(200, { "success": true, "message": "Setup completato" });
});
