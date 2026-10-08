import { api, setCsrf } from "./api.js";
import { state, applyDesign } from "./state.js";
import { esc, toast, enhanceControls } from "./ui.js";
import {
  homeView,
  catalogView,
  courseView,
  authView,
  dashboardView,
  classroomView,
  paymentView,
  certificateView,
  setMain,
} from "./views.js";
import { adminView } from "./admin.js";

async function bootstrap() {
  try {
    const me = await api("/api/auth/me");
    state.user = me.user;
    state.csrfToken = me.csrfToken;
    setCsrf(me.csrfToken);
    const data = await api("/api/site");
    state.site = data.site || {};
    state.design = data.design || {};
    state.navigation = data.navigation || [];
    state.locations = data.locations || [];
    state.homeSections = data.home?.sections || [];
    if (
      new URLSearchParams(location.search).get("preview") === "1" &&
      state.user?.role === "admin"
    ) {
      try {
        const preview = await api("/api/admin/cms/home/preview");
        state.homeSections = preview.sections || state.homeSections;
        state.cmsPreview = true;
      } catch {}
    }
    applyDesign(state.design);
    renderChrome();
    await route();
  } catch (error) {
    console.error(error);
    setMain(
      `<div class="auth-shell"><div class="auth-card surface"><h1>No se pudo iniciar la plataforma</h1><p>${esc(error.message)}</p><a class="btn" href="/">Reintentar</a></div></div>`,
    );
  }
}
function renderChrome() {
  const header = document.querySelector("#site-header");
  const footer = document.querySelector("#site-footer");
  const headerItems = state.navigation.filter((x) => x.location === "header");
  const footerItems = state.navigation.filter((x) => x.location === "footer");
  const mobileSessionActions = state.user
    ? `${state.user.role === "admin" ? '<a class="nav-mobile-action" data-link href="/admin/resumen">Administración</a>' : ""}<button id="mobile-logout-btn" class="nav-mobile-action nav-mobile-button" type="button">Salir</button>`
    : `<a class="nav-mobile-action" data-link href="/login">${esc(state.site.login_label || "Entrar")}</a>`;
  const mobilePrimaryAction = state.user
    ? `<a class="btn mobile-header-cta" data-link href="/dashboard">Mi aprendizaje</a>`
    : `<a class="btn mobile-header-cta" data-link href="/registro">${esc(state.site.register_label || "Crear cuenta")}</a>`;

  header.innerHTML = `<div class="container header-inner">
    <a class="brand" data-link href="/">${state.site.logo_url ? `<img src="${esc(state.site.logo_url)}" alt="">` : `<span class="brand-mark">A</span>`}<span>${esc(state.site.academy_name || "AcademiaVE")}</span></a>
    <nav id="main-nav" class="nav" aria-label="Principal">
      ${headerItems.map((item) => `<a ${item.href.startsWith("/") ? "data-link" : ""} href="${esc(item.href)}">${esc(item.label)}</a>`).join("")}
      <div class="nav-mobile-actions">${mobileSessionActions}</div>
    </nav>
    <div class="header-actions">${state.user ? `${state.user.role === "admin" ? '<a class="btn btn--secondary" data-link href="/admin/resumen">Administración</a>' : ""}<a class="btn" data-link href="/dashboard">Mi aprendizaje</a><button id="logout-btn" class="btn btn--ghost">Salir</button>` : `<a class="btn btn--secondary" data-link href="/login">${esc(state.site.login_label || "Entrar")}</a><a class="btn" data-link href="/registro">${esc(state.site.register_label || "Crear cuenta")}</a>`}</div>
    <div class="mobile-header-actions">
      ${mobilePrimaryAction}
      <button id="menu-btn" class="icon-btn menu-btn" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menú">☰</button>
    </div>
  </div>`;

  footer.innerHTML = `<div class="container footer-grid"><div><a class="brand" data-link href="/">${state.site.logo_url ? `<img src="${esc(state.site.logo_url)}" alt="">` : '<span class="brand-mark">A</span>'}<span>${esc(state.site.academy_name || "AcademiaVE")}</span></a><p class="muted">${esc(state.site.footer_text || "Formación práctica para el mundo digital.")}</p><small class="muted">${esc(state.site.copyright_text || "")}</small></div><div><strong>Navegación</strong><div class="footer-links">${footerItems.map((item) => `<a ${item.href.startsWith("/") ? "data-link" : ""} href="${esc(item.href)}">${esc(item.label)}</a>`).join("")}</div></div><div><strong>Contacto</strong><div class="footer-links">${state.site.support_email ? `<a href="mailto:${esc(state.site.support_email)}">${esc(state.site.support_email)}</a>` : ""}${state.site.whatsapp ? `<span>${esc(state.site.whatsapp)}</span>` : ""}${state.site.instagram_url ? `<a href="${esc(state.site.instagram_url)}" target="_blank" rel="noopener">Instagram</a>` : ""}${state.site.facebook_url ? `<a href="${esc(state.site.facebook_url)}" target="_blank" rel="noopener">Facebook</a>` : ""}${state.site.tiktok_url ? `<a href="${esc(state.site.tiktok_url)}" target="_blank" rel="noopener">TikTok</a>` : ""}</div></div></div>`;

  const menuButton = document.querySelector("#menu-btn");
  const nav = document.querySelector("#main-nav");
  const closeMenu = () => {
    nav?.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
    if (menuButton) menuButton.setAttribute("aria-label", "Abrir menú");
  };
  menuButton?.addEventListener("click", (e) => {
    const open = nav.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
    e.currentTarget.setAttribute(
      "aria-label",
      open ? "Cerrar menú" : "Abrir menú",
    );
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
      location.assign("/");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  document.querySelector("#logout-btn")?.addEventListener("click", logout);
  document
    .querySelector("#mobile-logout-btn")
    ?.addEventListener("click", logout);

  if (state.site.favicon_url) {
    let fav = document.querySelector('link[rel="icon"]');
    if (!fav) {
      fav = document.createElement("link");
      fav.rel = "icon";
      document.head.append(fav);
    }
    fav.href = state.site.favicon_url;
  }
  document.title = state.site.academy_name || "AcademiaVE";
}
async function route() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const params = Object.fromEntries(new URLSearchParams(location.search));
  try {
    if (path === "/") await homeView();
    else if (path === "/catalogo") await catalogView();
    else if (path.startsWith("/curso/"))
      await courseView(decodeURIComponent(path.split("/")[2] || ""));
    else if (path === "/login") authView("login", params);
    else if (path === "/registro") authView("register", params);
    else if (path === "/recuperar") authView("forgot", params);
    else if (path === "/reset-password") authView("reset", params);
    else if (path === "/dashboard") await dashboardView();
    else if (path.startsWith("/aula/"))
      await classroomView(decodeURIComponent(path.split("/")[2] || ""));
    else if (path === "/pago") await paymentView(params);
    else if (path.startsWith("/certificado/"))
      await certificateView(decodeURIComponent(path.split("/")[2] || ""));
    else if (path === "/privacidad")
      setMain(
        `<section class="section"><div class="container"><h1>Política de privacidad</h1><div class="panel"><p>${esc(state.site.privacy_text || "Contenido pendiente de configuración.")}</p></div></div></section>`,
      );
    else if (path === "/terminos")
      setMain(
        `<section class="section"><div class="container"><h1>Términos y condiciones</h1><div class="panel"><p>${esc(state.site.terms_text || "Contenido pendiente de configuración.")}</p></div></div></section>`,
      );
    else if (path === "/admin" || path.startsWith("/admin/"))
      await adminView(path.split("/")[2] || "resumen");
    else
      setMain(
        `<div class="auth-shell"><div class="auth-card surface"><h1>404</h1><p>La página que buscas no existe.</p><a class="btn" data-link href="/">Volver al inicio</a></div></div>`,
      );
  } catch (error) {
    if (error.status === 401) {
      location.assign(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    setMain(
      `<div class="auth-shell"><div class="auth-card surface"><h1>No se pudo cargar esta vista</h1><p>${esc(error.message)}</p><a class="btn btn--secondary" data-link href="/">Ir al inicio</a></div></div>`,
    );
  }
  document.querySelectorAll("#main-nav a").forEach((a) => {
    if (
      new URL(a.href, location.origin).pathname === path &&
      (!new URL(a.href, location.origin).hash ||
        new URL(a.href, location.origin).hash === location.hash)
    )
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelector("#site-footer").hidden =
    path === "/" &&
    (state.homeSections || []).some(
      (s) => s.enabled && s.section_type === "footer",
    );
  document.querySelector("#main-nav")?.classList.remove("open");
  document.querySelector("#menu-btn")?.setAttribute("aria-expanded", "false");
  document.querySelector("#menu-btn")?.setAttribute("aria-label", "Abrir menú");
}
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-link]");
  if (!link) return;
  if (
    link.target === "_blank" ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  )
    return;
  const url = new URL(link.href, location.origin);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  history.pushState({}, "", url.pathname + url.search + url.hash);
  route();
  if (url.hash)
    setTimeout(
      () =>
        document
          .getElementById(decodeURIComponent(url.hash.slice(1)))
          ?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
});
window.addEventListener("popstate", route);
const controlObserver = new MutationObserver(() => enhanceControls());
controlObserver.observe(document.querySelector("#main"), {
  childList: true,
  subtree: true,
});
controlObserver.observe(document.querySelector("#modal-root"), {
  childList: true,
  subtree: true,
});
document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && !img.closest(".certificate-stage")) {
      img.hidden = true;
      img.parentElement?.classList.add("image-fallback");
    }
  },
  true,
);
bootstrap();
