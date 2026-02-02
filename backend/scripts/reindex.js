const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const { esClient, ensureStockIndex, indexStockDoc } = require("../search");
const { MONGO_URL, ELASTIC_INDEX_STOCK } = require("../config");

async function run() {
    try {
        // 1. Connect to Mongo
        const uri = MONGO_URL || "mongodb://127.0.0.1:27017/medassist";
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected to", uri);

        // 2. Delete existing ES index (to apply new mapping)
        try {
            await esClient.indices.delete({ index: ELASTIC_INDEX_STOCK });
            console.log("🗑️ Deleted old ES index");
        } catch (e) {
            console.log("⚠️ Index didn't exist or verify error:", e.message);
        }

        // 3. Re-create index (will use updated code in search.js)
        await ensureStockIndex();

        // 4. Fetch all stocks
        const stocks = await Stock.find({});
        console.log(`📦 Found ${stocks.length} stocks in DB. Indexing...`);

        // 5. Index each
        for (const s of stocks) {
            await indexStockDoc(s);
            process.stdout.write("."); // progress bar
        }
        console.log("\n✅ Re-indexing complete!");

        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
}

run();
