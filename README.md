# Real-Time Device Location Tracker

A small Node.js + Redis Geo service that ingests device GPS coordinates and
answers "which devices are within X metres of this point?" in milliseconds.

**Stack:** Node.js 20 · Express · ioredis · Redis 7 (Geo) · Docker Compose

## Project structure

```
├── docker-compose.yml     # redis + app services
├── Dockerfile             # app image (node:20-alpine, non-root)
└── src/
    ├── config.js          # all env-var configuration in one place
    ├── redisClient.js     # shared async ioredis client (retry + backoff)
    ├── app.js             # Express app: middleware, routes, error handler
    ├── server.js          # entry point: listen + graceful shutdown
    └── routes/
        └── locations.js   # POST /location, GET /nearby, GET /health
```

## How to start

```bash
docker compose up --build
```

The API is then available at `http://localhost:3000`.

Configuration (via environment variables):

| Variable    | Default              | Description        |
|-------------|----------------------|--------------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection   |
| `PORT`      | `3000`               | HTTP listen port   |

## API

### Add / update a device location

```bash
curl -X POST http://localhost:3000/location/sensor-a \
  -H "Content-Type: application/json" \
  -d '{ "latitude": 40.7128, "longitude": -74.0060 }'
```

Response: `200 { "status": "ok" }`

Invalid input (missing fields, latitude outside ±90, longitude outside ±180,
malformed JSON) returns `400` with a descriptive error, e.g.
`{ "error": "latitude must be between -90 and 90" }`.

### Query nearby devices

```bash
# radius in metres (default 1000)
curl "http://localhost:3000/nearby?latitude=40.7128&longitude=-74.0060&radius=500"
```

Response (sorted nearest-first, distances rounded to 2 decimals):

```json
[
  { "device_id": "sensor-a", "distance_meters": 0 },
  { "device_id": "camera-3", "distance_meters": 245.67 }
]
```

No devices in range → `200 []`. Missing/invalid parameters → `400`.

### Health check

```bash
curl http://localhost:3000/health
```

`200 { "redis": "connected" }` when Redis answers PING, otherwise
`503 { "redis": "disconnected", ... }`.

## Implementation notes

- **Storage:** one Redis geo key, `device_locations` (per spec). `GEOADD`
  upserts, so posting a new location for an existing device simply moves it.
- **Query:** `GEOSEARCH ... FROMLONLAT ... BYRADIUS r m ASC WITHDIST` — the
  modern replacement for the deprecated `GEORADIUS`, available since Redis 6.2.
- **Fully async:** ioredis promises + async/await everywhere; no blocking calls.
- **Resilience:** the Redis client retries with capped exponential backoff, the
  compose file gates app startup on a Redis healthcheck, and the app shuts down
  gracefully on SIGTERM/SIGINT.

## Assumptions & trade-offs

- **Last write wins.** Devices report every few seconds; we only keep the most
  recent position (no location history). Fits the "where is it now?" use case.
- **No TTL / stale-device eviction.** A device that stops reporting stays at
  its last position. Redis geo members can't have per-member TTLs; eviction
  would need a companion sorted set of last-seen timestamps and a sweep job —
  out of scope for the 2-hour limit, but noted as the first thing I'd add.
- **No authentication/rate limiting** — assumed to run inside a trusted network
  behind a gateway, as is typical for an internal ingestion service.
- **Device IDs** are taken from the URL path as-is (any non-empty string).
- **No persistence** (per spec): Redis runs with RDB/AOF disabled, so data is
  lost on container restart.
