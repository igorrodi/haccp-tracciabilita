// Block user creation after the first admin exists
// First user can register freely; after that, only admins can create users
onRecordCreateRequest(function(e) {
  var result = arrayOf(new DynamicModel({ "total": 0 }));

  try {
    $app.dao().db()
      .newQuery("SELECT COUNT(*) as total FROM users")
      .all(result);
  } catch(err) {
    // Table issue — allow creation (first time)
    return;
  }

  var count = 0;
  if (result.length > 0) {
    count = result[0].total;
  }

  // If no users exist, allow first registration
  if (count === 0) {
    return;
  }

  // Users exist — only allow if requester is an authenticated admin
  var authRecord = e.httpContext.get("authRecord");
  if (!authRecord) {
    throw new ForbiddenError("La registrazione pubblica è disabilitata. Contatta l'amministratore.");
  }

  if (authRecord.get("role") !== "admin") {
    throw new ForbiddenError("Solo gli amministratori possono creare nuovi utenti.");
  }
}, "users");