const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medicineName: { type: String, required: true },
    quantity: { type: Number, required: true },
    batchNo: String,

    // 🟢 New Real Data Fields
    category: { type: String, required: true },  // e.g. "Pain Relief", "Supplements"
    image: { type: String },                     // URL to image
    price: { type: Number, required: true },     // Price per unit
    description: { type: String },               // Short description

    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Stock", StockSchema);
