// File per ispezioni (Excel + PDF) e backup su chiavetta USB. ES5.

// Ogni notte alle 03:35 rigenera Excel e PDF (poi rclone 04:00 li porta sul cloud)
cronAdd("inspection_export_nightly", "35 3 * * *", function () {
  try { var info = require(__hooks + "/lib/inspection.js").generate(); console.log("[Ispezione] file generati: " + info.lots + " lotti"); }
  catch (err) { console.log("[Ispezione] errore: " + err); }
});

// Ogni notte alle 04:30 backup su chiavetta, se attivato
cronAdd("usb_backup_nightly", "30 4 * * *", function () {
  try {
    var recs = $app.findRecordsByFilter("cloud_settings", 'id != ""', "", 1, 0);
    if (!recs || !recs.length || !recs[0].getBool("usb_enabled")) return;
    var dev = recs[0].getString("usb_device") || "auto";
    $os.cmd("sh", "-c", "/pb/usb-backup.sh run '" + dev.replace(/[^A-Za-z0-9\/_-]/g, "") + "'").run();
  } catch (err) { console.log("[USB] errore: " + err); }
});

// Genera adesso (qualsiasi utente collegato: serve in caso di controllo)
routerAdd("POST", "/api/inspection/generate", function (e) {
  if (!e.auth) return e.json(401, { error: "Accesso richiesto" });
  try { return e.json(200, require(__hooks + "/lib/inspection.js").generate()); }
  catch (err) { return e.json(500, { error: String(err) }); }
});

// Scarica Registro_HACCP.pdf / .xls (rigenerati al momento)
routerAdd("GET", "/api/inspection/file/{kind}", function (e) {
  if (!e.auth) return e.json(401, { error: "Accesso richiesto" });
  var kind = e.request.pathValue("kind");
  if (kind !== "pdf" && kind !== "xls") return e.json(400, { error: "Tipo non valido" });
  var lib = require(__hooks + "/lib/inspection.js");
  try { lib.generate(); } catch (err) { console.log("[Ispezione] rigenerazione fallita, uso l'ultimo file: " + err); }
  var path = lib.DIR + "/Registro_HACCP." + kind;
  var data;
  try { data = $os.readFile(path); } catch (err) { return e.json(404, { error: "File non ancora generato" }); }
  e.response.header().set("Content-Type", kind === "pdf" ? "application/pdf" : "application/vnd.ms-excel");
  e.response.header().set("Content-Disposition", 'attachment; filename="Registro_HACCP.' + kind + '"');
  return e.blob(200, kind === "pdf" ? "application/pdf" : "application/vnd.ms-excel", data);
});

routerAdd("GET", "/api/usb/devices", function (e) {
  if (!e.auth || e.auth.getString("role") !== "admin") return e.json(403, { error: "Solo amministratori" });
  var out = "";
  try { var b = $os.cmd("/pb/usb-backup.sh", "list").output(); for (var i = 0; i < b.length; i++) out += String.fromCharCode(b[i]); } catch (err) {}
  var list = [];
  var rows = out.split("\n");
  for (var j = 0; j < rows.length; j++) { if (rows[j]) { try { list.push(JSON.parse(rows[j])); } catch (pe) {} } }
  var st = null;
  try { var sb = $os.readFile("/pb/pb_data/exports/.usb-status.json"); var ss = ""; for (var k = 0; k < sb.length; k++) ss += String.fromCharCode(sb[k]); st = JSON.parse(ss); } catch (se) {}
  return e.json(200, { devices: list, status: st });
});

routerAdd("POST", "/api/usb/backup", function (e) {
  if (!e.auth || e.auth.getString("role") !== "admin") return e.json(403, { error: "Solo amministratori" });
  var dev = "auto";
  try { dev = String(e.requestInfo().body.device || "auto"); } catch (err) {}
  dev = dev.replace(/[^A-Za-z0-9\/_-]/g, "") || "auto";
  try {
    require(__hooks + "/lib/inspection.js").generate();
  } catch (err) { console.log("[USB] file ispezione non generati: " + err); }
  try {
    $os.cmd("sh", "-c", "/pb/usb-backup.sh run '" + dev + "' &").run();
    return e.json(200, { success: true, message: "Copia avviata" });
  } catch (err) { return e.json(500, { error: String(err) }); }
});
