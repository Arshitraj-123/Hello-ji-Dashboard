/**
 * Centralized configuration — reads from process.env with sensible defaults.
 * Every other module imports from here instead of touching process.env directly.
 */

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,

  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/helloji",

  jwt: {
    secret: process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || "http://localhost:8080")
      .split(",")
      .map((o) => o.trim()),
  },

  seed: {
    name: process.env.SEED_ADMIN_NAME || "Admin",
    email: process.env.SEED_ADMIN_EMAIL || "admin@helloji.in",
    phone: process.env.SEED_ADMIN_PHONE || "+919356444000",
    password: process.env.SEED_ADMIN_PASSWORD || "changeme123",
  },

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8080",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:5000",

  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Helloji Booking Desk <noreply@helloji.in>",
  },

  pinbot: {
    apiKey: process.env.PINBOT_API_KEY || "",
    waNumber: process.env.PINBOT_WA_NUMBER || "",
    apiUrl: process.env.PINBOT_API_URL || "https://partners.pinbot.ai/v2/messages",
  },

  bcryptRounds: 12,
};

export default config;
