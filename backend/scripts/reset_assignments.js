const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");

mongoose.connect("mongodb://127.0.0.1:27017/medassist")
    .then(() => console.log("DB Connected"))
    .catch(err => console.log(err));

async function reset() {
    const res = await Order.updateMany(
        { status: "ready" },
        { $set: { deliveryId: null } }
    );
    console.log(`Reset ${res.modifiedCount} orders to unassigned.`);

    const res2 = await User.updateMany(
        { role: "delivery", name: { $in: ["Driver Near", "Driver Far"] } },
        { $set: { isOnline: false } }
    );
    console.log(`Set ${res2.modifiedCount} test drivers to offline.`);

    process.exit();
}

reset();
