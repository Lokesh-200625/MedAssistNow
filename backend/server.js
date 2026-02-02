// backend/server.js
// const { initSocket } = require("./socket");
// const { ensureStockIndex } = require("./search");
const { connectRabbit } = require("./rabbitmq"); // 🐇 NEW
const client = require("prom-client"); // 🔥 Prometheus client

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");

const { initSocket } = require("./socket");
const { ensureStockIndex } = require("./search");  // 🔥 NEW

// ================= DATABASE =================
mongoose
  .connect("mongodb://127.0.0.1:27017/medassist")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const app = express();
app.use(express.json());
app.use(cors());

// ================= STATIC FILES =================
// Serve *entire* public folder (user + pharmacist + delivery)
app.use(express.static(path.join(__dirname, "../public")));

// ================= API ROUTES =================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/stock", require("./routes/stock"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/order", require("./routes/order"));
app.use("/api/delivery", require("./routes/delivery"));


// ================= PROMETHEUS METRICS =================

// Create a Registry which registers the metrics
const register = new client.Registry();

// Collect default metrics (process_cpu, memory, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: "medass_"
});

// Custom metrics

// Total HTTP requests counter
const httpRequestTotal = new client.Counter({
  name: "medass_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"]
});

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: "medass_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5] // in seconds
});

// Register custom metrics
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestDuration);

// Middleware to track every request
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durNs = process.hrtime.bigint() - start;
    const durSec = Number(durNs) / 1e9;

    const route = req.route?.path || req.path || "unknown";

    const labels = {
      method: req.method,
      route: route,
      status: res.statusCode
    };

    httpRequestTotal.inc(labels);
    httpRequestDuration.observe(labels, durSec);
  });

  next();
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    console.error("Metrics error:", err);
    res.status(500).end();
  }
});


// Dummy medicines (temp)
let medicines = [
  "Paracetamol",
  "Ibuprofen",
  "Aspirin",
  "Vitamin C",
  "Amoxicillin",
  "Antacid",
  "Cough Syrup",
  "Insulin",
  "DOLO-650"
];

// SEARCH API (old demo)
app.get("/api/search", (req, res) => {
  const q = req.query.q?.toLowerCase() || "";
  const results = medicines.filter((m) => m.toLowerCase().includes(q));
  res.json(results);
});

// ================= FALLBACK ROUTE =================
// Any unknown route → load user home page
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/home.html"));
});

// ================= HTTP + SOCKET SERVER =================
const PORT = process.env.PORT || 5000;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
initSocket(server);

// Make callback async so we can await ES init
// Make callback async so we can await ES init
server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  try {
    // Elasticsearch
    await ensureStockIndex(); // has internal retry
  } catch (err) {
    console.error("Elasticsearch init failed (non-fatal):", err.message);
  }

  try {
    // RabbitMQ
    await connectRabbit(); // has internal retry
  } catch (err) {
    console.error("RabbitMQ init failed (non-fatal):", err.message);
  }
});

