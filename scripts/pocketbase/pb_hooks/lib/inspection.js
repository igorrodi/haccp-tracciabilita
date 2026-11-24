// Genera file pronti per le ispezioni: Excel (.xls SpreadsheetML) e PDF.
// Modulo caricato con require() dentro gli handler (ES5, Goja).
var DIR = "/pb/pb_data/exports/ispezione";

function str(v) { return v === null || v === undefined ? "" : String(v); }
function day(v) { v = str(v); return v ? v.substring(0, 10) : ""; }

function loadData() {
  var map = function (col) {
    var m = {};
    try {
      var rs = $app.findRecordsByFilter(col, "1=1", "", 0, 0);
      for (var i = 0; i < rs.length; i++) m[rs[i].id] = rs[i].getString("name");
    } catch (e) {}
    return m;
  };
  var products = map("products");
  var suppliers = map("suppliers");
  var today = new Date().toISOString().substring(0, 10);
  var lots = [];
  try {
    var ls = $app.findRecordsByFilter("lots", "1=1", "-reception_date", 0, 0);
    for (var i = 0; i < ls.length; i++) {
      var r = ls[i];
      var exp = day(r.get("expiry_date"));
      lots.push({
        code: r.getString("internal_lot_number"),
        lot: r.getString("lot_number"),
        product: products[r.getString("product_id")] || "",
        supplier: suppliers[r.getString("supplier_id")] || "",
        received: day(r.get("reception_date")),
        produced: day(r.get("production_date")),
        expiry: exp,
        frozen: r.getBool("is_frozen") ? "Si" : "No",
        status: r.getString("status"),
        notes: r.getString("notes"),
        expired: exp !== "" && exp < today
      });
    }
  } catch (e) { console.log("[Ispezione] lotti: " + e); }
  var temps = [];
  try {
    var ts = $app.findRecordsByFilter("temperature_logs", "1=1", "-date", 0, 0);
    for (var j = 0; j < ts.length; j++) {
      temps.push({
        date: str(ts[j].get("date")).substring(0, 16).replace("T", " "),
        value: str(ts[j].get("value")),
        operator: ts[j].getString("operator"),
        notes: ts[j].getString("notes")
      });
    }
  } catch (e) { console.log("[Ispezione] temperature: " + e); }
  var sup = [];
  try {
    var ss = $app.findRecordsByFilter("suppliers", "1=1", "name", 0, 0);
    for (var k = 0; k < ss.length; k++) sup.push({ name: ss[k].getString("name"), contact: ss[k].getString("contact_info"), notes: ss[k].getString("notes") });
  } catch (e) {}
  return { lots: lots, temps: temps, suppliers: sup, today: today };
}

