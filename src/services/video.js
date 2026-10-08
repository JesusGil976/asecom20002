const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { config } = require("../config");

const CHUNK_BYTES = 4 * 1024 * 1024;
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function assetDir(id) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw fail("Vídeo no encontrado.", 404);
  return path.join(config.privateUploadDir, "videos", id);
}
function dirSize(folder) {
  if (!fs.existsSync(folder)) return 0;
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .reduce((sum, entry) => {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw fail("Archivo de vídeo no válido.");
      return (
        sum + (entry.isDirectory() ? dirSize(file) : fs.statSync(file).size)
      );
    }, 0);
}
function presentVideo(db, lesson) {
  const asset =
    lesson.video_asset_id &&
    db
      .prepare(
        "SELECT state,duration_seconds FROM video_assets WHERE id=? AND lesson_id=?",
      )
      .get(lesson.video_asset_id, lesson.id);
  return {
    ...lesson,
    video:
      asset?.state === "ready"
        ? {
            url: `/api/videos/${lesson.id}/master.m3u8`,
            duration: asset.duration_seconds,
            captions: fs.existsSync(
              path.join(assetDir(lesson.video_asset_id), "hls", "captions.vtt"),
            ),
          }
        : null,
  };
}
function authorizeLesson(db, user, lessonId, { allowFree = false } = {}) {
  const lesson = db
    .prepare(
      "SELECT l.*,c.status course_status FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?",
    )
    .get(Number(lessonId));
  if (!lesson) throw fail("Clase no encontrada.", 404);
  if (user?.role === "admin") return lesson;
  if (lesson.status !== "published") throw fail("Clase no disponible.", 404);
  if (allowFree && lesson.is_free && lesson.course_status === "published")
    return lesson;
  if (!user) throw fail("Debes iniciar sesión.", 401);
  if (
    !db
      .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
      .get(user.id, lesson.course_id)
  )
    throw fail("No tienes acceso a esta clase.", 403);
  return lesson;
}
function createVideoService(db) {
  let child = null,
    closed = false;
  const locks = new Set();
  fs.mkdirSync(path.join(config.privateUploadDir, "videos"), {
    recursive: true,
    mode: 0o700,
  });
  // One Node process owns the queue. A stopped conversion can be restarted safely.
  db.prepare(
    "UPDATE video_assets SET state='queued',updated_at=CURRENT_TIMESTAMP WHERE state='processing'",
  ).run();
  function row(id) {
    assetDir(id);
    const result = db.prepare("SELECT * FROM video_assets WHERE id=?").get(id);
    if (!result) throw fail("Subida no encontrada.", 404);
    return result;
  }
  function info(asset) {
    return {
      id: asset.id,
      state: asset.state,
      receivedBytes: asset.received_bytes,
      totalBytes: asset.expected_bytes,
      duration: asset.duration_seconds,
      error: asset.error,
      chunkBytes: CHUNK_BYTES,
    };
  }
  function reservedBytes() {
    return db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN state IN ('uploading','queued','processing') THEN MAX(stored_bytes,expected_bytes*3) ELSE stored_bytes END),0) n FROM video_assets",
      )
      .get().n;
  }
  function start({ lessonId, name, size, userId }) {
    const lesson = db
      .prepare("SELECT * FROM lessons WHERE id=?")
      .get(Number(lessonId));
    if (!lesson) throw fail("Guarda primero la clase.", 404);
    if (lesson.status !== "draft")
      throw fail(
        "Guarda la clase como borrador antes de subir o reemplazar su vídeo.",
        409,
      );
    if (!Number.isSafeInteger(size) || size <= 0 || size > config.maxVideoBytes)
      throw fail("El vídeo supera el tamaño permitido.", 413);
    if (
      db
        .prepare(
          "SELECT COUNT(*) n FROM video_assets WHERE state IN ('uploading','queued','processing')",
        )
        .get().n >= 5
    )
      throw fail(
        "Hay demasiadas subidas pendientes. Finaliza o cancela una.",
        409,
      );
    if (reservedBytes() + size * 3 > config.videoStorageBytes)
      throw fail(
        "No queda cuota de vídeo suficiente para subir y procesar este archivo.",
        413,
      );
    const available = fs.statfsSync(config.privateUploadDir);
    if (available.bavail * available.bsize < size * 3 + 256 * 1024 * 1024)
      throw fail("No queda espacio suficiente en el servidor.", 507);
    const id = crypto.randomBytes(16).toString("hex");
    const folder = assetDir(id);
    fs.mkdirSync(folder, { mode: 0o700 });
    try {
      fs.writeFileSync(path.join(folder, "source"), "", {
        flag: "wx",
        mode: 0o600,
      });
      db.prepare(
        "INSERT INTO video_assets(id,lesson_id,created_by,original_name,expected_bytes,state) VALUES(?,?,?,?,?,'uploading')",
      ).run(
        id,
        lesson.id,
        userId,
        String(name || "video")
          .replace(/[\x00-\x1f]/g, "")
          .slice(0, 255),
        size,
      );
    } catch (error) {
      fs.rmSync(folder, { recursive: true, force: true });
      throw error;
    }
    return info(row(id));
  }
  async function append(id, offset, bytes) {
    if (locks.has(id))
      throw fail("Ya se está escribiendo esta subida. Reintenta.", 409);
    const asset = row(id);
    if (asset.state !== "uploading")
      throw fail("La subida ya no admite datos.", 409);
    if (!Number.isSafeInteger(offset) || offset !== asset.received_bytes)
      throw fail(
        "El punto de reanudación cambió. Consulta el estado y reintenta.",
        409,
      );
    if (
      !Buffer.isBuffer(bytes) ||
      !bytes.length ||
      bytes.length > CHUNK_BYTES ||
      offset + bytes.length > asset.expected_bytes
    )
      throw fail("Fragmento de subida no válido.");
    locks.add(id);
    const file = path.join(assetDir(id), "source");
    let handle;
    try {
      handle = await fs.promises.open(file, "r+");
      await handle.truncate(offset); // Recover a disk write interrupted before the DB update.
      let written = 0;
      while (written < bytes.length) {
        const result = await handle.write(
          bytes,
          written,
          bytes.length - written,
          offset + written,
        );
        if (!result.bytesWritten)
          throw fail("No se pudo guardar el fragmento.", 507);
        written += result.bytesWritten;
      }
      await handle.sync();
      db.prepare(
        "UPDATE video_assets SET received_bytes=?,stored_bytes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(offset + bytes.length, offset + bytes.length, id);
      return info(row(id));
    } catch (error) {
      if (handle) await handle.truncate(offset).catch(() => {});
      throw error;
    } finally {
      await handle?.close();
      locks.delete(id);
    }
  }
  function finish(id) {
    if (locks.has(id))
      throw fail("Espera a que termine el fragmento actual.", 409);
    const asset = row(id);
    if (asset.state !== "uploading") return info(asset);
    if (asset.received_bytes !== asset.expected_bytes)
      throw fail("La subida está incompleta.", 409);
    const lesson = db
      .prepare("SELECT status FROM lessons WHERE id=?")
      .get(asset.lesson_id);
    if (lesson?.status !== "draft")
      throw fail("La clase debe seguir en borrador.", 409);
    db.prepare(
      "UPDATE video_assets SET state='queued',updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(id);
    tick();
    return info(row(id));
  }
  function remove(id) {
    const asset = row(id);
    if (locks.has(id) || ["queued", "processing"].includes(asset.state))
      throw fail(
        "Espera a que termine el procesamiento para retirar el archivo.",
        409,
      );
    if (db.prepare("SELECT id FROM lessons WHERE video_asset_id=?").get(id))
      throw fail(
        "El vídeo está asociado a una clase. Cambia primero su fuente.",
        409,
      );
    fs.rmSync(assetDir(id), { recursive: true, force: true });
    db.prepare("DELETE FROM video_assets WHERE id=?").run(id);
  }
  function cleanup() {
    if (!db.open) return;
    const candidates = db
      .prepare(
        `SELECT v.id FROM video_assets v WHERE v.state NOT IN ('queued','processing') AND NOT EXISTS(SELECT 1 FROM lessons l WHERE l.video_asset_id=v.id) AND (v.lesson_id IS NULL OR (v.state IN ('uploading','failed') AND v.updated_at < datetime('now','-1 day')) OR (v.state='ready' AND v.updated_at < datetime('now','-7 days')))`,
      )
      .all();
    for (const asset of candidates) {
      try {
        remove(asset.id);
      } catch {}
    }
  }
  function tick() {
    if (closed || !db.open || child) return;
    const next = db
      .prepare(
        "SELECT id FROM video_assets WHERE state='queued' ORDER BY created_at,id LIMIT 1",
      )
      .get();
    if (!next) return;
    child = spawn(
      process.execPath,
      [path.join(__dirname, "video-worker.js"), next.id],
      { env: process.env, stdio: "ignore" },
    );
    child.unref();
    child.once("error", () => {});
    child.once("close", () => {
      child = null;
      if (closed || !db.open) return;
      db.prepare(
        "UPDATE video_assets SET state='failed',error='El procesamiento se interrumpió. Vuelve a subir el vídeo.',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state IN ('queued','processing')",
      ).run(next.id);
      tick();
    });
  }
  const timer = setInterval(tick, 1000);
  timer.unref();
  const cleaner = setInterval(cleanup, 60 * 60 * 1000);
  cleaner.unref();
  cleanup();
  return {
    start,
    append,
    finish,
    remove,
    row,
    info,
    reservedBytes,
    cleanup,
    close() {
      closed = true;
      clearInterval(timer);
      clearInterval(cleaner);
      if (!child) return Promise.resolve();
      const running = child;
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          running.kill("SIGKILL");
          resolve();
        }, 5000);
        running.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        running.kill("SIGTERM");
      });
    },
  };
}
module.exports = {
  createVideoService,
  presentVideo,
  authorizeLesson,
  assetDir,
  dirSize,
  fail,
  CHUNK_BYTES,
};
