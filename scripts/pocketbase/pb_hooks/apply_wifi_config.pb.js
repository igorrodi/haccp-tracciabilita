// Hook: when wifi_settings record is updated, write config request to shared volume
// The host-side haccp-wifi-watcher.service picks up the file and applies it
// PocketBase Goja engine — ES5 only, no const/let/arrow/template literals

onRecordAfterUpdateRequest(function(e) {
  var record = e.record;
  var ssid = record.getString("wifi_ssid");
  var password = record.getString("wifi_password");

  if (!ssid || ssid.length < 1) {
    return;
  }

  // Write wifi config request to shared volume (pb_data is mounted from host)
  // The host-side watcher will read this file and run setup-hotspot.sh
  var configContent = JSON.stringify({
    ssid: ssid,
    password: password || "",
    timestamp: new Date().toISOString()
  });

  try {
    $os.writeFile("/pb/pb_data/.wifi_config_request.json", configContent, 0o644);
    console.log("Wi-Fi config request scritto: SSID=" + ssid);
  } catch (err) {
    console.log("Errore scrittura Wi-Fi config request: " + err);
  }
}, "wifi_settings");
