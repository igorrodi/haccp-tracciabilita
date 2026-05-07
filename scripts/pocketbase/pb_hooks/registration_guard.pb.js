// Block public user creation once an admin exists.
// If no admin exists yet, allow creation and force admin role.
// PocketBase 0.36+ API (Goja ES5)
onRecordCreateRequest(function(e) {
  var hasAdmin = false;

  try {
    var admins = $app.findRecordsByFilter("users", 'role = "admin"', "", 1, 0);
    hasAdmin = admins && admins.length > 0;
  } catch (err) {
    // Collection issue — allow creation on fresh install
    return e.next();
  }

  // Bootstrap mode: first valid account becomes admin
  if (!hasAdmin) {
    e.record.set("role", "admin");
    return e.next();
  }

  // Admin exists — only authenticated admins can create users
  var authRecord = e.auth;
  if (!authRecord) {
    throw new ForbiddenError("La registrazione pubblica è disabilitata. Contatta l'amministratore.");
  }

  if (authRecord.get("role") !== "admin") {
    throw new ForbiddenError("Solo gli amministratori possono creare nuovi utenti.");
  }

  if (!e.record.get("role")) {
    e.record.set("role", "user");
  }

  return e.next();
}, "users");
