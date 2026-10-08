const crypto = require('crypto');
const { config } = require('../config');

function createAuditService(db) {
  const insert = db.prepare(`INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata_json,ip_hash)
    VALUES (?,?,?,?,?,?)`);

  function ipHash(ip) {
    if (!ip) return null;
    return crypto.createHmac('sha256', config.sessionSecret).update(String(ip)).digest('hex').slice(0, 32);
  }

  function write({ actorUserId = null, action, entityType = null, entityId = null, metadata = {}, ip = null }) {
    let safeMetadata = JSON.stringify(metadata, (key, value) => /password|token|secret|cookie/i.test(key) ? '[redacted]' : value);
    if (safeMetadata.length > 10000) safeMetadata = JSON.stringify({ truncated: true, preview: safeMetadata.slice(0, 9000) });
    insert.run(actorUserId, action, entityType, entityId == null ? null : String(entityId), safeMetadata, ipHash(ip));
  }

  function list({ limit = 100, offset = 0 } = {}) {
    const safeLimit = Math.min(250, Math.max(1, Number(limit) || 100));
    const safeOffset = Math.max(0, Number(offset) || 0);
    return db.prepare(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.metadata_json,a.created_at,u.name actor_name,u.email actor_email
      FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.id DESC LIMIT ? OFFSET ?`).all(safeLimit, safeOffset).map(row => ({
        ...row,
        metadata: (() => { try { return JSON.parse(row.metadata_json || '{}'); } catch { return {}; } })()
      }));
  }

  return { write, list };
}

module.exports = { createAuditService };
