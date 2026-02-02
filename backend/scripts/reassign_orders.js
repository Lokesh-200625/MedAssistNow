const mongoose = require("mongoose");
const Order = require("../models/Order");

mongoose.connect("mongodb://127.0.0.1:27017/medassist")
    .then(() => console.log("DB Connected"))
    .catch(err => console.log(err));

async function reassign() {
    // Current pharmacist 'medplus' ID from dump
    const targetPharmacyId = "693857ff2abebf1ef576006b";

    const res = await Order.updateMany(
        { status: "pending" },
        { $set: { pharmacyId: targetPharmacyId } }
    );
    console.log(`Reassigned ${res.modifiedCount} pending orders to pharmacist ${targetPharmacyId}.`);
    process.exit();
}

reassign();
