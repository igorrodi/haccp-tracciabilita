migrate(function (app) {
  var schemaPath = "/pb/pb_schema.json";
  var rawData = "";
  var collections = [];

  try {
    rawData = $os.readFile(schemaPath);
  } catch (err) {
    console.log("Schema file not found, skipping import");
    return;
  }

  try {
    collections = JSON.parse(rawData);
  } catch (err) {
    console.log("Invalid schema JSON, skipping import");
    return;
  }

  app.importCollections(collections, false);
  console.log("Schema imported successfully via migration");
}, function (app) {
  console.log("Revert not supported for initial schema import");
});
