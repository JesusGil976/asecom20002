import { uploadVideo } from "./video-upload.js";
import { videoMarkup, mountPlayers } from "./video-player.js";
import { api } from "./api.js";
import { state, applyDesign } from "./state.js";
import { mountNavigationEditor } from "./navigation-editor.js";
import { renderSection, initCarousels } from "./home.js";
import { esc, money, date, toast, loading, badge, progress } from "./ui.js";

const main = () => document.querySelector("#main");
const adminItems = [
  ["resumen", "Resumen"],
  ["usuarios", "Usuarios"],
  ["pagos", "Pagos"],
  ["cursos", "Cursos y clases"],
  ["cms", "Páginas / CMS"],
  ["sedes", "Sedes"],
  ["cupones", "Cupones"],
  ["certificados", "Certificados"],
  ["configuracion", "Configuración"],
  ["diseno", "Diseño"],
  ["auditoria", "Auditoría"],
];
function shell(section, content, title, actions = "") {
  main().innerHTML = `<div class="admin-shell"><aside class="admin-sidebar"><div class="eyebrow">Administración</div><h2>${esc(state.site?.academy_name || "AcademiaVE")}</h2><nav>${adminItems.map(([key, label]) => `<a data-link href="/admin/${key}" ${key === section ? 'aria-current="page"' : ""}>${esc(label)}</a>`).join("")}</nav></aside><section class="admin-content"><div class="admin-title"><div><div class="eyebrow">Espacio de gestión</div><h1 style="font-size:clamp(2rem,4vw,3rem)">${esc(title)}</h1></div>${actions}</div>${content}</section></div>`;
}
function modal(title, body, actions = "") {
  const root = document.querySelector("#modal-root"),
    previous = document.activeElement;
  root.innerHTML = `<div class="modal-backdrop" data-modal-bg><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal__head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-modal-close aria-label="Cerrar">×</button></div><div class="modal__body">${body}</div>${actions ? `<div class="modal__actions">${actions}</div>` : ""}</section></div>`;
  document.body.classList.add("modal-open");
  const dialog = root.querySelector(".modal"),
    shell = document.querySelector("#app-shell");
  shell.inert = true;
  root.querySelectorAll(".field").forEach((field, i) => {
    const label = field.querySelector("label"),
      input = field.querySelector('input:not([type="hidden"]),select,textarea');
    if (label && input) {
      input.id ||= `modal-input-${i}`;
      label.htmlFor = input.id;
    }
  });
  const focusable = () =>
    [...dialog.querySelectorAll("button,input,select,textarea,a[href]")].filter(
      (el) => !el.disabled && el.type !== "hidden",
    );
  const close = () => {
    document.removeEventListener("keydown", keys);
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    shell.inert = false;
    if (previous?.isConnected) previous.focus();
  };
  const keys = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const all = focusable(),
        first = all[0],
        last = all.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };
  document.addEventListener("keydown", keys);
  root.querySelector("[data-modal-close]").onclick = close;
  root.querySelector("[data-modal-bg]").onclick = (e) => {
    if (e.target === e.currentTarget) close();
  };
  (focusable()[1] || dialog).focus();
  return { root, close };
}
function statusBadge(status) {
  return status === "approved"
    ? badge("Aprobado", "success")
    : status === "rejected"
      ? badge("Rechazado", "danger")
      : badge("Pendiente", "warning");
}
export async function adminView(section = "resumen") {
  if (state.user?.role !== "admin") {
    location.assign("/dashboard");
    return;
  }
  try {
    if (section === "resumen") await overview();
    else if (section === "usuarios") await users();
    else if (section === "pagos") await payments();
    else if (section === "cursos") await courses();
    else if (section === "cms") await cms();
    else if (section === "sedes") await locations();
    else if (section === "cupones") await coupons();
    else if (section === "certificados") await certificates();
    else if (section === "configuracion") await settings();
    else if (section === "diseno") await design();
    else if (section === "auditoria") await audit();
    else await overview();
  } catch (err) {
    shell(
      section,
      `<div class="empty-state"><h2>No se pudo cargar</h2><p>${esc(err.message)}</p></div>`,
      "Administración",
    );
  }
}
async function overview() {
  shell("resumen", loading(), "Resumen");
  const { stats } = await api("/api/admin/stats");
  shell(
    "resumen",
    `<div class="kpi-grid"><div class="kpi"><span class="muted">Alumnos</span><strong>${stats.students || 0}</strong></div><div class="kpi"><span class="muted">Matrículas</span><strong>${stats.enrollments || 0}</strong></div><div class="kpi"><span class="muted">Pagos pendientes</span><strong>${stats.pending || 0}</strong></div><div class="kpi"><span class="muted">Ingresos aprobados</span><strong>${money(stats.approved_revenue_usd)}</strong></div></div><section class="section--tight"><div class="panel"><div class="section-head"><div><div class="eyebrow">Siguiente acción</div><h2>La academia, bajo control.</h2><p class="muted">Organiza el contenido y atiende las solicitudes de tus alumnos.</p></div></div><div class="admin-quick-actions"><a data-link href="/admin/pagos"><span>Inscripciones</span><strong>Revisar pagos →</strong><small>${stats.pending || 0} pendientes de revisión</small></a><a data-link href="/admin/cursos"><span>Aprendizaje</span><strong>Gestionar cursos →</strong><small>Clases, materiales y publicación</small></a><a data-link href="/admin/cms"><span>Tu sitio</span><strong>Editar página de inicio →</strong><small>Borrador, vista previa y publicación</small></a></div></div></section>`,
    "Resumen",
  );
}
async function users() {
  shell("usuarios", loading(), "Usuarios");
  const { users } = await api("/api/admin/users");
  shell(
    "usuarios",
    `<div class="toolbar"><div class="field"><label for="user-search">Buscar</label><input id="user-search" type="search" placeholder="Nombre o correo"></div><button id="search-users" class="btn btn--secondary">Buscar</button></div><div id="users-table">${usersTable(users)}</div>`,
    "Usuarios",
  );
  document.querySelector("#search-users").onclick = async () => {
    const q = document.querySelector("#user-search").value;
    const data = await api(`/api/admin/users?search=${encodeURIComponent(q)}`);
    document.querySelector("#users-table").innerHTML = usersTable(data.users);
  };
}
function usersTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Matrículas</th><th>Pagos</th><th>Alta</th></tr></thead><tbody>${rows.map((u) => `<tr><td><strong>${esc(u.name)}</strong><br><span class="muted">${esc(u.email)}</span></td><td>${badge(u.role, u.role === "admin" ? "primary" : "neutral")}</td><td>${u.enrollments}</td><td>${u.payments}</td><td>${date(u.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function payments() {
  shell("pagos", loading(), "Pagos");
  const { payments: rows } = await api("/api/admin/payments");
  renderPayments(rows);
}
function renderPayments(rows) {
  shell(
    "pagos",
    `<div class="toolbar"><div class="field"><label for="payment-status">Estado</label><select id="payment-status"><option value="">Todos</option><option value="pending">Pendientes</option><option value="approved">Aprobados</option><option value="rejected">Rechazados</option></select></div><div class="field"><label for="payment-search">Buscar</label><input id="payment-search" placeholder="Alumno, curso o referencia"></div><button id="filter-payments" class="btn btn--secondary">Filtrar</button></div><div class="table-wrap"><table><thead><tr><th>Alumno / Curso</th><th>Referencia</th><th>Monto</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr></thead><tbody>${rows.map((p) => `<tr><td><strong>${esc(p.user_name)}</strong><br><span class="muted">${esc(p.user_email)} · ${esc(p.course_name)}</span></td><td>${esc(p.reference)}</td><td>${money(p.amount)}<br><span class="muted">${Number(p.amount_bs || 0).toFixed(2)} Bs</span></td><td>${statusBadge(p.status)}${p.rejection_reason ? `<br><small>${esc(p.rejection_reason)}</small>` : ""}</td><td>${p.receipt_url ? `<a class="text-link" href="${esc(p.receipt_url)}" target="_blank">Ver archivo</a>` : "—"}</td><td>${p.status === "pending" ? `<div class="cluster"><button class="btn btn--small" data-approve="${p.id}">Aprobar</button><button class="btn btn--small btn--secondary" data-reject="${p.id}">Rechazar</button></div>` : "—"}</td></tr>`).join("")}</tbody></table></div>`,
    "Pagos",
  );
  document.querySelector("#filter-payments").onclick = async () => {
    const status = document.querySelector("#payment-status").value;
    const search = document.querySelector("#payment-search").value;
    const data = await api(
      `/api/admin/payments?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`,
    );
    renderPayments(data.payments);
  };
  document.querySelectorAll("[data-approve]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("¿Aprobar este pago y crear la matrícula?")) return;
        try {
          await api(`/api/admin/payments/${b.dataset.approve}/approve`, {
            method: "POST",
            body: {},
          });
          toast("Pago aprobado.", "success");
          payments();
        } catch (err) {
          toast(err.message, "error");
        }
      }),
  );
  document.querySelectorAll("[data-reject]").forEach(
    (b) =>
      (b.onclick = async () => {
        const reason = prompt("Motivo del rechazo:");
        if (!reason) return;
        try {
          await api(`/api/admin/payments/${b.dataset.reject}/reject`, {
            method: "POST",
            body: { reason },
          });
          toast("Pago rechazado.", "success");
          payments();
        } catch (err) {
          toast(err.message, "error");
        }
      }),
  );
}

async function courses() {
  shell(
    "cursos",
    loading(),
    "Cursos",
    '<button id="new-course" class="btn">Nuevo curso</button>',
  );
  const { courses: rows } = await api("/api/admin/courses");
  shell(
    "cursos",
    `<div class="table-wrap"><table><thead><tr><th>Curso</th><th>Precio</th><th>Estado</th><th>Destacado</th><th>Clases</th><th>Acciones</th></tr></thead><tbody>${rows.map((c) => `<tr><td><strong>${esc(c.name)}</strong><br><span class="muted">/${esc(c.slug)} · ${esc(c.category)}</span></td><td>${money(c.price)}</td><td>${badge(c.status, c.status === "published" ? "success" : c.status === "draft" ? "warning" : "neutral")}</td><td>${c.featured ? "Sí" : "No"}</td><td>${c.lesson_count}</td><td><div class="cluster"><button class="btn btn--small btn--secondary" data-edit-course="${c.id}">Editar</button><button class="btn btn--small btn--secondary" data-lessons="${c.id}">Clases</button>${c.status !== "archived" ? `<button class="btn btn--small btn--danger" data-archive="${c.id}">Archivar</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`,
    "Cursos y clases",
    '<button id="new-course" class="btn">Nuevo curso</button>',
  );
  document.querySelector("#new-course").onclick = () => courseModal();
  document
    .querySelectorAll("[data-edit-course]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          courseModal(rows.find((c) => c.id === Number(b.dataset.editCourse)))),
    );
  document
    .querySelectorAll("[data-lessons]")
    .forEach(
      (b) => (b.onclick = () => lessonsModal(Number(b.dataset.lessons))),
    );
  document.querySelectorAll("[data-archive]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("¿Archivar este curso?")) return;
        await api(`/api/admin/courses/${b.dataset.archive}`, {
          method: "DELETE",
        });
        toast("Curso archivado.", "success");
        courses();
      }),
  );
}
function courseModal(course = {}) {
  const isEdit = Boolean(course.id);
  const m = modal(
    isEdit ? "Editar curso" : "Nuevo curso",
    `<form id="course-form" class="stack"><div class="form-grid"><div class="field"><label>Nombre</label><input name="name" value="${esc(course.name || "")}" required></div><div class="field"><label>Slug</label><input name="slug" value="${esc(course.slug || "")}"></div><div class="field"><label>Precio USD</label><input name="price_usd" type="number" min="0" step="0.01" value="${esc(course.price ?? 30)}" required></div><div class="field"><label>Duración (horas)</label><input name="duration_hours" type="number" min="0" step="0.5" value="${esc(course.duration_hours ?? 0)}"></div><div class="field"><label>Categoría</label><input name="category" value="${esc(course.category || "General")}"></div><div class="field"><label>Nivel</label><input name="level" value="${esc(course.level || "Todos")}"></div><div class="field"><label>Estado</label><select name="status"><option value="draft" ${course.status === "draft" ? "selected" : ""}>Borrador</option><option value="published" ${course.status === "published" ? "selected" : ""}>Publicado</option><option value="archived" ${course.status === "archived" ? "selected" : ""}>Archivado</option></select></div><div class="field"><label>Destacado</label><select name="featured"><option value="0">No</option><option value="1" ${course.featured ? "selected" : ""}>Sí</option></select></div></div><div class="field"><label>Descripción corta</label><textarea name="description">${esc(course.description || "")}</textarea></div><div class="field"><label>Descripción completa</label><textarea name="long_description">${esc(course.long_description || "")}</textarea></div><div class="field"><label>Imagen de portada (URL o subida)</label><div class="cluster"><input name="cover_image_url" value="${esc(course.cover_image_url || "")}" style="flex:1"><input id="course-image" type="file" accept="image/png,image/jpeg,image/webp"></div></div><div class="field"><label>Vídeo promocional</label><input name="promo_video_url" value="${esc(course.promo_video_url || "")}"></div><div class="form-grid"><div class="field"><label>Título SEO</label><input name="seo_title" value="${esc(course.seo_title || "")}"></div><div class="field"><label>Descripción SEO</label><input name="seo_description" value="${esc(course.seo_description || "")}"></div></div><button class="btn" type="submit">Guardar curso</button></form>`,
  );
  const form = m.root.querySelector("#course-form");
  m.root.querySelector("#course-image").onchange = async (e) => {
    if (!e.target.files[0]) return;
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    try {
      const r = await api("/api/admin/upload/image", {
        method: "POST",
        body: fd,
      });
      form.cover_image_url.value = r.url;
      toast("Imagen subida.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    try {
      await api(
        isEdit ? `/api/admin/courses/${course.id}` : "/api/admin/courses",
        { method: isEdit ? "PUT" : "POST", body },
      );
      m.close();
      toast("Curso guardado.", "success");
      courses();
    } catch (err) {
      toast(err.message, "error");
    }
  };
}
async function lessonsModal(courseId) {
  const data = await api(`/api/admin/courses/${courseId}/lessons`);
  const m = modal(
    `Clases · ${data.course.name}`,
    `<div class="stack"><button id="add-lesson" class="btn">Nueva clase</button><div id="lesson-list">${data.lessons.map((l, i) => `<div class="lesson-row"><div><strong>${i + 1}. ${esc(l.title)}</strong><p class="muted">${l.status === "draft" ? "Borrador" : "Publicada"} · ${l.is_free ? "Vista previa pública" : "Sólo matriculados"}${l.video_asset_id ? " · Vídeo propio" : ""}</p></div><div class="cluster"><button class="btn btn--small btn--secondary" data-move="${i}" data-direction="-1" aria-label="Subir ${esc(l.title)}" ${i === 0 ? "disabled" : ""}>↑</button><button class="btn btn--small btn--secondary" data-move="${i}" data-direction="1" aria-label="Bajar ${esc(l.title)}" ${i === data.lessons.length - 1 ? "disabled" : ""}>↓</button><button class="btn btn--small btn--secondary" data-edit="${l.id}">Editar</button><button class="btn btn--small btn--danger" data-delete="${l.id}">Eliminar</button></div></div>`).join("") || '<p class="muted">Añade la primera clase del curso.</p>'}</div></div>`,
  );
  m.root.querySelector("#add-lesson").onclick = () => {
    m.close();
    lessonEditor(courseId, { sort_order: data.lessons.length });
  };
  m.root.querySelectorAll("[data-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        m.close();
        lessonEditor(
          courseId,
          data.lessons.find((l) => l.id === Number(b.dataset.edit)),
        );
      }),
  );
  m.root.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("¿Eliminar esta clase y retirar sus materiales?")) return;
        try {
          await api(`/api/admin/lessons/${b.dataset.delete}`, {
            method: "DELETE",
          });
          m.close();
          toast("Clase eliminada.", "success");
          lessonsModal(courseId);
        } catch (e) {
          toast(e.message, "error");
        }
      }),
  );
  m.root.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = async () => {
        const ids = data.lessons.map((l) => l.id),
          i = Number(b.dataset.move),
          j = i + Number(b.dataset.direction);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        try {
          await api(`/api/admin/courses/${courseId}/lessons/reorder`, {
            method: "POST",
            body: { ids },
          });
          m.close();
          lessonsModal(courseId);
        } catch (e) {
          toast(e.message, "error");
        }
      }),
  );
}
async function lessonEditor(courseId, lesson = {}) {
  const cfg = await api("/api/admin/videos/config");
  const m = modal(
    lesson.id ? "Editar clase" : "Nueva clase",
    `<form id="lesson-form" class="stack"><div class="form-grid"><div class="field"><label>Título</label><input name="title" value="${esc(lesson.title || "")}" required></div><div class="field"><label>Orden</label><input name="sort_order" type="number" min="0" value="${lesson.sort_order || 0}"></div></div><div class="field"><label>Descripción</label><textarea name="description">${esc(lesson.description || "")}</textarea></div><div class="field"><label>Contenido</label><textarea name="content" rows="6">${esc(lesson.content || "")}</textarea></div><div class="form-grid"><div class="field"><label>Estado</label><select name="status"><option value="draft">Borrador</option><option value="published" ${lesson.status === "published" ? "selected" : ""}>Publicada</option></select></div><div class="field"><label>Acceso</label><select name="is_free"><option value="0">Sólo matriculados</option><option value="1" ${lesson.is_free ? "selected" : ""}>Vista previa pública</option></select></div></div><div class="field"><label>Fuente del vídeo</label><select id="video-source"><option value="url">Enlace externo</option><option value="upload" ${lesson.video_asset_id ? "selected" : ""}>Vídeo propio</option></select></div><div id="video-url-field" class="field"><label>URL de vídeo</label><input name="video_url" value="${esc(lesson.video_url || "")}" placeholder="https://www.youtube.com/watch?v=…"><small>Conserva esta opción para promociones y clases gratuitas.</small></div><section id="video-upload-field" class="stack video-upload-panel"><div class="field"><label>Vídeo propio</label><input id="video-file" type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"><small>Máximo ${(cfg.maxBytes / 1073741824).toFixed(1)} GB y ${(cfg.maxDuration / 3600).toFixed(1)} horas por archivo. Se prepara hasta ${cfg.heights.join("p / ")}p. Conserva tu original.</small></div><div class="cluster"><button type="button" id="upload-video" class="btn btn--secondary">Subir y preparar vídeo</button><button type="button" id="pause-video" class="btn btn--secondary" hidden>Pausar subida</button></div><progress id="video-progress" max="1" value="0" hidden></progress><p id="video-status" class="muted" role="status"></p><div class="field"><label>Vídeo preparado de esta clase</label><select id="video-asset"><option value="">Sin vídeo preparado</option></select></div><div id="video-assets"></div><button type="button" id="preview-video" class="btn btn--secondary" hidden>Previsualizar vídeo</button><div id="video-preview"></div><div class="field"><label>Subtítulos en español (opcional)</label><input id="video-captions" type="file" accept=".vtt,text/vtt"><small>Archivo WebVTT. Se aplica al vídeo preparado seleccionado.</small></div><p class="muted">Almacenamiento reservado: ${(cfg.usedBytes / 1073741824).toFixed(2)} de ${(cfg.storageBytes / 1073741824).toFixed(1)} GB.</p></section><div class="field"><label>URL de imagen</label><input name="image_url" value="${esc(lesson.image_url || "")}"></div><input name="pdf_media_id" type="hidden" value="${lesson.pdf_media_id || ""}"><div class="field"><label>Material PDF</label><input id="lesson-pdf" type="file" accept="application/pdf"><small>${lesson.pdf_media_id ? "Hay un PDF asociado. Selecciona otro para reemplazarlo." : "Opcional."}</small></div><button id="save-lesson" class="btn" type="submit">Guardar clase</button><p class="muted">Publica cuando el contenido esté listo. Para reemplazar un vídeo, guarda primero la clase como borrador.</p></form>`,
  );
  const form = m.root.querySelector("#lesson-form"),
    source = form.querySelector("#video-source"),
    assetSelect = form.querySelector("#video-asset"),
    status = form.querySelector("#video-status");
  let busy = false,
    controller,
    poller,
    lastAssets = [],
    selected = lesson.video_asset_id || "";
  const visible = () => {
    form.querySelector("#video-url-field").hidden = source.value !== "url";
    form.querySelector("#video-upload-field").hidden =
      source.value !== "upload";
  };
  visible();
  source.onchange = visible;
  const controls = (active) => {
    busy = active;
    form.querySelector("#save-lesson").disabled = active;
    form.querySelector("#upload-video").disabled = active;
    form.querySelector("#pause-video").hidden = !active;
  };
  const connected = () => form.isConnected;
  const refresh = async () => {
    if (!lesson.id || !connected()) return;
    const data = await api(`/api/admin/lessons/${lesson.id}/videos`);
    if (!connected()) return;
    lastAssets = data.videos;
    const current = assetSelect.value || selected;
    assetSelect.innerHTML =
      '<option value="">Sin vídeo preparado</option>' +
      lastAssets
        .filter((v) => v.state === "ready")
        .map(
          (v) =>
            `<option value="${v.id}">${esc(v.originalName)} · ${Math.round(v.duration)} s</option>`,
        )
        .join("");
    assetSelect.value = current;
    form.querySelector("#video-assets").innerHTML = lastAssets
      .map(
        (v) =>
          `<div class="video-asset"><span>${esc(v.originalName)} · ${{ uploading: "Subida pendiente", queued: "En espera", processing: "Preparando", ready: "Listo", failed: "Error" }[v.state]}${v.error ? `<br>${esc(v.error)}` : ""}</span>${!["queued", "processing"].includes(v.state) && v.id !== lesson.video_asset_id ? `<button class="btn btn--small btn--danger" type="button" data-remove-video="${v.id}">Retirar</button>` : ""}</div>`,
      )
      .join("");
    if (!assetSelect.value && lastAssets.some((v) => v.state === "ready")) {
      assetSelect.value = lastAssets.find((v) => v.state === "ready").id;
      selected = assetSelect.value;
    }
    form.querySelector("#preview-video").hidden = !assetSelect.value;
    form.querySelectorAll("[data-remove-video]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await api(`/api/admin/videos/uploads/${b.dataset.removeVideo}`, {
              method: "DELETE",
            });
            if (selected === b.dataset.removeVideo) selected = "";
            await refresh();
          } catch (e) {
            toast(e.message, "error");
          }
        }),
    );
    if (lastAssets.some((v) => ["queued", "processing"].includes(v.state))) {
      clearTimeout(poller);
      poller = setTimeout(() => refresh().catch(() => {}), 2000);
    }
  };
  assetSelect.onchange = () => {
    selected = assetSelect.value;
    form.querySelector("#preview-video").hidden = !selected;
    form.querySelector("#video-preview").innerHTML = "";
  };
  form.querySelector("#preview-video").onclick = () => {
    const v = lastAssets.find((v) => v.id === assetSelect.value);
    if (!v) return;
    const root = form.querySelector("#video-preview");
    root.innerHTML = videoMarkup({
      id: lesson.id,
      title: lesson.title,
      video: { url: `/api/admin/video-preview/${v.id}/master.m3u8` },
    });
    mountPlayers(root);
  };
  const saveDraft = async () => {
    const body = Object.fromEntries(new FormData(form));
    body.status = "draft";
    body.video_asset_id =
      source.value === "upload"
        ? assetSelect.value || lesson.video_asset_id || null
        : null;
    const saved = await api(
      lesson.id
        ? `/api/admin/lessons/${lesson.id}`
        : `/api/admin/courses/${courseId}/lessons`,
      { method: lesson.id ? "PUT" : "POST", body },
    );
    lesson = saved.lesson;
    return lesson;
  };
  form.querySelector("#upload-video").onclick = async () => {
    const file = form.querySelector("#video-file").files[0];
    if (!file) {
      toast("Selecciona un vídeo.", "error");
      return;
    }
    if (file.size > cfg.maxBytes) {
      toast("El vídeo supera el tamaño permitido.", "error");
      return;
    }
    if (!form.reportValidity() || busy) return;
    controls(true);
    controller = new AbortController();
    form.querySelector("[name=status]").value = "draft";
    try {
      await saveDraft();
      source.value = "upload";
      visible();
      const bar = form.querySelector("#video-progress");
      bar.hidden = false;
      status.textContent = "Subiendo vídeo…";
      const result = await uploadVideo(lesson.id, file, {
        signal: controller.signal,
        onProgress: (p) => {
          bar.value = p;
          status.textContent = `Subiendo vídeo… ${Math.round(p * 100)} %`;
        },
      });
      selected = result.id;
      status.textContent =
        "Subida terminada. El vídeo se está preparando; puedes volver más tarde.";
      form.querySelector("#video-file").value = "";
      await refresh();
    } catch (e) {
      if (connected()) {
        status.textContent = e.message;
        await refresh().catch(() => {});
      }
    } finally {
      if (connected()) controls(false);
    }
  };
  form.querySelector("#pause-video").onclick = () => controller?.abort();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    controls(true);
    const desired = form.querySelector("[name=status]").value;
    try {
      if (
        source.value === "upload" &&
        form.querySelector("#video-file").files[0]
      )
        throw new Error("Sube y prepara el vídeo antes de publicar o guardar.");
      if (
        source.value === "upload" &&
        desired === "published" &&
        !assetSelect.value
      )
        throw new Error("Selecciona un vídeo preparado antes de publicar.");
      await saveDraft();
      const pdf = form.querySelector("#lesson-pdf").files[0];
      if (pdf) {
        const fd = new FormData();
        fd.append("file", pdf);
        const saved = await api(`/api/admin/upload/pdf/${lesson.id}`, {
          method: "POST",
          body: fd,
        });
        lesson.pdf_media_id = saved.id;
        form.querySelector("[name=pdf_media_id]").value = saved.id;
        form.querySelector("#lesson-pdf").value = "";
      }
      const captions = form.querySelector("#video-captions").files[0];
      if (captions) {
        if (!assetSelect.value)
          throw new Error("Selecciona un vídeo listo para añadir subtítulos.");
        await api(`/api/admin/videos/${assetSelect.value}/captions`, {
          method: "PUT",
          body: await captions.text(),
          headers: { "Content-Type": "text/vtt" },
        });
      }
      const body = Object.fromEntries(new FormData(form));
      body.status = desired;
      body.video_asset_id =
        source.value === "upload" ? assetSelect.value || null : null;
      await api(`/api/admin/lessons/${lesson.id}`, { method: "PUT", body });
      m.close();
      toast(
        desired === "published" ? "Clase publicada." : "Borrador guardado.",
        "success",
      );
      lessonsModal(courseId);
    } catch (e) {
      toast(
        `${e.message}${lesson.id ? " La clase se conserva como borrador." : ""}`,
        "error",
      );
    } finally {
      if (connected()) controls(false);
    }
  };
  new MutationObserver((_, observer) => {
    if (!connected()) {
      controller?.abort();
      clearTimeout(poller);
      observer.disconnect();
    }
  }).observe(m.root, { childList: true, subtree: true });
  await refresh();
}

