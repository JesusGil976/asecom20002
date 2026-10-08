const test = require("node:test"),
  assert = require("node:assert/strict"),
  Database = require("better-sqlite3");
const { migrate } = require("../src/db");
const { seedAll } = require("../src/db/seed");
const { createCmsService } = require("../src/services/cms");
const { createSettingsService } = require("../src/services/settings");
function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  migrate(db);
  seedAll(db);
  return {
    db,
    admin: db.prepare("SELECT id FROM users WHERE role='admin'").get().id,
  };
}
test("CMS mantiene borrador privado y publica colores y pie seguros con historia intacta", () => {
  const { db, admin } = fixture(),
    cms = createCmsService(db),
    before = cms.getPublished();
  cms.saveDraft("home", admin, [
    {
      section_key: "footer-custom",
      section_type: "footer",
      variant: "minimal",
      enabled: true,
      settings: {
        title: "Contacto de la academia",
        text: "Escríbenos para conocer los cursos.",
        backgroundColor: "#142d2a",
        textColor: "#ffffff",
        accentColor: "#a9c7b0",
      },
    },
  ]);
  assert.deepEqual(cms.getPublished(), before);
  assert.equal(cms.getEditor().sections[0].settings.textColor, "#ffffff");
  cms.publish("home", admin);
  assert.equal(cms.getPublished().sections[0].section_type, "footer");
  assert.ok(
    db
      .prepare("SELECT COUNT(*) n FROM page_versions WHERE status='archived'")
      .get().n,
  );
  db.close();
});
test("CMS rechaza CSS inyectado y revierte la sección completa conservando borrador", () => {
  const { db, admin } = fixture(),
    cms = createCmsService(db);
  cms.ensureDraft("home", admin);
  const before = cms.getEditor();
  for (const value of [
    "red",
    "url(https://evil.test)",
    ";position:fixed",
    "#ffffff;display:none",
    "var(--primary)",
    "<script>",
  ])
    assert.throws(
      () =>
        cms.saveDraft("home", admin, [
          {
            section_key: "x",
            section_type: "hero",
            variant: "split",
            enabled: true,
            settings: { backgroundColor: value },
          },
        ]),
      (e) => e.status === 400,
    );
  assert.deepEqual(cms.getEditor(), before);
  db.close();
});
test("diseño conserva temas existentes y valida estilo, densidad y tipografía sin CSS arbitrario", () => {
  const { db } = fixture(),
    settings = createSettingsService(db);
  settings.updateDesignTokens({
    primary: "#123456",
    button_style: "pill",
    density: "compact",
    font_family: "Georgia, serif",
    radius_sm: "8px",
    radius_md: "16px",
    content_width: "1180px",
    shadow: "0 8px 24px rgba(20, 45, 42, .08)",
  });
  seedAll(db);
  const d = settings.getDesignTokens();
  assert.equal(d.primary, "#123456");
  assert.equal(d.button_style, "pill");
  assert.equal(d.font_family, "Georgia, serif");
  for (const patch of [
    { button_style: "hidden" },
    { density: "zero" },
    { font_family: "Arial; display:none" },
    { shadow: "url(https://evil.test)" },
    { radius_md: "1px;position:fixed" },
    { content_width: "100vw" },
    { primary: "#111111", button_style: "evil" },
  ])
    assert.throws(
      () => settings.updateDesignTokens(patch),
      (e) => e.status === 400,
    );
  assert.equal(settings.getDesignTokens().primary, "#123456");
  db.close();
});
