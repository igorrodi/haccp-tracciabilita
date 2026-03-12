/// <reference path="../pb_data/types.d.ts" />

// Version info API endpoint
// GET /api/version - Returns app version and update status

routerAdd("GET", "/api/version", function(c) {
  var versionInfo = {
    app_version: "2.1.0",
    app_name: "HACCP Tracker",
    pocketbase_version: "0.36.6",
    last_update: null,
    last_check: null,
    update_status: "unknown",
    build_date: null
  };

  // Read version.json if exists
  var versionFile = "/pb/pb_data/version.json";
  try {
    var raw = String.fromCharCode.apply(null, $os.readFile(versionFile));
    var data = JSON.parse(raw);
    versionInfo.last_update = data.last_update || null;
    versionInfo.last_check = data.last_check || null;
    versionInfo.update_status = data.status || "unknown";
  } catch (e) {
    // File not found or parse error, ignore
  }

  // Check build date from pb_public
  try {
    var stat = $os.stat("/pb/pb_public/index.html");
    if (stat) {
      versionInfo.build_date = stat.modTime().string();
    }
  } catch (e) {
    // Ignore
  }

  return c.json(200, versionInfo);
});
