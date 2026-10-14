const {
  cleanText,
  parseBoolean,
  safeHttpUrl,
  safeNavigationUrl,
  safeColor,
} = require("../utils/text");
const schemas = {
  hero: [
    "badge",
    "title",
    "text",
    "primaryCta",
    "secondaryCta",
    "imageUrl",
    "primaryHref",
    "secondaryHref",
    "primaryHidden",
    "secondaryHidden",
    "primaryStyle",
    "secondaryStyle",
  ],
  featured_courses: ["eyebrow", "title", "limit", "courseIds"],
  faq: ["title", "items"],
  gallery: ["title", "items"],
  team: ["title", "items"],
  stats: ["items"],
  process: ["title", "steps"],
  about: ["title", "text", "imageUrl"],
  locations: ["title", "text", "locationIds"],
  testimonials: ["title", "text", "items"],
  cta: ["title", "text", "buttonLabel", "href"],
  rich_text: ["title", "text"],
  footer: ["title", "text"],
};
const common = [
  "internalName",
  "anchor",
  "imageFit",
  "imagePosition",
  "imageRatio",
  "imageWidth",
  "imageHidden",
  "imageAlt",
  "imageSide",
  "spacing",
  "animation",
  "columns",
  "alignment",
  "mobileHidden",
  "backgroundColor",
  "textColor",
  "accentColor",
];
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
function plain(value) {
  if (value != null && typeof value !== "string")
    throw invalid("Los textos del CMS deben ser cadenas.");
  const text = cleanText(value, 5000);
  if (/<[^>]*>|javascript\s*:/i.test(text))
    throw invalid("El CMS admite texto plano, sin HTML ni JavaScript.");
  return text;
}
function validateSettings(type, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw invalid("Configuración de sección inválida.");
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!schemas[type]?.includes(key) && !common.includes(key))
      throw invalid(`Propiedad CMS no permitida: ${key}`);
    if (["courseIds", "locationIds"].includes(key)) {
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some((v) => !Number.isSafeInteger(Number(v)) || Number(v) < 1)
      )
        throw invalid("Selección inválida.");
      output[key] = [...new Set(value.map(Number))];
    } else if (key === "anchor") {
      if (value && !/^[a-z][a-z0-9_-]{0,79}$/.test(value))
        throw invalid(
          "El identificador debe empezar por una letra y usar minúsculas, números o guiones.",
        );
      if (
        [
          "main",
          "site-header",
          "site-footer",
          "app-shell",
          "modal-root",
          "toast-region",
        ].includes(value)
      )
        throw invalid("Identificador reservado.");
      output[key] = value;
    } else if (
      [
        "imageFit",
        "imagePosition",
        "imageRatio",
        "imageWidth",
        "imageSide",
        "primaryStyle",
        "secondaryStyle",
      ].includes(key)
    ) {
      const options = {
        imageFit: ["cover", "contain"],
        imagePosition: ["center", "top", "bottom", "left", "right"],
        imageRatio: ["auto", "1 / 1", "4 / 3", "16 / 9"],
        imageWidth: ["small", "medium", "large"],
        imageSide: ["left", "right"],
        primaryStyle: ["primary", "secondary", "ghost"],
        secondaryStyle: ["primary", "secondary", "ghost"],
      };
      if (!options[key].includes(value))
        throw invalid("Opción visual inválida.");
      output[key] = value;
    } else if (
      ["imageHidden", "primaryHidden", "secondaryHidden"].includes(key)
    )
      output[key] = parseBoolean(value);
    else if (["backgroundColor", "textColor", "accentColor"].includes(key)) {
      if (value === "") {
        output[key] = "";
        continue;
      }
      const color = safeColor(value, null);
      if (!color) throw invalid("Color CMS inválido.");
      output[key] = color;
    } else if (["spacing", "animation", "alignment"].includes(key)) {
      const values = {
        spacing: ["normal", "compact", "spacious"],
        animation: ["none", "fade-in", "fade-up"],
        alignment: ["left", "center", "right"],
      };
      if (!values[key].includes(value))
        throw invalid(`Valor CMS inválido: ${key}`);
      output[key] = value;
    } else if (key === "columns") {
      if (value === "") {
        output[key] = "";
        continue;
      }
      const n = Number(value);
      if (![1, 2, 3, 4].includes(n)) throw invalid("Columnas inválidas.");
      output[key] = n;
    } else if (key === "limit") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 30)
        throw invalid("Límite de cursos inválido.");
      output[key] = n;
    } else if (key === "mobileHidden") output[key] = parseBoolean(value);
    else if (["href", "primaryHref", "secondaryHref"].includes(key)) {
      const href = safeNavigationUrl(value);
      if (!href) throw invalid("Enlace CMS inválido.");
      output[key] = href;
    } else if (key === "imageUrl") {
      const text = plain(value);
      const url = /^\/uploads\/(?:certificates\/)?[a-zA-Z0-9._-]+$/.test(text)
        ? text
        : safeHttpUrl(text);
      if (text && !url) throw invalid("Imagen CMS inválida.");
      output[key] = url;
    } else if (["items", "steps"].includes(key)) {
      if (!Array.isArray(value) || value.length > 30)
        throw invalid("Lista CMS inválida.");
      const fields =
        type === "faq"
          ? ["question", "answer"]
          : type === "gallery"
            ? ["imageUrl", "alt", "caption"]
            : type === "team"
              ? ["imageUrl", "name", "role", "text"]
              : type === "stats"
                ? ["value", "label"]
                : type === "process"
                  ? ["title", "text"]
                  : ["name", "quote", "text"];
      output[key] = value.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw invalid("Elemento CMS inválido.");
        const row = {};
        for (const [k, v] of Object.entries(item)) {
          if (!fields.includes(k))
            throw invalid(`Propiedad de elemento CMS inválida: ${k}`);
          if (k === "imageUrl") {
            const url = /^\/uploads\/[a-zA-Z0-9._-]+$/.test(v)
              ? v
              : safeHttpUrl(v);
            if (v && !url) throw invalid("Imagen inválida.");
            row[k] = url;
          } else row[k] = plain(v);
        }
        return row;
      });
    } else output[key] = plain(value);
  }
  return output;
}
module.exports = { validateSettings };
