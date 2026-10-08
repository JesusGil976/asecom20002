const { safeColor, safeHttpUrl, cleanText } = require("../utils/text");

const PUBLIC_SETTING_KEYS = [
  "academy_name",
  "tagline",
  "logo_url",
  "favicon_url",
  "support_email",
  "whatsapp",
  "instagram_url",
  "facebook_url",
  "tiktok_url",
  "footer_text",
  "copyright_text",
  "privacy_text",
  "terms_text",
  "login_label",
  "register_label",
];

const ADMIN_SETTING_KEYS = [
  ...PUBLIC_SETTING_KEYS,
  "hero_text",
  "hero_badge",
  "hero_cta",
  "hero_secondary_cta",
  "hero_card_title",
  "hero_card_text",
  "catalog_eyebrow",
  "catalog_title",
  "process_title",
  "process_step1_title",
  "process_step1_text",
  "process_step2_title",
  "process_step2_text",
  "process_step3_title",
  "process_step3_text",
  "hero_image_url",
  "primary_color",
  "secondary_color",
  "accent_color",
  "page_background",
  "surface_color",
  "about_title",
  "about_text",
  "about_image_url",
  "about_visible",
  "locations_title",
  "locations_text",
  "certificate_name_y",
  "certificate_course_y",
  "certificate_meta_y",
  "certificate_name_size",
  "certificate_course_size",
  "certificate_meta_size",
  "certificate_name_color",
  "certificate_course_color",
  "certificate_meta_color",
  "certificate_front_url",
  "certificate_back_url",
  "payment_bank",
  "payment_phone",
  "payment_document",
  "exchange_rate",
];

function createSettingsService(db) {
  const getStmt = db.prepare("SELECT value FROM site_settings WHERE key = ?");
  const upsertStmt = db.prepare(
    `INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  );

  function get(key, fallback = "") {
    return getStmt.get(key)?.value ?? fallback;
  }

  function getMany(keys) {
    return Object.fromEntries(keys.map((key) => [key, get(key, "")]));
  }

  function getDesignTokens() {
    return Object.fromEntries(
      db
        .prepare("SELECT key,value FROM design_tokens ORDER BY key")
        .all()
        .map((row) => [row.key, row.value]),
    );
  }

  function validateToken(key, value) {
    const text = cleanText(value, 200);
    if (
      [
        "primary",
        "primary_dark",
        "secondary",
        "accent",
        "background",
        "surface",
        "surface_muted",
        "text",
        "text_muted",
        "border",
        "success",
        "warning",
        "danger",
      ].includes(key)
    ) {
      return safeColor(text, null);
    }
    if (key === "content_width") return /^\d{3,4}px$/.test(text) ? text : null;
    if (["radius_sm", "radius_md", "radius_lg"].includes(key))
      return /^\d{1,2}px$/.test(text) ? text : null;
    if (key === "button_style")
      return ["rounded", "pill", "square"].includes(text) ? text : null;
    if (key === "density")
      return ["compact", "comfortable", "spacious"].includes(text)
        ? text
        : null;
    if (key === "font_family")
      return /^[a-zA-Z0-9 ,"'_-]+$/.test(text) ? text : null;
    if (key === "shadow")
      return text === "none" ||
        /^(?:0|-?\d+px) (?:0|-?\d+px) (?:0|\d+px)(?: (?:0|-?\d+px))? (?:#[0-9a-f]{6}|rgba?\([\d.,% ]+\))$/i.test(
          text,
        )
        ? text
        : null;
    return null;
  }

  function updateDesignTokens(patch) {
    const update =
      db.prepare(`INSERT INTO design_tokens (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`);
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(patch || {})) {
        const safe = validateToken(key, value);
        if (safe == null)
          throw Object.assign(new Error(`Valor de diseño inválido: ${key}`), {
            status: 400,
          });
        update.run(key, safe);
      }
    });
    tx();
    return getDesignTokens();
  }

  function sanitizeSetting(key, value) {
    if (
      [
        "primary_color",
        "secondary_color",
        "accent_color",
        "page_background",
        "surface_color",
        "certificate_name_color",
        "certificate_course_color",
        "certificate_meta_color",
      ].includes(key)
    ) {
      const color = safeColor(value, null);
      if (!color)
        throw Object.assign(new Error(`Color inválido: ${key}`), {
          status: 400,
        });
      return color;
    }
    if (key.endsWith("_url")) {
      const raw = cleanText(value, 2000);
      if (!raw) return "";
      if (/^\/uploads\/(?:certificates\/)?[a-zA-Z0-9._-]+$/.test(raw))
        return raw;
      const certificateTemplate = [
        "certificate_front_url",
        "certificate_back_url",
      ].includes(key);
      const url = safeHttpUrl(raw, { httpsOnly: certificateTemplate });
      if (!url)
        throw Object.assign(new Error(`URL inválida: ${key}`), { status: 400 });
      return url;
    }
    if (key === "exchange_rate") {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > 100000000)
        throw Object.assign(new Error("Tasa de cambio inválida."), {
          status: 400,
        });
      return String(number);
    }
    return cleanText(value, 5000);
  }

  function updateSettings(patch) {
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(patch || {})) {
        if (!ADMIN_SETTING_KEYS.includes(key))
          throw Object.assign(new Error(`Configuración desconocida: ${key}`), {
            status: 400,
          });
        upsertStmt.run(key, sanitizeSetting(key, value));
      }
    });
    tx();
    return getMany(ADMIN_SETTING_KEYS);
  }

  return {
    get,
    getMany,
    getDesignTokens,
    updateDesignTokens,
    updateSettings,
    PUBLIC_SETTING_KEYS,
    ADMIN_SETTING_KEYS,
  };
}

module.exports = {
  createSettingsService,
  PUBLIC_SETTING_KEYS,
  ADMIN_SETTING_KEYS,
};
