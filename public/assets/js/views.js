import { videoMarkup, mountPlayers } from "./video-player.js";
import { api } from "./api.js";
import { state } from "./state.js";
import {
  esc,
  money,
  date,
  toast,
  loading,
  emptyState,
  badge,
  progress,
  courseCard,
  normalizeVideo,
} from "./ui.js";

const main = () => document.querySelector("#main");
export function setMain(html) {
  document.querySelector("#site-footer").hidden = false;
  main().innerHTML = html;
  main().focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
export { homeView } from "./home.js";
function sectionWrap(content) {
  return `<section class="section"><div class="container">${content}</div></section>`;
}
export async function catalogView() {
  setMain(loading());
  const initial = new URLSearchParams(location.search);
  const data = await api(`/api/courses?${initial}`);
  setMain(
    `<section class="section"><div class="container"><div class="section-head"><div><div class="eyebrow">Catálogo</div><h1 style="font-size:clamp(2.2rem,5vw,4rem)">Encuentra tu próximo curso</h1><p class="lead">Busca por tema, nivel o precio.</p></div></div><div class="catalog-layout"><aside class="filters panel"><details class="catalog-filter-details" open><summary>Filtrar y ordenar cursos</summary><form id="catalog-filters" class="stack"><div class="field"><label for="q">Buscar</label><input id="q" name="search" type="search" placeholder="IA, marketing…"></div><div class="field"><label for="category">Categoría</label><select id="category" name="category"><option value="">Todas</option>${data.facets.categories.map((v) => `<option>${esc(v)}</option>`).join("")}</select></div><div class="field"><label for="level">Nivel</label><select id="level" name="level"><option value="">Todos</option>${data.facets.levels.map((v) => `<option>${esc(v)}</option>`).join("")}</select></div><div class="field"><label for="sort">Ordenar</label><select id="sort" name="sort"><option value="featured">Destacados</option><option value="newest">Más recientes</option><option value="name">Nombre</option><option value="price_asc">Precio: menor</option><option value="price_desc">Precio: mayor</option></select></div><div class="form-grid"><div class="field"><label for="minPrice">Desde USD</label><input id="minPrice" name="minPrice" type="number" min="0" step="0.01" placeholder="0"></div><div class="field"><label for="maxPrice">Hasta USD</label><input id="maxPrice" name="maxPrice" type="number" min="0" step="0.01" placeholder="Sin límite"></div></div><button class="btn" type="submit">Aplicar filtros</button><button id="clear-filters" class="btn btn--ghost" type="button">Limpiar filtros</button></form></details></aside><div><p id="catalog-count" class="muted" role="status">${data.courses.length} cursos disponibles</p><div id="catalog-results" class="course-grid">${data.courses.length ? data.courses.map((c) => courseCard(c)).join("") : emptyState("Sin resultados", "Prueba con otros filtros.")}</div></div></div></div></section>`,
  );
  document.querySelector(".catalog-filter-details").open =
    !matchMedia("(max-width: 820px)").matches;
  for (const [key, value] of initial) {
    const input = document.querySelector("#catalog-filters").elements[key];
    if (input) input.value = value;
  }
  document.querySelector("#clear-filters").onclick = () => {
    document.querySelector("#catalog-filters").reset();
    document.querySelector("#catalog-filters").requestSubmit();
  };
  document
    .querySelector("#catalog-filters")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = [...new FormData(e.currentTarget)].filter(([, v]) =>
        String(v).trim(),
      );
      const params = new URLSearchParams(values);
      const min = Number(params.get("minPrice") || 0),
        max = params.has("maxPrice")
          ? Number(params.get("maxPrice"))
          : Infinity;
      if (max < min) {
        toast("El precio máximo debe ser mayor o igual al mínimo.", "error");
        return;
      }
      const results = document.querySelector("#catalog-results");
      results.innerHTML = loading("Buscando");
      try {
        const filtered = await api(`/api/courses?${params}`);
        history.replaceState(
          {},
          "",
          `/catalogo${params.size ? "?" + params : ""}`,
        );
        document.querySelector("#catalog-count").textContent =
          `${filtered.courses.length} cursos encontrados`;
        results.className = "course-grid";
        results.innerHTML = filtered.courses.length
          ? filtered.courses.map((c) => courseCard(c)).join("")
          : emptyState("Sin resultados", "Prueba con otros filtros.");
      } catch (err) {
        toast(err.message, "error");
      }
    });
}

