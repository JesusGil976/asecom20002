const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "asecom-cms-"));
Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_DIR: tmp,
  DB_FILE: path.join(tmp, "db.sqlite"),
  PUBLIC_UPLOAD_DIR: path.join(tmp, "uploads"),
  SESSION_SECRET: "cms-test-session-secret-012345678901234567890",
  ADMIN_EMAIL: "cms@example.test",
  ADMIN_PASSWORD: "Test-cms-pass-2026!",
  LOG_LEVEL: "warn",
});
const { createApp } = require("../src/app"),
  { closeDatabase } = require("../src/db");
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const packed = process.env.CHROMIUM_MODULE
    ? (await import(process.env.CHROMIUM_MODULE)).default
    : null;
  const browser = await chromium.launch({
    headless: true,
    ...(packed
      ? { executablePath: await packed.executablePath(), args: packed.args }
      : { args: ["--no-sandbox"] }),
  });
  let server;
  try {
    const app = createApp();
    await new Promise((r) => {
      server = app.listen(0, "127.0.0.1", r);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const ctx = await browser.newContext();
    const req = async (url, method = "GET", data, csrf) => {
      const r = await ctx.request.fetch(base + url, {
        method,
        data,
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      assert.ok(r.ok(), await r.text());
      return r.json();
    };
    const me = await req("/api/auth/me");
    const login = await req(
      "/api/auth/login",
      "POST",
      { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
      me.csrfToken,
    );
    const page = await ctx.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(base + "/admin/cms");
    await page.locator("#cms-save").waitFor();
    await page
      .locator('[name="settings.internalName"]')
      .fill("Portada editable");
    await page.locator('[name="settings.primaryHref"]').fill("/#nosotros");
    await page.locator('[name="settings.imageFit"]').selectOption("contain");
    await page.locator("#cms-save").click();
    await page
      .getByText("Borrador guardado.", { exact: true })
      .first()
      .waitFor();
    let draft = await req("/api/admin/cms/home");
    assert.equal(draft.sections[0].settings.primaryHref, "/#nosotros");
    const count = draft.sections.length;
    await page.locator('[data-copy="0"]').click();
    assert.equal(await page.locator("[data-block-index]").count(), count + 1);
    await page.locator("#cms-save").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#cms-status")?.textContent ===
        "Borrador guardado",
    );
    draft = await req("/api/admin/cms/home");
    assert.ok(draft.sections.at(-1).settings.anchor);
    await page.locator("#cms-add").click();
    await page.locator("dialog select").selectOption("faq");
    await page.locator('dialog button[value="add"]').click();
    await page.locator("[data-item-add]").click();
    await page
      .locator('[name="settings.items.0.question"]')
      .fill("¿Cómo estudio?");
    await page.locator('[name="settings.items.0.answer"]').fill("A tu ritmo.");
    await page
      .locator('[name="settings.internalName"]')
      .fill("Preguntas de alumnos");
    await page.reload();
    await page.locator("#cms-save").waitFor();
    await page.locator("[data-select]").last().click();
    assert.equal(
      await page.locator('[name="settings.items.0.question"]').inputValue(),
      "¿Cómo estudio?",
    );
    await page.locator("#cms-save").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#cms-status")?.textContent ===
        "Borrador guardado",
    );
    const popupPromise = page.waitForEvent("popup");
    await page.locator("#cms-preview").click();
    const popup = await popupPromise;
    await popup.waitForURL("**/cms-preview.html");
    await popup.locator("#device").selectOption("390px");
    await popup
      .frameLocator("#preview")
      .locator("details summary")
      .getByText("¿Cómo estudio?")
      .waitFor();
    assert.equal(
      await popup.locator("#preview").evaluate((el) => el.clientWidth),
      390,
    );
    await Promise.all([
      page.waitForEvent("load"),
      page.locator("#cms-publish").click(),
    ]);
    await page.locator("#cms-save").waitFor();
    await page.goto(base + "/");
    await page.getByText("¿Cómo estudio?", { exact: true }).waitFor();
    const ids = await page
      .locator("#main section[id]")
      .evaluateAll((els) => els.map((e) => e.id));
    assert.equal(new Set(ids).size, ids.length);
    await page.goto(base + "/admin/cms");
    await page.locator("#cms-history").click();
    await page.locator("[data-restore]").last().click();
    await page.locator("#cms-save").waitFor();
    draft = await req("/api/admin/cms/home");
    assert.ok(!draft.sections.some((s) => s.section_type === "faq"));
    const site = await req("/api/site");
    assert.ok(site.home.sections.some((s) => s.section_type === "faq"));
    await page.goto(base + "/admin/configuracion");
    await page.locator("[data-section-target]").first().waitFor();
    await page
      .locator("[data-section-target]")
      .first()
      .selectOption("/#nosotros");
    assert.equal(
      await page.locator('[name="href-0"]').inputValue(),
      "/#nosotros",
    );
    await page.goto(base + "/admin/cms");
    await page.locator("#cms-save").waitFor();
    draft = await req("/api/admin/cms/home");
    const statsIndex = draft.sections.findIndex(
      (s) => s.section_type === "stats",
    );
    await page.locator(`[data-select="${statsIndex}"]`).click();
    await page.locator("[data-item-add]").click();
    await page.locator('[name="settings.items.3.value"]').fill("4");
    await page
      .locator('[name="settings.items.3.label"]')
      .fill("Cuarto elemento");
    await page.locator("#cms-save").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#cms-status")?.textContent ===
        "Borrador guardado",
    );
    draft = await req("/api/admin/cms/home");
    assert.equal(draft.sections[statsIndex].settings.items.length, 4);
    assert.equal(draft.sections[statsIndex].settings.mobileHidden, false);
    const course = await req(
      "/api/admin/courses",
      "POST",
      {
        name: "Curso SEO",
        slug: "curso-seo",
        price_usd: 10,
        status: "published",
        seo_title: "Título SEO especial",
        seo_description: "Descripción SEO especial",
      },
      login.csrfToken,
    );
    const html = await ctx.request.get(base + "/curso/curso-seo");
    assert.match(await html.text(), /<title>Título SEO especial<\/title>/);
    await page.goto(base + "/curso/curso-seo");
    await page.waitForFunction(() => document.title === "Título SEO especial");
    assert.equal(
      await page.locator('meta[name="description"]').getAttribute("content"),
      "Descripción SEO especial",
    );
    await page.route("**/api/courses", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"Fallo simulado"}',
      }),
    );
    await page.goto(base + "/#nosotros");
    await page.locator("#nosotros").waitFor();
    await page
      .getByText("No se pudieron cargar los cursos.", { exact: false })
      .waitFor();
    assert.ok(
      Math.abs(
        await page
          .locator("#nosotros")
          .evaluate((el) => el.getBoundingClientRect().top),
      ) < 150,
    );
    await page.unroute("**/api/courses");
    await page.goto(base + "/admin/cms");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#cms-save").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(tmp, "cms-mobile.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: guardar, duplicar, FAQ, recuperar, publicar, historial privado, navegación, preview 390px y editor móvil.",
    );
    console.log("Screenshot:", path.join(tmp, "cms-mobile.png"));
  } finally {
    await browser.close();
    await new Promise((r) => (server ? server.close(r) : r()));
    closeDatabase();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
