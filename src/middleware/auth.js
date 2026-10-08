const crypto = require('crypto');

function createAuthMiddleware(db) {
  function ensureCsrf(req) {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    return req.session.csrfToken;
  }

  function attachUser(req, _res, next) {
    if (!req.session?.userId) return next();
    const user = db.prepare('SELECT id,name,email,role,session_version,created_at FROM users WHERE id=?').get(req.session.userId);
    if (!user || Number(user.session_version) !== Number(req.session.sessionVersion || 0)) {
      req.session.userId = null;
      req.user = null;
      return next();
    }
    req.user = user;
    next();
  }

  function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Debes iniciar sesión.' });
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Debes iniciar sesión.' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso reservado a administración.' });
    req.admin = req.user;
    next();
  }

  function requireCsrf(req, res, next) {
    const token = String(req.get('x-csrf-token') || req.body?._csrf || '');
    if (!req.session?.csrfToken || token.length < 20 || !safeEqual(token, req.session.csrfToken)) {
      return res.status(403).json({ error: 'La sesión de seguridad expiró. Recarga la página e inténtalo nuevamente.' });
    }
    next();
  }

  function safeEqual(a, b) {
    const aa = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  }

  return { ensureCsrf, attachUser, requireAuth, requireAdmin, requireCsrf };
}

module.exports = { createAuthMiddleware };
