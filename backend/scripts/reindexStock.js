const mongoose = require("mongoose");
const { MONGO_URL } = require("../config");
const Stock = require("../models/Stock");
const { ensureStockIndex, indexStockDoc } = require("../search");

(async () => {
  try {
    console.log("[Reindex] Connecting to Mongo...");
    await mongoose.connect(MONGO_URL);

    console.log("[Reindex] Ensuring Elasticsearch index...");
    await ensureStockIndex();

    const all = await Stock.find({});
    console.log("[Reindex] Found", all.length, "stock documents");

    for (const doc of all) {
      await indexStockDoc(doc);
    }

    console.log("[Reindex] ✅ All stock indexed into Elasticsearch");
    process.exit(0);
  } catch (err) {
    console.error("[Reindex] ❌ Error:", err);
    process.exit(1);
  }
})();
