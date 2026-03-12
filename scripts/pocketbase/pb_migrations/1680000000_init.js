/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const schemaPath = "/pb/pb_schema.json";

  let rawData;
  try {
    rawData = $os.readFile(schemaPath);
  } catch (e) {
    console.log("Schema file not found, skipping import");
    return;
  }

  const collections = JSON.parse(rawData);

  app.importCollections(collections, false);

  console.log("Schema imported successfully via migration");
}, (app) => {
  console.log("Revert not supported for initial schema import");
});
