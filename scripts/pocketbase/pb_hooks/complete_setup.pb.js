// Hook: POST /api/complete-setup
// Atomic first-run setup: creates the first admin, stores Wi-Fi settings,
// removes first_run.flag and returns an auth token for immediate login.
// PocketBase Goja engine — ES5 only

function writeWifiConfigRequest(ssid, password) {
  if (!ssid) return;

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

function saveWifiSettings(ssid, password, restaurantName) {
  if (!ssid) return;

  try {
    var collection = $app.findCollectionByNameOrId("wifi_settings");
    var records = $app.findRecordsByFilter("wifi_settings", 'id != ""', "", 1, 0);
    var record = records && records.length > 0 ? records[0] : new Record(collection);

    record.set("wifi_ssid", ssid);
    record.set("wifi_password", password || "");
    record.set("restaurant_name", restaurantName || "");
    $app.save(record);
  } catch (err) {
    console.log("Errore salvataggio wifi_settings: " + err);
  }
}

function markSetupComplete() {
  try {
    $os.remove("/pb/pb_data/first_run.flag");
    console.log("first_run.flag rimosso");
  } catch (err) {
    console.log("first_run.flag già assente o non rimovibile: " + err);
  }

  try {
    $os.writeFile("/pb/pb_data/setup_complete.json", JSON.stringify({
      completed: true,
      timestamp: new Date().toISOString()
    }), 0o644);
  } catch (err) {
    console.log("Errore scrittura setup_complete.json: " + err);
  }
}

routerAdd("POST", "/api/complete-setup", function(e) {
  var body = e.requestInfo().body || {};
  var email = (body.email || "").trim().toLowerCase();
  var adminPassword = body.password || "";
  var name = (body.name || "").trim();
  var ssid = (body.wifi_ssid || "HACCP-Tracciabilita").trim();
  var wifiPassword = body.wifi_password || "";
  var restaurantName = (body.restaurant_name || "").trim();

  var admins = [];
  try {
    admins = $app.findRecordsByFilter("users", 'role = "admin"', "", 1, 0);
  } catch (err) {
    return e.json(500, { "error": "Collezione utenti non inizializzata" });
  }

  var authRecord = null;

  if (!admins || admins.length === 0) {
    if (!email || adminPassword.length < 8) {
      return e.json(400, { "error": "Email e password admin valida sono obbligatorie" });
    }

    try {
      var usersCollection = $app.findCollectionByNameOrId("users");
      authRecord = new Record(usersCollection);
      authRecord.setEmail(email);
      authRecord.setPassword(adminPassword);
      authRecord.setVerified(true);
      authRecord.set("emailVisibility", true);
      authRecord.set("name", name);
      authRecord.set("role", "admin");
      $app.save(authRecord);
    } catch (err) {
      return e.json(400, { "error": "Errore creazione admin: " + err });
    }
  } else {
    authRecord = e.auth;
    if (!authRecord || authRecord.getString("role") !== "admin") {
      return e.json(403, { "error": "Setup già completato. Accedi con l'account amministratore." });
    }
  }

  saveWifiSettings(ssid, wifiPassword, restaurantName);
  writeWifiConfigRequest(ssid, wifiPassword);
  markSetupComplete();

  return e.json(200, {
    "success": true,
    "message": "Setup completato",
    "token": authRecord.newAuthToken(),
    "record": {
      "id": authRecord.id,
      "email": authRecord.email(),
      "emailVisibility": true,
      "name": authRecord.getString("name"),
      "role": authRecord.getString("role"),
      "collectionId": "_pb_users_auth_",
      "collectionName": "users"
    }
  });
});
