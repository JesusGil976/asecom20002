const fs = require("fs"),
  path = require("path"),
  os = require("os"),
  assert = require("assert/strict"),
  { spawnSync } = require("child_process");
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), "academiave-video-browser-"),
);
Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_DIR: temporary,
  PUBLIC_UPLOAD_DIR: path.join(temporary, "public"),
  DB_FILE: path.join(temporary, "academy.sqlite"),
  SESSION_SECRET: "qa-video-secret-abcdefghijklmnopqrstuvwxyz",
  PUBLIC_URL: "",
  ADMIN_EMAIL: "admin@video-qa.local",
  ADMIN_PASSWORD: "Video-qa-password-2026!",
  EXCHANGE_RATE: "100",
  LOG_LEVEL: "error",
});
const { createApp } = require("../src/app"),
  { closeDatabase, getDatabase } = require("../src/db"),
  { passwordResetMessage } = require("../src/services/mail");
const out = path.resolve(process.env.QA_OUTPUT || "qa/video");
fs.mkdirSync(out, { recursive: true });
async function run() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const app = createApp();
  let server;
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = {
    browser: browser.version(),
    flows: [],
    screenshots: [],
    errors: [],
    sourceBytes: 0,
    storedBytes: 0,
  };
  const admin = await browser.newContext(),
    student = await browser.newContext(),
    guest = await browser.newContext();
  async function request(context, url, method = "GET", body, csrf) {
    const response = await context.request.fetch(base + url, {
      method,
      data: body,
      headers: csrf ? { "x-csrf-token": csrf } : {},
    });
    assert.ok(
      response.ok(),
      `${method} ${url}: ${response.status()} ${await response.text()}`,
    );
    return response.json();
  }
  try {
    const aMe = await request(admin, "/api/auth/me"),
      adm = await request(
        admin,
        "/api/auth/login",
        "POST",
        {
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        },
        aMe.csrfToken,
      );
    const me = await request(student, "/api/auth/me"),
      stu = await request(
        student,
        "/api/auth/register",
        "POST",
        {
          name: "María de prueba",
          email: "student@video-qa.local",
          password: "VideoStudentPassword2026!",
        },
        me.csrfToken,
      );
    const course = (
      await request(
        admin,
        "/api/admin/courses",
        "POST",
        {
          name: "Curso con vídeos propios",
          slug: "video-qa",
          price_usd: 20,
          status: "published",
          duration_hours: 10,
        },
        adm.csrfToken,
      )
    ).course;
    const pay = (
      await request(
        student,
        "/api/payments",
        "POST",
        {
          courseId: course.id,
          payerName: "María",
          payerBank: "Banco",
          payerPhone: "04141234567",
          payerDocument: "V-12345678",
          reference: "VIDEO-QA-PAY",
        },
        stu.csrfToken,
      )
    ).payment;
    await request(
      admin,
      `/api/admin/payments/${pay.id}/approve`,
      "POST",
      {},
      adm.csrfToken,
    );
    const fixture = path.join(temporary, "clase.mp4");
    const generated = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=1280x720:rate=24",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440",
        "-t",
        "12",
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        fixture,
      ],
      { encoding: "utf8" },
    );
    assert.equal(generated.status, 0, generated.stderr);
    results.sourceBytes = fs.statSync(fixture).size;
    const page = await admin.newPage();
    page.on("pageerror", (e) => results.errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") results.errors.push(m.text());
    });
    await page.goto(base + "/admin/cursos");
    await page.locator(`[data-lessons="${course.id}"]`).click();
    await page
      .getByRole("button", { name: "Nueva clase", exact: true })
      .click();
    await page.locator("[name=title]").fill("Clase privada con vídeo propio");
    await page
      .locator("textarea[name=description]")
      .fill("Un vídeo subido directamente a la academia.");
    await page.locator("#video-source").selectOption("upload");
    await page.locator("#video-file").setInputFiles(fixture);
    await page.locator("#upload-video").click();
    await page.waitForFunction(
      () => document.querySelector("#video-asset")?.options.length > 1,
      {},
      { timeout: 120000 },
    );
    results.flows.push(
      "Crear borrador y subir un MP4 mediante XHR por partes; procesar a 720p/480p y seleccionar activo listo",
    );
    await page.locator("#preview-video").click();
    await page.waitForFunction(
      () => document.querySelector("video")?.readyState >= 2,
      {},
      { timeout: 30000 },
    );
    await page.locator("video").evaluate(async (v) => {
      v.muted = true;
      await v.play();
    });
    await page.waitForFunction(
      () => document.querySelector("video")?.currentTime > 0.5,
    );
    await page.locator("video").evaluate((v) => v.pause());
    results.flows.push(
      "Previsualización administrativa reproduce vídeo antes de publicar",
    );
    const captions = path.join(temporary, "subtitulos.vtt");
    fs.writeFileSync(
      captions,
      "WEBVTT\n\n00:00.000 --> 00:06.000\nBienvenida a tu clase.\n",
    );
    await page.locator("#video-captions").setInputFiles(captions);
    await page.locator("[name=status]").selectOption("published");
    await page.locator("#save-lesson").click();
    await page.getByText("Clase publicada.", { exact: true }).waitFor();
    const lesson = (
      await request(admin, `/api/admin/courses/${course.id}/lessons`)
    ).lessons[0];
    results.storedBytes = getDatabase()
      .prepare("SELECT stored_bytes FROM video_assets WHERE id=?")
      .get(lesson.video_asset_id).stored_bytes;
    assert.ok(results.storedBytes < results.sourceBytes);
    results.flows.push(
      "Añadir subtítulos y publicar la clase sólo después de preparación",
    );
    const sp = await student.newPage();
    sp.on("pageerror", (e) => results.errors.push(e.message));
    sp.on("console", (m) => {
      if (m.type() === "error") results.errors.push(m.text());
    });
    await sp.goto(base + "/aula/video-qa");
    await sp.waitForFunction(
      () => document.querySelector("video")?.readyState >= 2,
      {},
      { timeout: 30000 },
    );
    await sp.locator("video").evaluate(async (v) => {
      v.muted = true;
      await v.play();
    });
    await sp.waitForFunction(
      () => document.querySelector("video")?.currentTime > 1,
    );
    await sp.locator("[data-speed]").selectOption("1.5");
    assert.equal(
      await sp.locator("video").evaluate((v) => v.playbackRate),
      1.5,
    );
    await sp.locator("[data-quality]").selectOption("1");
    await sp.locator("video").evaluate((v) => {
      v.currentTime = 5;
      v.pause();
    });
    await sp.waitForTimeout(400);
    assert.ok(
      (await request(student, "/api/courses/video-qa/classroom")).lessons[0]
        .position_seconds >= 4.9,
    );
    await sp.reload();
    await sp.waitForFunction(
      () => document.querySelector("video")?.currentTime >= 4.9,
      {},
      { timeout: 30000 },
    );
    results.flows.push(
      "Reproducción real, cambio de velocidad/calidad, búsqueda y reanudación después de recargar",
    );
    for (const width of [360, 390, 768, 1440]) {
      await sp.setViewportSize({ width, height: 900 });
      await sp.screenshot({
        path: path.join(out, `aula-${width}.png`),
        fullPage: true,
      });
      assert.ok(
        await sp.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const rect = await sp.locator("video").boundingBox();
      assert.ok(rect.width <= width && rect.height < 900);
      results.screenshots.push(`aula-${width}.png`);
    }
    await page.locator(`#lesson-list [data-edit="${lesson.id}"]`).click();
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: path.join(out, `editor-${width}.png`),
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      results.screenshots.push(`editor-${width}.png`);
    }
    await page.locator("[data-modal-close]").click();
    await request(
      admin,
      `/api/admin/courses/${course.id}/lessons`,
      "POST",
      {
        title: "Clase pública por enlace",
        video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        is_free: 1,
        status: "published",
        sort_order: 1,
      },
      adm.csrfToken,
    );
    await page.goto(base + "/admin/cursos");
    await page.locator(`[data-lessons="${course.id}"]`).click();
    await page.locator('[data-move="1"][data-direction="-1"]').click();
    await page.waitForFunction(() =>
      document
        .querySelector("#lesson-list strong")
        ?.textContent.includes("Clase pública por enlace"),
    );
    results.flows.push(
      "Reordenación con botones; conservación de clases públicas por enlace externo",
    );
    const noAccess = await guest.request.get(
      base + `/api/videos/${lesson.id}/master.m3u8`,
    );
    assert.equal(noAccess.status(), 401);
    results.flows.push(
      "Enlace privado copiado a contexto anónimo devuelve 401",
    );
    await request(
      admin,
      `/api/admin/lessons/${lesson.id}`,
      "PUT",
      { ...lesson, is_free: 1, status: "published" },
      adm.csrfToken,
    );
    const gp = await guest.newPage();
    await gp.goto(base + "/curso/video-qa");
    await gp.locator(`[data-preview="${lesson.id}"]`).click();
    await gp.waitForFunction(
      () => document.querySelector("video")?.readyState >= 2,
      {},
      { timeout: 30000 },
    );
    results.flows.push(
      "Vista previa gratuita reproduce vídeo propio publicado sin matrícula",
    );
    const mail = passwordResetMessage({
      name: "María Fernanda",
      academyName: "AcademiaVE",
      resetUrl:
        "https://academia.example/reset-password?token=ejemplo-no-valido",
    });
    fs.writeFileSync(path.join(out, "correo-recuperacion.html"), mail.html);
    const email = await browser.newPage();
    await email.setContent(mail.html);
    for (const width of [390, 768]) {
      await email.setViewportSize({ width, height: 900 });
      await email.screenshot({
        path: path.join(out, `correo-${width}.png`),
        fullPage: true,
      });
      assert.ok(
        await email.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      results.screenshots.push(`correo-${width}.png`);
    }
    results.flows.push(
      "Correo HTML renderizado en móvil y escritorio, con botón y dirección alternativa",
    );
    assert.deepEqual(results.errors, []);
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await app.locals.videoService.close();
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
run().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
