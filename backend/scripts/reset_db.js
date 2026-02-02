const mongoose = require("mongoose");
const { MONGO_URL } = require("../config");
const User = require("../models/User");
const Order = require("../models/Order");
const Stock = require("../models/Stock");
const Cart = require("../models/Cart");

async function run() {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to DB...");

    await User.deleteMany({});
    console.log("Deleted all Users");

    await Order.deleteMany({});
    console.log("Deleted all Orders");

    await Stock.deleteMany({});
    console.log("Deleted all Stock");

    await Cart.deleteMany({});
    console.log("Deleted all Carts");

    console.log("Database Cleared.");
    process.exit();
}

run();
