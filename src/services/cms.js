const { cleanText, parseBoolean } = require('../utils/text');

const SECTION_TYPES = new Set(['hero','featured_courses','stats','process','about','locations','testimonials','cta','rich_text','footer']);
const VARIANTS = {
  hero: new Set(['split','centered','minimal']),
  featured_courses: new Set(['cards','compact','horizontal']),
  stats: new Set(['inline','cards']),
  process: new Set(['steps','cards']),
  about: new Set(['split','centered']),
  locations: new Set(['grid','compact']),
  testimonials: new Set(['cards','slider']),
  cta: new Set(['simple','banner','highlighted']),
  rich_text: new Set(['default']),
  footer: new Set(['columns','minimal'])
};


function createCmsService(db) {
  function parseSections(rows) {
    return rows.map(row => ({ ...row, enabled: Boolean(row.enabled), settings: (() => { try { return JSON.parse(row.settings_json || '{}'); } catch { return {}; } })() }));
  }

  function pageBySlug(slug) {
    return db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
  }

  function versionPayload(versionId) {
    const version = db.prepare('SELECT * FROM page_versions WHERE id = ?').get(versionId);
    if (!version) return null;
    const sections = parseSections(db.prepare('SELECT * FROM page_sections WHERE version_id = ? ORDER BY sort_order,id').all(versionId));
    return { version, sections };
  }

  function getPublished(slug = 'home') {
    const page = pageBySlug(slug);
    if (!page?.published_version_id) return { page, version: null, sections: [] };
    return { page, ...versionPayload(page.published_version_id) };
  }

  function getEditor(slug = 'home') {
    const page = pageBySlug(slug);
    if (!page) return null;
    const draft = db.prepare("SELECT * FROM page_versions WHERE page_id = ? AND status = 'draft' ORDER BY version_number DESC LIMIT 1").get(page.id);
    const target = draft || (page.published_version_id ? db.prepare('SELECT * FROM page_versions WHERE id = ?').get(page.published_version_id) : null);
    return { page, ...(target ? versionPayload(target.id) : { version: null, sections: [] }) };
  }

  function ensureDraft(slug, userId) {
    const page = pageBySlug(slug);
    if (!page) throw Object.assign(new Error('Página no encontrada.'), { status: 404 });
    const existing = db.prepare("SELECT * FROM page_versions WHERE page_id = ? AND status = 'draft' ORDER BY version_number DESC LIMIT 1").get(page.id);
    if (existing) return versionPayload(existing.id);
    const maxVersion = db.prepare('SELECT COALESCE(MAX(version_number),0) value FROM page_versions WHERE page_id = ?').get(page.id).value;
    const result = db.prepare("INSERT INTO page_versions (page_id,status,version_number,created_by) VALUES (?, 'draft', ?, ?)").run(page.id, Number(maxVersion) + 1, userId);
    const draftId = Number(result.lastInsertRowid);
    if (page.published_version_id) {
      db.prepare(`INSERT INTO page_sections (version_id,section_key,section_type,variant,enabled,sort_order,settings_json)
        SELECT ?,section_key,section_type,variant,enabled,sort_order,settings_json FROM page_sections WHERE version_id = ?`).run(draftId, page.published_version_id);
    }
    return versionPayload(draftId);
  }

  function validateSection(input, index) {
    const sectionType = cleanText(input.section_type || input.type, 50);
    if (!SECTION_TYPES.has(sectionType)) throw Object.assign(new Error(`Tipo de sección no permitido: ${sectionType}`), { status: 400 });
    const variant = cleanText(input.variant || 'default', 50);
    if (!VARIANTS[sectionType]?.has(variant)) throw Object.assign(new Error(`Variante inválida para ${sectionType}.`), { status: 400 });
    const key = cleanText(input.section_key || input.key || `${sectionType}-${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, '-');
    return { key, sectionType, variant, enabled: parseBoolean(input.enabled) ? 1 : 0, sortOrder: index, settings: require('./cms-schema').validateSettings(sectionType,input.settings || {}) };
  }

  function saveDraft(slug, userId, sections) {
    if (!Array.isArray(sections) || sections.length > 40) throw Object.assign(new Error('Estructura de página inválida.'), { status: 400 });
    const normalized = sections.map(validateSection);
    const keys = new Set(normalized.map(item => item.key));
    if (keys.size !== normalized.length) throw Object.assign(new Error('Las secciones deben tener identificadores únicos.'), { status: 400 });
    const tx = db.transaction(() => {
      const draft = ensureDraft(slug, userId);
      const versionId = draft.version.id;
      db.prepare('DELETE FROM page_sections WHERE version_id = ?').run(versionId);
      const insert = db.prepare(`INSERT INTO page_sections (version_id,section_key,section_type,variant,enabled,sort_order,settings_json)
        VALUES (?,?,?,?,?,?,?)`);
      normalized.forEach(item => insert.run(versionId, item.key, item.sectionType, item.variant, item.enabled, item.sortOrder, JSON.stringify(item.settings)));
    });
    tx();
    return getEditor(slug);
  }

  function publish(slug, userId) {
    const page = pageBySlug(slug);
    if (!page) throw Object.assign(new Error('Página no encontrada.'), { status: 404 });
    const draft = db.prepare("SELECT * FROM page_versions WHERE page_id=? AND status='draft' ORDER BY version_number DESC LIMIT 1").get(page.id);
    if (!draft) throw Object.assign(new Error('No hay borrador para publicar.'), { status: 409 });
    const tx = db.transaction(() => {
      if (page.published_version_id) db.prepare("UPDATE page_versions SET status='archived' WHERE id=?").run(page.published_version_id);
      db.prepare("UPDATE page_versions SET status='published', published_at=CURRENT_TIMESTAMP, created_by=COALESCE(created_by,?) WHERE id=?").run(userId, draft.id);
      db.prepare('UPDATE pages SET published_version_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(draft.id, page.id);
    });
    tx();
    return getPublished(slug);
  }

  function discardDraft(slug) {
    const page = pageBySlug(slug);
    if (!page) return;
    db.prepare("DELETE FROM page_versions WHERE page_id=? AND status='draft'").run(page.id);
  }

  return { getPublished, getEditor, ensureDraft, saveDraft, publish, discardDraft, SECTION_TYPES: [...SECTION_TYPES], VARIANTS };
}

module.exports = { createCmsService };
