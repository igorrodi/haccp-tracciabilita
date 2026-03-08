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

  const dao = app.dao();
  
  // Import collections using PocketBase's built-in method
  dao.importCollections(collections, false, null);
  
  console.log("Schema imported successfully via migration");
}, (app) => {
  // Revert: nothing to do
  console.log("Revert not supported for initial schema import");
});