async function cms() {
  shell("cms", loading(), "Páginas / CMS");
  const { courses: previewCourses } = await api("/api/courses");
  let data = await api("/api/admin/cms/home");
  if (!data.version || data.version.status !== "draft")
    data = await api("/api/admin/cms/home/draft", { method: "POST", body: {} });
  let sections = data.sections.map((s) => ({
    ...s,
    settings: { ...(s.settings || {}) },
  }));
  let selected = 0;
  const render = () => {
    shell(
      "cms",
      `<div class="toolbar"><button id="cms-add" class="btn btn--secondary">Añadir sección</button><button id="cms-preview" class="btn btn--secondary">Vista previa</button><button id="cms-save" class="btn">Guardar borrador</button><button id="cms-publish" class="btn">Publicar</button><span id="cms-status" class="muted" role="status">Borrador de trabajo</span></div><div class="cms-editor"><div class="cms-list" id="cms-list">${sections.map((s, i) => `<article class="cms-block ${i === selected ? "surface" : ""}" draggable="true" data-index="${i}"><div class="cms-block__handle" aria-hidden="true">⋮⋮</div><div class="cms-block__body"><strong>${esc(sectionLabel(s.section_type))}</strong><div class="muted">${esc(s.variant)} · ${s.enabled ? "Visible" : "Oculta"}</div></div><div class="cms-order"><button type="button" class="icon-btn" data-move="${i}" data-direction="-1" aria-label="Subir sección" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="icon-btn" data-move="${i}" data-direction="1" aria-label="Bajar sección" ${i === sections.length - 1 ? "disabled" : ""}>↓</button></div><button class="btn btn--small btn--secondary" data-select="${i}">Editar</button><button class="btn btn--small btn--danger" data-remove="${i}" aria-label="Eliminar">×</button></article>`).join("")}</div><aside class="cms-inspector panel">${sections[selected] ? inspector(sections[selected]) : '<p class="muted">Selecciona una sección.</p>'}</aside><section class="cms-live-preview panel"><div class="split"><div><div class="eyebrow">Vista de sección</div><h2>Así se verá</h2></div><span class="badge">Sin publicar</span></div><div id="cms-section-preview" class="cms-preview-canvas" inert></div><small class="muted">Referencia visual de la sección. La vista previa completa permite comprobar todos los anchos.</small></section></div>`,
      "CMS de Inicio",
    );
    bind();
    updatePreview();
  };
  const bind = () => {
    document.querySelectorAll("[data-move]").forEach(
      (b) =>
        (b.onclick = () => {
          const from = Number(b.dataset.move),
            to = from + Number(b.dataset.direction);
          const [item] = sections.splice(from, 1);
          sections.splice(to, 0, item);
          selected = to;
          render();
        }),
    );
    document.querySelectorAll("[data-select]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = Number(b.dataset.select);
          render();
        }),
    );
    document.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          sections.splice(Number(b.dataset.remove), 1);
          selected = Math.max(0, Math.min(selected, sections.length - 1));
          render();
        }),
    );
    document.querySelector("#cms-add").onclick = () => addSection();
    document.querySelector("#cms-save").onclick = () =>
      save().catch((err) => toast(err.message, "error"));
    document.querySelector("#cms-publish").onclick = publish;
    document.querySelector("#cms-preview").onclick = preview;
    bindInspector();
    bindDrag();
  };
  const updatePreview = () => {
    const preview = document.querySelector("#cms-section-preview");
    if (!preview) return;
    preview.innerHTML = sections[selected]
      ? renderSection(sections[selected], previewCourses)
      : '<p class="muted">Añade una sección para empezar.</p>';
  };
  const bindInspector = () => {
    const form = document.querySelector("#cms-inspector-form");
    if (!form) return;
    form.oninput = () => {
      const fd = new FormData(form);
      const s = sections[selected];
      s.variant = String(fd.get("variant"));
      s.enabled = fd.get("enabled") === "1";
      for (const [k, v] of fd.entries()) {
        if (["variant", "enabled"].includes(k)) continue;
        if (k.startsWith("settings.")) setNested(s.settings, k.slice(9), v);
      }
      document.querySelector("#cms-status").textContent = "Cambios sin guardar";
      updatePreview();
    };
    form.querySelectorAll("[data-color-target]").forEach(
      (picker) =>
        (picker.oninput = () => {
          form.elements[picker.dataset.colorTarget].value = picker.value;
          form.dispatchEvent(new Event("input"));
        }),
    );
    const upload = form.querySelector("[data-cms-image]");
    if (upload)
      upload.onchange = async () => {
        if (!upload.files[0]) return;
        const fd = new FormData();
        fd.append("file", upload.files[0]);
        upload.disabled = true;
        try {
          const result = await api("/api/admin/upload/image", {
            method: "POST",
            body: fd,
          });
          form.elements["settings.imageUrl"].value = result.url;
          form.dispatchEvent(new Event("input"));
          toast(
            "Imagen subida. Guarda el borrador para conservarla.",
            "success",
          );
        } catch (err) {
          toast(err.message, "error");
        } finally {
          upload.disabled = false;
        }
      };
  };
  const bindDrag = () => {
    let from = null;
    document.querySelectorAll(".cms-block").forEach((el) => {
      el.ondragstart = () => {
        from = Number(el.dataset.index);
        el.classList.add("dragging");
      };
      el.ondragend = () => el.classList.remove("dragging");
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => {
        e.preventDefault();
        const to = Number(el.dataset.index);
        if (from === null || from === to) return;
        const [item] = sections.splice(from, 1);
        sections.splice(to, 0, item);
        selected = to;
        render();
      };
    });
  };
  const save = async () => {
    try {
      const r = await api("/api/admin/cms/home/draft", {
        method: "PUT",
        body: {
          sections: sections.map((s, i) => ({
            section_key: s.section_key,
            section_type: s.section_type,
            variant: s.variant,
            enabled: s.enabled,
            settings: s.settings,
          })),
        },
      });
      sections = r.sections;
      toast("Borrador guardado.", "success");
      render();
    } catch (err) {
      throw err;
    }
  };
  const publish = async () => {
    if (!confirm("¿Publicar este borrador en el sitio?")) return;
    try {
      await save();
      await api("/api/admin/cms/home/publish", { method: "POST", body: {} });
      toast("Inicio publicado.", "success");
      location.reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };
  const preview = async () => {
    try {
      await save();
      window.open("/?preview=1", "_blank", "noopener");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  const addSection = () => {
    const m = modal(
      "Añadir sección",
      `<div class="field"><label for="new-section-type">Tipo</label><select id="new-section-type"><option value="hero">Hero</option><option value="featured_courses">Cursos destacados</option><option value="stats">Estadísticas</option><option value="process">Cómo funciona</option><option value="about">Nosotros</option><option value="locations">Sedes</option><option value="testimonials">Testimonios</option><option value="cta">CTA</option><option value="rich_text">Texto</option><option value="footer">Pie de página</option></select></div>`,
      `<button class="btn btn--secondary" data-modal-close2>Cancelar</button><button class="btn" id="confirm-section">Añadir</button>`,
    );
    m.root.querySelector("[data-modal-close2]").onclick = m.close;
    m.root.querySelector("#confirm-section").onclick = () => {
      const type = m.root.querySelector("#new-section-type").value;
      sections.push(defaultSection(type, sections.length));
      selected = sections.length - 1;
      m.close();
      render();
    };
  };
  render();
}
function sectionLabel(t) {
  return (
    {
      hero: "Hero",
      featured_courses: "Cursos destacados",
      stats: "Estadísticas",
      process: "Cómo funciona",
      about: "Nosotros",
      locations: "Sedes",
      testimonials: "Testimonios",
      cta: "Llamado a la acción",
      rich_text: "Texto",
      footer: "Pie de página",
    }[t] || t
  );
}
function variants(t) {
  return (
    {
      hero: ["split", "centered", "minimal"],
      featured_courses: ["cards", "compact", "horizontal"],
      stats: ["inline", "cards"],
      process: ["steps", "cards"],
      about: ["split", "centered"],
      locations: ["grid", "compact"],
      testimonials: ["cards", "slider"],
      cta: ["simple", "banner", "highlighted"],
      rich_text: ["default"],
      footer: ["columns", "minimal"],
    }[t] || ["default"]
  );
}
function inspector(s) {
  const fields = [];
  const add = (label, key, value, type = "text") =>
    fields.push(
      `<div class="field"><label>${esc(label)}</label>${type === "textarea" ? `<textarea name="settings.${esc(key)}">${esc(value || "")}</textarea>` : `<input name="settings.${esc(key)}" value="${esc(value || "")}">`}</div>`,
    );
  if (s.section_type === "hero") {
    add("Etiqueta", "badge", s.settings.badge);
    add("Título", "title", s.settings.title);
    add("Texto", "text", s.settings.text, "textarea");
    add("CTA principal", "primaryCta", s.settings.primaryCta);
    add("CTA secundario", "secondaryCta", s.settings.secondaryCta);
    add("Imagen", "imageUrl", s.settings.imageUrl);
  } else if (s.section_type === "featured_courses") {
    add("Etiqueta", "eyebrow", s.settings.eyebrow);
    add("Título", "title", s.settings.title);
    add("Límite", "limit", s.settings.limit || 9);
  } else if (s.section_type === "about") {
    add("Título", "title", s.settings.title);
    add("Texto", "text", s.settings.text, "textarea");
    add("Imagen", "imageUrl", s.settings.imageUrl);
  } else if (s.section_type === "locations") {
    add("Título", "title", s.settings.title);
    add("Texto", "text", s.settings.text, "textarea");
  } else if (s.section_type === "cta") {
    add("Título", "title", s.settings.title);
    add("Texto", "text", s.settings.text, "textarea");
    add("Botón", "buttonLabel", s.settings.buttonLabel);
    add("Enlace", "href", s.settings.href);
  } else if (["rich_text", "footer"].includes(s.section_type)) {
    add("Título", "title", s.settings.title);
    add("Texto", "text", s.settings.text, "textarea");
  } else if (s.section_type === "process") {
    add("Título", "title", s.settings.title);
    for (let i = 0; i < 3; i++) {
      add(
        `Paso ${i + 1}: título`,
        `steps.${i}.title`,
        s.settings.steps?.[i]?.title,
      );
      add(
        `Paso ${i + 1}: texto`,
        `steps.${i}.text`,
        s.settings.steps?.[i]?.text,
      );
    }
  } else if (s.section_type === "stats") {
    for (let i = 0; i < 3; i++) {
      add(
        `Dato ${i + 1}: valor`,
        `items.${i}.value`,
        s.settings.items?.[i]?.value,
      );
      add(
        `Dato ${i + 1}: etiqueta`,
        `items.${i}.label`,
        s.settings.items?.[i]?.label,
      );
    }
  } else if (s.section_type === "testimonials") {
    add("Título", "title", s.settings.title);
    add("Texto introductorio", "text", s.settings.text, "textarea");
    for (let i = 0; i < 3; i++) {
      add(
        `Testimonio ${i + 1}: nombre`,
        `items.${i}.name`,
        s.settings.items?.[i]?.name,
      );
      add(
        `Testimonio ${i + 1}: texto`,
        `items.${i}.quote`,
        s.settings.items?.[i]?.quote,
        "textarea",
      );
    }
  }
  return `<form id="cms-inspector-form" class="stack"><div class="field"><label>Variante</label><select name="variant">${variants(
    s.section_type,
  )
    .map(
      (v) => `<option ${v === s.variant ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join(
      "",
    )}</select></div><div class="form-grid"><div class="field"><label>Visible</label><select name="enabled"><option value="1" ${s.enabled ? "selected" : ""}>Sí</option><option value="0" ${!s.enabled ? "selected" : ""}>No</option></select></div><div class="field"><label>Espaciado</label><select name="settings.spacing"><option value="normal">Normal</option><option value="compact" ${s.settings.spacing === "compact" ? "selected" : ""}>Compacto</option><option value="spacious" ${s.settings.spacing === "spacious" ? "selected" : ""}>Amplio</option></select></div><div class="field"><label>Animación</label><select name="settings.animation"><option value="none">Ninguna</option><option value="fade-in" ${s.settings.animation === "fade-in" ? "selected" : ""}>Fade</option><option value="fade-up" ${s.settings.animation === "fade-up" ? "selected" : ""}>Fade + desplazamiento</option></select></div><div class="field"><label>Columnas</label><select name="settings.columns"><option value="">Automático</option>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${Number(s.settings.columns) === n ? "selected" : ""}>${n}</option>`).join("")}</select></div></div><div class="form-grid"><div class="field"><label>Alineación</label><select name="settings.alignment">${["left", "center", "right"].map((v) => `<option value="${v}" ${s.settings.alignment === v ? "selected" : ""}>${{ left: "Izquierda", center: "Centro", right: "Derecha" }[v]}</option>`).join("")}</select></div><div class="field"><label>Mostrar en móvil</label><select name="settings.mobileHidden"><option value="0" ${!s.settings.mobileHidden ? "selected" : ""}>Sí</option><option value="1" ${s.settings.mobileHidden ? "selected" : ""}>No</option></select></div></div><fieldset class="cms-color-fields"><legend>Colores de la sección</legend><small class="muted">Deja el campo vacío para heredar el diseño global.</small>${[
    ["backgroundColor", "Fondo"],
    ["textColor", "Texto"],
    ["accentColor", "Acento"],
  ]
    .map(
      ([key, label]) =>
        `<div class="field"><label>${label}</label><div class="color-control"><input name="settings.${key}" value="${esc(s.settings[key] || "")}" placeholder="Heredar diseño global" pattern="#[0-9a-fA-F]{6}"><input type="color" aria-label="Elegir ${label.toLowerCase()}" data-color-target="settings.${key}" value="${esc(s.settings[key] || "#ffffff")}"></div></div>`,
    )
    .join(
      "",
    )}</fieldset>${fields.join("")}${["hero", "about"].includes(s.section_type) ? '<div class="field"><label>Subir imagen de sección</label><input data-cms-image type="file" accept="image/png,image/jpeg,image/webp"><small>También puedes pegar una URL en Imagen.</small></div>' : ""}</form>`;
}
function setNested(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i],
      next = parts[i + 1];
    if (cur[p] == null) cur[p] = /^\d+$/.test(next) ? [] : {};
    cur = cur[p];
  }
  cur[parts.at(-1)] = value;
}
function defaultSection(type, index) {
  const defaults = {
    hero: {
      badge: "Formación online",
      title: "Nuevo hero",
      text: "Escribe aquí el mensaje principal.",
      primaryCta: "Ver cursos",
      secondaryCta: "Crear cuenta",
      imageUrl: "",
    },
    featured_courses: {
      eyebrow: "CATÁLOGO",
      title: "Cursos destacados",
      limit: 9,
    },
    stats: {
      items: [
        { value: "100%", label: "Online" },
        { value: "24/7", label: "Acceso" },
        { value: "A tu ritmo", label: "Aprendizaje" },
      ],
    },
    process: {
      title: "Cómo funciona",
      steps: [
        { title: "Paso 1", text: "" },
        { title: "Paso 2", text: "" },
        { title: "Paso 3", text: "" },
      ],
    },
    about: { title: "Nosotros", text: "", imageUrl: "" },
    locations: { title: "Nuestras sedes", text: "" },
    testimonials: {
      title: "Testimonios",
      text: "",
      items: [
        { name: "Alumno 1", quote: "" },
        { name: "Alumno 2", quote: "" },
        { name: "Alumno 3", quote: "" },
      ],
    },
    cta: {
      title: "Empieza hoy",
      text: "",
      buttonLabel: "Ver cursos",
      href: "/catalogo",
    },
    rich_text: { title: "", text: "" },
    footer: { title: "Tu próximo paso empieza aquí.", text: "" },
  };
  const settings = {
    ...(defaults[type] || {}),
    spacing: "normal",
    animation: "none",
  };
  return {
    section_key: `${type}-${Date.now()}-${index}`,
    section_type: type,
    variant: variants(type)[0],
    enabled: true,
    settings,
  };
}
function previewSettings(s) {
  const title = s.settings?.title || s.settings?.badge || "";
  const text = s.settings?.text || "";
  return `${title ? `<h3>${esc(title)}</h3>` : ""}${text ? `<p>${esc(text)}</p>` : ""}`;
}

async function locations() {
  shell("sedes", loading(), "Sedes");
  const { locations: rows } = await api("/api/admin/locations");
  const render = () => {
    shell(
      "sedes",
      `<div class="location-list">${rows.map((l) => `<article class="panel"><div class="split"><h3>${esc(l.name)}</h3>${badge(l.active ? "Activa" : "Oculta", l.active ? "success" : "neutral")}</div><p>${esc(l.address)}</p><p class="muted">${esc(l.description || "")}</p><div class="cluster"><button class="btn btn--small btn--secondary" data-location="${l.id}">Editar</button><button class="btn btn--small btn--danger" data-delete-location="${l.id}">Eliminar</button></div></article>`).join("") || "<p>No hay sedes.</p>"}</div>`,
      "Sedes",
      '<button id="new-location" class="btn">Nueva sede</button>',
    );
    document.querySelector("#new-location").onclick = () => locationModal();
    document
      .querySelectorAll("[data-location]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            locationModal(
              rows.find((x) => x.id === Number(b.dataset.location)),
            )),
      );
    document.querySelectorAll("[data-delete-location]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!confirm("¿Eliminar sede?")) return;
          await api(`/api/admin/locations/${b.dataset.deleteLocation}`, {
            method: "DELETE",
          });
          toast("Sede eliminada.", "success");
          locations();
        }),
    );
  };
  render();
}
function locationModal(loc = {}) {
  const edit = Boolean(loc.id);
  const m = modal(
    edit ? "Editar sede" : "Nueva sede",
    `<form id="location-form" class="stack"><div class="field"><label>Nombre</label><input name="name" value="${esc(loc.name || "")}" required></div><div class="field"><label>Dirección</label><input name="address" value="${esc(loc.address || "")}"></div><div class="field"><label>Descripción</label><textarea name="description">${esc(loc.description || "")}</textarea></div><div class="field"><label>Google Maps Embed URL o iframe</label><textarea name="map_embed_url">${esc(loc.map_embed_url || "")}</textarea></div><div class="form-grid"><div class="field"><label>Visible</label><select name="active"><option value="1" ${loc.active !== 0 ? "selected" : ""}>Sí</option><option value="0" ${loc.active === 0 ? "selected" : ""}>No</option></select></div><div class="field"><label>Orden</label><input name="sort_order" type="number" value="${esc(loc.sort_order ?? 0)}"></div></div><button class="btn" type="submit">Guardar sede</button></form>`,
  );
  m.root.querySelector("#location-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api(
        edit ? `/api/admin/locations/${loc.id}` : "/api/admin/locations",
        {
          method: edit ? "PUT" : "POST",
          body: Object.fromEntries(new FormData(e.currentTarget)),
        },
      );
      m.close();
      toast("Sede guardada.", "success");
      locations();
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

async function coupons() {
  shell("cupones", loading(), "Cupones");
  const { coupons: rows } = await api("/api/admin/coupons");
  shell(
    "cupones",
    `<div class="table-wrap"><table><thead><tr><th>Código</th><th>Descuento</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr><td><strong>${esc(c.code)}</strong></td><td>${c.discount_type === "percent" ? `${c.discount_value}%` : money(c.discount_value)}</td><td>${c.uses_count}${c.max_uses != null ? ` / ${c.max_uses}` : ""}</td><td>${c.expires_at ? date(c.expires_at) : "—"}</td><td>${badge(c.active ? "Activo" : "Inactivo", c.active ? "success" : "neutral")}</td><td><button class="btn btn--small btn--secondary" data-toggle-coupon="${c.id}" data-active="${c.active ? 0 : 1}">${c.active ? "Desactivar" : "Activar"}</button></td></tr>`).join("")}</tbody></table></div>`,
    "Cupones",
    '<button id="new-coupon" class="btn">Nuevo cupón</button>',
  );
  document.querySelector("#new-coupon").onclick = () => {
    const m = modal(
      "Nuevo cupón",
      `<form id="coupon-form" class="stack"><div class="field"><label>Código</label><input name="code" required></div><div class="form-grid"><div class="field"><label>Tipo</label><select name="discount_type"><option value="percent">Porcentaje</option><option value="fixed">Monto fijo USD</option></select></div><div class="field"><label>Valor</label><input name="discount_value" type="number" step="0.01" min="0.01" required></div><div class="field"><label>Máximo de usos</label><input name="max_uses" type="number" min="1"></div><div class="field"><label>Vencimiento</label><input name="expires_at" type="date"></div></div><button class="btn">Crear cupón</button></form>`,
    );
    m.root.querySelector("#coupon-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/api/admin/coupons", {
          method: "POST",
          body: Object.fromEntries(new FormData(e.currentTarget)),
        });
        m.close();
        toast("Cupón creado.", "success");
        coupons();
      } catch (err) {
        toast(err.message, "error");
      }
    };
  };
  document.querySelectorAll("[data-toggle-coupon]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api(`/api/admin/coupons/${b.dataset.toggleCoupon}`, {
          method: "PUT",
          body: { active: b.dataset.active },
        });
        coupons();
      }),
  );
}

