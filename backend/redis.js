// backend/redis.js

const { createClient } = require("redis");
const { REDIS_URL } = require("./config");

const client = createClient({ url: REDIS_URL });

// Basic event logging
client.on("error", (err) => {
  console.error("[Redis] Client error:", err);
});

client.on("connect", () => {
  console.log("[Redis] Connecting...");
});

client.on("ready", () => {
  console.log("[Redis] Connected and ready.");
});

// Connect immediately on server start
async function connectRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
  } catch (err) {
    console.error("[Redis] Failed to connect:", err);
  }
}

connectRedis();

/* ------------------------------------------
   JSON helpers (for future cache use)
------------------------------------------ */

async function getJSON(key) {
  try {
    if (!client.isOpen) return null;
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Redis] getJSON error for key:", key, err);
    return null;
  }
}

async function setJSON(key, value, ttlSeconds) {
  try {
    if (!client.isOpen) return;
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.setEx(key, ttlSeconds, payload);
    } else {
      await client.set(key, payload);
    }
  } catch (err) {
    console.error("[Redis] setJSON error for key:", key, err);
  }
}

async function delKey(key) {
  try {
    if (!client.isOpen) return;
    await client.del(key);
  } catch (err) {
    console.error("[Redis] delKey error for key:", key, err);
  }
}

async function deleteByPrefix(prefix) {
  try {
    if (!client.isOpen) return;
    const pattern = `${prefix}*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    console.error("[Redis] deleteByPrefix error for prefix:", prefix, err);
  }
}

/* ------------------------------------------
   Rate limiting helper – core of Step 5
   INCR + EXPIRE in one atomic multi()
------------------------------------------ */
async function incrWithTTL(key, windowSeconds) {
  try {
    if (!client.isOpen) return null;

    const results = await client
      .multi()
      .incr(key)
      .expire(key, windowSeconds)
      .exec();

    // results = [count, expireResult]
    const count = results && results[0];

    // node-redis returns number, but be safe:
    if (typeof count === "number") return count;
    if (typeof count === "string") return parseInt(count, 10);

    return null;
  } catch (err) {
    console.error("[Redis] incrWithTTL error for key:", key, err);
    // On error, do NOT block the user – just skip rate limiting
    return null;
  }
}

module.exports = {
  client,
  connectRedis,
  getJSON,
  setJSON,
  delKey,
  deleteByPrefix,
  incrWithTTL
};
