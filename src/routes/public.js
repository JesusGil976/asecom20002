const express = require("express");
const { cleanText } = require("../utils/text");

function createPublicRoutes({ db, settings, cms, courses }) {
  const router = express.Router();

  router.get("/site", (req, res) => {
    const page = cms.getPublished("home");
    const navigation = db
      .prepare(
        "SELECT id,label,href,location,sort_order FROM navigation_items WHERE active=1 ORDER BY location,sort_order,id",
      )
      .all();
    const locations = db
      .prepare(
        "SELECT id,name,address,description,map_embed_url,sort_order FROM locations WHERE active=1 ORDER BY sort_order,id",
      )
      .all();
    const siteSettings = settings.getMany(settings.PUBLIC_SETTING_KEYS);
    res.json({
      site: siteSettings,
      design: settings.getDesignTokens(),
      navigation,
      locations,
      home: {
        sections: page.sections || [],
        version: page.version?.version_number || 1,
      },
    });
  });

  router.get("/courses", (req, res) => {
    const search = cleanText(req.query.search, 120);
    const category = cleanText(req.query.category, 120);
    const level = cleanText(req.query.level, 80);
    const sort = ["price_asc", "price_desc", "newest", "name"].includes(
      req.query.sort,
    )
      ? req.query.sort
      : "featured";
    const minPrice =
      req.query.minPrice === undefined ? null : Number(req.query.minPrice);
    const maxPrice =
      req.query.maxPrice === undefined ? null : Number(req.query.maxPrice);
    const where = ["c.status='published'"];
    const params = [];
    if (search) {
      where.push(
        "(c.name LIKE ? OR c.description LIKE ? OR c.category LIKE ?)",
      );
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category) {
      where.push("c.category=?");
      params.push(category);
    }
    if (level) {
      where.push("c.level=?");
      params.push(level);
    }
    if (Number.isFinite(minPrice)) {
      where.push("c.price_usd>=?");
      params.push(minPrice);
    }
    if (Number.isFinite(maxPrice)) {
      where.push("c.price_usd<=?");
      params.push(maxPrice);
    }
    const order = {
      price_asc: "c.price_usd ASC",
      price_desc: "c.price_usd DESC",
      newest: "c.id DESC",
      name: "c.name COLLATE NOCASE ASC",
      featured: "c.featured DESC,c.id ASC",
    }[sort];
    const rows = db
      .prepare(
        `SELECT c.id,c.slug,c.name,c.price_usd AS price,c.icon,c.description,c.long_description,c.cover_image_url,c.category,c.level,c.duration_hours,c.promo_video_url,c.status,c.featured,c.seo_title,c.seo_description FROM courses c WHERE ${where.join(" AND ")} ORDER BY ${order}`,
      )
      .all(...params)
      .map(courses.summary);
    let access = [];
    if (req.user) {
      access = db
        .prepare(
          `SELECT c.id,c.slug,c.name,e.created_at,
        COALESCE((SELECT ROUND(100.0*SUM(CASE WHEN lp.completed=1 THEN 1 ELSE 0 END)/NULLIF(COUNT(l.id),0)) FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=? WHERE l.course_id=c.id AND l.status='published'),0) progress_percentage,
        (SELECT l2.title FROM lessons l2 LEFT JOIN lesson_progress lp2 ON lp2.lesson_id=l2.id AND lp2.user_id=? WHERE l2.course_id=c.id AND l2.status='published' AND COALESCE(lp2.completed,0)=0 ORDER BY l2.sort_order,l2.id LIMIT 1) next_lesson_title
        FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=?`,
        )
        .all(req.user.id, req.user.id, req.user.id);
    }
    const facets = {
      categories: db
        .prepare(
          "SELECT DISTINCT category FROM courses WHERE status='published' AND category!='' ORDER BY category",
        )
        .all()
        .map((r) => r.category),
      levels: db
        .prepare(
          "SELECT DISTINCT level FROM courses WHERE status='published' AND level!='' ORDER BY level",
        )
        .all()
        .map((r) => r.level),
    };
    res.json({ courses: rows, access, facets });
  });

  router.get("/courses/:slug", (req, res) => {
    const course = courses.getBySlug(cleanText(req.params.slug, 120));
    if (!course || course.status === "archived")
      return res.status(404).json({ error: "Curso no encontrado." });
    if (course.status === "draft" && req.user?.role !== "admin")
      return res.status(404).json({ error: "Curso no encontrado." });
    const lessons = db
      .prepare(
        "SELECT id,title,description,is_free,sort_order FROM lessons WHERE course_id=? AND status='published' ORDER BY sort_order,id",
      )
      .all(course.id)
      .map((row) => ({ ...row, is_free: Boolean(row.is_free) }));
    const preview = db
      .prepare(
        "SELECT id,title,description,content,video_url,video_asset_id,image_url,is_free,sort_order FROM lessons WHERE course_id=? AND is_free=1 AND status='published' ORDER BY sort_order,id",
      )
      .all(course.id)
      .map(courses.presentLesson);
    const enrolled = Boolean(
      req.user &&
      db
        .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
        .get(req.user.id, course.id),
    );
    res.json({ course: courses.summary(course), lessons, preview, enrolled });
  });

  router.get("/courses/:slug/preview/:lessonId", (req, res) => {
    const course = courses.getBySlug(cleanText(req.params.slug, 120));
    if (!course || course.status !== "published")
      return res.status(404).json({ error: "Curso no encontrado." });
    const lesson = db
      .prepare(
        "SELECT id,title,description,content,video_url,video_asset_id,image_url,is_free,sort_order,course_id FROM lessons WHERE id=? AND course_id=? AND is_free=1 AND status='published'",
      )
      .get(Number(req.params.lessonId), course.id);
    if (!lesson)
      return res
        .status(404)
        .json({ error: "Esta clase no está disponible como vista previa." });
    res.json({
      course: courses.summary(course),
      lesson: courses.presentLesson(lesson),
    });
  });

  router.get("/certificates/:code", (req, res) => {
    const certificate = db
      .prepare(
        `SELECT cert.code,cert.issued_at,cert.snapshot_json,u.name student_name,c.name course_name,c.duration_hours
      FROM certificates cert JOIN users u ON u.id=cert.user_id JOIN courses c ON c.id=cert.course_id WHERE cert.code=?`,
      )
      .get(cleanText(req.params.code, 80));
    if (!certificate)
      return res.status(404).json({ error: "Certificado no encontrado." });
    if (certificate.snapshot_json) {
      const snapshot = JSON.parse(certificate.snapshot_json);
      certificate.student_name = snapshot.student_name;
      certificate.course_name = snapshot.course_name;
      certificate.duration_hours = snapshot.duration_hours;
    }
    delete certificate.snapshot_json;
    res.json({ certificate });
  });

  return router;
}
module.exports = { createPublicRoutes };
