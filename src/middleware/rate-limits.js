const { rateLimit } = require('express-rate-limit');

function limiter(windowMs, limit) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Inténtalo nuevamente más tarde.' } });
}

const authLimiter = limiter(15 * 60 * 1000, 25);
const passwordResetRequestLimiter = limiter(60 * 60 * 1000, 8);
const passwordResetSubmitLimiter = limiter(60 * 60 * 1000, 12);
const paymentLimiter = limiter(15 * 60 * 1000, 12);
const uploadLimiter = limiter(15 * 60 * 1000, 40);

module.exports = { authLimiter, passwordResetRequestLimiter, passwordResetSubmitLimiter, paymentLimiter, uploadLimiter };
