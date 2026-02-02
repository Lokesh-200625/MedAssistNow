// backend/routes/stock.js

const express = require("express");
const router = express.Router();

const Stock = require("../models/Stock");
const authMiddleware = require("../middleware/auth");
const { notifyStockChanged } = require("../socket");
const { searchRateLimit } = require("../middleware/rateLimit");  // optional
const { indexStockDoc, searchStock } = require("../search");     // 🔥 NEW

/* =====================================================
   ADD STOCK  (Pharmacist only)
   ===================================================== */
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const pharmacyId = req.user.id;
    const { medicineName, quantity, batchNo, image, price, description, category } = req.body;

    if (!medicineName || !quantity || !category || !price) {
      return res.json({ error: "Please provide name, quantity, category, and price." });
    }

    const stock = await Stock.create({
      pharmacyId,
      medicineName,
      quantity,
      batchNo,
      image,
      price,
      description,
      category
    });

    // 🔔 REAL-TIME: stock changed
    notifyStockChanged();

    // 🔥 Index in Elasticsearch (non-blocking)
    indexStockDoc(stock);

    res.json({ message: "Stock added successfully", stock });
  } catch (err) {
    console.error("Stock Add Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   SEARCH STOCK  (Public search for users)
   GET /api/stock/search?q=
   ===================================================== */
router.get("/search", /* searchRateLimit, */ async (req, res) => {
  try {
    const q = req.query.q?.trim() || "";

    if (!q) {
      return res.json([]);
    }

    // 🔥 1) Try Elasticsearch first
    const esResults = await searchStock(q);

    if (Array.isArray(esResults) && esResults.length > 0) {
      // Normalize shape for frontend
      const mapped = esResults.map((doc) => ({
        _id: doc._id,                         // ES doc id (same as Mongo _id)
        medicineName: doc.medicineName,
        quantity: doc.quantity,
        batchNo: doc.batchNo,
        pharmacyId: doc.pharmacyId,
        image: doc.image,
        price: doc.price,
        description: doc.description,
        category: doc.category,
        updatedAt: doc.updatedAt
      }));

      return res.json(mapped);
    }

    // 🔁 2) Fallback to Mongo regex search (old behavior)
    const results = await Stock.find({
      medicineName: { $regex: q, $options: "i" }
    })
      .limit(20)
      .sort({ quantity: -1 });

    res.json(results);
  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   GET CATEGORIES (Unique List)
   GET /api/stock/categories
   ===================================================== */
router.get("/categories", async (req, res) => {
  try {
    const distinctRaw = await Stock.distinct("category");

    // Normalize case: Capitalize first letter, lowercase rest (deduplication)
    const unique = new Set();
    distinctRaw.filter(Boolean).forEach(c => {
      const normalized = c.trim().charAt(0).toUpperCase() + c.trim().slice(1).toLowerCase();
      unique.add(normalized);
    });

    res.json(Array.from(unique).sort());
  } catch (err) {
    console.error("Category Fetch Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   UPDATE STOCK (Increase / decrease)
   PUT /api/stock/update/:id
   ===================================================== */
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const { qty } = req.body;

    if (qty === undefined) {
      return res.json({ error: "Please provide quantity adjustment" });
    }

    const stock = await Stock.findById(req.params.id);

    if (!stock) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    stock.quantity += Number(qty);

    await stock.save();

    // 🔔 REAL-TIME: stock changed
    notifyStockChanged();

    // 🔥 Update Elasticsearch index
    indexStockDoc(stock);

    res.json({ message: "Stock updated successfully", stock });
  } catch (err) {
    console.error("Update Stock Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
