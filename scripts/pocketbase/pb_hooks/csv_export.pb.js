/// <reference path="../pb_data/types.d.ts" />

// Cron Hook: CSV Export every night at 03:30
cronAdd("csv_export_nightly", "30 3 * * *", (e) => {
  const exportDir = $os.getenv("PB_DATA_DIR") || "/pb/pb_data";
  const csvDir = exportDir + "/exports";

  console.log("[CSV Export] Avvio generazione CSV...");

  try { $os.mkdirAll(csvDir, 0o755); } catch (err) {}

  // Rotation: delete old CSV files
  try {
    const files = $os.readDir(csvDir);
    for (let f of files) {
      if (f.name().endsWith(".csv")) {
        $os.remove(csvDir + "/" + f.name());
      }
    }
  } catch (err) {}

  const today = new Date().toISOString().split("T")[0];
  const baseUrl = $app.settings().meta.appUrl || "";
  let success = true;
  let errorMsg = "";

  const escapeCsv = (val) => {
    val = String(val || "");
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };

  try {
    // Load lookup tables
    const products = {};
    try {
      const prods = $app.dao().findRecordsByFilter("products", "", "", 0, 0);
      for (const p of prods) { products[p.getId()] = p.getString("name"); }
    } catch (e) {}

    const suppliers = {};
    try {
      const supps = $app.dao().findRecordsByFilter("suppliers", "", "", 0, 0);
      for (const s of supps) { suppliers[s.getId()] = s.getString("name"); }
    } catch (e) {}

    // Fetch all lots
    const lots = $app.dao().findRecordsByFilter("lots", "", "-production_date", 0, 0);

    // Fetch all lot_images grouped by lot_id
    const lotPhotos = {};
    try {
      const images = $app.dao().findRecordsByFilter("lot_images", "", "", 0, 0);
      for (const img of images) {
        const lotId = img.getString("lot_id");
        const filename = img.getString("image");
        if (lotId && filename) {
          if (!lotPhotos[lotId]) lotPhotos[lotId] = [];
          if (baseUrl) {
            lotPhotos[lotId].push(`${baseUrl}/api/files/lot_images/${img.getId()}/${filename}`);
          } else {
            lotPhotos[lotId].push(filename);
          }
        }
      }
    } catch (e) {}

    // Build single CSV
    let csv = "Prodotto,Numero Lotto,Fornitore,Data Produzione,Data Scadenza,Congelato,Data Congelamento,Note,Foto Etichette\n";

    for (const r of lots) {
      const productName = products[r.getString("product_id")] || "";
      const supplierName = suppliers[r.getString("supplier_id")] || "";
      const photos = lotPhotos[r.getId()] || [];

      csv += [
        escapeCsv(productName),
        escapeCsv(r.getString("lot_number")),
        escapeCsv(supplierName),
        escapeCsv(r.getString("production_date")),
        escapeCsv(r.getString("expiry_date")),
        escapeCsv(r.getBool("is_frozen") ? "Sì" : "No"),
        escapeCsv(r.getString("freezing_date")),
        escapeCsv(r.getString("notes")),
        escapeCsv(photos.join(" | ")),
      ].join(",") + "\n";
    }

    $os.writeFile(csvDir + `/Registro_Lotti_${today}.csv`, csv, 0o644);
    console.log(`[CSV Export] Registro Lotti: ${lots.length} record`);
  } catch (err) {
    console.log(`[CSV Export] Errore: ${err.message}`);
    success = false;
    errorMsg = err.message;
  }

  // Update export status
  try {
    let statusRecord;
    try {
      statusRecord = $app.dao().findFirstRecordByFilter("app_settings", "key = 'csv_export_status'");
    } catch (e) {}

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
