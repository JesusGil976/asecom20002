const { config } = require('../config');

function verifyOrigin(req, res, next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const origin = String(req.get('origin') || '');
  if (!origin) return next(); // Clientes no navegador y same-origin antiguos pueden omitirlo; CSRF sigue activo.
  const allowed = new Set();
  if (config.publicUrl) {
    try { allowed.add(new URL(config.publicUrl).origin); } catch {}
  }
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  if (!config.publicUrl) allowed.add(requestOrigin);
  if (!allowed.has(origin)) return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
  next();
}

module.exports = { verifyOrigin };
