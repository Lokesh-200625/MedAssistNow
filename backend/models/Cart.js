const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
        {
            medicineName: String,
            quantity: { type: Number, default: 1 },
            price: Number,      // 🟢 NEW
            image: String,      // 🟢 NEW
            pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
        }
    ]

});

module.exports = mongoose.model("Cart", CartSchema);
