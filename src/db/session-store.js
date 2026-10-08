const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStmt = db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?');
    this.setStmt = db.prepare(`INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`);
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?');
    this.clearExpiredStmt = db.prepare('DELETE FROM sessions WHERE expire < ?');
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row || Number(row.expire) < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (error) { callback(error); }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expire = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 1000 * 60 * 60 * 24 * 7;
      this.setStmt.run(sid, JSON.stringify(sess), expire);
      callback(null);
    } catch (error) { callback(error); }
  }

  destroy(sid, callback = () => {}) {
    try { this.destroyStmt.run(sid); callback(null); } catch (error) { callback(error); }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const expire = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 1000 * 60 * 60 * 24 * 7;
      this.touchStmt.run(expire, sid);
      callback(null);
    } catch (error) { callback(error); }
  }

  clearExpired() {
    this.clearExpiredStmt.run(Date.now());
  }
}

module.exports = { SQLiteSessionStore };
