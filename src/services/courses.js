const {
  cleanText,
  slugify,
  parseBoolean,
  safeHttpUrl,
} = require("../utils/text");

function checkedUrl(value, local = false) {
  const raw = String(value || "");
  if (!raw) return null;
  const safe =
    local && /^\/uploads\/(?:certificates\/)?[a-zA-Z0-9._-]+$/.test(raw)
      ? raw
      : safeHttpUrl(raw);
  if (!safe)
    throw Object.assign(new Error("URL de imagen o vídeo inválida."), {
      status: 400,
    });
  return safe;
}

const { presentVideo } = require("./video");

function createCourseService(db) {
  function getById(id) {
    return db
      .prepare(
        `SELECT id,slug,name,price_usd AS price,icon,description,long_description,cover_image_url,category,level,duration_hours,promo_video_url,status,featured,seo_title,seo_description,created_at,updated_at FROM courses WHERE id=?`,
      )
      .get(id);
  }
  function getBySlug(slug) {
    return db
      .prepare(
        `SELECT id,slug,name,price_usd AS price,icon,description,long_description,cover_image_url,category,level,duration_hours,promo_video_url,status,featured,seo_title,seo_description,created_at,updated_at FROM courses WHERE slug=?`,
      )
      .get(slug);
  }
  function summary(course) {
    if (!course) return null;
    const count = db
      .prepare(
        "SELECT COUNT(*) count FROM lessons WHERE course_id=? AND status='published'",
      )
      .get(course.id).count;
    return {
      ...course,
      featured: Boolean(course.featured),
      lesson_count: count,
    };
  }
  function validateCourse(body, existingId = null) {
    const name = cleanText(body.name, 160);
    const slug = slugify(body.slug || name);
    const price = Number(body.price_usd ?? body.price);
    const duration = Number(body.duration_hours || 0);
    if (name.length < 2)
      throw Object.assign(new Error("El nombre del curso es obligatorio."), {
        status: 400,
      });
    if (!slug)
      throw Object.assign(new Error("El slug del curso no es válido."), {
        status: 400,
      });
    if (!Number.isFinite(price) || price <= 0 || price > 100000)
      throw Object.assign(new Error("El precio del curso no es válido."), {
        status: 400,
      });
    if (!Number.isFinite(duration) || duration < 0 || duration > 10000)
      throw Object.assign(new Error("La duración no es válida."), {
        status: 400,
      });
    const duplicate = existingId
      ? db
          .prepare("SELECT id FROM courses WHERE slug=? AND id!=?")
          .get(slug, existingId)
      : db.prepare("SELECT id FROM courses WHERE slug=?").get(slug);
    if (duplicate)
      throw Object.assign(new Error("Ya existe un curso con ese slug."), {
        status: 409,
      });
    return {
      name,
      slug,
      price,
      icon: cleanText(body.icon || "CURSO", 24),
      description: cleanText(body.description, 500),
      long_description: cleanText(body.long_description, 20000),
      cover_image_url: checkedUrl(body.cover_image_url, true),
      category: cleanText(body.category || "General", 120),
      level: cleanText(body.level || "Todos", 80),
      duration_hours: duration,
      promo_video_url: checkedUrl(body.promo_video_url),
      status: ["draft", "published", "archived"].includes(body.status)
        ? body.status
        : "draft",
      featured: parseBoolean(body.featured) ? 1 : 0,
      seo_title: cleanText(body.seo_title, 180),
      seo_description: cleanText(body.seo_description, 320),
    };
  }
  function validateLesson(body, existing = null) {
    const title = cleanText(body.title, 180);
    const order = Number(body.sort_order || 0);
    if (title.length < 2)
      throw Object.assign(new Error("El título de la clase es obligatorio."), {
        status: 400,
      });
    if (!Number.isFinite(order))
      throw Object.assign(new Error("El orden de la clase no es válido."), {
        status: 400,
      });
    const imageRaw = String(body.image_url || "");
    const status =
      body.status === undefined ? existing?.status || "draft" : body.status;
    if (!["draft", "published"].includes(status))
      throw Object.assign(new Error("Estado de clase no válido."), {
        status: 400,
      });
    const videoId =
      body.video_asset_id === undefined
        ? existing?.video_asset_id || null
        : body.video_asset_id || null;
    if (videoId) {
      const asset = db
        .prepare(
          "SELECT id FROM video_assets WHERE id=? AND lesson_id=? AND state='ready'",
        )
        .get(String(videoId), existing?.id || -1);
      if (!asset)
        throw Object.assign(
          new Error(
            "El vídeo todavía no está listo o no pertenece a esta clase.",
          ),
          { status: 400 },
        );
    }
    if (
      status === "published" &&
      existing &&
      db
        .prepare(
          "SELECT id FROM video_assets WHERE lesson_id=? AND state IN ('uploading','queued','processing')",
        )
        .get(existing.id)
    )
      throw Object.assign(
        new Error("Termina o cancela la subida de vídeo antes de publicar."),
        { status: 409 },
      );
    return {
      title,
      status,
      video_asset_id: videoId,
      description: cleanText(body.description, 1000),
      content: cleanText(body.content, 30000),
      video_url: videoId ? null : checkedUrl(body.video_url),
      image_url: checkedUrl(imageRaw, true),
      pdf_media_id: body.pdf_media_id ? Number(body.pdf_media_id) : null,
      is_free: parseBoolean(body.is_free) ? 1 : 0,
      sort_order: Math.max(0, Math.floor(order)),
    };
  }
  return {
    getById,
    getBySlug,
    summary,
    validateCourse,
    validateLesson,
    presentLesson: (lesson) => presentVideo(db, lesson),
  };
}
module.exports = { createCourseService };
