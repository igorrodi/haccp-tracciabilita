/// <reference path="../pb_data/types.d.ts" />

// Cron Hook: CSV Export every night at 03:30
cronAdd("csv_export_nightly", "30 3 * * *", (e) => {
  const fs = require("fs");
  const exportDir = $os.getenv("PB_DATA_DIR") || "/pb/pb_data";
  const csvDir = exportDir + "/exports";

  console.log("[CSV Export] Avvio generazione CSV...");

  // 1. Create exports directory if not exists
  try {
    $os.mkdirAll(csvDir, 0o755);
  } catch (err) {
    // directory already exists
  }

  // 2. Rotation: delete old CSV files
  try {
    const files = $os.readDir(csvDir);
    for (let f of files) {
      if (f.name().endsWith(".csv")) {
        $os.remove(csvDir + "/" + f.name());
      }
    }
    console.log("[CSV Export] Vecchi CSV eliminati");
  } catch (err) {
    console.log("[CSV Export] Nessun file precedente da eliminare");
  }

  const today = new Date().toISOString().split("T")[0];
  const tables = [
    { collection: "temperature_logs", filename: `Temperature_${today}.csv`, label: "Temperature" },
    { collection: "reception_logs", filename: `Ricezione_${today}.csv`, label: "Ricezione" },
    { collection: "cleaning_logs", filename: `Pulizie_${today}.csv`, label: "Pulizie" },
  ];

  let success = true;
  let errorMsg = "";

  for (const table of tables) {
    try {
      const records = $app.dao().findRecordsByFilter(
        table.collection,
        "",    // no filter = all records
        "-created",
        0,     // no limit
        0      // no offset
      );

      // CSV header
      let csv = "Data,Operatore,Valore,Note\n";

      for (const record of records) {
        const data = record.getString("date") || record.getString("created");
        const operatore = record.getString("operator") || "";
        const valore = record.getString("value") || "";
        const note = record.getString("notes") || "";

        // Escape CSV fields
        const escapeCsv = (val) => {
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        };

        csv += `${escapeCsv(data)},${escapeCsv(operatore)},${escapeCsv(valore)},${escapeCsv(note)}\n`;
      }

      // Write file
      $os.writeFile(csvDir + "/" + table.filename, csv, 0o644);
      console.log(`[CSV Export] ${table.label}: ${records.length} record esportati`);
    } catch (err) {
      console.log(`[CSV Export] Errore ${table.label}: ${err.message}`);
      success = false;
      errorMsg += `${table.label}: ${err.message}; `;
    }
  }

  // 3. Update export status in app_settings
  try {
    let statusRecord;
    try {
      statusRecord = $app.dao().findFirstRecordByFilter("app_settings", "key = 'csv_export_status'");
    } catch (e) {
      // not found, create
    }

    const statusValue = JSON.stringify({
      lastRun: new Date().toISOString(),
      status: success ? "success" : "error",
      error: errorMsg || null,
    });

    if (statusRecord) {
      statusRecord.set("value", statusValue);
      $app.dao().saveRecord(statusRecord);
    } else {
      const collection = $app.dao().findCollectionByNameOrId("app_settings");
      const record = new Record(collection);
      record.set("key", "csv_export_status");
      record.set("value", statusValue);
      $app.dao().saveRecord(record);
    }
  } catch (err) {
    console.log(`[CSV Export] Errore salvataggio stato: ${err.message}`);
  }

  console.log(`[CSV Export] Completato - Stato: ${success ? "SUCCESSO" : "ERRORE"}`);
});
