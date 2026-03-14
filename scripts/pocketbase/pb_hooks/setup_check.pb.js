// Public endpoint to check if any users exist (bypasses RLS)
// GET /api/setup-check → { "needsSetup": true/false }
routerAdd("GET", "/api/setup-check", function(e) {
  var result = arrayOf(new DynamicModel({ "total": 0 }));

  try {
    $app.dao().db()
      .newQuery("SELECT COUNT(*) as total FROM users")
      .all(result);
  } catch(err) {
    // Table doesn't exist yet — needs setup
    return e.json(200, { "needsSetup": true });
  }

  var count = 0;
  if (result.length > 0) {
    count = result[0].total;
  }

  return e.json(200, { "needsSetup": count === 0 });
});