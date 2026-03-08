/// <reference path="../pb_data/types.d.ts" />

// Updates & Backup status API
// GET /api/updates/status - Returns update log, backup list, and system status

routerAdd("GET", "/api/updates/status", (c) => {
  const fs = require("fs");
  const path = require("path");
  
  const response = {
    log_entries: [],
    backups: [],
  };
  
  // Parse update.log
  const logFile = "/pb/pb_data/update.log";
  try {
    if (fs.existsSync(logFile)) {
      const raw = fs.readFileSync(logFile, "utf8");
      const lines = raw.split('\n').filter(l => l.trim());
      
      // Parse log lines: "2024-01-01 12:00:00 [✓] Message"
      const entries = [];
      for (const line of lines.slice(-100)) { // Last 100 lines
        let level = 'info';
        let message = line;
        let timestamp = '';
        
        // Extract timestamp (first 19 chars if date format)
        const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+/);
        if (tsMatch) {
          timestamp = tsMatch[1];
          message = line.substring(tsMatch[0].length);
        }
        
        // Detect level from ANSI-stripped markers
        if (message.includes('[✓]') || message.includes('[✓]')) {
          level = 'ok';
          message = message.replace(/\[✓\]/g, '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        } else if (message.includes('[✗]') || message.includes('[✗]')) {
          level = 'error';
          message = message.replace(/\[✗\]/g, '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        } else if (message.includes('[!]')) {
          level = 'warn';
          message = message.replace(/\[!\]/g, '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        } else if (message.includes('[i]')) {
          level = 'info';
          message = message.replace(/\[i\]/g, '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        }
        
        // Clean remaining ANSI codes
        message = message.replace(/\x1b\[[0-9;]*m/g, '').trim();
        
        if (message && message !== '═══') {
          entries.push({
            timestamp: timestamp ? new Date(timestamp.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(),
            level: level,
            message: message
          });
        }
      }
      
      response.log_entries = entries.reverse(); // Most recent first
    }
  } catch (e) {
    // Ignore log parse errors
  }
  
  // List backups
  const backupDir = "/pb/pb_data/backups";
  try {
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      const dbFiles = files.filter(f => f.endsWith('.db') && f.startsWith('data_'));
      
      for (const file of dbFiles.sort().reverse()) {
        const filePath = backupDir + '/' + file;
        try {
          const stat = fs.statSync(filePath);
          const sizeKB = Math.round(stat.size / 1024);
          const sizeStr = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
          
          response.backups.push({
            name: file,
            size: sizeStr,
            date: stat.mtime.toISOString()
          });
        } catch (e) {
          // Skip files we can't stat
        }
      }
    }
  } catch (e) {
    // Ignore backup listing errors
  }
  
  return c.json(200, response);
});
