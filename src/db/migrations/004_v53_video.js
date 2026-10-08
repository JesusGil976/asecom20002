module.exports = {
  id: "004_v53_video",
  up(db) {
    db.exec(`
      ALTER TABLE lessons ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published'));
      ALTER TABLE lessons ADD COLUMN video_asset_id TEXT;
      ALTER TABLE lesson_progress ADD COLUMN position_seconds REAL NOT NULL DEFAULT 0;
      CREATE TABLE video_assets (
        id TEXT PRIMARY KEY,
        lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        original_name TEXT NOT NULL,
        expected_bytes INTEGER NOT NULL,
        received_bytes INTEGER NOT NULL DEFAULT 0,
        stored_bytes INTEGER NOT NULL DEFAULT 0,
        duration_seconds REAL NOT NULL DEFAULT 0,
        state TEXT NOT NULL CHECK(state IN ('uploading','queued','processing','ready','failed')),
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_video_assets_state ON video_assets(state,updated_at);
      CREATE INDEX idx_video_assets_lesson ON video_assets(lesson_id);
    `);
  },
};
