// Public endpoint to check if at least one admin exists (bypasses API rules)
// GET /api/setup-check → { "needsSetup": true/false }
routerAdd("GET", "/api/setup-check", function(e) {
  try {
    var admins = $app.findRecordsByFilter("users", 'role = "admin"', "", 1, 0);
    var hasAdmin = admins && admins.length > 0;
    return e.json(200, { "needsSetup": !hasAdmin });
  } catch (err) {
    // Collection not initialized yet
    return e.json(200, { "needsSetup": true });
  }
});