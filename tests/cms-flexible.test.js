const test = require("node:test"),
  assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { migrate } = require("../src/db");
const { seedAll } = require("../src/db/seed");
const { createCmsService } = require("../src/services/cms");
const { validateSettings } = require("../src/services/cms-schema");
test("CMS valida listas ampliadas, selecciones y destinos seguros", () => {
  const settings = validateSettings("hero", {
    primaryHref: "/catalogo",
    secondaryHref: "https://example.com/contacto",
    imageFit: "contain",
    imageRatio: "1 / 1",
    imageHidden: "0",
    anchor: "portada",
  });
  assert.equal(settings.imageHidden, false);
  assert.throws(() =>
    validateSettings("hero", { primaryHref: "javascript:alert(1)" }),
  );
  assert.throws(() => validateSettings("hero", { anchor: "main" }));
  assert.throws(() =>
    validateSettings("hero", { imagePosition: "center;display:none" }),
  );
  assert.equal(
    validateSettings("process", {
      steps: Array.from({ length: 12 }, (_, i) => ({
        title: `Paso ${i}`,
        text: "Descripción",
      })),
    }).steps.length,
    12,
  );
  assert.deepEqual(
    validateSettings("featured_courses", { courseIds: [3, 1, 3] }).courseIds,
    [3, 1],
  );
  assert.throws(() =>
    validateSettings("gallery", {
      items: [{ imageUrl: "javascript:alert(1)" }],
    }),
  );
  assert.throws(() =>
    validateSettings("faq", {
      items: [{ question: "<script>x</script>", answer: "No" }],
    }),
  );
});
test("Historial restaura a borrador sin alterar publicación y rechaza anclas repetidas", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  migrate(db);
  seedAll(db);
  try {
    const cms = createCmsService(db),
      admin = db.prepare("SELECT id FROM users WHERE role='admin'").get().id;
    const old = cms.getPublished(),
      oldId = old.version.id;
    cms.saveDraft("home", admin, [
      {
        section_key: "faq-new",
        section_type: "faq",
        variant: "default",
        enabled: true,
        settings: {
          title: "Dudas",
          items: [{ question: "¿Cómo?", answer: "En línea." }],
        },
      },
    ]);
    cms.publish("home", admin);
    const current = cms.getPublished();
    assert.notEqual(current.version.id, oldId);
    assert.ok(cms.history("home").some((x) => x.id === oldId));
    const restored = cms.restore("home", oldId, admin);
    assert.equal(restored.version.status, "draft");
    assert.deepEqual(
      restored.sections.map((s) => s.settings),
      old.sections.map((s) => s.settings),
    );
    assert.equal(cms.getPublished().version.id, current.version.id);
    assert.throws(() => cms.restore("home", 999999, admin));
    const duplicate = restored.sections
      .slice(0, 2)
      .map((s) => ({ ...s, settings: { ...s.settings, anchor: "repetida" } }));
    assert.throws(() => cms.saveDraft("home", admin, duplicate));
  } finally {
    db.close();
  }
});

async function loadCmsContent() {
  const fs = require("node:fs"),
    path = require("node:path");
  const asModule = (source) =>
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  const ui = asModule(
    fs.readFileSync(path.join(__dirname, "../public/assets/js/ui.js"), "utf8"),
  );
  const source = fs
    .readFileSync(
      path.join(__dirname, "../public/assets/js/cms-content.js"),
      "utf8",
    )
    .replace('"./ui.js"', JSON.stringify(ui));
  return import(asModule(source));
}

test("Texto enriquecido escapa HTML y no crea enlaces ejecutables", async () => {
  const { richText } = await loadCmsContent();
  const html = richText(
    "## Título\n- **Importante**\n[Curso](/catalogo)\n[No](javascript:alert)\n<script>alert(1)</script>",
  );
  assert.match(html, /<h3>Título<\/h3>/);
  assert.match(html, /<li><strong>Importante<\/strong><\/li>/);
  assert.match(html, /href="\/catalogo"/);
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes("<script>"));
});
test("Anclas automáticas no se repiten y conservan los destinos habituales", async () => {
  const { sectionAnchors } = await loadCmsContent();
  assert.deepEqual(
    sectionAnchors([
      { section_type: "about" },
      { section_type: "locations" },
      { section_type: "about" },
      { section_type: "faq", settings: { anchor: "preguntas" } },
    ]),
    ["nosotros", "sedes", "nosotros-2", "preguntas"],
  );
  assert.deepEqual(
    sectionAnchors([
      { section_type: "about" },
      { section_type: "faq", settings: { anchor: "nosotros" } },
    ]),
    ["nosotros-2", "nosotros"],
  );
});
