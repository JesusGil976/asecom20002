const express = require("express");
const crypto = require("crypto");
const { cleanText, parseBoolean } = require("../utils/text");
const { asyncHandler } = require("../utils/http");

function createStudentRoutes({ db, auth, courses, certificates, audit }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  router.get("/dashboard", (req, res) => {
    const enrolled = db
      .prepare(
        `SELECT c.id,c.slug,c.name,c.cover_image_url,c.category,c.level,e.created_at,
      COUNT(l.id) total_lessons,
      SUM(CASE WHEN lp.completed=1 THEN 1 ELSE 0 END) completed_lessons,
      COALESCE(ROUND(100.0*SUM(CASE WHEN lp.completed=1 THEN 1 ELSE 0 END)/NULLIF(COUNT(l.id),0)),0) progress_percentage,
      (SELECT l2.id FROM lessons l2 LEFT JOIN lesson_progress p2 ON p2.lesson_id=l2.id AND p2.user_id=? WHERE l2.course_id=c.id AND l2.status='published' AND COALESCE(p2.completed,0)=0 ORDER BY l2.sort_order,l2.id LIMIT 1) next_lesson_id,
      (SELECT l2.title FROM lessons l2 LEFT JOIN lesson_progress p2 ON p2.lesson_id=l2.id AND p2.user_id=? WHERE l2.course_id=c.id AND l2.status='published' AND COALESCE(p2.completed,0)=0 ORDER BY l2.sort_order,l2.id LIMIT 1) next_lesson_title
      FROM enrollments e JOIN courses c ON c.id=e.course_id LEFT JOIN lessons l ON l.course_id=c.id AND l.status='published' LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=?
      WHERE e.user_id=? GROUP BY c.id,e.id ORDER BY MAX(COALESCE(lp.last_viewed_at,e.created_at)) DESC`,
      )
      .all(req.user.id, req.user.id, req.user.id, req.user.id);
    const certs = db
      .prepare(
        `SELECT cert.code,cert.issued_at,c.name course_name,c.slug course_slug FROM certificates cert JOIN courses c ON c.id=cert.course_id WHERE cert.user_id=? ORDER BY cert.issued_at DESC`,
      )
      .all(req.user.id);
    const enrolledIds = enrolled.map((x) => x.id);
    const recommendations = db
      .prepare(
        `SELECT id,slug,name,price_usd AS price,cover_image_url,category,level,description FROM courses WHERE status='published' AND id NOT IN (${enrolledIds.length ? enrolledIds.map(() => "?").join(",") : "-1"}) ORDER BY featured DESC,id DESC LIMIT 2`,
      )
      .all(...enrolledIds);
    res.json({
      continueLearning: enrolled.slice(0, 3),
      enrolled,
      certificates: certs,
      recommendations,
    });
  });

  router.get("/courses/:slug/classroom", (req, res) => {
    const course = courses.getBySlug(cleanText(req.params.slug, 120));
    if (!course) return res.status(404).json({ error: "Curso no encontrado." });
    if (
      !db
        .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
        .get(req.user.id, course.id)
    )
      return res
        .status(403)
        .json({ error: "Tu acceso a este curso aún está bloqueado." });
    const lessons = db
      .prepare(
        `SELECT l.id,l.title,l.description,l.content,l.video_url,l.image_url,l.video_asset_id,lp.position_seconds,CASE WHEN l.pdf_media_id IS NULL THEN NULL ELSE '/api/media/'||l.pdf_media_id END pdf_url,l.sort_order,COALESCE(lp.completed,0) completed,lp.last_viewed_at,lp.completed_at
      FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=? WHERE l.course_id=? AND l.status='published' ORDER BY l.sort_order,l.id`,
      )
      .all(req.user.id, course.id)
      .map((row) =>
        courses.presentLesson({ ...row, completed: Boolean(row.completed) }),
      );
    const completed = lessons.filter((x) => x.completed).length;
    const total = lessons.length;
    const certificate =
      db
        .prepare(
          "SELECT code,issued_at FROM certificates WHERE user_id=? AND course_id=?",
        )
        .get(req.user.id, course.id) || null;
    res.json({
      course: courses.summary(course),
      lessons,
      progress: {
        total,
        completed,
        percentage: total ? Math.round((completed / total) * 100) : 0,
      },
      certificate,
    });
  });

  router.post("/lessons/:id/view", auth.requireCsrf, (req, res) => {
    const lesson = db
      .prepare(
        "SELECT id,course_id FROM lessons WHERE id=? AND status='published'",
      )
      .get(Number(req.params.id));
    if (!lesson) return res.status(404).json({ error: "Clase no encontrada." });
    if (
      !db
        .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
        .get(req.user.id, lesson.course_id)
    )
      return res.status(403).json({ error: "No tienes acceso a esta clase." });
    db.prepare(
      `INSERT INTO lesson_progress (user_id,lesson_id,completed,last_viewed_at,updated_at) VALUES (?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id,lesson_id) DO UPDATE SET last_viewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`,
    ).run(req.user.id, lesson.id);
    res.json({ ok: true });
  });

  router.post("/lessons/:id/progress", auth.requireCsrf, (req, res) => {
    const lesson = db
      .prepare(
        "SELECT id,course_id FROM lessons WHERE id=? AND status='published'",
      )
      .get(Number(req.params.id));
    if (!lesson) return res.status(404).json({ error: "Clase no encontrada." });
    if (
      !db
        .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
        .get(req.user.id, lesson.course_id)
    )
      return res.status(403).json({ error: "No tienes acceso a esta clase." });
    const completed = parseBoolean(req.body.completed) ? 1 : 0;
    db.prepare(
      `INSERT INTO lesson_progress (user_id,lesson_id,completed,last_viewed_at,completed_at,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP,CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=excluded.completed,last_viewed_at=CURRENT_TIMESTAMP,completed_at=CASE WHEN excluded.completed=1 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP`,
    ).run(req.user.id, lesson.id, completed, completed);
    res.json({ ok: true, completed: Boolean(completed) });
  });

  router.post("/courses/:slug/certificate", auth.requireCsrf, (req, res) => {
    const course = courses.getBySlug(cleanText(req.params.slug, 120));
    if (!course) return res.status(404).json({ error: "Curso no encontrado." });
    if (
      !db
        .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
        .get(req.user.id, course.id)
    )
      return res.status(403).json({ error: "No tienes acceso a este curso." });
    const total = db
      .prepare(
        "SELECT COUNT(*) count FROM lessons WHERE course_id=? AND status='published'",
      )
      .get(course.id).count;
    const completed = db
      .prepare(
        `SELECT COUNT(*) count FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.user_id=? AND l.course_id=? AND l.status='published' AND lp.completed=1`,
      )
      .get(req.user.id, course.id).count;
    if (!total || completed < total)
      return res
        .status(409)
        .json({
          error: "Completa todas las clases para obtener tu certificado.",
        });
    let certificate = db
      .prepare(
        "SELECT code,issued_at FROM certificates WHERE user_id=? AND course_id=?",
      )
      .get(req.user.id, course.id);
    if (!certificate) {
      const code = `AVE-${new Date().getFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      db.prepare(
        "INSERT INTO certificates (user_id,course_id,code,snapshot_json) VALUES (?,?,?,?)",
      ).run(
        req.user.id,
        course.id,
        code,
        JSON.stringify(certificates.snapshotCourse(req.user, course)),
      );
      certificate = db
        .prepare(
          "SELECT code,issued_at FROM certificates WHERE user_id=? AND course_id=?",
        )
        .get(req.user.id, course.id);
      audit.write({
        actorUserId: req.user.id,
        action: "certificate.issued",
        entityType: "course",
        entityId: course.id,
        metadata: { code },
        ip: req.ip,
      });
    }
    res.json({ certificate });
  });

  router.get(
    "/certificates/:code/pdf",
    asyncHandler(async (req, res) => {
      const certificate = db
        .prepare(
          `SELECT cert.code,cert.issued_at,cert.user_id,cert.course_id,u.name student_name,c.name course_name FROM certificates cert JOIN users u ON u.id=cert.user_id JOIN courses c ON c.id=cert.course_id WHERE cert.code=?`,
        )
        .get(cleanText(req.params.code, 80));
      if (!certificate)
        return res.status(404).json({ error: "Certificado no encontrado." });
      if (req.user.role !== "admin" && certificate.user_id !== req.user.id)
        return res
          .status(403)
          .json({ error: "No tienes acceso a este certificado." });
      const pdf = await certificates.createPdf(certificate);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`certificado-${certificate.code}.pdf`)}`,
      );
      res.send(pdf);
    }),
  );

  return router;
}
module.exports = { createStudentRoutes };