const certificatePreviewData = {
  front: {
    student_name: "María Fernanda Rojas",
    course_name: "Marketing Digital Estratégico",
    duration: "40 horas",
    date: "03/10/2026",
    code: "AVE-DEMO-2026-001",
  },
  back: {
    content:
      "1. Introducción y fundamentos\n2. Estrategia y herramientas principales\n3. Aplicaciones prácticas\n4. Proyecto final y buenas prácticas",
    duration: "40 horas",
    code: "AVE-DEMO-2026-001",
  },
};

function certificateFieldOptions(layout, side) {
  return Object.entries(layout[side] || {})
    .map(
      ([key, field]) =>
        `<option value="${esc(key)}">${esc(field.label || key)}</option>`,
    )
    .join("");
}
function certificateFieldStyle(field, stageWidth) {
  const scale = (stageWidth || 841.89) / 841.89;
  return `left:${Number(field.x)}%;top:${Number(field.y)}%;width:${Number(field.width)}%;height:${Number(field.height)}%;font-size:${Number(field.size) * scale}px;color:${esc(field.color)};text-align:${esc(field.align)};font-weight:${["bold", "boldItalic"].includes(field.style) ? "700" : "400"};font-style:${["italic", "boldItalic"].includes(field.style) ? "italic" : "normal"};`;
}

