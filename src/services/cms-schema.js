const {
  cleanText,
  parseBoolean,
  safeHttpUrl,
  safeNavigationUrl,
  safeColor,
} = require("../utils/text");
const schemas = {
  hero: ["badge", "title", "text", "primaryCta", "secondaryCta", "imageUrl"],
  featured_courses: ["eyebrow", "title", "limit"],
  stats: ["items"],
  process: ["title", "steps"],
  about: ["title", "text", "imageUrl"],
  locations: ["title", "text"],
  testimonials: ["title", "text", "items"],
  cta: ["title", "text", "buttonLabel", "href"],
  rich_text: ["title", "text"],
  footer: ["title", "text"],
};
const common = [
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
    if (["backgroundColor", "textColor", "accentColor"].includes(key)) {
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
    else if (key === "href") {
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
        type === "stats"
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
          row[k] = plain(v);
        }
        return row;
      });
    } else output[key] = plain(value);
  }
  return output;
}
module.exports = { validateSettings };
