function cleanText(value, maxLength = 5000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function parseBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function slugify(value) {
  return cleanText(value, 160)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function safeColor(value, fallback = '#111827') {
  const candidate = cleanText(value, 32);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function safeHttpUrl(value, { httpsOnly = false, allowedHosts = null } = {}) {
  const candidate = cleanText(value, 2000);
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[\\\x00-\x1f]/.test(candidate)) return '';
    if (httpsOnly && url.protocol !== 'https:') return '';
    if (Array.isArray(allowedHosts) && allowedHosts.length && !allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function safeLocalUrl(value) {
  const raw = cleanText(value, 2000);
  return /^\/(?!\/)[^\\\x00-\x20]*$/.test(raw) ? raw : '';
}

function safeNavigationUrl(value) {
  return safeLocalUrl(value) || safeHttpUrl(value, { httpsOnly: true });
}

function safeGoogleMapsEmbed(value) {
  const raw = cleanText(value, 5000);
  if (!raw) return '';
  const source = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || raw;
  const safe = safeHttpUrl(source, { httpsOnly: true });
  if (!safe) return '';
  const u = new URL(safe);
  return ['www.google.com', 'maps.google.com', 'google.com'].includes(u.hostname) && /^\/maps\/(?:embed|d\/embed)(?:\/|$)/.test(u.pathname) ? safe : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

module.exports = { cleanText, normalizeEmail, parseBoolean, slugify, roundMoney, clampNumber, safeColor, safeHttpUrl, safeGoogleMapsEmbed, safeLocalUrl, safeNavigationUrl, escapeHtml };
