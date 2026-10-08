const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { config } = require("../config");
const {
  cleanText,
  parseBoolean,
  safeGoogleMapsEmbed,
  safeNavigationUrl,
} = require("../utils/text");
const {
  writeFile,
  safePublicUpload,
  safePrivateUpload,
} = require("../services/files");
const { uploadLimiter } = require("../middleware/rate-limits");

function createAdminCoreRoutes({
  db,
  auth,
  courses,
  settings,
  audit,
  certificates,
  certificateLayout,
  video,
}) {
  const router = express.Router();
  const memory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.max(config.maxPdfBytes, config.maxImageBytes) },
  });
  router.use(auth.requireAdmin);

  router.get("/stats", (req, res) => {
    const payments = db
      .prepare(
        `SELECT COUNT(*) total,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) approved,SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) rejected,COALESCE(SUM(CASE WHEN status='approved' THEN amount_usd ELSE 0 END),0) approved_revenue_usd FROM payments`,
      )
      .get();
    const students = db
      .prepare("SELECT COUNT(*) count FROM users WHERE role='student'")
      .get().count;
    const courseCount = db
      .prepare("SELECT COUNT(*) count FROM courses WHERE status!='archived'")
      .get().count;
    const enrollments = db
      .prepare("SELECT COUNT(*) count FROM enrollments")
      .get().count;
    res.json({
      stats: { ...payments, students, courses: courseCount, enrollments },
    });
  });

  router.get("/payments", (req, res) => {
    const status = ["pending", "approved", "rejected"].includes(
      req.query.status,
    )
      ? req.query.status
      : null;
    const search = cleanText(req.query.search, 120);
    const where = [];
    const params = [];
    if (status) {
      where.push("p.status=?");
      params.push(status);
    }
    if (search) {
      const like = `%${search}%`;
      where.push(
        "(u.email LIKE ? OR u.name LIKE ? OR p.reference LIKE ? OR c.name LIKE ?)",
      );
      params.push(like, like, like, like);
    }
    const rows = db
      .prepare(
        `SELECT p.id,p.user_id,u.name user_name,u.email user_email,c.id course_id,c.slug course_slug,c.name course_name,p.original_amount_usd,p.discount_usd,p.amount_usd amount,p.amount_bs,p.exchange_rate,p.payer_name,p.payer_bank,p.payer_phone,p.payer_document,p.reference,p.status,p.rejection_reason,p.created_at,p.reviewed_at,p.approved_at,reviewer.email reviewed_by_email,CASE WHEN pr.id IS NULL THEN NULL ELSE '/api/payment-receipts/'||pr.id END receipt_url FROM payments p LEFT JOIN payment_receipts pr ON pr.payment_id=p.id JOIN users u ON u.id=p.user_id JOIN courses c ON c.id=p.course_id LEFT JOIN users reviewer ON reviewer.id=p.reviewed_by ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,p.created_at DESC,p.id DESC`,
      )
      .all(...params);
    res.json({ payments: rows });
  });

  router.post("/payments/:id/approve", auth.requireCsrf, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const payment = db.transaction(() => {
        const p = db
          .prepare(
            "SELECT p.*,c.slug course_slug,c.name course_name FROM payments p JOIN courses c ON c.id=p.course_id WHERE p.id=?",
          )
          .get(id);
        if (!p)
          throw Object.assign(new Error("Pago no encontrado."), {
            status: 404,
          });
        if (p.status !== "pending")
          throw Object.assign(new Error("El pago ya fue procesado."), {
            status: 409,
          });
        if (
          db
            .prepare(
              "SELECT id FROM enrollments WHERE user_id=? AND course_id=?",
            )
            .get(p.user_id, p.course_id)
        )
          throw Object.assign(new Error("El alumno ya tiene esta matrícula."), {
            status: 409,
          });
        db.prepare(
          "UPDATE payments SET status='approved',reviewed_at=CURRENT_TIMESTAMP,approved_at=CURRENT_TIMESTAMP,reviewed_by=?,approved_by=? WHERE id=?",
        ).run(req.user.id, req.user.id, id);
        db.prepare(
          "INSERT INTO enrollments (user_id,course_id,payment_id) VALUES (?,?,?)",
        ).run(p.user_id, p.course_id, id);
        return p;
      })();
      audit.write({
        actorUserId: req.user.id,
        action: "payment.approved",
        entityType: "payment",
        entityId: id,
        metadata: { courseId: payment.course_id, userId: payment.user_id },
        ip: req.ip,
      });
      res.json({
        ok: true,
        message: `Pago aprobado. ${payment.course_name} quedó desbloqueado.`,
        courseSlug: payment.course_slug,
        userId: payment.user_id,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/payments/:id/reject", auth.requireCsrf, (req, res) => {
    const id = Number(req.params.id);
    const reason = cleanText(req.body.reason, 500);
    if (reason.length < 3)
      return res.status(400).json({ error: "Indica el motivo del rechazo." });
    const result = db
      .prepare(
        "UPDATE payments SET status='rejected',rejection_reason=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=? AND status='pending'",
      )
      .run(reason, req.user.id, id);
    if (!result.changes)
      return res
        .status(409)
        .json({ error: "El pago no existe o ya fue procesado." });
    audit.write({
      actorUserId: req.user.id,
      action: "payment.rejected",
      entityType: "payment",
      entityId: id,
      metadata: { reason },
      ip: req.ip,
    });
    res.json({ ok: true, message: "Pago rechazado." });
  });

  router.get("/users", (req, res) => {
    const search = cleanText(req.query.search, 120);
    const like = `%${search}%`;
    const users = db
      .prepare(
        `SELECT u.id,u.name,u.email,u.role,u.created_at,(SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id) enrollments,(SELECT COUNT(*) FROM payments p WHERE p.user_id=u.id) payments FROM users u WHERE (?='' OR u.name LIKE ? OR u.email LIKE ?) ORDER BY u.created_at DESC,u.id DESC`,
      )
      .all(search, like, like);
    res.json({ users });
  });

  router.get("/courses", (req, res) =>
    res.json({
      courses: db
        .prepare("SELECT * FROM courses ORDER BY id DESC")
        .all()
        .map((row) => courses.summary({ ...row, price: row.price_usd })),
    }),
  );
  router.post("/courses", auth.requireCsrf, (req, res, next) => {
    try {
      const c = courses.validateCourse(req.body);
      const result = db
        .prepare(
          `INSERT INTO courses (slug,name,price_usd,icon,description,long_description,cover_image_url,category,level,duration_hours,promo_video_url,status,featured,seo_title,seo_description,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
        )
        .run(
          c.slug,
          c.name,
          c.price,
          c.icon,
          c.description,
          c.long_description,
          c.cover_image_url,
          c.category,
          c.level,
          c.duration_hours,
          c.promo_video_url,
          c.status,
          c.featured,
          c.seo_title,
          c.seo_description,
        );
      audit.write({
        actorUserId: req.user.id,
        action: "course.created",
        entityType: "course",
        entityId: result.lastInsertRowid,
        ip: req.ip,
      });
      res
        .status(201)
        .json({
          course: courses.summary(courses.getById(result.lastInsertRowid)),
        });
    } catch (error) {
      next(error);
    }
  });
  router.put("/courses/:id", auth.requireCsrf, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!courses.getById(id))
        return res.status(404).json({ error: "Curso no encontrado." });
      const c = courses.validateCourse(req.body, id);
      db.prepare(
        `UPDATE courses SET slug=?,name=?,price_usd=?,icon=?,description=?,long_description=?,cover_image_url=?,category=?,level=?,duration_hours=?,promo_video_url=?,status=?,featured=?,seo_title=?,seo_description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      ).run(
        c.slug,
        c.name,
        c.price,
        c.icon,
        c.description,
        c.long_description,
        c.cover_image_url,
        c.category,
        c.level,
        c.duration_hours,
        c.promo_video_url,
        c.status,
        c.featured,
        c.seo_title,
        c.seo_description,
        id,
      );
      audit.write({
        actorUserId: req.user.id,
        action: "course.updated",
        entityType: "course",
        entityId: id,
        ip: req.ip,
      });
      res.json({ course: courses.summary(courses.getById(id)) });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/courses/:id", auth.requireCsrf, (req, res) => {
    const id = Number(req.params.id);
    const result = db
      .prepare(
        "UPDATE courses SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='archived'",
      )
      .run(id);
    if (!result.changes)
      return res.status(404).json({ error: "Curso no encontrado." });
    audit.write({
      actorUserId: req.user.id,
      action: "course.archived",
      entityType: "course",
      entityId: id,
      ip: req.ip,
    });
    res.json({ ok: true, message: "Curso archivado." });
  });

  router.get("/courses/:courseId/lessons", (req, res) => {
    const id = Number(req.params.courseId);
    const course = courses.getById(id);
    if (!course) return res.status(404).json({ error: "Curso no encontrado." });
    const lessons = db
      .prepare(
        `SELECT l.*,CASE WHEN l.pdf_media_id IS NULL THEN NULL ELSE '/api/media/'||l.pdf_media_id END pdf_url FROM lessons l WHERE course_id=? ORDER BY sort_order,id`,
      )
      .all(id);
    res.json({ course, lessons });
  });
  router.post(
    "/courses/:courseId/lessons",
    auth.requireCsrf,
    (req, res, next) => {
      try {
        const courseId = Number(req.params.courseId);
        if (!courses.getById(courseId))
          return res.status(404).json({ error: "Curso no encontrado." });
        const l = courses.validateLesson(req.body);
        if (
          l.pdf_media_id &&
          !db
            .prepare(
              "SELECT id FROM media WHERE id=? AND kind='pdf' AND lesson_id IS NULL",
            )
            .get(l.pdf_media_id)
        )
          return res.status(400).json({ error: "PDF no válido." });
        const result = db
          .prepare(
            `INSERT INTO lessons (course_id,title,description,content,video_url,image_url,pdf_media_id,is_free,sort_order,status,video_asset_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
          )
          .run(
            courseId,
            l.title,
            l.description,
            l.content,
            l.video_url,
            l.image_url,
            l.pdf_media_id,
            l.is_free,
            l.sort_order,
            l.status,
            l.video_asset_id,
          );
        audit.write({
          actorUserId: req.user.id,
          action: "lesson.created",
          entityType: "lesson",
          entityId: result.lastInsertRowid,
          metadata: { courseId },
          ip: req.ip,
        });
        res
          .status(201)
          .json({
            lesson: db
              .prepare("SELECT * FROM lessons WHERE id=?")
              .get(result.lastInsertRowid),
          });
      } catch (error) {
        next(error);
      }
    },
  );
  router.put("/lessons/:id", auth.requireCsrf, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!db.prepare("SELECT id FROM lessons WHERE id=?").get(id))
        return res.status(404).json({ error: "Clase no encontrada." });
      const existing = db.prepare("SELECT * FROM lessons WHERE id=?").get(id);
      const l = courses.validateLesson(req.body, existing);
      if (
        l.pdf_media_id &&
        !db
          .prepare(
            "SELECT id FROM media WHERE id=? AND kind='pdf' AND lesson_id=?",
          )
          .get(l.pdf_media_id, id)
      )
        return res.status(400).json({ error: "PDF no válido." });
      db.prepare(
        `UPDATE lessons SET title=?,description=?,content=?,video_url=?,image_url=?,pdf_media_id=?,is_free=?,sort_order=?,status=?,video_asset_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      ).run(
        l.title,
        l.description,
        l.content,
        l.video_url,
        l.image_url,
        l.pdf_media_id,
        l.is_free,
        l.sort_order,
        l.status,
        l.video_asset_id,
        id,
      );
      audit.write({
        actorUserId: req.user.id,
        action: "lesson.updated",
        entityType: "lesson",
        entityId: id,
        ip: req.ip,
      });
      res.json({
        lesson: db.prepare("SELECT * FROM lessons WHERE id=?").get(id),
      });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/lessons/:id", auth.requireCsrf, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare("SELECT id FROM lessons WHERE id=?").get(id))
      return res.status(404).json({ error: "Clase no encontrada." });
    const files = db
      .prepare("SELECT stored_name FROM media WHERE lesson_id=?")
      .all(id);
    db.prepare("DELETE FROM lessons WHERE id=?").run(id);
    for (const file of files) {
      try {
        fs.unlinkSync(
          path.join(config.privateUploadDir, path.basename(file.stored_name)),
        );
      } catch {}
    }
    video.cleanup();
    audit.write({
      actorUserId: req.user.id,
      action: "lesson.deleted",
      entityType: "lesson",
      entityId: id,
      ip: req.ip,
    });
    res.json({ ok: true });
  });
  router.post(
    "/courses/:courseId/lessons/reorder",
    auth.requireCsrf,
    (req, res) => {
      const courseId = Number(req.params.courseId);
      const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
      const valid = db
        .prepare("SELECT id FROM lessons WHERE course_id=?")
        .all(courseId)
        .map((x) => x.id)
        .sort((a, b) => a - b);
      if (valid.join(",") !== [...ids].sort((a, b) => a - b).join(","))
        return res
          .status(400)
          .json({ error: "La lista de clases no coincide con el curso." });
      const update = db.prepare(
        "UPDATE lessons SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND course_id=?",
      );
      db.transaction(() =>
        ids.forEach((id, index) => update.run(index, id, courseId)),
      )();
      audit.write({
        actorUserId: req.user.id,
        action: "lesson.reordered",
        entityType: "course",
        entityId: courseId,
        ip: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    "/upload/image",
    uploadLimiter,
    auth.requireCsrf,
    memory.single("file"),
    (req, res, next) => {
      try {
        if (!req.file)
          return res
            .status(400)
            .json({ error: "No se recibió ninguna imagen." });
        const saved = safePublicUpload(req.file);
        const result = db
          .prepare(
            `INSERT INTO cms_media (kind,original_name,stored_name,public_url,mime_type,size_bytes,created_by) VALUES ('image',?,?,?,?,?,?)`,
          )
          .run(
            cleanText(req.file.originalname, 255),
            saved.storedName,
            saved.publicUrl,
            saved.mimeType,
            saved.sizeBytes,
            req.user.id,
          );
        audit.write({
          actorUserId: req.user.id,
          action: "media.uploaded",
          entityType: "cms_media",
          entityId: result.lastInsertRowid,
          ip: req.ip,
        });
        res
          .status(201)
          .json({
            id: result.lastInsertRowid,
            url: saved.publicUrl,
            originalName: req.file.originalname,
          });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/upload/pdf/:lessonId",
    uploadLimiter,
    auth.requireCsrf,
    memory.single("file"),
    (req, res, next) => {
      let saved;
      try {
        const lessonId = Number(req.params.lessonId);
        if (!db.prepare("SELECT id FROM lessons WHERE id=?").get(lessonId))
          return res.status(404).json({ error: "Clase no encontrada." });
        if (!req.file)
          return res.status(400).json({ error: "No se recibió ningún PDF." });
        saved = safePrivateUpload(req.file, {
          allow: ["pdf"],
          maxBytes: config.maxPdfBytes,
        });
        const result = db
          .prepare(
            `INSERT INTO media (kind,original_name,stored_name,storage_path,mime_type,size_bytes,lesson_id) VALUES ('pdf',?,?,?,?,?,?)`,
          )
          .run(
            cleanText(req.file.originalname, 255),
            saved.storedName,
            saved.storagePath,
            saved.mimeType,
            saved.sizeBytes,
            lessonId,
          );
        db.prepare(
          "UPDATE lessons SET pdf_media_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(result.lastInsertRowid, lessonId);
        const old = db
          .prepare(
            "SELECT id,stored_name FROM media WHERE lesson_id=? AND kind='pdf' AND id!=? AND NOT EXISTS(SELECT 1 FROM lessons WHERE pdf_media_id=media.id)",
          )
          .all(lessonId, result.lastInsertRowid);
        for (const file of old) {
          try {
            fs.unlinkSync(
              path.join(
                config.privateUploadDir,
                path.basename(file.stored_name),
              ),
            );
            db.prepare("DELETE FROM media WHERE id=?").run(file.id);
          } catch {}
        }
        audit.write({
          actorUserId: req.user.id,
          action: "lesson.pdf_uploaded",
          entityType: "lesson",
          entityId: lessonId,
          metadata: { mediaId: result.lastInsertRowid },
          ip: req.ip,
        });
        res
          .status(201)
          .json({
            id: result.lastInsertRowid,
            url: `/api/media/${result.lastInsertRowid}`,
            originalName: req.file.originalname,
          });
      } catch (error) {
        if (saved?.storagePath) {
          try {
            fs.unlinkSync(saved.storagePath);
          } catch {}
        }
        next(error);
      }
    },
  );
  router.post(
    "/certificates/template/:side",
    uploadLimiter,
    auth.requireCsrf,
    memory.single("file"),
    (req, res, next) => {
      let saved;
      try {
        const side = ["front", "back"].includes(req.params.side)
          ? req.params.side
          : null;
        if (!side)
          return res.status(400).json({ error: "Plantilla no válida." });
        if (!req.file)
          return res
            .status(400)
            .json({ error: "No se recibió ninguna plantilla." });
        if (
          !["image/png", "image/jpeg"].includes(
            require("../services/files").validateBuffer(req.file, {
              allow: ["image"],
              maxBytes: config.maxImageBytes,
            }).mime,
          )
        )
          return res
            .status(400)
            .json({ error: "La plantilla debe ser PNG o JPEG." });
        saved = writeFile(req.file, config.certificateTemplateDir, {
          allow: ["image"],
          maxBytes: config.maxImageBytes,
        });
        const url = `/uploads/certificates/${saved.storedName}`;
        settings.updateSettings({
          [side === "front" ? "certificate_front_url" : "certificate_back_url"]:
            url,
        });
        audit.write({
          actorUserId: req.user.id,
          action: "certificate.template_updated",
          entityType: "certificate_template",
          entityId: side,
          metadata: { url },
          ip: req.ip,
        });
        res
          .status(201)
          .json({ url, side, originalName: req.file.originalname });
      } catch (error) {
        if (saved?.storagePath) {
          try {
            fs.unlinkSync(saved.storagePath);
          } catch {}
        }
        next(error);
      }
    },
  );

  router.get("/certificates/layout", (req, res) =>
    res.json({
      layout: certificateLayout.get(),
      defaults: certificateLayout.defaults(),
    }),
  );
  router.put("/certificates/layout", auth.requireCsrf, (req, res, next) => {
    try {
      const layout = certificateLayout.update(req.body?.layout || req.body);
      audit.write({
        actorUserId: req.user.id,
        action: "certificate.layout_updated",
        entityType: "certificate_template",
        entityId: "layout",
        metadata: { version: layout.version },
        ip: req.ip,
      });
      res.json({ layout });
    } catch (error) {
      next(error);
    }
  });
  router.post("/certificates/layout/reset", auth.requireCsrf, (req, res) => {
    const layout = certificateLayout.reset();
    audit.write({
      actorUserId: req.user.id,
      action: "certificate.layout_reset",
      entityType: "certificate_template",
      entityId: "layout",
      ip: req.ip,
    });
    res.json({ layout });
  });
  router.get("/certificates/preview.pdf", async (req, res, next) => {
    try {
      const pdf = await certificates.createPreviewPdf();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "inline; filename=certificado-vista-previa.pdf",
      );
      res.setHeader("Cache-Control", "no-store");
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  router.get("/coupons", (req, res) =>
    res.json({
      coupons: db
        .prepare("SELECT * FROM coupons ORDER BY created_at DESC,id DESC")
        .all(),
    }),
  );
  router.post("/coupons", auth.requireCsrf, (req, res) => {
    const code = cleanText(req.body.code, 50).toUpperCase().replace(/\s+/g, "");
    const type = req.body.discount_type === "fixed" ? "fixed" : "percent";
    const value = Number(req.body.discount_value);
    const max =
      req.body.max_uses === "" || req.body.max_uses == null
        ? null
        : Number(req.body.max_uses);
    const expires = cleanText(req.body.expires_at, 40) || null;
    if (expires && !Number.isFinite(Date.parse(expires)))
      return res.status(400).json({ error: "Fecha de vencimiento inválida." });
    if (code.length < 3)
      return res
        .status(400)
        .json({ error: "El código del cupón es demasiado corto." });
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      (type === "percent" && value > 100)
    )
      return res.status(400).json({ error: "Descuento no válido." });
    if (max !== null && (!Number.isInteger(max) || max < 1))
      return res.status(400).json({ error: "El límite de usos no es válido." });
    if (db.prepare("SELECT id FROM coupons WHERE code=?").get(code))
      return res.status(409).json({ error: "Ese cupón ya existe." });
    const result = db
      .prepare(
        "INSERT INTO coupons (code,discount_type,discount_value,max_uses,expires_at,active) VALUES (?,?,?,?,?,1)",
      )
      .run(code, type, value, max, expires);
    audit.write({
      actorUserId: req.user.id,
      action: "coupon.created",
      entityType: "coupon",
      entityId: result.lastInsertRowid,
      ip: req.ip,
    });
    res
      .status(201)
      .json({
        coupon: db
          .prepare("SELECT * FROM coupons WHERE id=?")
          .get(result.lastInsertRowid),
      });
  });
  router.put("/coupons/:id", auth.requireCsrf, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM coupons WHERE id=?").get(id);
    if (!existing)
      return res.status(404).json({ error: "Cupón no encontrado." });
    const active = parseBoolean(req.body.active) ? 1 : 0;
    const expires = Object.hasOwn(req.body, "expires_at")
      ? cleanText(req.body.expires_at, 40) || null
      : existing.expires_at;
    if (expires && !Number.isFinite(Date.parse(expires)))
      return res.status(400).json({ error: "Fecha de vencimiento inválida." });
    db.prepare("UPDATE coupons SET active=?,expires_at=? WHERE id=?").run(
      active,
      expires,
      id,
    );
    audit.write({
      actorUserId: req.user.id,
      action: "coupon.updated",
      entityType: "coupon",
      entityId: id,
      ip: req.ip,
    });
    res.json({
      coupon: db.prepare("SELECT * FROM coupons WHERE id=?").get(id),
    });
  });

  router.get("/settings", (req, res) =>
    res.json({
      settings: settings.getMany(settings.ADMIN_SETTING_KEYS),
      design: settings.getDesignTokens(),
    }),
  );
  router.put("/settings", auth.requireCsrf, (req, res, next) => {
    try {
      const result = settings.updateSettings(req.body);
      audit.write({
        actorUserId: req.user.id,
        action: "settings.updated",
        entityType: "site",
        entityId: "global",
        metadata: { keys: Object.keys(req.body || {}) },
        ip: req.ip,
      });
      res.json({ settings: result });
    } catch (error) {
      next(error);
    }
  });
  router.put("/design", auth.requireCsrf, (req, res, next) => {
    try {
      const design = settings.updateDesignTokens(req.body);
      audit.write({
        actorUserId: req.user.id,
        action: "design.updated",
        entityType: "design",
        entityId: "global",
        metadata: { keys: Object.keys(req.body || {}) },
        ip: req.ip,
      });
      res.json({ design });
    } catch (error) {
      next(error);
    }
  });

  router.get("/locations", (req, res) =>
    res.json({
      locations: db
        .prepare("SELECT * FROM locations ORDER BY sort_order,id")
        .all(),
    }),
  );
  router.post("/locations", auth.requireCsrf, (req, res) => {
    const order = Number(req.body.sort_order || 0);
    if (!Number.isInteger(order) || order < 0 || order > 100000)
      return res.status(400).json({ error: "Orden de sede inválido." });
    const name = cleanText(req.body.name, 120);
    if (name.length < 2)
      return res
        .status(400)
        .json({ error: "El nombre de la sede es obligatorio." });
    let map = "";
    try {
      map = safeGoogleMapsEmbed(req.body.map_embed_url || "");
    } catch {}
    if (req.body.map_embed_url && !map)
      return res
        .status(400)
        .json({
          error: "El mapa debe ser una URL válida de Google Maps Embed.",
        });
    const result = db
      .prepare(
        "INSERT INTO locations (name,address,description,map_embed_url,active,sort_order) VALUES (?,?,?,?,?,?)",
      )
      .run(
        name,
        cleanText(req.body.address, 500),
        cleanText(req.body.description, 1500),
        map,
        parseBoolean(req.body.active) ? 1 : 0,
        order,
      );
    audit.write({
      actorUserId: req.user.id,
      action: "location.created",
      entityType: "location",
      entityId: result.lastInsertRowid,
      ip: req.ip,
    });
    res
      .status(201)
      .json({
        location: db
          .prepare("SELECT * FROM locations WHERE id=?")
          .get(result.lastInsertRowid),
      });
  });
  router.put("/locations/:id", auth.requireCsrf, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare("SELECT id FROM locations WHERE id=?").get(id))
      return res.status(404).json({ error: "Sede no encontrada." });
    const order = Number(req.body.sort_order || 0);
    if (!Number.isInteger(order) || order < 0 || order > 100000)
      return res.status(400).json({ error: "Orden de sede inválido." });
    const name = cleanText(req.body.name, 120);
    if (name.length < 2)
      return res
        .status(400)
        .json({ error: "El nombre de la sede es obligatorio." });
    let map = safeGoogleMapsEmbed(req.body.map_embed_url || "");
    if (req.body.map_embed_url && !map)
      return res
        .status(400)
        .json({
          error: "El mapa debe ser una URL válida de Google Maps Embed.",
        });
    db.prepare(
      "UPDATE locations SET name=?,address=?,description=?,map_embed_url=?,active=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      name,
      cleanText(req.body.address, 500),
      cleanText(req.body.description, 1500),
      map,
      parseBoolean(req.body.active) ? 1 : 0,
      order,
      id,
    );
    audit.write({
      actorUserId: req.user.id,
      action: "location.updated",
      entityType: "location",
      entityId: id,
      ip: req.ip,
    });
    res.json({
      location: db.prepare("SELECT * FROM locations WHERE id=?").get(id),
    });
  });
  router.delete("/locations/:id", auth.requireCsrf, (req, res) => {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM locations WHERE id=?").run(id);
    audit.write({
      actorUserId: req.user.id,
      action: "location.deleted",
      entityType: "location",
      entityId: id,
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  router.get("/navigation", (req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT * FROM navigation_items ORDER BY location,sort_order,id",
        )
        .all(),
    }),
  );
  router.put("/navigation", auth.requireCsrf, (req, res) => {
    if (!Array.isArray(req.body.items))
      return res.status(400).json({ error: "Lista de navegación inválida." });
    const items = req.body.items;
    if (items.length > 30)
      return res
        .status(400)
        .json({ error: "Demasiados elementos de navegación." });
    db.transaction(() => {
      db.prepare("DELETE FROM navigation_items").run();
      const insert = db.prepare(
        "INSERT INTO navigation_items (label,href,location,active,sort_order) VALUES (?,?,?,?,?)",
      );
      items.forEach((item, index) => {
        const href = safeNavigationUrl(item.href);
        if (!cleanText(item.label, 80))
          throw Object.assign(
            new Error("La etiqueta de navegación es obligatoria."),
            { status: 400 },
          );
        if (!href)
          throw Object.assign(new Error("Enlace de navegación no permitido."), {
            status: 400,
          });
        insert.run(
          cleanText(item.label, 80),
          href,
          item.location === "footer" ? "footer" : "header",
          parseBoolean(item.active) ? 1 : 0,
          index,
        );
      });
    })();
    audit.write({
      actorUserId: req.user.id,
      action: "navigation.updated",
      entityType: "site",
      entityId: "navigation",
      ip: req.ip,
    });
    res.json({
      items: db
        .prepare(
          "SELECT * FROM navigation_items ORDER BY location,sort_order,id",
        )
        .all(),
    });
  });

  router.get("/audit", (req, res) =>
    res.json({
      logs: audit.list({ limit: req.query.limit, offset: req.query.offset }),
    }),
  );
  return router;
}
module.exports = { createAdminCoreRoutes };
