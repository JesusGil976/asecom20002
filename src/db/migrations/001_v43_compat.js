module.exports = {
  id: '001_v43_compat',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
        session_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price_usd REAL NOT NULL CHECK(price_usd >= 0),
        icon TEXT NOT NULL DEFAULT 'CURSO',
        description TEXT NOT NULL DEFAULT '',
        long_description TEXT NOT NULL DEFAULT '',
        cover_image_url TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        level TEXT NOT NULL DEFAULT 'Todos',
        duration_hours REAL NOT NULL DEFAULT 0,
        promo_video_url TEXT,
        status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
        featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        video_url TEXT,
        image_url TEXT,
        pdf_media_id INTEGER,
        is_free INTEGER NOT NULL DEFAULT 0 CHECK(is_free IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('pdf','image')),
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        storage_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        lesson_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed')),
        discount_value REAL NOT NULL CHECK(discount_value > 0),
        max_uses INTEGER,
        uses_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        original_amount_usd REAL NOT NULL DEFAULT 0,
        discount_usd REAL NOT NULL DEFAULT 0,
        amount_usd REAL NOT NULL,
        amount_bs REAL NOT NULL DEFAULT 0,
        exchange_rate REAL NOT NULL DEFAULT 0,
        coupon_id INTEGER,
        payer_name TEXT NOT NULL,
        payer_bank TEXT NOT NULL,
        payer_phone TEXT NOT NULL,
        payer_document TEXT NOT NULL,
        reference TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        rejection_reason TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT,
        approved_at TEXT,
        reviewed_by INTEGER,
        approved_by INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE RESTRICT,
        FOREIGN KEY(coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
        FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS payment_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        storage_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at_ms INTEGER NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at_ms);
      CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        payment_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS lesson_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        lesson_id INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
        last_viewed_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, lesson_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
      );
    `);

    const add = (table, column, definition) => {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
      if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    };

    add('users', 'session_version', 'INTEGER NOT NULL DEFAULT 0');
    add('courses', 'long_description', "TEXT NOT NULL DEFAULT ''");
    add('courses', 'cover_image_url', 'TEXT');
    add('courses', 'category', "TEXT NOT NULL DEFAULT 'General'");
    add('courses', 'level', "TEXT NOT NULL DEFAULT 'Todos'");
    add('courses', 'duration_hours', 'REAL NOT NULL DEFAULT 0');
    add('courses', 'promo_video_url', 'TEXT');
    add('courses', 'status', "TEXT NOT NULL DEFAULT 'published'");
    add('courses', 'featured', 'INTEGER NOT NULL DEFAULT 0');
    add('courses', 'created_at', 'TEXT');
    add('courses', 'updated_at', 'TEXT');
    add('lessons', 'video_url', 'TEXT');
    add('lessons', 'image_url', 'TEXT');
    add('lessons', 'pdf_media_id', 'INTEGER');
    add('lessons', 'is_free', 'INTEGER NOT NULL DEFAULT 0');
    add('lessons', 'created_at', 'TEXT');
    add('lessons', 'updated_at', 'TEXT');
    add('payments', 'original_amount_usd', 'REAL NOT NULL DEFAULT 0');
    add('payments', 'discount_usd', 'REAL NOT NULL DEFAULT 0');
    add('payments', 'amount_bs', 'REAL NOT NULL DEFAULT 0');
    add('payments', 'exchange_rate', 'REAL NOT NULL DEFAULT 0');
    add('payments', 'coupon_id', 'INTEGER');
    add('payments', 'rejection_reason', 'TEXT');
    add('payments', 'reviewed_at', 'TEXT');
    add('payments', 'reviewed_by', 'INTEGER');

    db.prepare(`UPDATE payments SET original_amount_usd = amount_usd WHERE COALESCE(original_amount_usd, 0) = 0`).run();
    db.prepare(`UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL OR updated_at = ''`).run();
    db.prepare(`UPDATE lessons SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL OR updated_at = ''`).run();
  }
};
