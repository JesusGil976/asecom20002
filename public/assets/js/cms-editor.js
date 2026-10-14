import { api } from "./api.js";
import { state } from "./state.js";
import { esc, toast } from "./ui.js";
import { renderSection } from "./home.js";
import { sectionAnchors } from "./cms-content.js";

export async function mountCms(shell, inspector, defaultSection, sectionLabel) {
  const [initial, catalog] = await Promise.all([
    api("/api/admin/cms/home"),
    api("/api/courses").catch(() => ({ courses: [] })),
  ]);
  let data =
    initial.version?.status === "draft"
      ? initial
      : await api("/api/admin/cms/home/draft", { method: "POST", body: {} });
  let sections = structuredClone(data.sections),
    selected = 0,
    saved = JSON.stringify(sections),
    busy = false,
    width = "100%";
  const key = `cms-home-recovery-${state.user.id}`;
  const dirty = () => JSON.stringify(sections) !== saved;
  const cache = () => {
    try {
      if (dirty())
        localStorage.setItem(
          key,
          JSON.stringify({
            sections,
            version: data.version?.id,
            time: Date.now(),
          }),
        );
      else localStorage.removeItem(key);
    } catch {}
  };
  let recovery;
  try {
    recovery = JSON.parse(localStorage.getItem(key));
  } catch {}
  if (
    Array.isArray(recovery?.sections) &&
    confirm(
      "Hay cambios locales sin guardar del " +
        new Date(recovery.time).toLocaleString() +
        ". ¿Recuperarlos?" +
        (recovery.version !== data.version?.id
          ? " La versión del servidor ha cambiado; revisa antes de guardar."
          : ""),
    )
  )
    sections = recovery.sections;
  else {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
  const status = () => {
    const el = document.querySelector("#cms-status");
    if (el)
      el.textContent = busy
        ? "Guardando…"
        : dirty()
          ? "Cambios sin guardar · recuperación local"
          : "Borrador guardado";
  };
  const changed = () => {
    cache();
    status();
    preview();
  };
  const uid = () => `bloque-${crypto.randomUUID()}`;
  const selectField = (label, name, value, options) =>
    `<label class="field">${esc(label)}<select name="settings.${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(value ?? "") === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  const field = (label, name, value = "", area = false) =>
    `<label class="field">${esc(label)}${area ? `<textarea name="settings.${name}">${esc(value)}</textarea>` : `<input name="settings.${name}" value="${esc(value)}">`}</label>`;
  const lists = {
    stats: ["items", { value: "Valor", label: "Etiqueta" }],
    process: ["steps", { title: "Título", text: "Texto" }],
    testimonials: ["items", { name: "Nombre", quote: "Testimonio" }],
    faq: ["items", { question: "Pregunta", answer: "Respuesta" }],
    gallery: [
      "items",
      {
        imageUrl: "Imagen URL",
        alt: "Texto alternativo",
        caption: "Descripción",
      },
    ],
    team: [
      "items",
      {
        imageUrl: "Foto URL",
        name: "Nombre",
        role: "Cargo",
        text: "Biografía",
      },
    ],
  };
  const extra = (s) => {
    const v = s.settings;
    let html =
      field("Nombre interno", "internalName", v.internalName || "") +
      field(
        "Identificador para enlaces (minúsculas)",
        "anchor",
        v.anchor || "",
      ) +
      "<small>Opcional. Si lo cambias, actualiza los enlaces que apunten a esta sección.</small>";
    if (s.section_type === "hero")
      for (const prefix of ["primary", "secondary"])
        html +=
          `<fieldset><legend>Botón ${prefix === "primary" ? "principal" : "secundario"}</legend>` +
          field(
            "Destino",
            prefix + "Href",
            v[prefix + "Href"] ||
              (prefix === "primary" ? "/catalogo" : "/registro"),
          ) +
          selectField(
            "Ocultar",
            prefix + "Hidden",
            String(
              v[prefix + "Hidden"] === true || v[prefix + "Hidden"] === "1"
                ? "1"
                : "0",
            ),
            [
              ["0", "No"],
              ["1", "Sí"],
            ],
          ) +
          selectField(
            "Estilo",
            prefix + "Style",
            v[prefix + "Style"] ||
              (prefix === "primary" ? "primary" : "secondary"),
            [
              ["primary", "Principal"],
              ["secondary", "Secundario"],
              ["ghost", "Discreto"],
            ],
          ) +
          "</fieldset>";
    if (["hero", "about"].includes(s.section_type))
      html +=
        "<fieldset><legend>Imagen y distribución</legend>" +
        field("Texto alternativo", "imageAlt", v.imageAlt || "") +
        selectField(
          "Ocultar imagen",
          "imageHidden",
          v.imageHidden === true || v.imageHidden === "1" ? "1" : "0",
          [
            ["0", "No"],
            ["1", "Sí"],
          ],
        ) +
        selectField("Ajuste", "imageFit", v.imageFit || "cover", [
          ["cover", "Recortar"],
          ["contain", "Mostrar completa"],
        ]) +
        selectField("Encuadre", "imagePosition", v.imagePosition || "center", [
          ["center", "Centro"],
          ["top", "Arriba"],
          ["bottom", "Abajo"],
          ["left", "Izquierda"],
          ["right", "Derecha"],
        ]) +
        selectField("Proporción", "imageRatio", v.imageRatio || "auto", [
          ["auto", "Original"],
          ["1 / 1", "Cuadrada"],
          ["4 / 3", "4:3"],
          ["16 / 9", "16:9"],
        ]) +
        selectField("Tamaño", "imageWidth", v.imageWidth || "large", [
          ["small", "Pequeña"],
          ["medium", "Mediana"],
          ["large", "Grande"],
        ]) +
        selectField("Lado en escritorio", "imageSide", v.imageSide || "right", [
          ["right", "Derecha"],
          ["left", "Izquierda"],
        ]) +
        "</fieldset>";
    if (lists[s.section_type]) {
      const [prop, fields] = lists[s.section_type];
      if (["faq", "gallery", "team"].includes(s.section_type))
        html += field("Título", "title", v.title || "");
      html += `<fieldset><legend>Elementos</legend>${(v[prop] || [])
        .map(
          (row, i) =>
            `<div class="cms-item panel">${Object.entries(fields)
              .map(([k, label]) =>
                field(
                  label,
                  `${prop}.${i}.${k}`,
                  row[k] || "",
                  ["text", "quote", "answer"].includes(k),
                ),
              )
              .join(
                "",
              )}${"imageUrl" in fields ? `<label>Subir imagen<input type="file" accept="image/png,image/jpeg,image/webp" data-item-image="${prop}.${i}.imageUrl"></label>` : ""}<div class="cluster"><button type="button" data-item-move="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" data-item-move="${i}" data-direction="1" ${i === (v[prop] || []).length - 1 ? "disabled" : ""}>↓</button><button type="button" data-item-remove="${i}">Eliminar elemento</button></div></div>`,
        )
        .join(
          "",
        )}<button type="button" class="btn btn--secondary" data-item-add ${(v[prop] || []).length >= 30 ? "disabled" : ""}>Añadir elemento</button></fieldset>`;
    }
    if (
      s.section_type === "featured_courses" ||
      s.section_type === "locations"
    ) {
      const courses = s.section_type === "featured_courses",
        prop = courses ? "courseIds" : "locationIds",
        rows = courses ? catalog.courses : state.locations,
        ids = v[prop] || [];
      html += `<fieldset><legend>${courses ? "Cursos y orden manual" : "Sedes visibles"}</legend><small>Sin selección se usa la lista automática.</small><div class="stack">${ids.map((id, i) => `<div>${esc(rows.find((x) => x.id === Number(id))?.name || "Elemento no disponible")} <button type="button" data-selection-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" data-selection-remove="${i}">Quitar</button></div>`).join("")}</div><select data-selection-add><option value="">Añadir…</option>${rows
        .filter((x) => !ids.map(Number).includes(x.id))
        .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
        .join("")}</select></fieldset>`;
    }
    if (s.section_type === "rich_text")
      html +=
        '<div class="cluster"><button type="button" data-format="heading">Título</button><button type="button" data-format="bold">Negrita</button><button type="button" data-format="list">Lista</button><button type="button" data-format="link">Enlace</button></div><small>Formato: ## Título, **negrita**, - elemento, [texto](https://…). No se admite HTML.</small>';
    return html;
  };
  function preview() {
    const canvas = document.querySelector("#cms-section-preview");
    if (!canvas) return;
    const active = sections.filter((s) => s.enabled),
      anchors = sectionAnchors(active);
    canvas.innerHTML = active
      .map((s, i) =>
        renderSection({ ...s, _anchor: anchors[i] }, catalog.courses),
      )
      .join("");
    canvas.style.width = width;
  }
  function read() {
    const form = document.querySelector("#cms-inspector-form"),
      s = sections[selected];
    if (!form || !s) return;
    for (const [key, value] of new FormData(form)) {
      if (key === "variant") s.variant = value;
      else if (key === "enabled") s.enabled = value === "1";
      else if (key.startsWith("settings.")) {
        const parts = key.slice(9).split(".");
        let target = s.settings;
        for (const p of parts.slice(0, -1)) target = target[p] ??= {};
        target[parts.at(-1)] = [
          "mobileHidden",
          "imageHidden",
          "primaryHidden",
          "secondaryHidden",
        ].includes(parts.at(-1))
          ? value === "1"
          : value;
      }
    }
  }
  function render() {
    const s = sections[selected];
    shell(
      "cms",
      `<div class="toolbar"><button class="btn btn--secondary" id="cms-add" ${sections.length >= 40 ? "disabled" : ""}>Añadir sección</button><button class="btn btn--secondary" id="cms-history">Historial</button><button class="btn btn--secondary" id="cms-preview">Vista previa completa</button><button class="btn" id="cms-save">Guardar borrador</button><button class="btn" id="cms-publish">Publicar</button><span id="cms-status" role="status"></span></div><div class="cms-editor"><div class="cms-list">${sections.map((x, i) => `<article class="cms-block panel" draggable="true" data-active="${i === selected}" data-block-index="${i}"><div class="cms-block__body"><strong>${esc(x.settings.internalName || sectionLabel(x.section_type))}</strong><small>${x.enabled ? "Visible" : "Oculta"}</small></div><div class="cluster"><button data-select="${i}" type="button">Editar</button><button data-move="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""}>↑</button><button data-move="${i}" data-direction="1" ${i === sections.length - 1 ? "disabled" : ""}>↓</button><button data-copy="${i}" ${sections.length >= 40 ? "disabled" : ""}>Duplicar</button><button data-remove="${i}">Eliminar</button></div></article>`).join("")}</div><aside class="cms-inspector panel">${s ? inspector(s) : "Añade una sección."}</aside><section class="cms-live-preview panel"><h2>Vista de la página</h2><p>Referencia de contenido. Usa la vista completa para comprobar los tamaños de pantalla.</p><div class="cms-preview-scroll"><div id="cms-section-preview" inert></div></div></section></div>`,
      "CMS de Inicio",
    );
    const form = document.querySelector("#cms-inspector-form");
    if (form) {
      // Replace fixed-length controls with dynamic list controls.
      if (lists[s.section_type])
        form.querySelectorAll("[name]").forEach((el) => {
          if (/^settings\.(items|steps)\./.test(el.name))
            el.closest(".field")?.remove();
        });
      if (
        ![
          "stats",
          "process",
          "locations",
          "testimonials",
          "gallery",
          "team",
        ].includes(s.section_type)
      )
        form.elements["settings.columns"]?.closest(".field")?.remove();
      form.insertAdjacentHTML("beforeend", extra(s));
      form.oninput = () => {
        read();
        changed();
      };
      form.onsubmit = (e) => e.preventDefault();
      form.querySelectorAll("[data-color-target]").forEach(
        (el) =>
          (el.oninput = () => {
            form.elements[el.dataset.colorTarget].value = el.value;
            read();
            changed();
          }),
      );
      const mutate = (fn) => {
        read();
        fn();
        changed();
        render();
      };
      if (lists[s.section_type]) {
        const [prop, fields] = lists[s.section_type];
        s.settings[prop] ||= [];
        form.querySelector("[data-item-add]").onclick = () =>
          mutate(() =>
            s.settings[prop].push(
              Object.fromEntries(Object.keys(fields).map((k) => [k, ""])),
            ),
          );
        form
          .querySelectorAll("[data-item-remove]")
          .forEach(
            (b) =>
              (b.onclick = () =>
                mutate(() =>
                  s.settings[prop].splice(Number(b.dataset.itemRemove), 1),
                )),
          );
        form.querySelectorAll("[data-item-move]").forEach(
          (b) =>
            (b.onclick = () =>
              mutate(() => {
                const from = Number(b.dataset.itemMove),
                  to = from + Number(b.dataset.direction);
                const [row] = s.settings[prop].splice(from, 1);
                s.settings[prop].splice(to, 0, row);
              })),
        );
      }
      const prop =
        s.section_type === "featured_courses" ? "courseIds" : "locationIds";
      form
        .querySelector("[data-selection-add]")
        ?.addEventListener("change", (e) => {
          if (e.target.value)
            mutate(() => {
              (s.settings[prop] ||= []).push(Number(e.target.value));
            });
        });
      form
        .querySelectorAll("[data-selection-remove]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              mutate(() =>
                s.settings[prop].splice(Number(b.dataset.selectionRemove), 1),
              )),
        );
      form.querySelectorAll("[data-selection-up]").forEach(
        (b) =>
          (b.onclick = () =>
            mutate(() => {
              const i = Number(b.dataset.selectionUp);
              [s.settings[prop][i - 1], s.settings[prop][i]] = [
                s.settings[prop][i],
                s.settings[prop][i - 1],
              ];
            })),
      );
      form.querySelectorAll("[data-cms-image],[data-item-image]").forEach(
        (input) =>
          (input.onchange = async () => {
            if (!input.files[0]) return;
            input.disabled = true;
            try {
              const body = new FormData();
              body.append("file", input.files[0]);
              const r = await api("/api/admin/upload/image", {
                method: "POST",
                body,
              });
              if (!form.isConnected) return;
              form.elements[
                "settings." + (input.dataset.itemImage || "imageUrl")
              ].value = r.url;
              read();
              changed();
            } catch (e) {
              toast(e.message, "error");
            } finally {
              input.disabled = false;
            }
          }),
      );
      form.querySelectorAll("[data-format]").forEach(
        (b) =>
          (b.onclick = () => {
            const el = form.elements["settings.text"],
              start = el.selectionStart,
              end = el.selectionEnd,
              text = el.value.slice(start, end) || "Texto";
            let insert = {
              heading: `\n## ${text}\n`,
              bold: `**${text}**`,
              list: `\n- ${text}\n`,
            }[b.dataset.format];
            if (b.dataset.format === "link") {
              const url = prompt("Destino HTTPS o ruta interna", "https://");
              if (!url) return;
              insert = `[${text}](${url})`;
            }
            el.setRangeText(insert, start, end, "select");
            el.focus();
            read();
            changed();
          }),
      );
    }
    document.querySelectorAll("[data-select]").forEach(
      (b) =>
        (b.onclick = () => {
          read();
          selected = Number(b.dataset.select);
          render();
        }),
    );
    document.querySelectorAll("[data-move]").forEach(
      (b) =>
        (b.onclick = () => {
          read();
          const from = Number(b.dataset.move),
            to = from + Number(b.dataset.direction);
          const [x] = sections.splice(from, 1);
          sections.splice(to, 0, x);
          selected = to;
          changed();
          render();
        }),
    );
    document.querySelectorAll("[data-copy]").forEach(
      (b) =>
        (b.onclick = () => {
          read();
          const x = structuredClone(sections[Number(b.dataset.copy)]);
          x.section_key = uid();
          x.settings.anchor = x.section_key;
          x.settings.internalName =
            (x.settings.internalName || sectionLabel(x.section_type)) +
            " (copia)";
          delete x.id;
          sections.push(x);
          selected = sections.length - 1;
          changed();
          render();
        }),
    );
    document.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!confirm("¿Eliminar esta sección del borrador?")) return;
          sections.splice(Number(b.dataset.remove), 1);
          selected = Math.max(0, Math.min(selected, sections.length - 1));
          changed();
          render();
        }),
    );
    document.querySelector("#cms-add").onclick = () => {
      const dialog = document.createElement("dialog");
      dialog.innerHTML = `<form method="dialog" class="stack"><h2>Añadir sección</h2><select>${["hero", "featured_courses", "stats", "process", "about", "locations", "testimonials", "cta", "rich_text", "footer", "faq", "gallery", "team"].map((t) => `<option value="${t}">${esc(sectionLabel(t))}</option>`).join("")}</select><button value="add" class="btn">Añadir</button><button value="cancel">Cancelar</button></form>`;
      document.body.append(dialog);
      dialog.showModal();
      dialog.onclose = () => {
        if (dialog.returnValue === "add") {
          const type = dialog.querySelector("select").value,
            x = defaultSection(type, sections.length);
          x.section_key = uid();
          if (["faq", "gallery", "team"].includes(type))
            x.settings = { title: sectionLabel(type), items: [] };
          sections.push(x);
          selected = sections.length - 1;
          changed();
          render();
        }
        dialog.remove();
      };
    };
    document.querySelector("#cms-save").onclick = () =>
      save().catch((e) => toast(e.message, "error"));
    document.querySelector("#cms-publish").onclick = async () => {
      if (busy || !confirm("¿Publicar el borrador en el sitio?")) return;
      try {
        await save();
        if (dirty())
          throw new Error(
            "Hubo cambios durante el guardado. Revisa y vuelve a publicar.",
          );
        busy = true;
        await api("/api/admin/cms/home/publish", { method: "POST", body: {} });
        saved = JSON.stringify(sections);
        cache();
        location.reload();
      } catch (e) {
        toast(e.message, "error");
      } finally {
        busy = false;
        status();
      }
    };
    document.querySelector("#cms-preview").onclick = async () => {
      if (busy) return;
      const popup = window.open("about:blank", "_blank");
      if (popup) popup.opener = null;
      try {
        await save();
        if (popup) popup.location.href = "/cms-preview.html";
        else
          toast(
            "Permite ventanas emergentes para abrir la vista previa.",
            "error",
          );
      } catch (e) {
        popup?.close();
        toast(e.message, "error");
      }
    };
    document.querySelector("#cms-history").onclick = async () => {
      try {
        const { versions } = await api("/api/admin/cms/home/history");
        const dialog = document.createElement("dialog");
        dialog.innerHTML = `<h2>Versiones publicadas</h2><p>Restaurar reemplaza el borrador. La página publicada no cambia hasta publicar.</p><div class="stack">${versions.map((v) => `<button data-restore="${v.id}">Versión ${v.version_number} · ${esc(v.published_at || "")} · ${esc(v.status)}</button>`).join("") || "Sin versiones anteriores."}</div><button data-close>Cerrar</button>`;
        document.body.append(dialog);
        dialog.showModal();
        dialog.onclose = () => dialog.remove();
        dialog.querySelector("[data-close]").onclick = () => dialog.close();
        dialog.querySelectorAll("[data-restore]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (!confirm("¿Reemplazar el borrador por esta versión?")) return;
              b.disabled = true;
              try {
                data = await api("/api/admin/cms/home/restore", {
                  method: "POST",
                  body: { versionId: Number(b.dataset.restore) },
                });
                sections = data.sections;
                saved = JSON.stringify(sections);
                selected = 0;
                cache();
                dialog.close();
                render();
              } catch (e) {
                toast(e.message, "error");
                b.disabled = false;
              }
            }),
        );
      } catch (e) {
        toast(e.message, "error");
      }
    };
    let from = null;
    document.querySelectorAll("[data-block-index]").forEach((el) => {
      el.ondragstart = (e) => {
        if (e.target.closest("button,input,select,textarea")) {
          e.preventDefault();
          return;
        }
        from = Number(el.dataset.blockIndex);
      };
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => {
        e.preventDefault();
        const to = Number(el.dataset.blockIndex);
        if (from === null || from === to) return;
        read();
        const [x] = sections.splice(from, 1);
        sections.splice(to, 0, x);
        selected = to;
        from = null;
        changed();
        render();
      };
      el.ondragend = () => {
        from = null;
      };
    });
    status();
    preview();
  }
  async function save() {
    if (busy) throw new Error("Espera a que termine el guardado.");
    read();
    busy = true;
    status();
    const snapshot = structuredClone(sections);
    try {
      const r = await api("/api/admin/cms/home/draft", {
        method: "PUT",
        body: { sections: snapshot },
      });
      data = r;
      // Preserve edits made while the request was in flight.
      if (JSON.stringify(sections) === JSON.stringify(snapshot)) {
        sections = r.sections;
        saved = JSON.stringify(sections);
        render();
      } else saved = JSON.stringify(snapshot);
      cache();
      toast("Borrador guardado.", "success");
    } finally {
      busy = false;
      status();
    }
  }
  const onExit = (e) => {
    if (dirty()) {
      cache();
      e.preventDefault();
      e.returnValue = "";
    }
  };
  const onNavigate = (e) => {
    const a = e.target.closest?.("a[data-link]");
    if (!a || !dirty() || e.ctrlKey || e.metaKey) return;
    if (
      !confirm(
        "Hay cambios sin guardar. Se conservará una copia local. ¿Salir?",
      )
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
    } else cache();
  };
  window.addEventListener("beforeunload", onExit);
  document.addEventListener("click", onNavigate, true);
  render();
  const root = document.querySelector(".cms-editor");
  // render() replaces the root on every edit; disconnect only when the CMS route is left.
  const observer = new MutationObserver(() => {
    if (!document.querySelector("#cms-save")) {
      cache();
      window.removeEventListener("beforeunload", onExit);
      document.removeEventListener("click", onNavigate, true);
      observer.disconnect();
    }
  });
  observer.observe(document.querySelector("#main"), { childList: true });
}
