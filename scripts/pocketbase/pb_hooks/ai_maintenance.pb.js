/// <reference path="../pb_data/types.d.ts" />
// AI Maintenance: diagnose, analyze (via Lovable AI Gateway), fix.
// Admin-only. ES5 / Goja-safe.

var AI_REPAIR = "/pb/ai-repair.sh";
var AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
var DEFAULT_MODEL = "google/gemini-3-flash-preview";

var ALLOWED_ACTIONS = {
  "restart_pb": 1, "vacuum_db": 1, "prune_backups": 1,
  "free_space": 1, "retry_backup": 1, "fix_perms": 1, "restart_all": 1
};

function requireAdmin(e) {
  var auth = e.auth;
  if (!auth || auth.getString("role") !== "admin") {
    e.json(403, { "error": "Solo gli amministratori possono usare questa funzione" });
    return false;
  }
  return true;
}

function bytesToString(bytes) {
  if (!bytes) return "";
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function runShell(args) {
  try {
    var cmd = $os.cmd.apply(null, args);
    var out = cmd.combinedOutput();
    return { ok: true, output: bytesToString(out) };
  } catch (err) {
    return { ok: false, output: String(err) };
  }
}

function runDiagnose() {
  var res = runShell(["sh", AI_REPAIR, "diagnose"]);
  if (!res.ok) return { error: res.output };
  try {
    return JSON.parse(res.output);
  } catch (err) {
    return { error: "Output non JSON: " + res.output.substring(0, 300) };
  }
}

// GET /api/ai-maintenance/diagnose
routerAdd("GET", "/api/ai-maintenance/diagnose", function(e) {
  if (!requireAdmin(e)) return;
  var data = runDiagnose();
  if (data.error) return e.json(500, data);
  return e.json(200, data);
});

// POST /api/ai-maintenance/analyze  { prompt?: string }
routerAdd("POST", "/api/ai-maintenance/analyze", function(e) {
  if (!requireAdmin(e)) return;

  var apiKey = $os.getenv("LOVABLE_API_KEY");
  if (!apiKey) {
    return e.json(400, {
      "error": "LOVABLE_API_KEY non configurata. Aggiungila tra le variabili d'ambiente del container per abilitare l'AI."
    });
  }

  var body = {};
  try { body = e.requestInfo().body || {}; } catch (err) { body = {}; }
  var userPrompt = body.prompt ? String(body.prompt) : "";

  var diag = runDiagnose();
  if (diag.error) return e.json(500, { "error": "Diagnosi fallita: " + diag.error });

  var system =
    "Sei un tecnico di sistema per HACCP Tracker (Docker su Raspberry Pi/Armbian, PocketBase, CUPS, rclone). " +
    "Analizza il JSON di diagnostica e rispondi SOLO con JSON valido nel formato:\n" +
    '{ "summary": "...breve riassunto stato in italiano...",' +
    ' "severity": "ok|warn|critical",' +
    ' "issues": [{"area":"disk|db|backup|cloud|services|network|filesystem","message":"...","severity":"info|warn|critical"}],' +
    ' "actions": [{"id":"restart_pb|vacuum_db|prune_backups|free_space|retry_backup|fix_perms|restart_all","label":"...","why":"..."}] }\n' +
    "Suggerisci solo azioni dall'elenco. Niente testo fuori dal JSON.";

  var userContent =
    "Diagnostica:\n" + JSON.stringify(diag) +
    (userPrompt ? ("\n\nNota dell'admin: " + userPrompt) : "");

  var payload = {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent }
    ]
  };

  var resp;
  try {
    resp = $http.send({
      url: AI_GATEWAY,
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      timeout: 60
    });
  } catch (err) {
    return e.json(502, { "error": "Errore chiamata AI Gateway: " + String(err), "diagnostics": diag });
  }

  if (resp.statusCode === 429) {
    return e.json(429, { "error": "Limite richieste AI raggiunto, riprova più tardi.", "diagnostics": diag });
  }
  if (resp.statusCode === 402) {
    return e.json(402, { "error": "Crediti AI esauriti. Aggiungi crediti nel workspace Lovable.", "diagnostics": diag });
  }
  if (resp.statusCode < 200 || resp.statusCode >= 300) {
    return e.json(resp.statusCode, { "error": "AI Gateway error", "body": String(resp.raw || resp.body || "").substring(0, 500), "diagnostics": diag });
  }

  var parsed = null;
  try { parsed = JSON.parse(resp.raw); } catch (err) { parsed = null; }
  var content = "";
  try {
    content = parsed.choices[0].message.content || "";
  } catch (err) { content = ""; }

  // Strip code fences se presenti
  content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  var report = null;
  try { report = JSON.parse(content); } catch (err) {
    report = { summary: content || "Risposta AI non strutturata", severity: "warn", issues: [], actions: [] };
  }

  return e.json(200, { "diagnostics": diag, "report": report });
});

// POST /api/ai-maintenance/fix  { action: "..." }
routerAdd("POST", "/api/ai-maintenance/fix", function(e) {
  if (!requireAdmin(e)) return;

  var body = {};
  try { body = e.requestInfo().body || {}; } catch (err) { body = {}; }
  var action = body.action ? String(body.action) : "";

  if (!ALLOWED_ACTIONS[action]) {
    return e.json(400, { "error": "Azione non consentita: " + action });
  }

  var res = runShell(["sh", AI_REPAIR, "fix", action]);
  return e.json(res.ok ? 200 : 500, {
    "success": res.ok,
    "action": action,
    "output": res.output
  });
});