export async function courseView(slug) {
  setMain(loading());
  const { course, lessons, preview, enrolled } = await api(
    `/api/courses/${encodeURIComponent(slug)}`,
  );
  const video = normalizeVideo(course.promo_video_url);
  setMain(
    `<section class="course-detail-hero"><div class="container course-detail-grid"><div><div class="eyebrow">${esc(course.category)}</div><h1>${esc(course.name)}</h1><p class="lead course-detail-description">${esc(course.long_description || course.description)}</p><div class="cluster">${badge(course.level, "primary")}${badge(`${course.duration_hours || 0} h`)}${badge(`${course.lesson_count} clases`)}</div></div><aside class="course-detail-card">${course.cover_image_url ? `<img class="image-preview" src="${esc(course.cover_image_url)}" alt="">` : ""}<h2>${money(course.price)}</h2>${enrolled ? `<a class="btn" data-link href="/aula/${esc(course.slug)}">Entrar al aula</a>` : state.user ? `<a class="btn" data-link href="/pago?course=${encodeURIComponent(course.slug)}">Inscribirme</a>` : `<a class="btn" data-link href="/login?next=${encodeURIComponent(`/curso/${course.slug}`)}">Iniciar sesión para inscribirme</a>`}<p class="muted">Pago Móvil sujeto a verificación administrativa.</p></aside></div></section>${video ? sectionWrap(`<div class="classroom-player"><iframe src="${esc(video)}" title="Presentación de ${esc(course.name)}" allowfullscreen></iframe></div>`) : ""}${sectionWrap(`<div class="section-head"><div><div class="eyebrow">Programa</div><h2>Contenido del curso</h2></div></div><div class="lesson-list">${lessons.map((l, i) => `<div class="lesson-row"><div><strong>${i + 1}. ${esc(l.title)}</strong><p class="muted">${esc(l.description)}</p></div>${l.is_free ? `<button class="btn btn--small btn--secondary" data-preview="${l.id}">Vista previa</button>` : badge("Incluida")}</div>`).join("")}</div>`)}`,
  );
  document.querySelectorAll("[data-preview]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        const data = await api(
          `/api/courses/${encodeURIComponent(slug)}/preview/${btn.dataset.preview}`,
        );
        showPreviewModal(data.lesson);
      } catch (err) {
        toast(err.message, "error");
      }
    }),
  );
}
function showPreviewModal(lesson) {
  const root = document.querySelector("#modal-root");
  const video = normalizeVideo(lesson.video_url);
  root.innerHTML = `<div class="modal-backdrop" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-labelledby="preview-title"><div class="modal__head"><h2 id="preview-title">${esc(lesson.title)}</h2><button class="icon-btn" data-close-modal aria-label="Cerrar">×</button></div><div class="modal__body">${lesson.video ? videoMarkup(lesson) : video ? `<div class="classroom-player"><iframe src="${esc(video)}" title="${esc(lesson.title)}" allowfullscreen></iframe></div>` : ""}${lesson.image_url ? `<img class="classroom-image" src="${esc(lesson.image_url)}" alt="">` : ""}<p>${esc(lesson.content)}</p></div></div></div>`;
  mountPlayers(root);
  document.body.classList.add("modal-open");
  const previous = document.activeElement,
    shell = document.querySelector("#app-shell");
  shell.inert = true;
  const button = root.querySelector("button");
  button.focus();
  const close = () => {
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    shell.inert = false;
    document.removeEventListener("keydown", keys);
    previous?.focus();
  };
  const keys = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      button.focus();
    }
  };
  document.addEventListener("keydown", keys);
  root.querySelectorAll("[data-close-modal]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target === el || el.tagName === "BUTTON") close();
    }),
  );
}

