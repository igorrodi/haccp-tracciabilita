/// <reference path="../pb_data/types.d.ts" />

// CUPS Print API endpoint
// POST /api/cups/print - Send a print job to CUPS
// GET /api/cups/printers - List available CUPS printers
// GET /api/cups/status - Get CUPS status

routerAdd("GET", "/api/cups/printers", (c) => {
  try {
    const result = $os.exec("lpstat", "-p", "-d");
    const output = String.fromCharCode(...result);
    
    const printers = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('printer ')) {
        const parts = line.split(' ');
        const name = parts[1];
        const enabled = line.includes('enabled');
        printers.push({
          name: name,
          enabled: enabled,
          description: line
        });
      }
    }
    
    // Get default printer
    let defaultPrinter = '';
    for (const line of lines) {
      if (line.startsWith('system default destination:')) {
        defaultPrinter = line.replace('system default destination:', '').trim();
      }
    }
    
    return c.json(200, {
      printers: printers,
      default_printer: defaultPrinter,
      cups_available: true
    });
  } catch (e) {
    return c.json(200, {
      printers: [],
      default_printer: '',
      cups_available: false,
      error: String(e)
    });
  }
});

routerAdd("GET", "/api/cups/status", (c) => {
  try {
    const result = $os.exec("lpstat", "-t");
    const output = String.fromCharCode(...result);
    
    return c.json(200, {
      status: output,
      cups_available: true
    });
  } catch (e) {
    return c.json(200, {
      cups_available: false,
      error: String(e)
    });
  }
});

routerAdd("POST", "/api/cups/print", (c) => {
  const data = $apis.requestInfo(c).data;
  
  if (!data.html) {
    return c.json(400, { error: "Missing 'html' field" });
  }
  
  const printerName = data.printer || '';
  const copies = data.copies || 1;
  const labelWidth = data.label_width || 100;
  const labelHeight = data.label_height || 50;
  
  try {
    // Write HTML to temporary file
    const tmpFile = `/tmp/label_${Date.now()}.html`;
    $os.writeFile(tmpFile, data.html, 0644);
    
    // Build lp command arguments
    const args = [tmpFile];
    
    if (printerName) {
      args.unshift("-d", printerName);
    }
    
    if (copies > 1) {
      args.unshift("-n", String(copies));
    }
    
    // Add media size option
    args.unshift("-o", `media=Custom.${labelWidth}x${labelHeight}mm`);
    args.unshift("-o", "fit-to-page");
    
    // Execute print command
    const result = $os.exec("lp", ...args);
    const output = String.fromCharCode(...result);
    
    // Clean up temp file
    try {
      $os.exec("rm", "-f", tmpFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return c.json(200, {
      success: true,
      message: output,
      printer: printerName || 'default'
    });
  } catch (e) {
    return c.json(500, {
      success: false,
      error: String(e)
    });
  }
});
