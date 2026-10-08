export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
export const money = (value) =>
  new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "";
export function toast(message, type = "info") {
  const region = document.querySelector("#toast-region");
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 4200);
}
export function loading(label = "Cargando") {
  return `<div class="loading-state" role="status"><span class="spinner" aria-hidden="true"></span><span>${esc(label)}…</span></div>`;
}
export function emptyState(title, text, action = "") {
  return `<section class="empty-state"><div class="empty-state__icon" aria-hidden="true">○</div><h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</section>`;
}
export function badge(text, tone = "neutral") {
  return `<span class="badge badge--${esc(tone)}">${esc(text)}</span>`;
}
export function progress(value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="progress" role="progressbar" aria-label="Progreso del curso" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="100"><span style="width:${n}%"></span></div>`;
}
export function icon(name) {
  const icons = {
    menu: "☰",
    close: "×",
    arrow: "→",
    back: "←",
    check: "✓",
    play: "▶",
    book: "▣",
    user: "○",
    settings: "⚙",
    chev: "›",
  };
  return `<span aria-hidden="true">${icons[name] || ""}</span>`;
}
export function normalizeVideo(url) {
  try {
    const u = new URL(url);
    let id = "";
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "www.youtube-nocookie.com",
      ].includes(u.hostname)
    ) {
      id =
        u.searchParams.get("v") ||
        u.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]+)/)?.[1] ||
        "";
    } else if (u.hostname === "youtu.be")
      id = u.pathname.slice(1).split("/")[0];
    if (id && /^[a-zA-Z0-9_-]+$/.test(id))
      return `https://www.youtube-nocookie.com/embed/${id}`;
    if (
      ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(u.hostname)
    ) {
      const match = u.pathname.match(/(?:^\/|\/video\/)(\d+)(?:\/|$)/);
      if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch {}
  return "";
}
export function courseCard(course, { compact = false } = {}) {
  return `<article class="course-card ${compact ? "course-card--compact" : ""}">${course.cover_image_url ? `<div class="course-card__media"><img src="${esc(course.cover_image_url)}" alt="" loading="lazy"></div>` : `<div class="course-card__media course-card__placeholder"><span>${esc((course.category || "Academia").slice(0, 32))}<span class="course-card__placeholder-mark" aria-hidden="true">↗</span></span></div>`}<div class="course-card__body"><div class="course-card__meta"><span>${esc(course.category || "General")}</span><span>${esc(course.level || "Todos")}</span></div><h3><a data-link href="/curso/${esc(course.slug)}">${esc(course.name)}</a></h3><p>${esc(course.description || "")}</p><div class="course-card__facts"><span>${Number(course.duration_hours) || 0} horas</span><span>Acceso al aula</span></div><div class="course-card__footer"><strong>${money(course.price)}</strong><a class="text-link" data-link href="/curso/${esc(course.slug)}">Ver curso ${icon("arrow")}</a></div></div></article>`;
}

let controlSequence = 0;
export function enhanceControls(root = document) {
  root.querySelectorAll(".field").forEach((field) => {
    const label = field.querySelector("label");
    const control = field.querySelector(
      "input:not([type=hidden]),textarea,select",
    );
    if (label && control && !label.htmlFor) {
      if (!control.id) control.id = `form-control-${++controlSequence}`;
      label.htmlFor = control.id;
    }
  });
}
