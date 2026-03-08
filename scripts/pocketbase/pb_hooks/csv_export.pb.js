/// <reference path="../pb_data/types.d.ts" />

// Cron Hook: CSV Export every night at 03:30
cronAdd("csv_export_nightly", "30 3 * * *", (e) => {
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
  const baseUrl = $app.settings().meta.appUrl || "";

  let success = true;
  let errorMsg = "";

  // Helper: escape CSV field
  const escapeCsv = (val) => {
    val = String(val || "");
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };

  // --- PRODOTTI ---
  try {
    const records = $app.dao().findRecordsByFilter("products", "", "name", 0, 0);
    let csv = "ID,Nome,Ingredienti,Procedura Preparazione,Durata (giorni),Data Creazione\n";
    for (const r of records) {
      csv += [
        escapeCsv(r.getId()),
        escapeCsv(r.getString("name")),
        escapeCsv(r.getString("ingredients")),
        escapeCsv(r.getString("preparation_procedure")),
        escapeCsv(r.getInt("shelf_life_days") || ""),
        escapeCsv(r.getString("created")),
      ].join(",") + "\n";
    }
    $os.writeFile(csvDir + `/Prodotti_${today}.csv`, csv, 0o644);
    console.log(`[CSV Export] Prodotti: ${records.length} record`);
  } catch (err) {
    console.log(`[CSV Export] Errore Prodotti: ${err.message}`);
    success = false;
    errorMsg += `Prodotti: ${err.message}; `;
  }

  // --- LOTTI (con link foto) ---
  try {
    const records = $app.dao().findRecordsByFilter("lots", "", "-production_date", 0, 0);
    let csv = "ID,Numero Lotto,Prodotto ID,Fornitore ID,Data Produzione,Data Scadenza,Congelato,Data Congelamento,Note,Foto Etichette\n";

    for (const r of records) {
      // Trova foto associate dal collection lot_images
      let photoLinks = "";
      try {
        const images = $app.dao().findRecordsByFilter("lot_images", `lot_id = "${r.getId()}"`, "", 0, 0);
        const links = [];
        for (const img of images) {
          const filename = img.getString("image");
          if (filename && baseUrl) {
            links.push(`${baseUrl}/api/files/lot_images/${img.getId()}/${filename}`);
          } else if (filename) {
            links.push(filename);
          }
        }
        photoLinks = links.join(" | ");
      } catch (imgErr) {
        // lot_images collection might not exist yet
      }

      csv += [
        escapeCsv(r.getId()),
        escapeCsv(r.getString("lot_number")),
        escapeCsv(r.getString("product_id")),
        escapeCsv(r.getString("supplier_id")),
        escapeCsv(r.getString("production_date")),
        escapeCsv(r.getString("expiry_date")),
        escapeCsv(r.getBool("is_frozen") ? "Sì" : "No"),
        escapeCsv(r.getString("freezing_date")),
        escapeCsv(r.getString("notes")),
        escapeCsv(photoLinks),
      ].join(",") + "\n";
    }
    $os.writeFile(csvDir + `/Lotti_${today}.csv`, csv, 0o644);
    console.log(`[CSV Export] Lotti: ${records.length} record`);
  } catch (err) {
    console.log(`[CSV Export] Errore Lotti: ${err.message}`);
    success = false;
    errorMsg += `Lotti: ${err.message}; `;
  }

  // --- FORNITORI ---
  try {
    const records = $app.dao().findRecordsByFilter("suppliers", "", "name", 0, 0);
    let csv = "ID,Nome,Contatto,Email,Telefono,Note,Data Creazione\n";
    for (const r of records) {
      csv += [
        escapeCsv(r.getId()),
        escapeCsv(r.getString("name")),
        escapeCsv(r.getString("contact_person")),
        escapeCsv(r.getString("email")),
        escapeCsv(r.getString("phone")),
        escapeCsv(r.getString("notes")),
        escapeCsv(r.getString("created")),
      ].join(",") + "\n";
    }
    $os.writeFile(csvDir + `/Fornitori_${today}.csv`, csv, 0o644);
    console.log(`[CSV Export] Fornitori: ${records.length} record`);
  } catch (err) {
    console.log(`[CSV Export] Errore Fornitori: ${err.message}`);
    success = false;
    errorMsg += `Fornitori: ${err.message}; `;
  }

  // --- ALLERGENI ---
  try {
    const records = $app.dao().findRecordsByFilter("allergens", "", "number", 0, 0);
    let csv = "Numero,Categoria,Ingredienti Ufficiali,Esempi Comuni\n";
    for (const r of records) {
      csv += [
        escapeCsv(r.getInt("number")),
        escapeCsv(r.getString("category_name")),
        escapeCsv(r.getString("official_ingredients")),
        escapeCsv(r.getString("common_examples")),
      ].join(",") + "\n";
    }
    $os.writeFile(csvDir + `/Allergeni_${today}.csv`, csv, 0o644);
    console.log(`[CSV Export] Allergeni: ${records.length} record`);
  } catch (err) {
    console.log(`[CSV Export] Errore Allergeni: ${err.message}`);
    success = false;
    errorMsg += `Allergeni: ${err.message}; `;
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
