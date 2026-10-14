import { sectionAnchors } from "./cms-content.js";
import { api } from "./api.js";
import { esc, toast, enhanceControls } from "./ui.js";

export async function mountNavigationEditor(initial) {
  const { home } = await api("/api/site");
  const sections = (home?.sections || []).filter((s) => s.enabled);
  const anchors = sectionAnchors(sections);
  const form = document.querySelector("#nav-form");
  let items = initial.map((item) => ({ ...item }));
  const read = () => {
    const data = new FormData(form);
    items = items.map((item, i) => ({
      ...item,
      label: data.get(`label-${i}`),
      href: data.get(`href-${i}`),
      location: data.get(`location-${i}`),
      active: data.get(`active-${i}`) === "1",
    }));
  };
  const render = () => {
    form.innerHTML =
      items
        .map(
          (item, i) =>
            `<fieldset class="navigation-row"><legend>Enlace ${i + 1}</legend><div class="form-grid"><div class="field"><label>Etiqueta</label><input name="label-${i}" value="${esc(item.label)}" required maxlength="80"></div><div class="field"><label>Destino</label><input name="href-${i}" value="${esc(item.href)}" required placeholder="/catalogo o https://…"><select data-section-target="${i}" aria-label="Elegir sección publicada"><option value="">Elegir sección publicada…</option><option value="/">Inicio de página</option>${sections.map((s, n) => `<option value="/#${esc(anchors[n])}">${esc(s.settings.internalName || s.settings.title || s.section_type)}</option>`).join("")}</select></div><div class="field"><label>Ubicación</label><select name="location-${i}"><option value="header" ${item.location === "header" ? "selected" : ""}>Cabecera</option><option value="footer" ${item.location === "footer" ? "selected" : ""}>Pie de página</option></select></div><div class="field"><label>Visible</label><select name="active-${i}"><option value="1" ${item.active ? "selected" : ""}>Sí</option><option value="0" ${!item.active ? "selected" : ""}>No</option></select></div></div><div class="cluster"><button type="button" class="btn btn--small btn--secondary" data-nav-move="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir enlace ${i + 1}">↑</button><button type="button" class="btn btn--small btn--secondary" data-nav-move="${i}" data-direction="1" ${i === items.length - 1 ? "disabled" : ""} aria-label="Bajar enlace ${i + 1}">↓</button><button type="button" class="btn btn--small btn--ghost" data-nav-remove="${i}">Eliminar enlace</button></div></fieldset>`,
        )
        .join("") +
      `<div class="cluster"><button id="nav-add" type="button" class="btn btn--secondary" ${items.length >= 30 ? "disabled" : ""}>Añadir enlace</button><button class="btn" type="submit">Guardar navegación</button></div><small class="muted">Los cambios se aplican al guardar. Máximo 30 enlaces.</small>`;
    form.querySelectorAll("[data-section-target]").forEach(
      (el) =>
        (el.onchange = () => {
          if (el.value)
            form.elements[`href-${el.dataset.sectionTarget}`].value = el.value;
        }),
    );
    enhanceControls(form);
    form.querySelector("#nav-add").onclick = () => {
      read();
      items.push({
        label: "Nuevo enlace",
        href: "/catalogo",
        location: "header",
        active: true,
      });
      render();
    };
    form.querySelectorAll("[data-nav-remove]").forEach(
      (button) =>
        (button.onclick = () => {
          read();
          items.splice(Number(button.dataset.navRemove), 1);
          render();
        }),
    );
    form.querySelectorAll("[data-nav-move]").forEach(
      (button) =>
        (button.onclick = () => {
          read();
          const from = Number(button.dataset.navMove),
            to = from + Number(button.dataset.direction);
          const [item] = items.splice(from, 1);
          items.splice(to, 0, item);
          render();
        }),
    );
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    read();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      const result = await api("/api/admin/navigation", {
        method: "PUT",
        body: { items },
      });
      items = result.items;
      render();
      toast("Navegación guardada. Se verá al recargar la página.", "success");
    } catch (error) {
      toast(error.message, "error");
      submit.disabled = false;
    }
  };
  render();
}
