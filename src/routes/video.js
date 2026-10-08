const express = require("express");
const fs = require("fs");
const path = require("path");
const { config } = require("../config");
const { uploadLimiter } = require("../middleware/rate-limits");
const { asyncHandler } = require("../utils/http");
const {
  assetDir,
  authorizeLesson,
  CHUNK_BYTES,
  fail,
} = require("../services/video");

function createVideoRoutes({ db, auth, video, audit }) {
  const router = express.Router();
  function serve(asset, req, res, next) {
    const resource = [].concat(req.params.resource || []).join("/");
    if (
      !/^(master\.m3u8|v\d{1,4}\/(index\.m3u8|seg-\d{6}\.ts)|captions\.vtt)$/.test(
        resource,
      )
    )
      throw fail("Recurso no encontrado.", 404);
    const file = path.join(assetDir(asset.id), "hls", resource);
    if (!fs.existsSync(file)) throw fail("Recurso no encontrado.", 404);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Cookie");
    res.setHeader(
      "Content-Type",
      resource.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : resource.endsWith(".vtt")
          ? "text/vtt; charset=utf-8"
          : "video/mp2t",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(
      file,
      { cacheControl: false, lastModified: false, etag: false },
      (error) => {
        if (error) next(error);
      },
    );
  }
  router.get(
    "/admin/video-preview/:id/{*resource}",
    auth.requireAdmin,
    (req, res, next) => {
      const asset = video.row(req.params.id);
      if (asset.state !== "ready")
        throw fail("Vídeo todavía no disponible.", 409);
      serve(asset, req, res, next);
    },
  );
  router.put(
    "/admin/videos/:id/captions",
    auth.requireAdmin,
    auth.requireCsrf,
    express.text({ type: "text/vtt", limit: "512kb" }),
    (req, res) => {
      const asset = video.row(req.params.id);
      if (asset.state !== "ready")
        throw fail("Selecciona un vídeo preparado.", 409);
      const lesson = db
        .prepare("SELECT status FROM lessons WHERE id=?")
        .get(asset.lesson_id);
      if (lesson?.status !== "draft")
        throw fail(
          "Guarda la clase como borrador antes de cambiar subtítulos.",
          409,
        );
      let text =
        typeof req.body === "string"
          ? req.body.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
          : "";
      if (
        !/^WEBVTT(?:[^\n]*)\n/.test(text) ||
        !text.includes("-->") ||
        /\x00|<script|STYLE|REGION/i.test(text)
      )
        throw fail("Archivo WebVTT no válido.");
      const cues = text.split("\n").filter((line) => line.includes("-->"));
      if (
        cues.length > 5000 ||
        cues.some(
          (line) =>
            !/^\s*(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}(?:\s.*)?$/.test(
              line,
            ),
        )
      )
        throw fail("Tiempos WebVTT no válidos.");
      text = text.replace(/<[^>]*>/g, "");
      fs.writeFileSync(
        path.join(assetDir(asset.id), "hls", "captions.vtt"),
        text,
        { mode: 0o600 },
      );
      db.prepare(
        "UPDATE video_assets SET stored_bytes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(require("../services/video").dirSize(assetDir(asset.id)), asset.id);
      res.json({ ok: true });
    },
  );
  router.get("/admin/videos/config", auth.requireAdmin, (_req, res) =>
    res.json({
      maxBytes: config.maxVideoBytes,
      storageBytes: config.videoStorageBytes,
      usedBytes: video.reservedBytes(),
      heights: config.videoHeights,
      maxDuration: config.maxVideoDuration,
    }),
  );
  router.get("/admin/lessons/:id/videos", auth.requireAdmin, (req, res) =>
    res.json({
      videos: db
        .prepare(
          "SELECT * FROM video_assets WHERE lesson_id=? ORDER BY created_at DESC,id",
        )
        .all(Number(req.params.id))
        .map((v) => ({ ...video.info(v), originalName: v.original_name })),
    }),
  );
  router.post(
    "/admin/videos/uploads",
    auth.requireAdmin,
    uploadLimiter,
    auth.requireCsrf,
    (req, res) => {
      const uploaded = video.start({
        lessonId: req.body.lessonId,
        name: req.body.name,
        size: Number(req.body.size),
        userId: req.user.id,
      });
      audit.write({
        actorUserId: req.user.id,
        action: "video.upload_started",
        entityType: "video",
        entityId: uploaded.id,
        ip: req.ip,
      });
      res.status(201).json(uploaded);
    },
  );
  router.get("/admin/videos/uploads/:id", auth.requireAdmin, (req, res) =>
    res.json(video.info(video.row(req.params.id))),
  );
  router.put(
    "/admin/videos/uploads/:id/chunk",
    auth.requireAdmin,
    auth.requireCsrf,
    express.raw({ type: "application/octet-stream", limit: CHUNK_BYTES }),
    asyncHandler(async (req, res) => {
      if (!/^\d+$/.test(req.get("upload-offset") || ""))
        throw fail("Indica el punto de reanudación.");
      res.json(
        await video.append(
          req.params.id,
          Number(req.get("upload-offset")),
          req.body,
        ),
      );
    }),
  );
  router.post(
    "/admin/videos/uploads/:id/finish",
    auth.requireAdmin,
    auth.requireCsrf,
    (req, res) => res.json(video.finish(req.params.id)),
  );
  router.delete(
    "/admin/videos/uploads/:id",
    auth.requireAdmin,
    auth.requireCsrf,
    (req, res) => {
      video.remove(req.params.id);
      res.json({ ok: true });
    },
  );
  router.get("/videos/:lessonId/{*resource}", (req, res, next) => {
    try {
      const lesson = authorizeLesson(db, req.user, req.params.lessonId, {
        allowFree: true,
      });
      const asset =
        lesson.video_asset_id &&
        db
          .prepare(
            "SELECT id FROM video_assets WHERE id=? AND lesson_id=? AND state='ready'",
          )
          .get(lesson.video_asset_id, lesson.id);
      if (!asset) throw fail("Vídeo no disponible.", 404);
      serve(asset, req, res, next);
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/lessons/:id/position",
    auth.requireAuth,
    auth.requireCsrf,
    (req, res) => {
      const lesson = authorizeLesson(db, req.user, req.params.id);
      const asset =
        lesson.video_asset_id &&
        db
          .prepare(
            "SELECT duration_seconds FROM video_assets WHERE id=? AND state='ready'",
          )
          .get(lesson.video_asset_id);
      const position = Number(req.body.position);
      if (
        !asset ||
        !Number.isFinite(position) ||
        position < 0 ||
        position > asset.duration_seconds + 1
      )
        throw fail("Posición de reproducción no válida.");
      db.prepare(
        `INSERT INTO lesson_progress(user_id,lesson_id,position_seconds,last_viewed_at,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(user_id,lesson_id) DO UPDATE SET position_seconds=excluded.position_seconds,last_viewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`,
      ).run(req.user.id, lesson.id, Math.min(position, asset.duration_seconds));
      res.json({ ok: true });
    },
  );
  return router;
}
module.exports = { createVideoRoutes };
