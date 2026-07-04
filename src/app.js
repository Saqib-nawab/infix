'use strict';

const express = require('express');
const locationsRouter = require('./routes/locations');

const app = express();

// Parse JSON bodies; malformed JSON is caught by the error handler below.
app.use(express.json());

// All routes.
app.use('/', locationsRouter);

// 404 for anything unmatched.
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Central error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Malformed JSON body from express.json() -> client error, not server error.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}: ${err.message}`);
  return res.status(500).json({ error: 'internal server error' });
});

module.exports = app;