async function certificates() {
  shell("certificados", loading(), "Certificados");
  let certPayload;
  try {
    certPayload = await api("/api/admin/certificates/layout");
  } catch (err) {
    if (err.status === 404) {
      throw new Error(
        "El backend de certificados no está actualizado. Aplica el hotfix v5.0.3.1 completo en la raíz del proyecto y reinicia npm start.",
      );
    }
    throw err;
  }
  const [{ settings: s }, { layout: serverLayout, defaults }] =
    await Promise.all([
      api("/api/admin/settings"),
      Promise.resolve(certPayload),
    ]);
  let layout = structuredClone(serverLayout);
  let currentSide = "front";
  let selectedField = "student_name";

  shell(
    "certificados",
    `<div class="certificate-workspace">
    <section class="panel stack certificate-template-panel">
      <div><h2>Plantillas</h2><p class="muted">Sube el diseño limpio de frente y reverso. AcademiaVE sólo superpone los datos variables.</p></div>
      <form id="certificate-template-settings" class="stack">
        <div class="field"><label>Plantilla frontal</label><input name="certificate_front_url" value="${esc(s.certificate_front_url || "")}"><input id="front-file" type="file" accept="image/png,image/jpeg"><small>PNG o JPG. Recomendado: relación A4 horizontal (1.414:1).</small></div>
        <div class="field"><label>Plantilla trasera</label><input name="certificate_back_url" value="${esc(s.certificate_back_url || "")}"><input id="back-file" type="file" accept="image/png,image/jpeg"><small>Usa la misma proporción que el frente para evitar recortes.</small></div>
        <button class="btn btn--secondary" type="submit">Guardar URLs</button>
      </form>
      <div class="callout"><strong>Importante</strong><p>Los textos fijos como “Otorgado a”, “Duración” o “Contenido” pueden formar parte de tu diseño. Los campos configurables deben dejarse libres para que la plataforma escriba encima.</p></div>
    </section>

    <section class="panel stack certificate-editor-panel">
      <div class="split certificate-editor-head"><div><h2>Editor de posiciones</h2><p class="muted">Arrastra cada campo sobre la plantilla o ajusta sus valores. Las coordenadas son porcentajes, por lo que se conservan aunque cambie la resolución de la imagen.</p></div><div class="cluster"><button type="button" class="btn btn--small" data-cert-side="front">Frente</button><button type="button" class="btn btn--small btn--secondary" data-cert-side="back">Reverso</button></div></div>
      <div id="certificate-stage" class="certificate-stage" aria-label="Vista previa del certificado"><img id="certificate-stage-image" alt="Plantilla del certificado"><div id="certificate-stage-fields"></div></div>
      <p class="certificate-stage-hint">Selecciona o arrastra un campo. La vista usa datos ficticios; los certificados reales toman automáticamente los datos del alumno y del curso.</p>

      <div class="certificate-field-editor">
        <div class="field"><label for="certificate-field-select">Campo</label><select id="certificate-field-select">${certificateFieldOptions(layout, currentSide)}</select></div>
        <label class="check"><input id="certificate-field-enabled" type="checkbox"> Mostrar campo</label>
        <div class="certificate-position-grid">
          <div class="field"><label>X (%)</label><input id="certificate-field-x" type="number" min="0" max="100" step="0.1"></div>
          <div class="field"><label>Y (%)</label><input id="certificate-field-y" type="number" min="0" max="100" step="0.1"></div>
          <div class="field"><label>Ancho (%)</label><input id="certificate-field-width" type="number" min="5" max="100" step="0.1"></div>
          <div class="field"><label>Alto (%)</label><input id="certificate-field-height" type="number" min="3" max="90" step="0.1"></div>
          <div class="field"><label>Tamaño</label><input id="certificate-field-size" type="number" min="7" max="60" step="0.5"></div>
          <div class="field"><label>Color</label><input id="certificate-field-color" type="color"></div>
          <div class="field"><label>Alineación</label><select id="certificate-field-align"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></div>
          <div class="field"><label>Estilo</label><select id="certificate-field-style"><option value="regular">Normal</option><option value="bold">Negrita</option><option value="italic">Cursiva</option><option value="boldItalic">Negrita y cursiva</option></select></div>
        </div>
      </div>
      <div class="cluster certificate-editor-actions"><button id="save-certificate-layout" class="btn" type="button">Guardar posiciones</button><button id="certificate-pdf-preview" class="btn btn--secondary" type="button">Ver PDF de prueba</button><button id="reset-certificate-layout" class="btn btn--secondary" type="button">Restaurar recomendados</button></div>
    </section>
  </div>`,
    "Certificados",
  );

  const stage = document.querySelector("#certificate-stage");
  const stageImage = document.querySelector("#certificate-stage-image");
  const stageFields = document.querySelector("#certificate-stage-fields");
  const fieldSelect = document.querySelector("#certificate-field-select");
  const controls = {
    enabled: document.querySelector("#certificate-field-enabled"),
    x: document.querySelector("#certificate-field-x"),
    y: document.querySelector("#certificate-field-y"),
    width: document.querySelector("#certificate-field-width"),
    height: document.querySelector("#certificate-field-height"),
    size: document.querySelector("#certificate-field-size"),
    color: document.querySelector("#certificate-field-color"),
    align: document.querySelector("#certificate-field-align"),
    style: document.querySelector("#certificate-field-style"),
  };

  const templateUrl = () =>
    currentSide === "front"
      ? document.querySelector('[name="certificate_front_url"]').value
      : document.querySelector('[name="certificate_back_url"]').value;
  const currentField = () => layout[currentSide][selectedField];
  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, Number(value) || 0));

  function syncControls() {
    const f = currentField();
    if (!f) return;
    controls.enabled.checked = Boolean(f.enabled);
    for (const key of ["x", "y", "width", "height", "size"])
      controls[key].value = Math.round(Number(f[key]) * 100) / 100;
    controls.color.value = f.color;
    controls.align.value = f.align;
    controls.style.value = f.style;
  }
  function renderStage() {
    const url = templateUrl();
    if (url) {
      stageImage.src = url;
      stageImage.hidden = false;
    } else {
      stageImage.removeAttribute("src");
      stageImage.hidden = true;
    }
    const side = layout[currentSide];
    const width = stage.clientWidth || 842;
    stageFields.innerHTML = Object.entries(side)
      .map(([key, field]) => {
        if (!field.enabled) return "";
        const value = certificatePreviewData[currentSide][key] || field.label;
        return `<div class="certificate-preview-field ${key === "content" ? "certificate-preview-field--content" : ""} ${key === selectedField ? "is-selected" : ""}" tabindex="0" role="button" aria-label="${esc(field.label)}" data-cert-field="${esc(key)}" style="${certificateFieldStyle(field, width)}"><span>${esc(value)}</span></div>`;
      })
      .join("");
    stageFields.querySelectorAll("[data-cert-field]").forEach((node) => {
      node.addEventListener("keydown", (event) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        selectedField = node.dataset.certField;
        fieldSelect.value = selectedField;
        const f = currentField(),
          step = event.shiftKey ? 1 : 0.1;
        f.x = clamp(
          f.x +
            (event.key === "ArrowRight"
              ? step
              : event.key === "ArrowLeft"
                ? -step
                : 0),
          0,
          100 - f.width,
        );
        f.y = clamp(
          f.y +
            (event.key === "ArrowDown"
              ? step
              : event.key === "ArrowUp"
                ? -step
                : 0),
          0,
          100 - f.height,
        );
        syncControls();
        renderStage();
        stageFields
          .querySelector(`[data-cert-field="${selectedField}"]`)
          ?.focus();
      });
      node.addEventListener("click", () => {
        selectedField = node.dataset.certField;
        fieldSelect.value = selectedField;
        syncControls();
        renderStage();
      });
      node.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        selectedField = node.dataset.certField;
        fieldSelect.value = selectedField;
        syncControls();
        renderStage();
        const field = currentField();
        const rect = stage.getBoundingClientRect();
        const startX = event.clientX,
          startY = event.clientY,
          startFieldX = Number(field.x),
          startFieldY = Number(field.y);
        const move = (e) => {
          field.x = clamp(
            startFieldX + ((e.clientX - startX) / rect.width) * 100,
            0,
            100 - Number(field.width),
          );
          field.y = clamp(
            startFieldY + ((e.clientY - startY) / rect.height) * 100,
            0,
            100 - Number(field.height),
          );
          syncControls();
          renderStage();
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
        window.addEventListener("pointercancel", up, { once: true });
      });
    });
  }
  function setSide(side) {
    currentSide = side;
    selectedField = Object.keys(layout[side])[0];
    fieldSelect.innerHTML = certificateFieldOptions(layout, side);
    fieldSelect.value = selectedField;
    document
      .querySelectorAll("[data-cert-side]")
      .forEach((btn) =>
        btn.classList.toggle("btn--secondary", btn.dataset.certSide !== side),
      );
    syncControls();
    renderStage();
  }
  function updateFromControls() {
    const f = currentField();
    if (!f) return;
    f.enabled = controls.enabled.checked;
    f.width = clamp(controls.width.value, 5, 100);
    f.height = clamp(controls.height.value, 3, 90);
    f.x = clamp(controls.x.value, 0, 100 - f.width);
    f.y = clamp(controls.y.value, 0, 100 - f.height);
    f.size = clamp(controls.size.value, 7, 60);
    f.color = controls.color.value;
    f.align = controls.align.value;
    f.style = controls.style.value;
    renderStage();
  }
  async function saveLayout() {
    const r = await api("/api/admin/certificates/layout", {
      method: "PUT",
      body: { layout },
    });
    layout = structuredClone(r.layout);
    syncControls();
    renderStage();
    toast("Posiciones del certificado guardadas.", "success");
  }

  document
    .querySelectorAll("[data-cert-side]")
    .forEach((btn) => (btn.onclick = () => setSide(btn.dataset.certSide)));
  fieldSelect.onchange = () => {
    selectedField = fieldSelect.value;
    syncControls();
    renderStage();
  };
  Object.values(controls).forEach((control) =>
    control.addEventListener(
      control.type === "checkbox" ? "change" : "input",
      updateFromControls,
    ),
  );
  controls.align.addEventListener("change", updateFromControls);
  controls.style.addEventListener("change", updateFromControls);
  document.querySelector("#save-certificate-layout").onclick = async () => {
    try {
      await saveLayout();
    } catch (err) {
      toast(err.message, "error");
    }
  };
  document.querySelector("#reset-certificate-layout").onclick = async () => {
    if (
      !confirm(
        "¿Restaurar las posiciones recomendadas? No cambia tus imágenes.",
      )
    )
      return;
    try {
      const r = await api("/api/admin/certificates/layout/reset", {
        method: "POST",
        body: {},
      });
      layout = structuredClone(r.layout || defaults);
      setSide(currentSide);
      toast("Posiciones restauradas.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  document.querySelector("#certificate-pdf-preview").onclick = async () => {
    const tab = window.open("about:blank", "_blank");
    try {
      await saveLayout();
      if (tab)
        tab.location = `/api/admin/certificates/preview.pdf?t=${Date.now()}`;
      else location.assign("/api/admin/certificates/preview.pdf");
    } catch (err) {
      if (tab) tab.close();
      toast(err.message, "error");
    }
  };

  const templateForm = document.querySelector("#certificate-template-settings");
  templateForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/admin/settings", {
        method: "PUT",
        body: {
          certificate_front_url:
            templateForm.elements.certificate_front_url.value,
          certificate_back_url:
            templateForm.elements.certificate_back_url.value,
        },
      });
      if (r.settings) {
        s.certificate_front_url = r.settings.certificate_front_url;
        s.certificate_back_url = r.settings.certificate_back_url;
      }
      renderStage();
      toast("Plantillas guardadas.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  for (const side of ["front", "back"])
    document.querySelector(`#${side}-file`).onchange = async (e) => {
      if (!e.target.files[0]) return;
      const fd = new FormData();
      fd.append("file", e.target.files[0]);
      try {
        const r = await api(`/api/admin/certificates/template/${side}`, {
          method: "POST",
          body: fd,
        });
        templateForm.elements[
          side === "front" ? "certificate_front_url" : "certificate_back_url"
        ].value = r.url;
        s[side === "front" ? "certificate_front_url" : "certificate_back_url"] =
          r.url;
        if (currentSide === side) renderStage();
        toast(
          "Plantilla subida. Ahora ajusta las posiciones sobre la vista previa.",
          "success",
        );
      } catch (err) {
        toast(err.message, "error");
      }
    };

  syncControls();
  renderStage();
  const observer = new ResizeObserver(() => {
    if (stage.isConnected) renderStage();
    else observer.disconnect();
  });
  observer.observe(stage);
}

