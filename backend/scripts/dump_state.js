const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");

mongoose.connect("mongodb://127.0.0.1:27017/medassist")
    .then(() => console.log("DB Connected"))
    .catch(err => console.log(err));

async function dump() {
    console.log("\n___ ALL USERS ___");
    const users = await User.find({});
    users.forEach(u => {
        console.log(`- [${u._id}] ${u.role} | ${u.name} | Loc: ${u.location?.lat},${u.location?.lon}`);
    });

    console.log("\n___ ALL ORDERS DATA ___");
    const orders = await Order.find({});
    orders.forEach(o => {
        console.log(`\nOrder [${o._id}] Status: ${o.status}`);
        console.log(` - PharmacyID: ${o.pharmacyId}`);
        console.log(` - DeliveryID: ${o.deliveryId}`);
        console.log(` - Order.userLocation:`, o.userLocation);
        console.log(` - Order.userAddress:`, o.userAddress);
    });

    process.exit();
}

dump();
