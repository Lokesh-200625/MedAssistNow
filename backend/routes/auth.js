const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();
const { JWT_SECRET } = require("../config");
const { loginRateLimit } = require("../middleware/rateLimit");

/* -------------------- SIGNUP -------------------- */
router.post("/signup", async (req, res) => {
  try {
    const {
      role,
      name,
      email,
      phone,
      password,
      address,
      pharmacyName,
      license,
      vehicleType,
      vehicleNumber,
      area,
      location     // { lat, lon } optional
    } = req.body;

    if (!role || !name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      role,
      name,
      email,
      phone,
      address,
      password: hash,
      pharmacyName,
      license,
      vehicleType,
      vehicleNumber,
      area,
      location: location || null
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ message: "Signup successful", token });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- LOGIN -------------------- */
router.post("/login", loginRateLimit, async (req, res) => {
  try {
    const { email, password, role, location } = req.body;

    if (!role) return res.status(400).json({ error: "Login role is required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    if (user.role !== role) {
      return res.json({ error: `You don't have a '${role}' account` });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ error: "Incorrect password" });

    // ✅ SAFE LOCATION UPDATE (never breaks address)
    if (
      location &&
      typeof location.lat === "number" &&
      typeof location.lon === "number" &&
      !isNaN(location.lat) &&
      !isNaN(location.lon)
    ) {
      user.location = {
        lat: Number(location.lat),
        lon: Number(location.lon)
      };
    }

    // ✅ HARD ADDRESS PROTECTION (never erased)
    if (!user.address || typeof user.address !== "string") {
      user.address = user.address || "";
    }

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ message: "Login successful", token });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;