async function settings() {
  shell("configuracion", loading(), "Configuración");
  const [{ settings: s }, { items }] = await Promise.all([
    api("/api/admin/settings"),
    api("/api/admin/navigation"),
  ]);
  shell(
    "configuracion",
    `<div class="dashboard-grid"><form id="general-settings" class="panel stack"><h2>Marca y contacto</h2><div class="field"><label>Nombre</label><input name="academy_name" value="${esc(s.academy_name || "")}"></div><div class="field"><label>Tagline</label><input name="tagline" value="${esc(s.tagline || "")}"></div><div class="field"><label>Logo URL</label><input name="logo_url" value="${esc(s.logo_url || "")}"></div><div class="form-grid"><div class="field"><label>Correo</label><input name="support_email" value="${esc(s.support_email || "")}"></div><div class="field"><label>WhatsApp</label><input name="whatsapp" value="${esc(s.whatsapp || "")}"></div></div><div class="field"><label>Texto footer</label><textarea name="footer_text">${esc(s.footer_text || "")}</textarea></div><div class="field"><label>Copyright</label><input name="copyright_text" value="${esc(s.copyright_text || "")}"></div><div class="form-grid"><div class="field"><label>Etiqueta login</label><input name="login_label" value="${esc(s.login_label || "Entrar")}"></div><div class="field"><label>Etiqueta registro</label><input name="register_label" value="${esc(s.register_label || "Crear cuenta")}"></div></div><div class="field"><label>Política de privacidad</label><textarea name="privacy_text">${esc(s.privacy_text || "")}</textarea></div><div class="field"><label>Términos y condiciones</label><textarea name="terms_text">${esc(s.terms_text || "")}</textarea></div><div class="form-grid"><div class="field"><label>Instagram</label><input name="instagram_url" value="${esc(s.instagram_url || "")}"></div><div class="field"><label>Facebook</label><input name="facebook_url" value="${esc(s.facebook_url || "")}"></div><div class="field"><label>TikTok</label><input name="tiktok_url" value="${esc(s.tiktok_url || "")}"></div></div><h2>Pago Móvil</h2><div class="form-grid"><div class="field"><label>Banco</label><input name="payment_bank" value="${esc(s.payment_bank || "")}"></div><div class="field"><label>Teléfono</label><input name="payment_phone" value="${esc(s.payment_phone || "")}"></div><div class="field"><label>Cédula / RIF</label><input name="payment_document" value="${esc(s.payment_document || "")}"></div><div class="field"><label>Tasa Bs/USD</label><input name="exchange_rate" type="number" min="0.0001" step="0.0001" inputmode="decimal" required value="${esc(s.exchange_rate || 0)}"><small>Se usa al crear pagos nuevos. Los pagos ya registrados conservan su tasa histórica.</small></div></div><button class="btn">Guardar configuración</button></form><div class="panel"><h2>Navegación</h2><p class="muted">Edita etiquetas y rutas seguras. Se admiten rutas internas y HTTPS.</p><form id="nav-form" class="stack">${items.map((item, i) => `<div class="form-grid"><input type="hidden" name="location-${i}" value="${esc(item.location)}"><div class="field"><label>Etiqueta</label><input name="label-${i}" value="${esc(item.label)}"></div><div class="field"><label>Enlace</label><input name="href-${i}" value="${esc(item.href)}"></div></div>`).join("")}<button class="btn btn--secondary">Guardar navegación</button></form></div></div>`,
    "Configuración",
  );
  document.querySelector("#general-settings").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = form.querySelector(
      'button[type="submit"],button:not([type])',
    );
    if (submit) submit.disabled = true;
    try {
      const r = await api("/api/admin/settings", {
        method: "PUT",
        body: Object.fromEntries(new FormData(form)),
      });
      if (r.settings) {
        for (const [key, value] of Object.entries(r.settings)) {
          const field = form.elements[key];
          if (field && field.type !== "file") field.value = value ?? "";
        }
      }
      toast(
        `Configuración guardada. Tasa activa: ${Number(r.settings?.exchange_rate || 0).toLocaleString("es-VE")} Bs/USD.`,
        "success",
      );
    } catch (err) {
      toast(err.message, "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  };
  document.querySelector("#nav-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nav = items.map((item, i) => ({
      label: fd.get(`label-${i}`),
      href: fd.get(`href-${i}`),
      location: fd.get(`location-${i}`),
      active: 1,
    }));
    await api("/api/admin/navigation", { method: "PUT", body: { items: nav } });
    toast("Navegación actualizada.", "success");
  };
  mountNavigationEditor(items);
}