function xml(v) { return str(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function sheet(name, headers, rows, flags) {
  var s = '<Worksheet ss:Name="' + xml(name) + '"><Table>';
  s += "<Row>";
  for (var h = 0; h < headers.length; h++) s += '<Cell ss:StyleID="h"><Data ss:Type="String">' + xml(headers[h]) + "</Data></Cell>";
  s += "</Row>";
  for (var i = 0; i < rows.length; i++) {
    s += flags && flags[i] ? '<Row ss:StyleID="bad">' : "<Row>";
    for (var c = 0; c < rows[i].length; c++) s += '<Cell><Data ss:Type="String">' + xml(rows[i][c]) + "</Data></Cell>";
    s += "</Row>";
  }
  return s + '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>';
}

function buildXls(d) {
  var lotRows = [], flags = [];
  for (var i = 0; i < d.lots.length; i++) {
    var l = d.lots[i];
    lotRows.push([l.code, l.product, l.lot, l.supplier, l.received, l.produced, l.expiry, l.frozen, l.expired ? "SCADUTO" : l.status, l.notes]);
    flags.push(l.expired);
  }
  var tRows = [];
  for (var j = 0; j < d.temps.length; j++) tRows.push([d.temps[j].date, d.temps[j].value, d.temps[j].operator, d.temps[j].notes]);
  var sRows = [];
  for (var k = 0; k < d.suppliers.length; k++) sRows.push([d.suppliers[k].name, d.suppliers[k].contact, d.suppliers[k].notes]);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B2545" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="bad"><Font ss:Color="#B00020"/><Interior ss:Color="#FDE7E9" ss:Pattern="Solid"/></Style></Styles>' +
    sheet("Lotti", ["Codice", "Prodotto", "Lotto fornitore", "Fornitore", "Ricevuto", "Prodotto il", "Scadenza", "Congelato", "Stato", "Note"], lotRows, flags) +
    sheet("Temperature", ["Data", "Valore °C", "Operatore", "Note"], tRows, null) +
    sheet("Fornitori", ["Nome", "Contatti", "Note"], sRows, null) +
    "</Workbook>";
}

// ---- PDF minimale (Courier, A4 orizzontale, testo Latin-1) ----
function pdfText(s) {
  s = str(s);
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    var ch = s.charAt(i);
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (c < 32) out += " ";
    else if (c < 127) out += ch;
    else if (c < 256) out += "\\" + ("00" + c.toString(8)).slice(-3);
    else if (c === 8364) out += "EUR";
    else out += "?";
  }
  return out;
}
function cell(v, w) { v = str(v).replace(/\s+/g, " "); if (v.length > w) v = v.substring(0, w - 1) + "~"; while (v.length < w) v += " "; return v; }

function buildPdf(d) {
  var lines = []; // {t, bold, red}
  lines.push({ t: "REGISTRO HACCP - generato il " + d.today, bold: true });
  lines.push({ t: "" });
  lines.push({ t: "LOTTI (" + d.lots.length + ")   - le righe con ! sono scadute", bold: true });
  lines.push({ t: cell("Codice", 8) + cell("Prodotto", 26) + cell("Lotto forn.", 16) + cell("Fornitore", 22) + cell("Ricevuto", 11) + cell("Scadenza", 11) + cell("Cong.", 6) + cell("Note", 30), bold: true });
  for (var i = 0; i < d.lots.length; i++) {
    var l = d.lots[i];
    lines.push({ t: cell((l.expired ? "!" : "") + l.code, 8) + cell(l.product, 26) + cell(l.lot, 16) + cell(l.supplier, 22) + cell(l.received, 11) + cell(l.expiry, 11) + cell(l.frozen, 6) + cell(l.notes, 30), red: l.expired });
  }
  lines.push({ t: "" });
  lines.push({ t: "TEMPERATURE (" + d.temps.length + ")", bold: true });
  lines.push({ t: cell("Data", 18) + cell("Valore C", 10) + cell("Operatore", 22) + cell("Note", 70), bold: true });
  for (var j = 0; j < d.temps.length; j++) {
    var t = d.temps[j];
    lines.push({ t: cell(t.date, 18) + cell(t.value, 10) + cell(t.operator, 22) + cell(t.notes, 70) });
  }
  lines.push({ t: "" });
  lines.push({ t: "FORNITORI (" + d.suppliers.length + ")", bold: true });
  for (var k = 0; k < d.suppliers.length; k++) lines.push({ t: cell(d.suppliers[k].name, 40) + cell(d.suppliers[k].contact, 80) });

  var perPage = 46, pages = [];
  for (var p = 0; p < lines.length; p += perPage) pages.push(lines.slice(p, p + perPage));
  var objs = []; // index 0 => obj 1
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(""); // pages placeholder
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>");
  var kids = [];
  for (var pg = 0; pg < pages.length; pg++) {
    var c = "BT /F1 8 Tf 30 560 Td 11 TL\n";
    for (var n = 0; n < pages[pg].length; n++) {
      var ln = pages[pg][n];
      c += (ln.bold ? "/F2 8 Tf " : "/F1 8 Tf ") + (ln.red ? "0.69 0 0.13 rg " : "0 0 0 rg ") + "(" + pdfText(ln.t) + ") Tj T*\n";
    }
    c += "ET\nBT /F1 7 Tf 0.4 0.4 0.4 rg 760 20 Td (Pagina " + (pg + 1) + " di " + pages.length + ") Tj ET";
    objs.push("<< /Length " + c.length + " >>\nstream\n" + c + "\nendstream");
    var contentId = objs.length;
    objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentId + " 0 R >>");
    kids.push(objs.length + " 0 R");
  }
  objs[1] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
  var out = "%PDF-1.4\n", offs = [];
  for (var o = 0; o < objs.length; o++) { offs.push(out.length); out += (o + 1) + " 0 obj\n" + objs[o] + "\nendobj\n"; }
  var xref = out.length;
  out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  for (var x = 0; x < offs.length; x++) out += ("0000000000" + offs[x]).slice(-10) + " 00000 n \n";
  out += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return out;
}

function generate() {
  try { $os.mkdirAll(DIR, 0o755); } catch (e) {}
  var d = loadData();
  // Contenuto PDF solo ASCII (escape ottali) => lunghezze in byte corrette
  $os.writeFile(DIR + "/Registro_HACCP.pdf", buildPdf(d), 0o644);
  $os.writeFile(DIR + "/Registro_HACCP.xls", buildXls(d), 0o644);
  var info = { lastRun: new Date().toISOString(), lots: d.lots.length, temps: d.temps.length, expired: 0 };
  for (var i = 0; i < d.lots.length; i++) if (d.lots[i].expired) info.expired++;
  $os.writeFile(DIR + "/.status.json", JSON.stringify(info), 0o644);
  return info;
}

module.exports = { generate: generate, buildPdf: buildPdf, buildXls: buildXls, DIR: DIR };
