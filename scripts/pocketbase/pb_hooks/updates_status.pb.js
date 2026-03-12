/// <reference path="../pb_data/types.d.ts" />

// Updates & Backup status API
// GET /api/updates/status - Returns update log, backup list, and system status

routerAdd("GET", "/api/updates/status", function(c) {
  var response = {
    log_entries: [],
    backups: []
  };

  // Parse update.log
  var logFile = "/pb/pb_data/update.log";
  try {
    var raw = String.fromCharCode.apply(null, $os.readFile(logFile));
    var allLines = raw.split("\n");
    var lines = [];
    for (var i = 0; i < allLines.length; i++) {
      if (allLines[i].trim()) {
        lines.push(allLines[i]);
      }
    }

    // Last 100 lines
    var start = lines.length > 100 ? lines.length - 100 : 0;
    var entries = [];

    for (var j = start; j < lines.length; j++) {
      var line = lines[j];
      var level = "info";
      var message = line;
      var timestamp = "";

      // Extract timestamp
      var tsMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+/);
      if (tsMatch) {
        timestamp = tsMatch[1];
        message = line.substring(tsMatch[0].length);
      }

      // Detect level
      if (message.indexOf("[✓]") >= 0) {
        level = "ok";
        message = message.replace(/\[✓\]/g, "").trim();
      } else if (message.indexOf("[✗]") >= 0) {
        level = "error";
        message = message.replace(/\[✗\]/g, "").trim();
      } else if (message.indexOf("[!]") >= 0) {
        level = "warn";
        message = message.replace(/\[!\]/g, "").trim();
      } else if (message.indexOf("[i]") >= 0) {
        level = "info";
        message = message.replace(/\[i\]/g, "").trim();
      }

      // Clean ANSI codes
      message = message.replace(/\x1b\[[0-9;]*m/g, "").trim();

      if (message && message !== "═══") {
        entries.push({
          timestamp: timestamp ? new Date(timestamp.replace(" ", "T") + "Z").toISOString() : new Date().toISOString(),
          level: level,
          message: message
        });
      }
    }

    response.log_entries = entries.reverse();
  } catch (e) {
    // Ignore log parse errors
  }

  // List backups
  var backupDir = "/pb/pb_data/backups";
  try {
    var files = $os.readDir(backupDir);
    var dbFiles = [];
    for (var k = 0; k < files.length; k++) {
      var fname = files[k].name();
      if (fname.indexOf("data_") === 0 && fname.indexOf(".db") === fname.length - 3) {
        dbFiles.push(fname);
      }
    }

    dbFiles.sort().reverse();

    for (var m = 0; m < dbFiles.length; m++) {
      var filePath = backupDir + "/" + dbFiles[m];
      try {
        var fstat = $os.stat(filePath);
        var sizeKB = Math.round(fstat.size() / 1024);
        var sizeStr = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + " MB" : sizeKB + " KB";

        response.backups.push({
          name: dbFiles[m],
          size: sizeStr,
          date: fstat.modTime().string()
        });
      } catch (e) {
        // Skip
      }
    }
  } catch (e) {
    // Ignore
  }

  return c.json(200, response);
});
