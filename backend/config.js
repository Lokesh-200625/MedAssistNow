// backend/config.js

module.exports = {
  // JWT secret (keep in env in real production)
  JWT_SECRET: process.env.JWT_SECRET || "your_super_secret_key",

  // MongoDB connection URL
  MONGO_URL: process.env.MONGO_URL || "mongodb://127.0.0.1:27017/medassist",

  // Redis connection URL
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",

  // Elasticsearch (SECURED HTTPS)
  ELASTIC_URL: process.env.ELASTIC_URL || "http://localhost:9200",
  ELASTIC_USERNAME: process.env.ELASTIC_USERNAME || "elastic",
  ELASTIC_PASSWORD: process.env.ELASTIC_PASSWORD || "XM1yj5PQw+dFP=tjSRIJ",
  ELASTIC_INDEX_STOCK: process.env.ELASTIC_INDEX_STOCK || "medassist_stock",

  // Environment flag
  IS_DEV: process.env.NODE_ENV !== "production",

  // Cache TTLs
  CACHE_TTLS: {
    STOCK_SEARCH: 60,      // seconds
    MEDICINE: 300,
    CART: 86400,
    READY_ORDERS: 15,
    ORDER_HISTORY: 30
  },

  // Rate limit configs
  RATE_LIMITS: {
    LOGIN: {
      WINDOW: 60,  // seconds (1 minute)
      MAX: 5       // max 5 login attempts per IP per minute
    },
    SEARCH: {
      WINDOW: 60,  // seconds (1 minute)
      MAX: 30      // max 30 searches per IP per minute
    }
  }
};
