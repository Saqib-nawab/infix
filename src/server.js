'use strict';

const app = require('./app');
const config = require('./config');
const redis = require('./redisClient');

const server = app.listen(config.port, () => {
  console.log(`[app] listening on port ${config.port}`);
});

/**
 * Graceful shutdown: stop accepting connections, then close Redis.
 * Docker sends SIGTERM on `docker compose down`.
 */
function shutdown(signal) {
  console.log(`[app] ${signal} received, shutting down...`);
  server.close(() => {
    redis.quit().finally(() => process.exit(0));
  });
  // Force-exit if something hangs beyond 5s.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
