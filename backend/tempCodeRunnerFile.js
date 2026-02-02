const express = require("express");
const path = require("path");
const cors = require("cors");

const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/medassist")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const app = express();
app.use(express.json());
app.use(cors());

// Correct path to frontend
app.use(express.static(path.join(__dirname, "../public/user")));

// Auth routes
app.use("/api/auth", require("./routes/auth"));

// Dummy medicine list
let medicines = [
    "Paracetamol", "Ibuprofen", "Aspirin",
    "Vitamin C", "Amoxicillin", "Antacid",
    "Cough Syrup", "Insulin", "DOlO-650"
];

// ================= API ROUTES =================

// SEARCH API
app.get("/api/search", (req, res) => {
    const q = req.query.q?.toLowerCase() || "";
    const results = medicines.filter(m => m.toLowerCase().includes(q));
    res.json(results);
});

// Fallback route for frontend
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// PORT
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
