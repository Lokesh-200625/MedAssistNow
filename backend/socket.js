// backend/socket.js

const { Server } = require("socket.io");

let io = null;

/**
 * Initialize Socket.IO with the HTTP server
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("[Socket] Connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected:", socket.id);
    });
  });

  console.log("[Socket] Socket.IO initialized");
}

/**
 * Safe emit helper – does nothing if io is not ready
 */
function safeEmit(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

/**
 * Notify pharmacy dashboards that orders changed
 */
function notifyPharmacyOrdersChanged() {
  safeEmit("pharmacy:ordersChanged");
}

/**
 * Notify delivery dashboards that ready orders changed
 */
function notifyDeliveryReadyOrdersChanged() {
  safeEmit("delivery:readyOrdersChanged");
}

/**
 * Notify user UIs that their orders changed
 */
function notifyUserOrdersChanged(userId) {
  safeEmit("user:ordersChanged", { userId });
}

/**
 * Notify user UIs that stock changed (optional for future)
 */
function notifyStockChanged() {
  safeEmit("stock:changed");
}

module.exports = {
  initSocket,
  notifyPharmacyOrdersChanged,
  notifyDeliveryReadyOrdersChanged,
  notifyUserOrdersChanged,
  notifyStockChanged
};
