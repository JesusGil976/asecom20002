const { safeColor } = require('../utils/text');

const STORAGE_KEY = 'certificate_layout_json';

const DEFAULT_LAYOUT = Object.freeze({
  version: 1,
  front: {
    student_name: { label: 'Nombre del alumno', enabled: true, x: 16, y: 43, width: 68, height: 9, size: 30, color: '#0f172a', align: 'center', style: 'bold' },
    course_name: { label: 'Curso', enabled: true, x: 18, y: 57, width: 64, height: 8, size: 18, color: '#334155', align: 'center', style: 'bold' },
    duration: { label: 'Duración', enabled: true, x: 18, y: 72, width: 20, height: 6, size: 11, color: '#475569', align: 'left', style: 'regular' },
    date: { label: 'Fecha', enabled: true, x: 18, y: 80, width: 20, height: 6, size: 11, color: '#475569', align: 'left', style: 'regular' },
    code: { label: 'Código', enabled: true, x: 58, y: 80, width: 25, height: 6, size: 9, color: '#475569', align: 'center', style: 'regular' }
  },
  back: {
    content: { label: 'Contenido / clases', enabled: true, x: 9, y: 20, width: 64, height: 56, size: 12, color: '#1f2937', align: 'left', style: 'regular' },
    duration: { label: 'Duración', enabled: true, x: 74, y: 20, width: 18, height: 7, size: 14, color: '#334155', align: 'center', style: 'bold' },
    code: { label: 'Código', enabled: true, x: 9, y: 88, width: 34, height: 5, size: 8, color: '#475569', align: 'left', style: 'regular' }
  }
});

const FIELD_NAMES = {
  front: ['student_name', 'course_name', 'duration', 'date', 'code'],
  back: ['content', 'duration', 'code']
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.min(max,Math.max(min,fallback));
  return Math.min(max, Math.max(min, number));
}

function sanitizeField(input, fallback) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const width = clamp(source.width, 5, 100, fallback.width);
  const height = clamp(source.height, 3, 90, fallback.height);
  const x = clamp(source.x, 0, Math.max(0, 100 - width), fallback.x);
  const y = clamp(source.y, 0, Math.max(0, 100 - height), fallback.y);
  return {
    label: fallback.label,
    enabled: source.enabled === undefined ? fallback.enabled : require('../utils/text').parseBoolean(source.enabled),
    x,
    y,
    width,
    height,
    size: clamp(source.size, 7, 60, fallback.size),
    color: safeColor(source.color, fallback.color),
    align: ['left', 'center', 'right'].includes(source.align) ? source.align : fallback.align,
    style: ['regular', 'bold', 'italic', 'boldItalic'].includes(source.style) ? source.style : fallback.style
  };
}

function sanitizeLayout(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const output = { version: 1, front: {}, back: {} };
  for (const side of ['front', 'back']) {
    for (const fieldName of FIELD_NAMES[side]) {
      output[side][fieldName] = sanitizeField(source?.[side]?.[fieldName], DEFAULT_LAYOUT[side][fieldName]);
    }
  }
  return output;
}

function createCertificateLayoutService(db) {
  const getStmt = db.prepare('SELECT value FROM site_settings WHERE key=?');
  const upsertStmt = db.prepare(`INSERT INTO site_settings (key,value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`);

  function get() {
    const raw = getStmt.get(STORAGE_KEY)?.value;
    if (!raw) return clone(DEFAULT_LAYOUT);
    try {
      return sanitizeLayout(JSON.parse(raw));
    } catch {
      return clone(DEFAULT_LAYOUT);
    }
  }

  function update(layout) {
    const safe = sanitizeLayout(layout);
    upsertStmt.run(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  }

  function reset() {
    const safe = clone(DEFAULT_LAYOUT);
    upsertStmt.run(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  }

  return { get, update, reset, defaults: () => clone(DEFAULT_LAYOUT), fieldNames: FIELD_NAMES };
}

module.exports = { createCertificateLayoutService, sanitizeLayout, DEFAULT_LAYOUT, STORAGE_KEY };
