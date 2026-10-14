import { sectionAnchors, richText } from "./cms-content.js";
import { api } from "./api.js";
import { state } from "./state.js";
import { esc, courseCard, emptyState, loading } from "./ui.js";
import { setMain } from "./views.js";

const sBoolean = (v) => v === true || v === "1";
function sectionStyle(section) {
  const s = section?.settings || {},
    safe = (v) => /^#[0-9a-f]{6}$/i.test(v || "");
  const values = [];
  if (safe(s.backgroundColor))
    values.push(`--section-background:${s.backgroundColor}`);
  if (safe(s.textColor))
    values.push(
      `--text:${s.textColor}`,
      `--text-muted:color-mix(in srgb, ${s.textColor} 78%, transparent)`,
    );
  if (safe(s.accentColor)) values.push(`--primary:${s.accentColor}`);
  if (["cover", "contain"].includes(s.imageFit))
    values.push(`--cms-image-fit:${s.imageFit}`);
  if (["center", "top", "bottom", "left", "right"].includes(s.imagePosition))
    values.push(`--cms-image-position:${s.imagePosition}`);
  if (["auto", "1 / 1", "4 / 3", "16 / 9"].includes(s.imageRatio))
    values.push(`--cms-image-ratio:${s.imageRatio}`);
  if (s.imageWidth)
    values.push(
      `--cms-image-width:${{ small: "360px", medium: "560px", large: "100%" }[s.imageWidth] || "100%"}`,
    );
  return values.length ? `style="${values.join(";")}"` : "";
}
function sectionClass(section) {
  const animation = ["fade-up", "fade-in"].includes(
    section?.settings?.animation,
  )
    ? ` motion-${section.settings.animation}`
    : "";
  const spacing = ["compact", "spacious"].includes(section?.settings?.spacing)
    ? ` section--${section.settings.spacing}`
    : "";
  const columns = [1, 2, 3, 4].includes(Number(section?.settings?.columns))
    ? ` cols-${Number(section.settings.columns)}`
    : "";
  const alignment = ["left", "center", "right"].includes(
    section?.settings?.alignment,
  )
    ? ` align-${section.settings.alignment}`
    : "";
  const hidden = [true, "1"].includes(section?.settings?.mobileHidden)
    ? " mobile-hidden"
    : "";
  return `section${sBoolean(section?.settings?.imageHidden) ? " cms-image-hidden" : ""}${section?.settings?.imageSide === "left" ? " cms-image-left" : ""}${animation}${spacing}${columns}${alignment}${hidden}`;
}
function sectionWrap(content, id = "", section = null) {
  id = section?._anchor || section?.settings?.anchor || id;
  return `<section ${sectionStyle(section)} ${id ? `id="${esc(id)}"` : ""} class="${sectionClass(section)}"><div class="container">${content}</div></section>`;
}

