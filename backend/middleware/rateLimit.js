// backend/middleware/rateLimit.js

const { RATE_LIMITS } = require("../config");
const { incrWithTTL } = require("../redis");

/**
 * Helper: build a safe IP string
 */
function getClientId(req) {
  // You can enhance this later with X-Forwarded-For if behind proxy
  return req.ip || "unknown";
}

/* ------------------------------------------
   LOGIN RATE LIMIT
   - Max RATE_LIMITS.LOGIN.MAX attempts per WINDOW seconds, per IP
------------------------------------------ */
async function loginRateLimit(req, res, next) {
  try {
    const { WINDOW, MAX } = RATE_LIMITS.LOGIN;
    const ip = getClientId(req);
    const key = `rate:login:${ip}`;

    const count = await incrWithTTL(key, WINDOW);

    // If Redis failed, count will be null → skip limiting (do NOT block user)
    if (count !== null && count > MAX) {
      return res.status(429).json({
        error: "Too many login attempts. Please try again in a minute."
      });
    }

    next();
  } catch (err) {
    console.error("[RateLimit] loginRateLimit error:", err);
    // If limiter itself fails, never block request
    next();
  }
}

/* ------------------------------------------
   SEARCH RATE LIMIT
   - Max RATE_LIMITS.SEARCH.MAX searches per WINDOW seconds, per IP
------------------------------------------ */
async function searchRateLimit(req, res, next) {
  try {
    const { WINDOW, MAX } = RATE_LIMITS.SEARCH;
    const ip = getClientId(req);
    const key = `rate:search:${ip}`;

    const count = await incrWithTTL(key, WINDOW);

    if (count !== null && count > MAX) {
      return res.status(429).json({
        error: "Too many search requests. Please slow down and try again."
      });
    }

    next();
  } catch (err) {
    console.error("[RateLimit] searchRateLimit error:", err);
    next();
  }
}

module.exports = {
  loginRateLimit,
  searchRateLimit
};
