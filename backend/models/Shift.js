const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema({
    date: { type: String, required: true },  // e.g. "2025-10-25"
    slot: { type: String, required: true },  // e.g. "09:00 AM - 01:00 PM"
    region: { type: String, required: true },
    capacity: { type: Number, default: 5 },
    filled: { type: Number, default: 0 },
    assignedDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

module.exports = mongoose.model("Shift", ShiftSchema);
