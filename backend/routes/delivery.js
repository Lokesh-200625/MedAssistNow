const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const Order = require("../models/Order");


router.post("/update-location", auth, async (req, res) => {
  if (req.user.role !== "delivery")
    return res.status(403).json({ error: "Only delivery staff" });

  const { lat, lon } = req.body;
  if (!lat || !lon)
    return res.status(400).json({ error: "Missing lat/lon" });

  await User.findByIdAndUpdate(req.user.id, {
    location: { lat, lon }
  });

  return res.json({ success: true });
});

/* =====================================
   TOGGLE ONLINE STATUS (Delivery)
   POST /api/delivery/status
   Body: { status: true/false }
   ===================================== */
router.post("/status", auth, async (req, res) => {
  if (req.user.role !== "delivery")
    return res.status(403).json({ error: "Only delivery staff" });

  const { status } = req.body;
  if (typeof status !== "boolean")
    return res.status(400).json({ error: "Status (boolean) is required" });

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { isOnline: status },
    { new: true }
  );

  return res.json({ message: "Status updated", isOnline: user.isOnline });
});

/* =====================================
   GET EARNINGS
   GET /api/delivery/earnings
   ===================================== */
router.get("/earnings", auth, async (req, res) => {
  if (req.user.role !== "delivery") return res.status(403).json({ error: "Access denied" });

  try {
    // Find all delivered orders for this driver
    const orders = await Order.find({ deliveryId: req.user.id, status: "delivered" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    let todayEarnings = 0;
    let weekEarnings = 0;
    let totalEarnings = 0;

    for (const o of orders) {
      // Fallback for legacy orders: assume base earning (30) if calculation missing
      const earning = typeof o.totalEarning === 'number' ? o.totalEarning : 30;

      // Use deliveredAt or updatedAt as fallback
      const date = new Date(o.deliveredAt || o.updatedAt);

      totalEarnings += earning;

      if (date >= today) {
        todayEarnings += earning;
      }

      if (date >= weekAgo) {
        weekEarnings += earning;
      }
    }

    res.json({
      today: todayEarnings,
      week: weekEarnings,
      total: totalEarnings,
      completedCount: orders.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