function authForm(mode, token = "") {
  const login = mode === "login",
    register = mode === "register",
    reset = mode === "reset";
  const title = login
    ? "Bienvenido de nuevo"
    : register
      ? "Crea tu cuenta"
      : reset
        ? "Define una nueva contraseña"
        : "Recupera tu acceso";
  const action = login
    ? "/api/auth/login"
    : register
      ? "/api/auth/register"
      : reset
        ? "/api/auth/reset-password"
        : "/api/auth/forgot-password";
  return `<div class="auth-layout"><aside class="auth-story"><a class="text-link" data-link href="/">← Volver al inicio</a><div><div class="eyebrow">Aprende con intención</div><h2>El próximo paso<br>es tuyo.</h2><p>Una clase a la vez. Tu progreso guardado. Un lugar para seguir avanzando.</p><div class="auth-story__path"><span>Explora</span><span>Aprende</span><span>Aplica</span></div></div><small>${esc(state.site?.academy_name || "AcademiaVE")} · Formación práctica</small></aside><div class="auth-form-area"><form id="auth-form" class="auth-card surface stack" data-action="${action}"><div><div class="eyebrow">${esc(state.site?.academy_name || "AcademiaVE")}</div><h1>${title}</h1></div>${register ? `<div class="field"><label for="name">Nombre</label><input id="name" name="name" autocomplete="name" required></div>` : ""}${!reset ? `<div class="field"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="email" required></div>` : ""}${login || register || reset ? `<div class="field"><label for="password">Contraseña</label><div class="password-control"><input id="password" name="password" type="password" autocomplete="${login ? "current-password" : "new-password"}" minlength="8" required><button type="button" data-toggle-password="password" aria-controls="password" aria-pressed="false" aria-label="Mostrar contraseña">Mostrar</button></div></div>` : ""}${reset ? `<input type="hidden" name="token" value="${esc(token)}"><div class="field"><label for="confirmPassword">Confirmar contraseña</label><div class="password-control"><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required><button type="button" data-toggle-password="confirmPassword" aria-controls="confirmPassword" aria-pressed="false" aria-label="Mostrar confirmación de contraseña">Mostrar</button></div></div>` : ""}<button class="btn" type="submit">${login ? "Iniciar sesión" : register ? "Crear cuenta" : reset ? "Cambiar contraseña" : "Enviar enlace"}</button>${login ? `<a class="text-link" data-link href="/recuperar">¿Olvidaste tu contraseña?</a><p class="muted">¿No tienes cuenta? <a data-link href="/registro">Regístrate</a></p>` : register ? `<p class="muted">¿Ya tienes cuenta? <a data-link href="/login">Inicia sesión</a></p>` : ""}<div id="auth-message" role="status"></div></form></div></div>`;
}
export function authView(mode, params = {}) {
  setMain(authForm(mode, params.token || ""));
  document.querySelectorAll("[data-toggle-password]").forEach((button) =>
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Ocultar" : "Mostrar";
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute(
        "aria-label",
        `${visible ? "Ocultar" : "Mostrar"} ${input.id === "confirmPassword" ? "confirmación de contraseña" : "contraseña"}`,
      );
    }),
  );
  document.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const result = await api(form.dataset.action, { method: "POST", body });
      if (result.user) {
        state.user = result.user;
        const { setCsrf } = await import("./api.js");
        setCsrf(result.csrfToken);
        toast(
          mode === "register" ? "Cuenta creada." : "Sesión iniciada.",
          "success",
        );
        const next = String(params.next || "");
        location.assign(
          /^\/(?!\/)[^\\\x00-\x20]*$/.test(next) ? next : "/dashboard",
        );
      } else {
        document.querySelector("#auth-message").innerHTML =
          `<div class="panel">${esc(result.message || "Solicitud procesada.")}</div>`;
        if (mode === "reset") setTimeout(() => location.assign("/login"), 1000);
      }
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

