/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const fs = require("fs");
  const schemaPath = "/pb/pb_schema.json";
  
  if (!fs.existsSync(schemaPath)) {
    console.log("Schema file not found, skipping import");
    return;
  }

  const rawData = fs.readFileSync(schemaPath, "utf8");
  const collections = JSON.parse(rawData);

  // PocketBase v0.25+ API: importCollections on the app instance directly
  app.importCollections(collections, false);
  
  console.log("Schema imported successfully via migration");
}, (app) => {
  console.log("Revert not supported for initial schema import");
});