async function design() {
  shell("diseno", loading(), "Diseño");
  const { design: d } = await api("/api/admin/settings");
  const colors = [
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
  ];
  shell(
    "diseno",
    `<div class="dashboard-grid"><form id="design-form" class="panel stack"><h2>Design System</h2><div class="form-grid">${colors.map((k) => `<div class="field"><label>${esc(k.replaceAll("_", " "))}</label><input name="${k}" type="color" value="${esc(d[k] || "#000000")}"></div>`).join("")}</div><div class="form-grid"><div class="field"><label>Radio pequeño</label><input name="radius_sm" value="${esc(d.radius_sm || "8px")}"></div><div class="field"><label>Radio medio</label><input name="radius_md" value="${esc(d.radius_md || "14px")}"></div><div class="field"><label>Radio grande</label><input name="radius_lg" value="${esc(d.radius_lg || "22px")}"></div><div class="field"><label>Ancho máximo</label><input name="content_width" value="${esc(d.content_width || "1180px")}"></div><div class="field"><label>Densidad</label><select name="density"><option ${d.density === "compact" ? "selected" : ""}>compact</option><option ${d.density === "comfortable" ? "selected" : ""}>comfortable</option><option ${d.density === "spacious" ? "selected" : ""}>spacious</option></select></div></div><div class="field"><label>Tipografía</label><select name="font_family">${[
      ["Inter, ui-sans-serif, system-ui, sans-serif", "Sistema moderno"],
      ["Georgia, serif", "Editorial"],
      ["Arial, sans-serif", "Clásica"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${esc(value)}" ${d.font_family === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}${!["Inter, ui-sans-serif, system-ui, sans-serif", "Georgia, serif", "Arial, sans-serif"].includes(d.font_family) ? `<option value="${esc(d.font_family || "system-ui, sans-serif")}" selected>Tipografía actual</option>` : ""}</select></div><div class="form-grid"><div class="field"><label>Botones</label><select name="button_style">${[
      ["rounded", "Redondeados"],
      ["pill", "Píldora"],
      ["square", "Rectos"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${d.button_style === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></div><div class="field"><label>Sombras</label><select name="shadow"><option value="none" ${d.shadow === "none" ? "selected" : ""}>Sin sombra</option><option value="0 8px 24px rgba(20, 45, 42, .08)" ${d.shadow === "0 8px 24px rgba(20, 45, 42, .08)" ? "selected" : ""}>Suave</option>${d.shadow && !["none", "0 8px 24px rgba(20, 45, 42, .08)"].includes(d.shadow) ? `<option value="${esc(d.shadow)}" selected>Actual</option>` : ""}</select></div></div><button class="btn">Guardar diseño</button></form><aside class="design-preview"><div class="eyebrow">Vista rápida</div><h2>Jerarquía de ejemplo</h2><p class="muted">Los cambios afectan de forma consistente a la aplicación publicada.</p><div class="cluster"><button class="btn" type="button">Primario</button><button class="btn btn--secondary" type="button">Secundario</button></div></aside></div>`,
    "Diseño",
  );
  document.querySelector("#design-form").oninput = (e) => {
    const values = Object.fromEntries(new FormData(e.currentTarget)),
      preview = document.querySelector(".design-preview");
    for (const [key, value] of Object.entries(values)) {
      if (["density", "button_style"].includes(key))
        preview.dataset[key] = value;
      else preview.style.setProperty("--" + key.replaceAll("_", "-"), value);
    }
    preview.style.background = values.background;
    preview.style.color = values.text;
  };
  document.querySelector("#design-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/admin/design", {
        method: "PUT",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      const { applyDesign } = await import("./state.js");
      applyDesign(r.design);
      toast("Design System actualizado.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

async function audit() {
  shell("auditoria", loading(), "Auditoría");
  const { logs } = await api("/api/admin/audit?limit=150");
  shell(
    "auditoria",
    `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Detalles</th></tr></thead><tbody>${logs.map((l) => `<tr><td>${date(l.created_at)}</td><td>${esc(l.actor_name || "Sistema")}<br><span class="muted">${esc(l.actor_email || "")}</span></td><td><code>${esc(l.action)}</code></td><td>${esc(l.entity_type || "—")} ${esc(l.entity_id || "")}</td><td><small>${esc(JSON.stringify(l.metadata || {}))}</small></td></tr>`).join("")}</tbody></table></div>`,
    "Auditoría",
  );
}
