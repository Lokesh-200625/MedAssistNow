// backend/routes/order.js
const { publishEvent } = require("../rabbitmq"); // 🐇 NEW

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../models/User");
const Stock = require("../models/Stock");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const auth = require("../middleware/auth");
const { delKey } = require("../redis");   // 🟢 ADD THIS AT TOP

// Earning + ETA constants
const BASE_EARNING_PER_ORDER = 30;    // ₹30 base
const PER_KM_EARNING = 5;             // ₹5 per km
const AVERAGE_SPEED_KMPH = 25;        // 25 km/h assumed for ETA


// 🔔 Socket helpers
const {
  notifyPharmacyOrdersChanged,
  notifyDeliveryReadyOrdersChanged,
  notifyUserOrdersChanged
} = require("../socket");

function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (x) => (x * Math.PI) / 180;

  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// =====================================
// PLACE ORDER
// POST /api/order/place
// =====================================
// =====================================
// PLACE ORDER
// POST /api/order/place
// =====================================
// =====================================
// PLACE ORDER
// POST /api/order/place
// =====================================
router.post("/place", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { location } = req.body;

    // 1) GET CART
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.json({ error: "Cart is empty" });
    }

    const user = await User.findById(userId);
    const userLocation = location || user.location || null;

    // 2) GROUP ITEMS BY PHARMACY
    const ordersByPharmacy = {};
    for (const item of cart.items) {
      if (!item.pharmacyId) continue;
      const pid = item.pharmacyId.toString();
      if (!ordersByPharmacy[pid]) {
        ordersByPharmacy[pid] = [];
      }
      ordersByPharmacy[pid].push(item);
    }

    const createdOrders = [];

    // 3) CREATE ORDER FOR EACH PHARMACY
    for (const [pid, items] of Object.entries(ordersByPharmacy)) {

      const totalAmount = items.reduce((sum, item) => {
        return sum + ((item.price || 0) * item.quantity);
      }, 0);

      // Decrement stock for these items
      for (const item of items) {
        await Stock.findOneAndUpdate(
          { pharmacyId: pid, medicineName: item.medicineName },
          { $inc: { quantity: -item.quantity } }
        );
      }

      const order = await Order.create({
        userId,
        pharmacyId: pid,
        userAddress: user.address,
        userLocation: userLocation,
        status: "pending",
        orderedAt: new Date(),
        items: items,
        totalAmount
      });

      createdOrders.push(order);

      // NOTIFICATIONS (Specific to this order)
      notifyPharmacyOrdersChanged();
      publishEvent("order.created", {
        orderId: order._id.toString(),
        userId,
        pharmacyId: pid,
        status: order.status,
        items: items,
        createdAt: order.orderedAt
      });
    }

    // 4) CLEAR CART
    cart.items = [];
    await cart.save();
    await delKey(`cart:user:${userId}`);

    // Notify user once
    notifyUserOrdersChanged(userId);

    return res.json({
      message: `Orders placed successfully (${createdOrders.length} orders created)`,
      orders: createdOrders
    });

  } catch (err) {
    console.error("Order error:", err);
    return res.status(500).json({ error: "Failed to place order" });
  }
});




