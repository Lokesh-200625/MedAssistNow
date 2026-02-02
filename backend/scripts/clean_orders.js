const mongoose = require("mongoose");
const Order = require("../models/Order");

mongoose.connect("mongodb://127.0.0.1:27017/medassist")
    .then(() => console.log("DB Connected"))
    .catch(err => console.log(err));

async function clean() {
    // Delete orders with likely test data (0.05 is the value from verification script)
    const res = await Order.deleteMany({
        $or: [
            { "userLocation.lat": 0.05 },
            { "userLocation.lat": 0 }
        ]
    });
    console.log(`Deleted ${res.deletedCount} orders with invalid/test locations.`);
    process.exit();
}

clean();