export async function dashboardView() {
  if (!state.user) return location.assign("/login?next=/dashboard");
  setMain(loading());
  const [data, paymentData] = await Promise.all([
    api("/api/dashboard"),
    api("/api/payments/my"),
  ]);
  const cards = data.enrolled.length
    ? data.enrolled
        .map(
          (c) =>
            `<article class="learning-card"><div class="learning-card__media">${c.cover_image_url ? `<img src="${esc(c.cover_image_url)}" alt="">` : `<span aria-hidden="true">${esc(c.icon || "CURSO")}</span>`}</div><div><div class="split"><h3>${esc(c.name)}</h3><strong>${Number(c.progress_percentage || 0)}%</strong></div>${progress(c.progress_percentage)}<p class="muted">${c.next_lesson_title ? `Siguiente: ${esc(c.next_lesson_title)}` : "Curso completado"}</p><a class="text-link" data-link href="/aula/${esc(c.slug)}">${Number(c.progress_percentage) === 100 ? "Repasar" : c.progress_percentage ? "Continuar" : "Comenzar"} →</a></div></article>`,
        )
        .join("")
    : emptyState(
        "Aún no tienes cursos",
        "Explora el catálogo para comenzar.",
        '<a class="btn" data-link href="/catalogo">Explorar cursos</a>',
      );
  setMain(
    sectionWrap(
      `<div class="section-head"><div><div class="eyebrow">Tu espacio</div><h1 style="font-size:clamp(2.1rem,5vw,3.8rem)">Hola, ${esc(state.user.name.split(/\s+/)[0])}</h1><p class="lead">Continúa desde donde lo dejaste.</p></div><a class="btn btn--secondary" data-link href="/catalogo">Explora más cursos</a></div><div class="learner-summary"><div><span>Cursos inscritos</span><strong>${data.enrolled.length}</strong></div><div><span>Cursos completados</span><strong>${data.enrolled.filter((c) => Number(c.progress_percentage) === 100).length}</strong></div><div><span>Certificados obtenidos</span><strong>${data.certificates.length}</strong></div></div><div class="dashboard-grid"><div class="stack"><h2>${data.enrolled.some((c) => Number(c.progress_percentage) < 100) ? "Continuar aprendiendo" : "Mis cursos"}</h2>${cards}</div><aside class="stack"><div class="panel"><h2>Mis pagos</h2>${
        paymentData.payments.length
          ? paymentData.payments
              .slice(0, 5)
              .map(
                (p) =>
                  `<article class="payment-summary"><div class="split"><strong>${esc(p.course_name)}</strong>${badge(p.status === "approved" ? "Aprobado" : p.status === "rejected" ? "Rechazado" : "Pendiente", p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "warning")}</div><p class="muted">${money(p.amount)} · ${Number(p.amount_bs).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</p>${p.rejection_reason ? `<p>${esc(p.rejection_reason)}</p>` : ""}${p.status === "pending" ? '<small class="muted">Tu pago está en revisión. El aula se habilitará al aprobarse.</small>' : ""}${p.receipt_url ? `<p><a class="text-link" href="${esc(p.receipt_url)}" target="_blank" rel="noopener">Ver comprobante</a></p>` : ""}</article>`,
              )
              .join("")
          : '<p class="muted">No has reportado pagos todavía.</p>'
      }</div><div class="panel"><h2>Certificados</h2>${data.certificates.length ? data.certificates.map((c) => `<div class="lesson-row"><div><strong>${esc(c.course_name)}</strong><p class="muted">${date(c.issued_at)}</p></div><a class="btn btn--small btn--secondary" href="/api/certificates/${encodeURIComponent(c.code)}/pdf">PDF</a></div>`).join("") : '<p class="muted">Completa un curso para obtener tu certificado.</p>'}</div><div class="panel"><h2>Recomendados</h2>${data.recommendations.map((c) => `<p><a class="text-link" data-link href="/curso/${esc(c.slug)}">${esc(c.name)} →</a></p>`).join("") || '<p class="muted">Ya estás inscrito en todos los cursos publicados.</p>'}</div></aside></div>`,
    ),
  );
}

export async function classroomView(slug) {
  if (!state.user)
    return location.assign(
      `/login?next=${encodeURIComponent(`/aula/${slug}`)}`,
    );
  setMain(loading());
  const data = await api(`/api/courses/${encodeURIComponent(slug)}/classroom`);
  let current = data.lessons.find((l) => !l.completed) || data.lessons[0];

  const markViewed = (lesson) => {
    if (!lesson) return;
    api(`/api/lessons/${lesson.id}/view`, { method: "POST", body: {} }).catch(
      () => {},
    );
  };

  const selectLesson = (index, { track = true } = {}) => {
    if (index < 0 || index >= data.lessons.length) return;
    current = data.lessons[index];
    draw();
    if (track) markViewed(current);
  };

  const draw = () => {
    const currentIndex = current
      ? data.lessons.findIndex((l) => l.id === current.id)
      : -1;
    const previous = currentIndex > 0 ? data.lessons[currentIndex - 1] : null;
    const next =
      currentIndex >= 0 && currentIndex < data.lessons.length - 1
        ? data.lessons[currentIndex + 1]
        : null;
    const completedCount = data.lessons.filter((l) => l.completed).length;
    data.progress = {
      total: data.lessons.length,
      completed: completedCount,
      percentage: data.lessons.length
        ? Math.round((completedCount / data.lessons.length) * 100)
        : 0,
    };

    setMain(`<div class="classroom">
      <aside class="classroom-sidebar">
        <div class="classroom-sidebar__top">
          <a class="text-link" data-link href="/dashboard">← Dashboard</a>
          <h2>${esc(data.course.name)}</h2>
          ${progress(data.progress.percentage)}
          <div class="classroom-progress-meta"><span>${data.progress.completed}/${data.progress.total} clases</span><strong>${data.progress.percentage}%</strong></div>
          <button id="classroom-outline-toggle" class="classroom-outline-toggle btn btn--secondary" type="button" aria-expanded="false" aria-controls="classroom-nav">Ver temario <span aria-hidden="true">⌄</span></button>
        </div>
        <nav id="classroom-nav" class="classroom-nav" aria-label="Clases">
          ${data.lessons.map((l, i) => `<button class="${l.id === current?.id ? "active" : ""} ${l.completed ? "completed" : ""}" data-lesson-index="${i}" ${l.id === current?.id ? 'aria-current="step"' : ""}><span>${i + 1}. ${esc(l.title)}</span></button>`).join("")}
        </nav>
      </aside>
      <article class="classroom-main">
        <div class="classroom-content">${current ? lessonContent(current) : emptyState("Curso sin clases", "La academia aún no ha publicado clases para este curso.")}</div>
        ${
          current
            ? `<div class="classroom-footer" aria-label="Acciones de la clase">
          <div class="classroom-status-actions">
            <button id="toggle-progress" class="btn ${current.completed ? "btn--secondary" : ""}">${current.completed ? "Marcar como pendiente" : "Marcar como completada"}</button>
            ${data.progress.percentage === 100 && !data.certificate ? `<button id="issue-certificate" class="btn btn--secondary">Generar certificado</button>` : ""}
            ${data.certificate ? `<a class="btn btn--secondary" href="/api/certificates/${encodeURIComponent(data.certificate.code)}/pdf">Descargar certificado</a>` : ""}
          </div>
          <nav class="classroom-pagination" aria-label="Navegación entre clases">
            ${previous ? `<button id="previous-lesson" class="btn btn--secondary classroom-pagination__previous" type="button"><span aria-hidden="true">←</span><span><small>Anterior</small>${esc(previous.title)}</span></button>` : '<span class="classroom-pagination__spacer" aria-hidden="true"></span>'}
            ${next ? `<button id="next-lesson" class="btn classroom-pagination__next" type="button"><span><small>Siguiente clase</small>${esc(next.title)}</span><span aria-hidden="true">→</span></button>` : `<a class="btn btn--secondary classroom-pagination__next" data-link href="/dashboard"><span><small>Curso</small>Volver al dashboard</span><span aria-hidden="true">→</span></a>`}
          </nav>
        </div>`
            : ""
        }
      </article>
    </div>`);

    mountPlayers();
    document
      .querySelectorAll("[data-lesson-index]")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          selectLesson(Number(btn.dataset.lessonIndex)),
        ),
      );
    document
      .querySelector("#previous-lesson")
      ?.addEventListener("click", () => selectLesson(currentIndex - 1));
    document
      .querySelector("#next-lesson")
      ?.addEventListener("click", () => selectLesson(currentIndex + 1));

    document
      .querySelector("#classroom-outline-toggle")
      ?.addEventListener("click", (e) => {
        const nav = document.querySelector("#classroom-nav");
        const open = nav?.classList.toggle("is-open") || false;
        e.currentTarget.setAttribute("aria-expanded", String(open));
        e.currentTarget.lastElementChild.textContent = open ? "⌃" : "⌄";
      });

    document
      .querySelector("#toggle-progress")
      ?.addEventListener("click", async () => {
        try {
          const r = await api(`/api/lessons/${current.id}/progress`, {
            method: "POST",
            body: { completed: !current.completed },
          });
          current.completed = r.completed;
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });

    document
      .querySelector("#issue-certificate")
      ?.addEventListener("click", async () => {
        try {
          const r = await api(
            `/api/courses/${encodeURIComponent(slug)}/certificate`,
            { method: "POST", body: {} },
          );
          data.certificate = r.certificate;
          toast("Certificado generado.", "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
  };

  draw();
  markViewed(current);
}
function lessonContent(l) {
  const video = normalizeVideo(l.video_url);
  return `<div class="classroom-lesson"><div class="lesson-heading"><div class="eyebrow">Tu aula · Clase</div></div><h1 style="font-size:clamp(2rem,4vw,3rem)">${esc(l.title)}</h1><p class="lead">${esc(l.description)}</p>${l.video ? videoMarkup(l, { remember: true }) : video ? `<div class="classroom-player"><iframe src="${esc(video)}" title="${esc(l.title)}" allowfullscreen></iframe></div>` : l.video_url ? `<p><a class="text-link" href="${esc(l.video_url)}" target="_blank" rel="noopener">Abrir vídeo →</a></p>` : ""}${l.image_url ? `<img class="classroom-image" src="${esc(l.image_url)}" alt="">` : ""}<div class="panel" style="margin-top:20px"><p>${esc(l.content).replace(/\n/g, "<br>")}</p></div>${l.pdf_url ? `<p><a class="btn btn--secondary" href="${esc(l.pdf_url)}" target="_blank" rel="noopener">Abrir material PDF</a></p>` : ""}</div>`;
}

export async function paymentView(params) {
  if (!state.user) return location.assign("/login?next=/pago");
  setMain(loading());
  const [catalog, cfg] = await Promise.all([
    api("/api/courses"),
    api("/api/payment-config"),
  ]);
  const selected = params.course || "";
  setMain(
    sectionWrap(
      `<div class="section-head"><div><div class="eyebrow">Inscripción</div><h1 style="font-size:clamp(2rem,5vw,3.6rem)">Reporta tu Pago Móvil</h1><p class="lead">El acceso se activa cuando administración aprueba el comprobante.</p></div></div><div class="dashboard-grid"><form id="payment-form" class="panel stack" enctype="multipart/form-data"><div class="field"><label for="courseId">Curso</label><select id="courseId" name="courseId" required><option value="">Selecciona</option>${catalog.courses.map((c) => `<option value="${c.id}" ${c.slug === selected ? "selected" : ""}>${esc(c.name)} · ${money(c.price)}</option>`).join("")}</select></div><div class="form-grid"><div class="field"><label for="payerName">Nombre del pagador</label><input id="payerName" name="payerName" required></div><div class="field"><label for="payerBank">Banco de origen</label><input id="payerBank" name="payerBank" required></div><div class="field"><label for="payerPhone">Teléfono</label><input id="payerPhone" name="payerPhone" required></div><div class="field"><label for="payerDocument">Cédula/RIF</label><input id="payerDocument" name="payerDocument" required></div><div class="field"><label for="reference">Referencia</label><input id="reference" name="reference" required></div><div class="field"><label for="couponCode">Cupón (opcional)</label><input id="couponCode" name="couponCode"></div></div><div class="field"><label for="receipt">Comprobante (PNG, JPG o PDF)</label><input id="receipt" name="receipt" type="file" accept="image/png,image/jpeg,application/pdf"></div><div id="payment-quote" class="callout" role="status">Selecciona un curso para consultar el importe.</div><button id="payment-submit" class="btn" type="submit" disabled>Enviar pago para revisión</button></form><aside class="panel"><h2>Datos de Pago Móvil</h2><p><strong>Banco</strong><br>${esc(cfg.bank)}</p><p><strong>Teléfono</strong><br>${esc(cfg.phone)}</p><p><strong>Cédula/RIF</strong><br>${esc(cfg.document)}</p><p><strong>Tasa</strong><br>${esc(cfg.exchangeRate)} Bs/USD</p></aside></div>`,
    ),
  );
  const quoteBox = document.querySelector("#payment-quote"),
    submit = document.querySelector("#payment-submit");
  let quoteVersion = 0;
  const updateQuote = async () => {
    const version = ++quoteVersion;
    submit.disabled = true;
    const id = document.querySelector("#courseId").value,
      coupon = document.querySelector("#couponCode").value;
    if (!id) {
      quoteBox.textContent = "Selecciona un curso para consultar el importe.";
      return;
    }
    quoteBox.textContent = "Calculando importe…";
    try {
      const { quote: q } = await api(
        `/api/payments/quote?courseId=${id}&couponCode=${encodeURIComponent(coupon)}`,
      );
      if (version !== quoteVersion) return;
      quoteBox.textContent = `Total: ${money(q.amountUsd)} · ${q.amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs${q.discountUsd ? ` · Descuento: ${money(q.discountUsd)}` : ""}`;
      submit.disabled = false;
    } catch (err) {
      if (version === quoteVersion) quoteBox.textContent = err.message;
    }
  };
  document.querySelector("#courseId").addEventListener("change", updateQuote);
  document.querySelector("#couponCode").addEventListener("input", updateQuote);
  updateQuote();
  document
    .querySelector("#payment-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const r = await api("/api/payments", {
          method: "POST",
          body: new FormData(form),
        });
        toast("Pago registrado y pendiente de revisión.", "success");
        form.reset();
        setTimeout(() => location.assign("/dashboard"), 700);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        btn.disabled = false;
      }
    });
}

export async function certificateView(code) {
  setMain(loading());
  try {
    const { certificate } = await api(
      `/api/certificates/${encodeURIComponent(code)}`,
    );
    setMain(
      `<div class="auth-shell"><article class="auth-card surface stack"><div class="eyebrow">Certificado válido</div><h1>${esc(certificate.student_name)}</h1><p class="lead">Completó ${esc(certificate.course_name)}</p><div class="panel"><p><strong>Código</strong><br>${esc(certificate.code)}</p><p><strong>Emisión</strong><br>${date(certificate.issued_at)}</p>${certificate.duration_hours ? `<p><strong>Duración</strong><br>${esc(certificate.duration_hours)} horas</p>` : ""}</div></article></div>`,
    );
  } catch (err) {
    setMain(emptyState("Certificado no encontrado", err.message));
  }
}
