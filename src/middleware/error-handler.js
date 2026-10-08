const logger = require('../utils/logger');

function errorHandler(error, req, res, _next) {
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.name === 'MulterError' ? 400 : Number(error.status || error.statusCode || 500);
  if (status >= 500) logger.error('request_error', { requestId: req.id, method: req.method, path: req.path, message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  else logger.warn('request_rejected', { requestId: req.id, method: req.method, path: req.path, status, message: error.message });

  if (res.headersSent) return;
  const message = status >= 500 ? 'Ocurrió un error interno. Inténtalo nuevamente.' : (error.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño permitido.' : error.message || 'Solicitud no válida.');
  res.status(status).json({ error: message, requestId: req.id });
}

module.exports = { errorHandler };
