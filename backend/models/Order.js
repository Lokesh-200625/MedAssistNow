const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  items: [
    {
      medicineName: String,
      quantity: Number,
      price: Number,
      pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    }
  ],

  userAddress: String,
  userLocation: {
    lat: Number,
    lon: Number
  },

  status: {
    type: String,
    enum: ["pending", "ready", "out-for-delivery", "delivered"],
    default: "pending"
  },

  pickedUp: { type: Boolean, default: false },
  pickedUpAt: { type: Date },


  orderedAt: Date,
  deliveredAt: Date,

  // 🔽 NEW: distance and earnings fields
  distanceKm: { type: Number, default: 0 },          // pharmacy → user distance
  baseEarning: { type: Number, default: 0 },         // fixed per order
  distanceEarning: { type: Number, default: 0 },     // per km
  distanceEarning: { type: Number, default: 0 },     // per km
  totalEarning: { type: Number, default: 0 },        // base + distance
  totalAmount: { type: Number, default: 0 }          // 🟢 NEW: cost to user (sum of items)
});

module.exports = mongoose.model("Order", OrderSchema);
