const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const { config } = require('../config');
const logger = require('../utils/logger');

let db;

function ensureDirectories() {
  for (const dir of [config.dataDir, config.privateUploadDir, config.publicUploadDir, config.certificateTemplateDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Copy packaged defaults only when persistent public storage is elsewhere. Never replace user templates.
  for(const name of ['demo-front.png','demo-back.png','default-front.png','default-back.png']){
    const source=path.join(config.publicDir,'uploads','certificates',name),target=path.join(config.certificateTemplateDir,name);
    if(source!==target && fs.existsSync(source) && !fs.existsSync(target))fs.copyFileSync(source,target);
  }
}

function getDatabase() {
  if (db) return db;
  ensureDirectories();
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const migrations = [
    require('./migrations/001_v43_compat'),
    require('./migrations/002_v5_platform'),
    require('./migrations/003_v51_certificates'),
    require('./migrations/004_v53_video')
  ];
  const applied = new Set(database.prepare('SELECT id FROM schema_migrations').all().map(row => row.id));
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    const tx = database.transaction(() => {
      migration.up(database);
      database.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migration.id);
    });
    tx();
    logger.info('migration_applied', { migration: migration.id });
  }
}

function closeDatabase() {
  if (!db) return;
  db.close();
  db = null;
}

module.exports = { getDatabase, migrate, closeDatabase, ensureDirectories };
