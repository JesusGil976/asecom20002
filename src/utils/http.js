const crypto = require('crypto');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requestId() {
  return crypto.randomUUID();
}

function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado.' });
}

module.exports = { asyncHandler, requestId, notFound };
