'use strict';

const Redis = require('ioredis');
const config = require('./config');

/**
 * Single shared ioredis client (fully async, promise-based).
 *
 * - Retries with capped exponential backoff so the app survives Redis
 *   starting slightly later than the app container.
 * - maxRetriesPerRequest keeps individual commands from hanging forever;
 *   failed commands reject and are handled by the route error handling.
 */
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // 200ms, 400ms, 800ms ... capped at 5s between reconnect attempts.
    return Math.min(200 * 2 ** times, 5000);
  },
});

redis.on('connect', () => {
  console.log(`[redis] connected to ${config.redisUrl}`);
});

redis.on('error', (err) => {
  // Log and keep running — ioredis reconnects automatically.
  console.error(`[redis] error: ${err.message}`);
});

module.exports = redis;
