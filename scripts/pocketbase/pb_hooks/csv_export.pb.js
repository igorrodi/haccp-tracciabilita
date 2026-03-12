/// <reference path="../pb_data/types.d.ts" />

// Cron Hook: CSV Export every night at 03:30
cronAdd("csv_export_nightly", "30 3 * * *", function(e) {
  var csvDir = "/pb/pb_data/exports";

  console.log("[CSV Export] Avvio generazione CSV...");

  try { $os.mkdirAll(csvDir, 0o755); } catch (err) {}

  // Rotation: delete old CSV files
  try {
    var files = $os.readDir(csvDir);
    for (var i = 0; i < files.length; i++) {
      var fname = files[i].name();
      if (fname.indexOf(".csv") === fname.length - 4) {
        try { $os.remove(csvDir + "/" + fname); } catch (er) {}
      }
    }
  } catch (err) {}

  var today = new Date().toISOString().split("T")[0];
  var success = true;
  var errorMsg = "";

  function escapeCsv(val) {
    val = String(val || "");
    if (val.indexOf(",") >= 0 || val.indexOf('"') >= 0 || val.indexOf("\n") >= 0) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

  try {
    // Load lookup tables
    var products = {};
    try {
      var prods = $app.findRecordsByFilter("products", "1=1", "", 0, 0);
      for (var p = 0; p < prods.length; p++) {
        products[prods[p].id] = prods[p].get("name");
      }
    } catch (e) {}

    var suppliers = {};
    try {
      var supps = $app.findRecordsByFilter("suppliers", "1=1", "", 0, 0);
      for (var s = 0; s < supps.length; s++) {
        suppliers[supps[s].id] = supps[s].get("name");
      }
    } catch (e) {}

    // Fetch all lots
    var lots = $app.findRecordsByFilter("lots", "1=1", "-production_date", 0, 0);

    // Fetch lot_images grouped by lot_id
    var lotPhotos = {};
    try {
      var images = $app.findRecordsByFilter("lot_images", "1=1", "", 0, 0);
      for (var li = 0; li < images.length; li++) {
        var lotId = images[li].get("lot_id");
        var filename = images[li].get("image");
        if (lotId && filename) {
          if (!lotPhotos[lotId]) lotPhotos[lotId] = [];
          lotPhotos[lotId].push(filename);
        }
      }
    } catch (e) {}

    // Build CSV
    var csv = "Prodotto,Numero Lotto,Fornitore,Data Produzione,Data Scadenza,Congelato,Data Congelamento,Note,Foto Etichette\n";

    for (var l = 0; l < lots.length; l++) {
      var r = lots[l];
      var productName = products[r.get("product_id")] || "";
      var supplierName = suppliers[r.get("supplier_id")] || "";
      var photos = lotPhotos[r.id] || [];

      csv += [
        escapeCsv(productName),
        escapeCsv(r.get("lot_number")),
        escapeCsv(supplierName),
        escapeCsv(r.get("production_date")),
        escapeCsv(r.get("expiry_date")),
        r.get("is_frozen") ? "Si" : "No",
        escapeCsv(r.get("freezing_date")),
        escapeCsv(r.get("notes")),
        escapeCsv(photos.join(" | "))
      ].join(",") + "\n";
    }

    $os.writeFile(csvDir + "/Registro_Lotti_" + today + ".csv", csv, 0o644);
    console.log("[CSV Export] Registro Lotti: " + lots.length + " record");
  } catch (err) {
    console.log("[CSV Export] Errore: " + err);
    success = false;
    errorMsg = String(err);
  }

  // Update export status
  try {
    var statusValue = JSON.stringify({
      lastRun: new Date().toISOString(),
      status: success ? "success" : "error",
      error: errorMsg || null
    });

    var statusRecord;
    try {
      statusRecord = $app.findFirstRecordByFilter("app_settings", "key = 'csv_export_status'");
    } catch (e) {}

    if (statusRecord) {
      statusRecord.set("value", statusValue);
      $app.save(statusRecord);
    } else {
      var collection = $app.findCollectionByNameOrId("app_settings");
      var record = new Record(collection);
      record.set("key", "csv_export_status");
      record.set("value", statusValue);
      $app.save(record);
    }
  } catch (err) {
    console.log("[CSV Export] Errore salvataggio stato: " + err);
  }

  console.log("[CSV Export] Completato - Stato: " + (success ? "SUCCESSO" : "ERRORE"));
});
