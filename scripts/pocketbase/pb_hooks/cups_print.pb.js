// CUPS Print API endpoint — PocketBase Goja ES5
// POST /api/cups/print - Send a print job to CUPS
// GET /api/cups/printers - List available CUPS printers
// GET /api/cups/status - Get CUPS status

routerAdd("GET", "/api/cups/printers", function(e) {
  try {
    var result = $os.exec("lpstat", "-p", "-d");
    var output = String.fromCharCode.apply(null, result);

    var printers = [];
    var lines = output.split("\n");

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("printer ") === 0) {
        var parts = line.split(" ");
        var name = parts[1];
        var enabled = line.indexOf("enabled") >= 0;
        printers.push({
          name: name,
          enabled: enabled,
          description: line
        });
      }
    }

    // Get default printer
    var defaultPrinter = "";
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].indexOf("system default destination:") === 0) {
        defaultPrinter = lines[j].replace("system default destination:", "").trim();
      }
    }

    return e.json(200, {
      printers: printers,
      default_printer: defaultPrinter,
      cups_available: true
    });
  } catch (err) {
    return e.json(200, {
      printers: [],
      default_printer: "",
      cups_available: false,
      error: String(err)
    });
  }
});

routerAdd("GET", "/api/cups/status", function(e) {
  try {
    var result = $os.exec("lpstat", "-t");
    var output = String.fromCharCode.apply(null, result);

    return e.json(200, {
      status: output,
      cups_available: true
    });
  } catch (err) {
    return e.json(200, {
      cups_available: false,
      error: String(err)
    });
  }
});

routerAdd("POST", "/api/cups/print", function(e) {
  var body = $apis.requestInfo(e).body;

  if (!body || !body.html) {
    return e.json(400, { error: "Missing 'html' field" });
  }

  var printerName = body.printer || "";
  var copies = body.copies || 1;
  var labelWidth = body.label_width || 100;
  var labelHeight = body.label_height || 50;

  try {
    // Write HTML to temporary file
    var tmpFile = "/tmp/label_" + Date.now() + ".html";
    $os.writeFile(tmpFile, body.html, 0o644);

    // Build lp command arguments
    var args = [
      "-o", "media=Custom." + labelWidth + "x" + labelHeight + "mm",
      "-o", "fit-to-page"
    ];

    if (printerName) {
      args.push("-d", printerName);
    }

    if (copies > 1) {
      args.push("-n", String(copies));
    }

    args.push(tmpFile);

    // Execute print command
    var result = $os.exec("lp", args[0], args[1], args[2], args[3], args[4] || "", args[5] || "", args[6] || "", args[7] || "");
    var output = String.fromCharCode.apply(null, result);

    // Clean up temp file
    try { $os.exec("rm", "-f", tmpFile); } catch (cleanErr) {}

    return e.json(200, {
      success: true,
      message: output,
      printer: printerName || "default"
    });
  } catch (err) {
    return e.json(500, {
      success: false,
      error: String(err)
    });
  }
});