function renderHero(section) {
  const s = section.settings || {};
  return `<section id="${esc(section._anchor || section.settings?.anchor || "inicio")}" ${sectionStyle(section)} class="hero ${sectionClass(section)} hero--${esc(section.variant || "split")} ${section.settings?.animation ? `motion-${esc(section.settings.animation)}` : ""}"><div class="container hero-grid"><div class="hero-copy"><div class="eyebrow">${esc(s.badge || "Formación online")}</div><h1>${esc(s.title || state.site?.tagline || "Aprende. Aplica. Avanza.")}</h1><p class="lead">${esc(s.text || "Cursos prácticos para desarrollar habilidades útiles.")}</p><div class="hero-actions">${sBoolean(s.primaryHidden) ? "" : `<a class="btn btn--${esc(s.primaryStyle || "primary")}" data-link href="${esc(s.primaryHref || "/catalogo")}">${esc(s.primaryCta || "Ver cursos")} <span aria-hidden="true">→</span></a>`}${sBoolean(s.secondaryHidden) ? "" : !state.user ? `<a class="btn btn--${esc(s.secondaryStyle || "secondary")}" data-link href="${esc(s.secondaryHref || "/registro")}">${esc(s.secondaryCta || "Crear cuenta")}</a>` : `<a class="btn btn--${esc(s.secondaryStyle || "secondary")}" data-link href="${esc(s.secondaryHref || "/dashboard")}">${esc(s.secondaryHref ? s.secondaryCta || "Ir a mi aprendizaje" : "Ir a mi aprendizaje")}</a>`}</div></div><div class="hero-media">${s.imageUrl ? `<img src="${esc(s.imageUrl)}" alt="${esc(s.imageAlt || "")}">` : `<div class="learning-illustration" aria-label="Aprendizaje a tu ritmo: clase, práctica y certificado"><div class="illustration-label">EL APRENDIZAJE, PASO A PASO</div><div class="illustration-orbit" aria-hidden="true"></div><div class="illustration-card"><span class="illustration-number">01</span><div><small>A tu ritmo</small><strong>Entiende lo esencial.</strong></div><span aria-hidden="true">↗</span></div><div class="illustration-card"><span class="illustration-number">02</span><div><small>Del concepto a la práctica</small><strong>Aplica lo aprendido.</strong></div><span aria-hidden="true">↗</span></div><div class="illustration-card"><span class="illustration-number">03</span><div><small>Al completar tu curso</small><strong>Obtén tu certificado.</strong></div><span aria-hidden="true">✓</span></div><div class="illustration-caption">Conocimiento que se convierte en acción.</div></div>`}</div></div></section>`;
}
function renderStats(section) {
  const items = Array.isArray(section.settings?.items)
    ? section.settings.items
    : [];
  return sectionWrap(
    `<div class="stats-grid stats--${esc(section.variant || "inline")}">${items.map((i) => `<div class="stat"><strong>${esc(i.value)}</strong><span class="muted">${esc(i.label)}</span></div>`).join("")}</div>`,
    "",
    section,
  );
}
function renderProcess(section) {
  const s = section.settings || {};
  const steps = Array.isArray(s.steps) ? s.steps : [];
  return sectionWrap(
    `<div class="section-head"><div><div class="eyebrow">Proceso</div><h2>${esc(s.title || "Cómo funciona")}</h2></div></div><div class="steps-grid process--${esc(section.variant || "steps")}">${steps.map((item, i) => `<article class="step"><div class="step-number">${i + 1}</div><h3>${esc(item.title)}</h3><p class="muted">${esc(item.text)}</p></article>`).join("")}</div>`,
    "",
    section,
  );
}
function renderAbout(section) {
  const s = section.settings || {};
  return sectionWrap(
    `<div class="about-grid about--${esc(section.variant || "split")}"><div><div class="eyebrow">Academia</div><h2>${esc(s.title || "Sobre nosotros")}</h2><p class="lead">${esc(s.text || "Formación práctica, clara y accesible.")}</p></div><div class="about-media">${s.imageUrl ? `<img src="${esc(s.imageUrl)}" alt="${esc(s.imageAlt || "")}">` : `<div class="hero-placeholder"><div class="hero-placeholder__inner"><h3>Aprendizaje útil</h3><p>Una plataforma pensada para que el contenido sea el protagonista.</p></div></div>`}</div></div>`,
    "nosotros",
    section,
  );
}
function renderLocations(section) {
  const s = section.settings || {};
  const locations = s.locationIds?.length
    ? s.locationIds
        .map((id) => state.locations.find((l) => l.id === Number(id)))
        .filter(Boolean)
    : state.locations;
  const cards = locations.length
    ? locations
        .map(
          (loc) =>
            `<article class="surface location-card">${loc.map_embed_url && section.variant !== "compact" ? `<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(loc.map_embed_url)}" title="Mapa de ${esc(loc.name)}"></iframe>` : ""}<div class="location-card__body"><h3>${esc(loc.name)}</h3><p>${esc(loc.address)}</p>${loc.description ? `<p class="muted">${esc(loc.description)}</p>` : ""}</div></article>`,
        )
        .join("")
    : emptyState(
        "Sedes por publicar",
        "La academia todavía no ha publicado ubicaciones.",
      );
  return sectionWrap(
    `<div><div class="section-head"><div><div class="eyebrow">Sedes</div><h2>${esc(s.title || "Nuestras sedes")}</h2><p class="muted">${esc(s.text || "")}</p></div></div><div class="location-list">${cards}</div></div>`,
    "sedes",
    section,
  );
}
function renderCta(section) {
  const s = section.settings || {};
  return sectionWrap(
    `<div class="cta cta--${esc(section.variant || "banner")}"><div><h2>${esc(s.title || "Empieza a aprender hoy")}</h2><p>${esc(s.text || "Explora el catálogo y elige tu próximo curso.")}</p></div><a class="btn" data-link href="${esc(s.href || "/catalogo")}">${esc(s.buttonLabel || "Explorar cursos")}</a></div>`,
    "",
    section,
  );
}
function renderTestimonials(section) {
  const s = section.settings || {};
  const items = Array.isArray(s.items) ? s.items : [];
  return sectionWrap(
    `<div class="section-head"><div><div class="eyebrow">Testimonios</div><h2>${esc(s.title || "Lo que dicen nuestros alumnos")}</h2><p class="muted">${esc(s.text || "")}</p></div></div>${items.length ? `<div class="steps-grid testimonials--${esc(section.variant || "cards")}" ${section.variant === "slider" ? 'tabindex="0" role="region" aria-label="Testimonios; desliza o usa las flechas"' : ""}>${items.map((i) => `<blockquote class="step"><p>“${esc(i.quote || i.text || "")}”</p><footer><strong>${esc(i.name || "Alumno")}</strong></footer></blockquote>`).join("")}</div>` : ``}`,
    "",
    section,
  );
}
function renderRich(section) {
  return sectionWrap(
    `<article class="panel">${section.settings?.title ? `<h2>${esc(section.settings.title)}</h2>` : ""}${richText(section.settings?.text)}</article>`,
    "",
    section,
  );
}
function renderExtra(section) {
  const s = section.settings || {},
    items = s.items || [];
  const title = s.title ? `<h2>${esc(s.title)}</h2>` : "";
  if (section.section_type === "faq")
    return sectionWrap(
      `${title}<div class="stack">${items.map((x) => `<details class="panel"><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join("")}</div>`,
      "",
      section,
    );
  return sectionWrap(
    `${title}<div class="steps-grid">${items.map((x) => `<figure class="panel cms-media-card">${x.imageUrl ? `<img loading="lazy" src="${esc(x.imageUrl)}" alt="${esc(x.alt || x.name || "")}">` : ""}<figcaption>${section.section_type === "team" ? `<h3>${esc(x.name)}</h3><strong>${esc(x.role)}</strong><p>${esc(x.text)}</p>` : esc(x.caption)}</figcaption></figure>`).join("")}</div>`,
    "",
    section,
  );
}

export function renderSection(section, courses = []) {
  const type = section.section_type;
  const renderers = {
    faq: renderExtra,
    gallery: renderExtra,
    team: renderExtra,
    hero: renderHero,
    stats: renderStats,
    process: renderProcess,
    about: renderAbout,
    locations: renderLocations,
    testimonials: renderTestimonials,
    cta: renderCta,
    rich_text: renderRich,
    footer: renderFooterSection,
  };
  if (renderers[type]) return renderers[type](section);
  if (type !== "featured_courses") return "";
  const s = section.settings || {},
    list = (
      s.courseIds?.length
        ? s.courseIds
            .map((id) => courses.find((c) => c.id === Number(id)))
            .filter(Boolean)
        : courses.filter((c) => c.featured)
    ).slice(0, Number(s.limit || 9));
  return sectionWrap(
    `<div class="section-head"><div><div class="eyebrow">${esc(s.eyebrow || "Una habilidad, un siguiente paso")}</div><h2>${esc(s.title || "Cursos destacados")}</h2></div><div class="cluster"><a class="text-link" data-link href="/catalogo">Todo el catálogo →</a><div class="carousel__controls"><button class="icon-btn" data-carousel-prev aria-label="Cursos anteriores">←</button><button class="icon-btn" data-carousel-next aria-label="Cursos siguientes">→</button></div></div></div>${list.length ? `<div class="carousel carousel--${esc(section.variant || "cards")}" data-carousel aria-label="Cursos destacados"><div class="carousel__track" tabindex="0">${list.map((c) => courseCard(c, { compact: section.variant === "compact" || section.variant === "horizontal" })).join("")}</div><div class="carousel__dots" aria-label="Navegación del carrusel"></div></div>` : emptyState("Sin cursos destacados", "La academia publicará aquí sus cursos destacados.")}`,
    "",
    section,
  );
}
function renderFooterSection(section) {
  const s = section.settings || {};
  return sectionWrap(
    `<div class="home-footer home-footer--${esc(section.variant || "columns")}"><div>${state.site?.logo_url ? `<img class="footer-block-logo" src="${esc(state.site.logo_url)}" alt="${esc(state.site.academy_name || "AcademiaVE")}">` : ""}<div class="eyebrow">${esc(state.site?.academy_name || "AcademiaVE")}</div><h2>${esc(s.title || "Tu próximo paso empieza aquí.")}</h2><p>${esc(s.text || state.site?.footer_text || "Formación práctica para el mundo digital.")}</p></div><nav class="footer-links" aria-label="Enlaces del pie">${state.navigation
      .filter((i) => i.location === "footer")
      .map(
        (i) =>
          `<a href="${esc(i.href)}" ${i.href.startsWith("/") ? "data-link" : ""}>${esc(i.label)}</a>`,
      )
      .join(
        "",
      )}</nav><div>${state.site?.support_email ? `<a href="mailto:${esc(state.site.support_email)}">${esc(state.site.support_email)}</a>` : ""}${state.site?.whatsapp ? `<p>${esc(state.site.whatsapp)}</p>` : ""}<div class="footer-links">${[
      ["instagram_url", "Instagram"],
      ["facebook_url", "Facebook"],
      ["tiktok_url", "TikTok"],
    ]
      .filter(([key]) => state.site?.[key])
      .map(
        ([key, label]) =>
          `<a href="${esc(state.site[key])}" target="_blank" rel="noopener">${label}</a>`,
      )
      .join(
        "",
      )}</div><p class="muted">${esc(state.site?.copyright_text || "")}</p></div></div>`,
    "",
    section,
  );
}
export async function homeView() {
  const sections = (state.homeSections || []).filter((s) => s.enabled);
  const list = sections.length
    ? sections
    : [
        { section_type: "hero", settings: {} },
        { section_type: "featured_courses", settings: {} },
      ];
  const anchors = sectionAnchors(list);
  const banner = state.cmsPreview
    ? '<div class="preview-banner">Vista previa del borrador del CMS · no publicada</div>'
    : "";
  setMain(
    banner +
      list
        .map(
          (s, i) =>
            `<div data-home-block="${i}">${s.section_type === "featured_courses" ? `<section id="${esc(anchors[i])}" class="section"><div class="container">${loading("Cargando cursos")}</div></section>` : renderSection({ ...s, _anchor: anchors[i] }, [])}</div>`,
        )
        .join(""),
  );
  // Keep the institutional content available even if the courses API fails.
  const blocks = [...document.querySelectorAll("[data-home-block]")];
  if (list.some((s) => s.section_type === "featured_courses")) {
    let interacted = false;
    const markInteraction = () => {
      interacted = true;
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"];
    events.forEach((event) =>
      window.addEventListener(event, markInteraction, { passive: true }),
    );
    const alignAnchor = () => {
      if (interacted || !blocks[0]?.isConnected || !location.hash) return;
      try {
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView({ behavior: "instant", block: "start" });
      } catch {}
    };
    api("/api/courses", { signal: AbortSignal.timeout(10000) })
      .then(({ courses }) => {
        list.forEach((s, i) => {
          if (s.section_type === "featured_courses" && blocks[i]?.isConnected) {
            blocks[i].innerHTML = renderSection(
              { ...s, _anchor: anchors[i] },
              courses,
            );
            initCarousels(blocks[i]);
          }
        });
        alignAnchor();
      })
      .catch(() => {
        list.forEach((s, i) => {
          if (s.section_type === "featured_courses" && blocks[i]?.isConnected)
            blocks[i].innerHTML =
              `<section id="${esc(anchors[i])}" class="section"><div class="container"><p>No se pudieron cargar los cursos. <a data-link href="/catalogo">Abrir catálogo</a></p></div></section>`;
        });
        alignAnchor();
      })
      .finally(() =>
        events.forEach((event) =>
          window.removeEventListener(event, markInteraction),
        ),
      );
  }
  document.querySelectorAll(".testimonials--slider").forEach((slider) =>
    slider.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        slider.scrollBy({
          left: slider.clientWidth * (e.key === "ArrowLeft" ? -1 : 1),
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      }
    }),
  );
  document.querySelector("#site-footer").hidden = sections.some(
    (s) => s.section_type === "footer",
  );
  initCarousels();
}
export function initCarousels(root = document) {
  root.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector(".carousel__track");
    const prev = carousel.parentElement.querySelector("[data-carousel-prev]");
    const next = carousel.parentElement.querySelector("[data-carousel-next]");
    const dots = carousel.querySelector(".carousel__dots");
    const cards = [...track.children];
    const behavior = () =>
      matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth";
    const amount = () => Math.max(260, track.clientWidth * 0.8);
    const nearestIndex = () => {
      if (!cards.length) return 0;
      const left = track.scrollLeft;
      let best = 0,
        distance = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs(card.offsetLeft - left - track.offsetLeft);
        if (d < distance) {
          distance = d;
          best = i;
        }
      });
      return best;
    };
    const updateDots = () => {
      const current = nearestIndex();
      dots
        ?.querySelectorAll(".carousel__dot")
        .forEach((dot, i) =>
          dot.setAttribute("aria-current", i === current ? "true" : "false"),
        );
    };
    if (dots) {
      dots.innerHTML = cards
        .map(
          (_, i) =>
            `<button class="carousel__dot" type="button" aria-label="Ir al curso ${i + 1}" aria-current="${i === 0 ? "true" : "false"}"></button>`,
        )
        .join("");
      dots.querySelectorAll(".carousel__dot").forEach((dot, i) =>
        dot.addEventListener("click", () =>
          track.scrollTo({
            left: cards[i].offsetLeft - track.offsetLeft,
            behavior: behavior(),
          }),
        ),
      );
    }
    prev?.addEventListener("click", () =>
      track.scrollBy({ left: -amount(), behavior: behavior() }),
    );
    next?.addEventListener("click", () =>
      track.scrollBy({ left: amount(), behavior: behavior() }),
    );
    let frame = 0;
    track.addEventListener(
      "scroll",
      () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(updateDots);
      },
      { passive: true },
    );
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        track.scrollBy({ left: amount(), behavior: behavior() });
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        track.scrollBy({ left: -amount(), behavior: behavior() });
      }
    });
    updateDots();
  });
}
