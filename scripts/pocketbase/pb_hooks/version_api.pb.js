/// <reference path="../pb_data/types.d.ts" />

// Version info API endpoint
// GET /api/version - Returns app version and update status

routerAdd("GET", "/api/version", (c) => {
  const fs = require("fs");
  
  let versionInfo = {
    app_version: "2.1.0",
    app_name: "HACCP Tracker",
    pocketbase_version: "0.36.6",
    last_update: null,
    last_check: null,
    update_status: "unknown",
    build_date: null,
  };
  
  // Read version.json if exists
  const versionFile = "/pb/pb_data/version.json";
  try {
    if (fs.existsSync(versionFile)) {
      const raw = fs.readFileSync(versionFile, "utf8");
      const data = JSON.parse(raw);
      versionInfo.last_update = data.last_update || null;
      versionInfo.last_check = data.last_check || null;
      versionInfo.update_status = data.status || "unknown";
    }
  } catch (e) {
    // Ignore read errors
  }
  
  // Check build date from pb_public
  try {
    const indexPath = "/pb/pb_public/index.html";
    if (fs.existsSync(indexPath)) {
      const stat = fs.statSync(indexPath);
      versionInfo.build_date = stat.mtime.toISOString();
    }
  } catch (e) {
    // Ignore
  }
  
  return c.json(200, versionInfo);
});
