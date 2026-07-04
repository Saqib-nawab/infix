'use strict';

/**
 * Central configuration.
 * All environment variables are read here — nowhere else in the codebase.
 * Values come from the environment (.env via docker-compose env_file, or
 * `node --env-file=.env` locally); the fallbacks only guard a bare start.
 */
module.exports = {
  // Port the HTTP server listens on.
  port: parseInt(process.env.PORT, 10) || 3000,

  // Redis connection URL. Default matches the docker-compose service name.
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',

  // Redis sorted-set key holding all device geo positions.
  geoKey: process.env.GEO_KEY || 'device_locations',

  // Default search radius in metres for GET /nearby.
  defaultRadiusMeters:
    parseInt(process.env.DEFAULT_RADIUS_METERS, 10) || 1000,
};
