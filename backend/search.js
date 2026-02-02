// backend/search.js

const { Client } = require("@elastic/elasticsearch");
const {
  ELASTIC_URL,
  ELASTIC_USERNAME,
  ELASTIC_PASSWORD,
  ELASTIC_INDEX_STOCK
} = require("./config");

// Create ES client
const esClient = new Client({
  node: ELASTIC_URL,
  auth: {
    username: "elastic",
    password: "XM1yj5PQw+dFP=tjSRIJ"
  },
  tls: {
    rejectUnauthorized: false   // ✅ REQUIRED for local self-signed cert
  }
});

/**
 * Ensure the stock index exists with proper mappings.
 * Call this once on server startup.
 */
async function ensureStockIndex(retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const exists = await esClient.indices.exists({ index: ELASTIC_INDEX_STOCK });

      if (exists) {
        console.log("[Elastic] Index exists:", ELASTIC_INDEX_STOCK);
        return;
      }

      await esClient.indices.create({
        index: ELASTIC_INDEX_STOCK,
        body: {
          mappings: {
            properties: {
              medicineName: { type: "text" },
              medicineName_keyword: { type: "keyword" },
              quantity: { type: "integer" },
              batchNo: { type: "keyword" },
              pharmacyId: { type: "keyword" },
              image: { type: "keyword" },
              price: { type: "float" },
              description: { type: "text" },
              category: { type: "text" },
              updatedAt: { type: "date" }
            }
          }
        }
      });

      console.log("[Elastic] Created index:", ELASTIC_INDEX_STOCK);
      return;
    } catch (err) {
      console.error(`[Elastic] ensureStockIndex error (Attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  console.error("[Elastic] giving up on ensuring index exists.");
}

/**
 * Index or update a single Stock document in ES.
 * Uses the Mongo _id as the ES document id.
 */
async function indexStockDoc(stockDoc) {
  try {
    if (!stockDoc) return;

    // Mongoose doc → plain object
    const src = stockDoc.toObject ? stockDoc.toObject() : stockDoc;

    await esClient.index({
      index: ELASTIC_INDEX_STOCK,
      id: src._id.toString(),
      document: {
        medicineName: src.medicineName,
        medicineName_keyword: src.medicineName,
        quantity: src.quantity,
        batchNo: src.batchNo || null,
        pharmacyId: src.pharmacyId ? src.pharmacyId.toString() : null,
        image: src.image || null,
        price: typeof src.price === "number" ? src.price : null,
        description: src.description || null,
        category: src.category || null, // ✅ Added
        updatedAt: src.updatedAt || new Date()
      }
    });

    // Make it visible for search soon
    await esClient.indices.refresh({ index: ELASTIC_INDEX_STOCK });

  } catch (err) {
    console.error("[Elastic] indexStockDoc error:", err);
    // IMPORTANT: we swallow the error so core app flow is not broken
  }
}

/**
 * Search stock documents by free-text query.
 * Returns an array of plain JS objects.
 */
async function searchStock(query) {
  try {
    if (!query || !query.trim()) return [];

    const res = await esClient.search({
      index: ELASTIC_INDEX_STOCK,
      size: 20,
      query: {
        multi_match: {
          query,
          fields: ["medicineName^3", "description", "category"]
        }
      }
    });

    const hits = (res.hits && res.hits.hits) || [];

    return hits.map((h) => ({
      _id: h._id,
      ...h._source
    }));
  } catch (err) {
    console.error("[Elastic] searchStock error:", err);
    // Return null to signal "ES failed", so caller can fallback to Mongo
    return null;
  }
}

module.exports = {
  esClient,
  ensureStockIndex,
  indexStockDoc,
  searchStock
};
