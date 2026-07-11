const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const modelsDir = path.resolve(__dirname, "../models");

function loadModels() {
  const modelFiles = fs
    .readdirSync(modelsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of modelFiles) {
    require(path.join(modelsDir, file));
  }
}

function formatIndex(index) {
  return JSON.stringify(index);
}

async function getIndexDiff(model) {
  if (typeof model.diffIndexes !== "function") {
    return null;
  }

  return model.diffIndexes();
}

async function syncModelIndexes(model, checkOnly) {
  const diff = await getIndexDiff(model);

  console.log(`\n${model.modelName} (${model.collection.name})`);

  if (diff) {
    const toDrop = diff.toDrop || [];
    const toCreate = diff.toCreate || [];

    console.log(
      `  stale indexes: ${toDrop.length ? toDrop.join(", ") : "none"}`
    );
    console.log(
      `  new indexes: ${
        toCreate.length ? toCreate.map(formatIndex).join(", ") : "none"
      }`
    );
  }

  if (checkOnly) {
    return;
  }

  const dropped = await model.syncIndexes();
  console.log(
    `  synced; dropped: ${dropped.length ? dropped.join(", ") : "none"}`
  );
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  const checkOnly = process.argv.includes("--check");

  loadModels();

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  for (const modelName of mongoose.modelNames().sort()) {
    await syncModelIndexes(mongoose.model(modelName), checkOnly);
  }

  await mongoose.disconnect();
  console.log(checkOnly ? "\nIndex check complete" : "\nIndex sync complete");
}

main().catch(async (error) => {
  console.error("\nIndex sync failed");
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
