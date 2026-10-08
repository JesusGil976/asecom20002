const { config } = require('../config');

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = levels[config.logLevel] || levels.info;

function write(level, event, meta = {}) {
  if ((levels[level] || 20) < threshold) return;
  const payload = { timestamp: new Date().toISOString(), level, event, ...meta };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else console.log(line);
}

module.exports = {
  debug: (event, meta) => write('debug', event, meta),
  info: (event, meta) => write('info', event, meta),
  warn: (event, meta) => write('warn', event, meta),
  error: (event, meta) => write('error', event, meta)
};
