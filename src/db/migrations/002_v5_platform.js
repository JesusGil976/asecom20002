module.exports = {
  id: '002_v5_platform',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS design_tokens (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        published_version_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS page_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
        version_number INTEGER NOT NULL,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT,
        UNIQUE(page_id, version_number),
        FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS page_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id INTEGER NOT NULL,
        section_key TEXT NOT NULL,
        section_type TEXT NOT NULL,
        variant TEXT NOT NULL DEFAULT 'default',
        enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(version_id) REFERENCES page_versions(id) ON DELETE CASCADE,
        UNIQUE(version_id, section_key)
      );

      CREATE INDEX IF NOT EXISTS idx_page_sections_version_order ON page_sections(version_id, sort_order);

      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        map_embed_url TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS navigation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        href TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT 'header' CHECK(location IN ('header','footer')),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ip_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS cms_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('image','document')),
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        public_url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    const add = (table, column, definition) => {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
      if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    };
    add('courses', 'seo_title', "TEXT NOT NULL DEFAULT ''");
    add('courses', 'seo_description', "TEXT NOT NULL DEFAULT ''");
  }
};
