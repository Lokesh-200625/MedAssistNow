// backend/routes/cart.js

const express = require("express");
const router = express.Router();

const Cart = require("../models/Cart");
const Stock = require("../models/Stock");
const auth = require("../middleware/auth");

const { getJSON, setJSON } = require("../redis");
const { CACHE_TTLS } = require("../config");

// Key helpers
function cartKey(userId) {
  return `cart:user:${userId}`;
}

function medicineKey(name) {
  return `stock:medicine:${name.toLowerCase()}`;
}

/* ============================
   ADD TO CART
============================ */
router.post("/add", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineName, quantity } = req.body;

    if (!medicineName) {
      return res.json({ error: "Medicine name is required" });
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;

    // ✅ 1) Get Product Details (Redis -> Mongo)
    let stockDoc = await getJSON(medicineKey(medicineName));

    if (!stockDoc) {
      const mongoStock = await Stock.findOne({ medicineName });
      if (!mongoStock) {
        return res.json({ error: "Medicine not found in stock" });
      }
      stockDoc = mongoStock.toObject();
      await setJSON(medicineKey(medicineName), stockDoc, CACHE_TTLS.MEDICINE);
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    // ✅ 2) Check for existing item to merge
    const existingItemIndex = cart.items.findIndex(
      (i) => i.medicineName === medicineName
    );

    if (existingItemIndex > -1) {
      // Increment existing
      cart.items[existingItemIndex].quantity += qty;
      // Update price/image in case they changed (optional but good)
      cart.items[existingItemIndex].price = stockDoc.price;
      cart.items[existingItemIndex].image = stockDoc.image;
    } else {
      // Add new
      cart.items.push({
        medicineName,
        quantity: qty,
        pharmacyId: stockDoc.pharmacyId,
        price: stockDoc.price,      // 🟢 Store Price
        image: stockDoc.image       // 🟢 Store Image
      });
    }

    await cart.save();

    // ✅ 3) Prepare response & Update Redis Cart
    const plainItems = cart.items.map(i => ({
      medicineName: i.medicineName,
      quantity: i.quantity,
      pharmacyId: i.pharmacyId,
      price: i.price,
      image: i.image
    }));

    await setJSON(cartKey(userId), plainItems, CACHE_TTLS.CART);

    res.json({ message: "Added to cart", cart: plainItems });

  } catch (err) {
    console.error("Cart add error:", err);
    res.status(500).json({ error: "Failed to add to cart" });
  }
});


/* ============================
   GET CART ITEMS
============================ */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const key = cartKey(userId);

    // ✅ 1) Try Redis first
    const cached = await getJSON(key);
    if (cached && Array.isArray(cached)) {
      return res.json(cached);
    }

    // ✅ 2) Fallback to Mongo
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.json([]);
    }

    const plainItems = cart.items.map(i => ({
      medicineName: i.medicineName,
      quantity: i.quantity,
      pharmacyId: i.pharmacyId,
      price: i.price,
      image: i.image
    }));

    // ✅ 3) Save into Redis for next time
    await setJSON(key, plainItems, CACHE_TTLS.CART);

    res.json(plainItems);

  } catch (err) {
    console.error("Cart fetch error:", err);
    res.status(500).json({ error: "Failed to load cart" });
  }
});

/* ============================
   UPDATE CART QUANTITY
   ============================ */
router.put("/update", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineName, quantity } = req.body;

    if (!medicineName) return res.status(400).json({ error: "Medicine Name required" });

    const newQty = parseInt(quantity);
    if (isNaN(newQty) || newQty < 1) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ message: "Cart empty" });

    const item = cart.items.find(i => i.medicineName === medicineName);
    if (item) {
      item.quantity = newQty;
      await cart.save();

      // Update Redis
      const plainItems = cart.items.map(i => ({
        medicineName: i.medicineName, quantity: i.quantity, pharmacyId: i.pharmacyId, price: i.price, image: i.image
      }));
      await setJSON(cartKey(userId), plainItems, CACHE_TTLS.CART);

      return res.json({ message: "Updated", cart: plainItems });
    }

    res.status(404).json({ error: "Item not found in cart" });

  } catch (err) {
    console.error("Cart update error:", err);
    res.status(500).json({ error: "Failed to update cart" });
  }
});


/* ============================
   REMOVE FROM CART
   ============================ */
router.post("/remove", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineName } = req.body;

    if (!medicineName) return res.status(400).json({ error: "Medicine Name required" });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ message: "Cart empty", cart: [] });

    // Filter out item
    const initialLen = cart.items.length;
    cart.items = cart.items.filter(i => i.medicineName !== medicineName);

    if (cart.items.length === initialLen) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    await cart.save();

    // Update Redis
    const plainItems = cart.items.map(i => ({
      medicineName: i.medicineName, quantity: i.quantity, pharmacyId: i.pharmacyId, price: i.price, image: i.image
    }));
    await setJSON(cartKey(userId), plainItems, CACHE_TTLS.CART);

    res.json({ message: "Item removed", cart: plainItems });

  } catch (err) {
    console.error("Cart remove error:", err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

module.exports = router;
