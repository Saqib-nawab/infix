'use strict';

const express = require('express');
const redis = require('../redisClient');
const config = require('../config');

const router = express.Router();

/**
 * Parse and validate a coordinate pair.
 * Returns { latitude, longitude } on success, or a string error message.
 */
function parseCoordinates(latRaw, lonRaw) {
  if (latRaw === undefined || latRaw === null || latRaw === '') {
    return 'latitude is required';
  }
  if (lonRaw === undefined || lonRaw === null || lonRaw === '') {
    return 'longitude is required';
  }

  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);

  if (!Number.isFinite(latitude)) {
    return 'latitude must be a number';
  }
  if (!Number.isFinite(longitude)) {
    return 'longitude must be a number';
  }
  if (latitude < -90 || latitude > 90) {
    return 'latitude must be between -90 and 90';
  }
  if (longitude < -180 || longitude > 180) {
    return 'longitude must be between -180 and 180';
  }

  return { latitude, longitude };
}

/**
 * POST /location/:device_id
 * Body: { "latitude": 40.7128, "longitude": -74.0060 }
 * Stores the device position via GEOADD.
 */
router.post('/location/:device_id', async (req, res, next) => {
  try {
    const { device_id: deviceId } = req.params;
    const body = req.body || {};

    const parsed = parseCoordinates(body.latitude, body.longitude);
    if (typeof parsed === 'string') {
      return res.status(400).json({ error: parsed });
    }

    // GEOADD key longitude latitude member  (note: lon before lat!)
    await redis.geoadd(
      config.geoKey,
      parsed.longitude,
      parsed.latitude,
      deviceId
    );

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /nearby?latitude=..&longitude=..&radius=..
 * Radius in metres, default 1000.
 * Returns [{ device_id, distance_meters }, ...] sorted nearest-first.
 */
router.get('/nearby', async (req, res, next) => {
  try {
    const parsed = parseCoordinates(req.query.latitude, req.query.longitude);
    if (typeof parsed === 'string') {
      return res.status(400).json({ error: parsed });
    }

    let radius = config.defaultRadiusMeters;
    if (req.query.radius !== undefined) {
      radius = Number(req.query.radius);
      if (!Number.isFinite(radius) || radius <= 0) {
        return res
          .status(400)
          .json({ error: 'radius must be a positive number (metres)' });
      }
    }

    // GEOSEARCH key FROMLONLAT lon lat BYRADIUS r m ASC WITHDIST
    // -> [ [member, distance], ... ] sorted nearest-first
    const results = await redis.geosearch(
      config.geoKey,
      'FROMLONLAT',
      parsed.longitude,
      parsed.latitude,
      'BYRADIUS',
      radius,
      'm',
      'ASC',
      'WITHDIST'
    );

    const devices = results.map(([deviceId, distance]) => ({
      device_id: deviceId,
      distance_meters: Math.round(Number(distance) * 100) / 100,
    }));

    return res.status(200).json(devices);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /health
 * PINGs Redis; 200 if reachable, 503 otherwise.
 */
router.get('/health', async (req, res) => {
  try {
    await redis.ping();
    return res.status(200).json({ redis: 'connected' });
  } catch (err) {
    return res.status(503).json({ redis: 'disconnected', error: err.message });
  }
});

module.exports = router;
