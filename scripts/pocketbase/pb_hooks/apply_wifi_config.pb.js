// Hook: when wifi_settings record is updated, apply the new config
// PocketBase Goja engine — ES5 only, no const/let/arrow/template literals

onRecordAfterUpdateRequest(function(e) {
  var record = e.record;
  var ssid = record.getString("wifi_ssid");
  var password = record.getString("wifi_password");

  if (!ssid || ssid.length < 1) {
    return;
  }

  // Build hostapd.conf content
  var hostapdConf = "interface=wlan0\n";
  hostapdConf = hostapdConf + "driver=nl80211\n";
  hostapdConf = hostapdConf + "ssid=" + ssid + "\n";
  hostapdConf = hostapdConf + "hw_mode=g\n";
  hostapdConf = hostapdConf + "channel=6\n";
  hostapdConf = hostapdConf + "wmm_enabled=0\n";
  hostapdConf = hostapdConf + "macaddr_acl=0\n";
  hostapdConf = hostapdConf + "auth_algs=1\n";
  hostapdConf = hostapdConf + "ignore_broadcast_ssid=0\n";

  if (password && password.length >= 8) {
    hostapdConf = hostapdConf + "wpa=2\n";
    hostapdConf = hostapdConf + "wpa_passphrase=" + password + "\n";
    hostapdConf = hostapdConf + "wpa_key_mgmt=WPA-PSK\n";
    hostapdConf = hostapdConf + "rsn_pairwise=CCMP\n";
  }

  try {
    $os.writeFile("/etc/hostapd/hostapd.conf", hostapdConf, 0o644);
    $os.exec("systemctl", "restart", "hostapd");
    $os.exec("systemctl", "restart", "dnsmasq");
    console.log("Wi-Fi config applicata: SSID=" + ssid);
  } catch (err) {
    console.log("Errore applicazione Wi-Fi config: " + err);
  }
}, "wifi_settings");
