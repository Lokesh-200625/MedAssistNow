// backend/workers/orderLogger.js

const { consumeEvents } = require("../rabbitmq");
const mongoose = require("mongoose");
const { MONGO_URL } = require("../config");

// Optional: connect to Mongo if the worker ever needs DB
async function start() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("[Worker] MongoDB connected");

    // Listen to all order-related events
    await consumeEvents(
      "order_logger_queue",
      ["order.*"], // order.created, order.status.updated, order.delivery.*, etc.
      async (routingKey, data) => {
        console.log("[Worker] Event received:", routingKey, data);
        // In future, do things like:
        // - send email
        // - write audit log
        // - push metrics
      }
    );
  } catch (err) {
    console.error("[Worker] Error starting worker:", err);
    process.exit(1);
  }
}

start();