// =====================================
// GET ORDERS FOR PHARMACY
// =====================================
router.get("/pharmacy", auth, async (req, res) => {
  try {
    const pharmacyId = req.user.id;

    const orders = await Order.find({ pharmacyId }).sort({ orderedAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Order fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/delivery/ready", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;
    const orders = await Order.find({
      status: { $in: ["ready", "out-for-delivery"] },
      $or: [
        { deliveryId: null },
        { deliveryId: deliveryId }
      ]
    }).sort({ orderedAt: -1 });

    const enriched = [];

    for (const o of orders) {
      const order = o.toObject();

      let pharmacyToUserKm = 0;
      let expectedEarning = BASE_EARNING_PER_ORDER;

      try {
        const pharmacy = await User.findById(order.pharmacyId);

        if (
          pharmacy &&
          pharmacy.location &&
          order.userLocation &&
          typeof order.userLocation.lat === "number" &&
          typeof order.userLocation.lon === "number"
        ) {
          pharmacyToUserKm = distanceKm(
            pharmacy.location,
            order.userLocation
          );
        }
      } catch (e) {
        console.error("Error computing pharmacy → user distance:", e);
      }

      // Earning preview must match /delivery/delivered logic
      expectedEarning =
        BASE_EARNING_PER_ORDER + pharmacyToUserKm * PER_KM_EARNING;

      order.distancePharmacyToUserKm = pharmacyToUserKm;
      order.expectedEarning = expectedEarning;

      enriched.push(order);
    }

    return res.json(enriched);
  } catch (err) {
    console.error("Delivery ready error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});





// =====================================
// UPDATE ORDER STATUS (pharmacy)
// =====================================
// UPDATE ORDER STATUS (pharmacy)
router.put("/status/:id", auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    // CAN'T MODIFY DELIVERED ORDER
    if (order.status === "delivered") {
      return res.json({ error: "Cannot update a delivered order" });
    }

    // CAN'T MODIFY ONCE DELIVERY PARTNER PICKED IT
    if (order.status === "out-for-delivery") {
      return res.json({ error: "Order already picked by delivery partner" });
    }

    order.status = status;

    // 🟢 AUTO-ASSIGN to NEAREST ONLINE DELIVERY USER if status is "ready"
    if (status === "ready") {
      // Find all ONLINE delivery users
      const drivers = await User.find({ role: "delivery", isOnline: true, "location.lat": { $ne: null } });

      if (drivers.length > 0) {
        // Get Pharmacy Location
        let pharmacyLocation = null;
        const pharmacy = await User.findById(order.pharmacyId);
        if (pharmacy && pharmacy.location) {
          pharmacyLocation = pharmacy.location;
        }

        if (pharmacyLocation) {
          let bestDriver = drivers[0];
          let bestDist = distanceKm(pharmacyLocation, bestDriver.location);

          for (let i = 1; i < drivers.length; i++) {
            const d = distanceKm(pharmacyLocation, drivers[i].location);
            if (d < bestDist) {
              bestDriver = drivers[i];
              bestDist = d;
            }
          }

          // Assign
          order.deliveryId = bestDriver._id;
          console.log(`[Order] Auto-assigned order ${order._id} to driver ${bestDriver.name} (${bestDist.toFixed(2)} km away)`);

          // NOTIFY DRIVER SPECIFICALLY (if using socket rooms, this would be `io.to(driverId).emit(...)`)
          // For now, `notifyDeliveryReadyOrdersChanged` broadcasts to all, but we can rely on `order.deliveryId` check in frontend
        }
      } else {
        console.log("[Order] No online drivers to auto-assign.");
      }

      notifyDeliveryReadyOrdersChanged(); // delivery sees it in ready list
    }

    await order.save();

    // REAL-TIME
    notifyPharmacyOrdersChanged();
    notifyUserOrdersChanged(order.userId);


    // RabbitMQ
    publishEvent("order.status.updated", {
      orderId: order._id.toString(),
      status: order.status,
      userId: order.userId,
      pharmacyId: order.pharmacyId,
      deliveryId: order.deliveryId
    });

    res.json({ message: "Status updated", order });

  } catch (err) {
    console.error("Order status update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// =====================================
// GET READY + OUT FOR DELIVERY ORDERS
// =====================================


// =====================================
// DELIVERY ACCEPT ORDER
// =====================================
// =====================================
// DELIVERY ACCEPT ORDER
// =====================================
router.put("/delivery/accept/:id", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    // Only ready orders can be accepted
    if (order.status !== "ready") {
      return res.json({ error: "Only ready orders can be accepted" });
    }

    // 🟢 ENFORCE ASSIGNMENT (if already assigned)
    if (order.deliveryId && order.deliveryId.toString() !== deliveryId) {
      return res.status(403).json({ error: "This order is assigned to another delivery partner" });
    }

    order.status = "out-for-delivery";
    order.deliveryId = deliveryId; // confirm assignment (in case it was null)
    order.pickedUp = false;
    order.pickedUpAt = null;

    await order.save();

    // get pharmacy location for navigation
    const pharmacy = await User.findById(order.pharmacyId);
    const pharmacyLocation = pharmacy && pharmacy.location ? pharmacy.location : null;

    // 🔔 REAL-TIME
    notifyDeliveryReadyOrdersChanged();
    notifyPharmacyOrdersChanged();
    notifyUserOrdersChanged(order.userId);

    // 🐇 RabbitMQ event: delivery accepted
    publishEvent("order.delivery.accepted", {
      orderId: order._id.toString(),
      deliveryId,
      userId: order.userId,
      pharmacyId: order.pharmacyId
    });

    return res.json({
      message: "Order accepted. Navigate to pharmacy.",
      order,
      pharmacyLocation,             // for Google Maps to pharmacy
      userLocation: order.userLocation || null  // kept for later if needed
    });

  } catch (err) {
    console.error("Delivery accept error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// =====================================
// DELIVERY PICKUP ORDER (AT PHARMACY)
router.put("/delivery/pickup/:id", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    if (!order.deliveryId || order.deliveryId.toString() !== deliveryId) {
      return res.status(403).json({ error: "This order is not assigned to you" });
    }

    if (order.status !== "out-for-delivery") {
      return res.json({ error: "Order is not out for delivery" });
    }

    if (order.pickedUp) {
      // already picked up, just return user location again
      return res.json({
        message: "Order already picked up. Navigate to user.",
        order,
        userLocation: order.userLocation || null,
        userAddress: order.userAddress || null
      });
    }

    order.pickedUp = true;
    order.pickedUpAt = new Date();
    await order.save();

    notifyDeliveryReadyOrdersChanged();
    notifyPharmacyOrdersChanged();
    notifyUserOrdersChanged(order.userId);

    publishEvent("order.delivery.picked-up", {
      orderId: order._id.toString(),
      deliveryId,
      userId: order.userId,
      pharmacyId: order.pharmacyId
    });

    // 🟢 Nav: Prefer Order Location, but fallback to Current User Profile Location
    let targetLocation = order.userLocation;
    if (!targetLocation || !targetLocation.lat) {
      const userUser = await User.findById(order.userId);
      if (userUser && userUser.location && userUser.location.lat) {
        targetLocation = userUser.location;
      }
    }

    return res.json({
      message: "Order picked up. Navigate to user.",
      order,
      userLocation: targetLocation || null,
      userAddress: order.userAddress || null
    });

  } catch (err) {
    console.error("Delivery pickup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});





// =====================================
// DELIVERY COMPLETES ORDER
// =====================================
// =====================================
// DELIVERY COMPLETES ORDER + HYBRID EARNING
// =====================================
router.put("/delivery/delivered/:id", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    // Prevent double-delivery
    if (order.status === "delivered") {
      return res.json({ message: "Order already delivered", order });
    }

    // 1) Mark as delivered
    order.status = "delivered";
    order.deliveredAt = new Date();

    // 2) Compute distance pharmacy → user (for earnings)
    let distance = 0;

    try {
      const pharmacy = await User.findById(order.pharmacyId);
      const userLocation = order.userLocation;

      if (pharmacy && pharmacy.location && userLocation && typeof userLocation.lat === "number" && typeof userLocation.lon === "number") {
        distance = distanceKm(pharmacy.location, userLocation);
      }
    } catch (e) {
      console.error("Error computing distance for earnings:", e);
      distance = 0;
    }

    // 3) Hybrid earning calculation
    const baseEarning = BASE_EARNING_PER_ORDER;
    const distanceEarning = distance * PER_KM_EARNING;
    const totalEarning = baseEarning + distanceEarning;

    // 4) Store on order
    order.distanceKm = distance;
    order.baseEarning = baseEarning;
    order.distanceEarning = distanceEarning;
    order.totalEarning = totalEarning;

    await order.save();

    // 5) REAL-TIME UPDATES
    notifyDeliveryReadyOrdersChanged();     // remove from ready list
    notifyPharmacyOrdersChanged();         // pharmacy history updates
    notifyUserOrdersChanged(order.userId); // user sees delivered

    // 6) 🐇 RabbitMQ event: delivered + earnings
    publishEvent("order.delivered", {
      orderId: order._id.toString(),
      userId: order.userId,
      deliveryId: order.deliveryId,
      pharmacyId: order.pharmacyId,
      deliveredAt: order.deliveredAt,
      distanceKm: order.distanceKm,
      baseEarning: order.baseEarning,
      distanceEarning: order.distanceEarning,
      totalEarning: order.totalEarning
    });

    return res.json({
      message: "Order delivered and earnings calculated",
      order
    });

  } catch (err) {
    console.error("Delivery complete error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


// =====================================
// ORDER HISTORY — USER
// =====================================
// =====================================
// ORDER HISTORY — USER (with ETA)
// =====================================
router.get("/history/user", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ userId }).sort({ orderedAt: -1 });

    // For each order that is out-for-delivery, compute ETA from driver → user
    const enriched = [];
    for (const o of orders) {
      const order = o.toObject();

      if (order.status === "out-for-delivery" && order.deliveryId && order.userLocation) {
        try {
          const driver = await User.findById(order.deliveryId);

          if (
            driver &&
            driver.location &&
            typeof driver.location.lat === "number" &&
            typeof driver.location.lon === "number" &&
            typeof order.userLocation.lat === "number" &&
            typeof order.userLocation.lon === "number"
          ) {
            const dist = distanceKm(driver.location, order.userLocation); // in km

            // ETA in minutes
            const etaMinutes = (dist / AVERAGE_SPEED_KMPH) * 60;

            // Rounded ETA for UI
            order.etaMinutes = Math.max(1, Math.round(etaMinutes));
          }
        } catch (e) {
          console.error("Failed to compute ETA for order", order._id, e);
        }
      }

      enriched.push(order);
    }

    return res.json(enriched);
  } catch (err) {
    console.error("User history error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


/* =====================================
   ORDER HISTORY — DELIVERY
   ===================================== */
router.get("/history/delivery", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;
    // Find delivered orders for this delivery partner
    const orders = await Order.find({ deliveryId, status: "delivered" }).sort({ deliveredAt: -1 });

    const enriched = orders.map(o => {
      const ord = o.toObject();
      // calculate earning if missing (helper)
      if (!ord.totalEarning) {
        ord.totalEarning = (ord.distanceEarning || 0) + (ord.baseEarning || 0); // fallback
      }
      // Ensure distance is exposed as 'distance' for frontend simplicity if needed
      ord.distance = ord.distanceKm || 0;
      return ord;
    });

    res.json(enriched);
  } catch (err) {
    console.error("Delivery history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// =====================================
// ORDER HISTORY — PHARMACY
// =====================================
// =====================================
// PHARMACY ANALYTICS
// =====================================
router.get("/analytics/pharmacy", auth, async (req, res) => {
  try {
    const pharmacyId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1) Total Sales Today (Delivered orders)
    const salesAgg = await Order.aggregate([
      {
        $match: {
          pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
          status: "delivered",
          deliveredAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" }
        }
      }
    ]);
    const totalSales = salesAgg.length > 0 ? salesAgg[0].total : 0;

    // 2) Pending Orders
    const pendingCount = await Order.countDocuments({
      pharmacyId,
      status: "pending"
    });

    // 3) Top Selling Item (All time or today? Let's do all time for better data initially)
    const topItemAgg = await Order.aggregate([
      { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.medicineName",
          count: { $sum: "$items.quantity" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const topItem = topItemAgg.length > 0 ? topItemAgg[0]._id : "N/A";

    res.json({
      totalSales,
      pendingOrders: pendingCount,
      topSelling: topItem
    });

  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
