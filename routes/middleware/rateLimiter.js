// /routes/middleware/rateLimiter.js
// Simple in-memory rate limiter for federation endpoints
// For production, consider using Redis-backed rate limiting

import logger from "#methods/utils/logger.js";

// Store for tracking request counts per IP
// Structure: { ip: { count: number, resetTime: timestamp } }
const requestCounts = new Map();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (data.resetTime < now) {
      requestCounts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

/**
 * Rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Max requests per window (default: 100)
 * @param {string} options.message - Error message when limit exceeded
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100,
  message = "Too many requests, please try again later",
} = {}) {
  return function rateLimiter(req, res, next) {
    // Skip rate limiting if disabled via environment variable
    if (process.env.RATE_LIMITING_ENABLED === "false") {
      return next();
    }

    // Get client IP (handle proxies)
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress ||
      req.connection.remoteAddress;

    const now = Date.now();
    const record = requestCounts.get(ip);

    // No record or window expired - start fresh
    if (!record || record.resetTime < now) {
      requestCounts.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    // Increment count
    record.count++;

    // Check if limit exceeded
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", "0");
      res.set("X-RateLimit-Reset", String(record.resetTime));

      logger.warn("Rate limit exceeded", {
        ip,
        count: record.count,
        max,
        path: req.path,
      });

      return res.status(429).json({
        error: message,
        retryAfter,
      });
    }

    // Set rate limit headers
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(max - record.count));
    res.set("X-RateLimit-Reset", String(record.resetTime));

    next();
  };
}

// Preset configurations for different endpoint types
export const inboxRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: "Too many inbox requests, please try again later",
});

export const outboxRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200, // More lenient for outbox
  message: "Too many outbox requests, please try again later",
});

export const strictRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Very strict for sensitive endpoints
  message: "Too many requests, please try again later",
});
