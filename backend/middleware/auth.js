
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

function auth(req, res, next) {
    // Token comes as: "Bearer token"
    const header = req.headers.authorization;

    if (!header) {
        return res.json({ error: "No token provided" });
    }

    const token = header.split(" ")[1]; // remove "Bearer"

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // save user data
        next(); // go forward
    } catch (err) {
        return res.json({ error: "Invalid token" });
    }
}

module.exports = auth;
