// backend/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  role: { type: String, required: true },   // "user" | "pharmacist" | "delivery"
  name: { type: String, required: true },

  // Pharmacist specific
  pharmacyName: String,
  license: String,

  // Delivery specific
  vehicleType: String,
  vehicleNumber: String,
  area: String,
  isOnline: { type: Boolean, default: false }, // Delivery active status

  // Common
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true },
  address: String,

  // 🌍 location for all roles (user, pharmacist, delivery)
  location: {
    lat: Number,
    lon: Number
  }
});

module.exports = mongoose.model("User", UserSchema);
