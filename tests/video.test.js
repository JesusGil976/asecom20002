const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawnSync } = require("child_process");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "academiave-video-"));
Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_DIR: tmp,
  DB_FILE: path.join(tmp, "academy.sqlite"),
  PUBLIC_UPLOAD_DIR: path.join(tmp, "public"),
  PUBLIC_URL: "",
  SESSION_SECRET: "video-test-secret-abcdefghijklmnopqrstuvwxyz",
  ADMIN_EMAIL: "video-admin@test.local",
  ADMIN_PASSWORD: "VideoAdminPassword2026!",
  EXCHANGE_RATE: "100",
  LOG_LEVEL: "error",
  VIDEO_HEIGHTS: "480,240",
  MAX_VIDEO_BYTES: "5000000",
  VIDEO_STORAGE_BYTES: "50000000",
  MAX_PROCESSED_VIDEO_BYTES: "10000000",
});
const { createApp } = require("../src/app"),
  { getDatabase, closeDatabase } = require("../src/db"),
  { assetDir } = require("../src/services/video");
let app,
  server,
  base,
  admin,
  student,
  stranger,
  course,
  lesson,
  asset,
  bytes,
  paymentId;
function client() {
  let cookie = "",
    csrf = "";
  return async (url, method = "GET", body, extra = {}) => {
    const headers = { ...extra };
    if (cookie) headers.cookie = cookie;
    if (method !== "GET")
      headers["x-csrf-token"] = extra["x-csrf-token"] ?? csrf;
    if (body && !(body instanceof Buffer) && typeof body !== "string") {
      headers["content-type"] = "application/json";
      body = JSON.stringify(body);
    }
    const response = await fetch(base + url, { method, headers, body });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = (response.headers.get("content-type") || "").includes("json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    if (data.csrfToken) csrf = data.csrfToken;
    return { status: response.status, data, headers: response.headers };
  };
}
async function register(c, email) {
  await c("/api/auth/me");
  return (
    await c("/api/auth/register", "POST", {
      name: "Alumna de vídeo",
      email,
      password: "StudentPassword2026!",
    })
  ).data.user;
}
const write = (id, offset, data) =>
  admin(`/api/admin/videos/uploads/${id}/chunk`, "PUT", data, {
    "content-type": "application/octet-stream",
    "upload-offset": String(offset),
  });
async function waitAsset(id) {
  for (let n = 0; n < 100; n++) {
    const r = await admin(`/api/admin/videos/uploads/${id}`);
    if (["ready", "failed"].includes(r.data.state)) return r.data;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("El trabajador de vídeo no terminó.");
}
test.before(async () => {
  app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  admin = client();
  student = client();
  stranger = client();
  await admin("/api/auth/me");
  assert.equal(
    (
      await admin("/api/auth/login", "POST", {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      })
    ).status,
    200,
  );
  const user = await register(student, "video-student@test.local");
  await register(stranger, "video-stranger@test.local");
  course = (
    await admin("/api/admin/courses", "POST", {
      name: "Curso privado de vídeo",
      slug: "video-course",
      price_usd: 20,
      status: "published",
    })
  ).data.course;
  lesson = (
    await admin(`/api/admin/courses/${course.id}/lessons`, "POST", {
      title: "Vídeo de prueba",
      content: "Privado",
    })
  ).data.lesson;
  const payment = await student("/api/payments", "POST", {
    courseId: course.id,
    payerName: "Alumno",
    payerBank: "Banco",
    payerPhone: "04141234567",
    payerDocument: "V-12345678",
    reference: "VIDEO-PAY-001",
  });
  assert.equal(payment.status, 201);
  paymentId = payment.data.payment.id;
  assert.equal(
    (await admin(`/api/admin/payments/${paymentId}/approve`, "POST", {}))
      .status,
    200,
  );
  const fixture = path.join(tmp, "fixture.mp4");
  const r = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x480:rate=24",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440",
      "-t",
      "10",
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
  assert.equal(r.status, 0, r.stderr);
  bytes = fs.readFileSync(fixture);
});
test.after(async () => {
  app.locals.videoService.close();
  await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tmp, { recursive: true, force: true });
});
test("clase nueva queda en borrador: catálogo, aula, progreso y PDF no la exponen", async () => {
  assert.equal(lesson.status, "draft");
  assert.equal(
    (await client()("/api/courses/video-course")).data.lessons.length,
    0,
  );
  assert.equal(
    (await student("/api/courses/video-course/classroom")).data.lessons.length,
    0,
  );
  assert.equal(
    (await student(`/api/lessons/${lesson.id}/view`, "POST", {})).status,
    404,
  );
  assert.equal(
    (
      await student(`/api/lessons/${lesson.id}/progress`, "POST", {
        completed: true,
      })
    ).status,
    404,
  );
});
test("subida exige rol y CSRF, límites de tamaño y una clase propia en borrador", async () => {
  assert.equal(
    (
      await student("/api/admin/videos/uploads", "POST", {
        lessonId: lesson.id,
        name: "test.mp4",
        size: bytes.length,
      })
    ).status,
    403,
  );
  assert.equal((await client()("/api/admin/videos/config")).status, 401);
  assert.equal(
    (
      await admin("/api/admin/videos/uploads", "POST", {
        lessonId: lesson.id,
        name: "test.mp4",
        size: 5000001,
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await admin("/api/admin/videos/uploads", "POST", {
        lessonId: 999999,
        name: "test.mp4",
        size: 10,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await admin(
        "/api/admin/videos/uploads",
        "POST",
        { lessonId: lesson.id, name: "x", size: 1 },
        { "x-csrf-token": "" },
      )
    ).status,
    403,
  );
  const started = await admin("/api/admin/videos/uploads", "POST", {
    lessonId: lesson.id,
    name: "../../private.mp4",
    size: bytes.length,
  });
  assert.equal(started.status, 201, JSON.stringify(started.data));
  asset = started.data;
  assert.match(asset.id, /^[a-f0-9]{32}$/);
  assert.ok(fs.existsSync(path.join(assetDir(asset.id), "source")));
});
test("fragmentos reanudan en offset exacto y no aceptan datos de otra cuenta ni exceso", async () => {
  const halfway = Math.floor(bytes.length / 2);
  assert.equal(
    (await write(asset.id, 0, bytes.subarray(0, halfway))).status,
    200,
  );
  assert.equal(
    (await admin(`/api/admin/videos/uploads/${asset.id}`)).data.receivedBytes,
    halfway,
  );
  assert.equal((await write(asset.id, 0, bytes.subarray(0, 20))).status, 409);
  assert.equal(
    (await admin(`/api/admin/videos/uploads/${asset.id}/finish`, "POST", {}))
      .status,
    409,
  );
  assert.equal(
    (
      await stranger(
        `/api/admin/videos/uploads/${asset.id}/chunk`,
        "PUT",
        bytes.subarray(0, 20),
        {
          "content-type": "application/octet-stream",
          "upload-offset": String(halfway),
        },
      )
    ).status,
    403,
  );
  assert.equal((await write(asset.id, halfway, bytes)).status, 400);
  assert.equal(
    (await write(asset.id, halfway, bytes.subarray(halfway))).status,
    200,
  );
});
test("no se publica mientras existe una subida pendiente", async () => {
  assert.equal(
    (
      await admin(`/api/admin/lessons/${lesson.id}`, "PUT", {
        ...lesson,
        status: "published",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await admin(`/api/admin/lessons/${lesson.id}`, "PUT", {
        ...lesson,
        video_asset_id: asset.id,
        status: "draft",
      })
    ).status,
    400,
  );
});
test("trabajador real convierte a HLS con dos calidades, guarda estado y elimina original", async () => {
  assert.equal(
    (await admin(`/api/admin/videos/uploads/${asset.id}/finish`, "POST", {}))
      .status,
    200,
  );
  const done = await waitAsset(asset.id);
  assert.equal(done.state, "ready", done.error);
  assert.ok(done.duration >= 9);
  assert.equal(fs.existsSync(path.join(assetDir(asset.id), "source")), false);
  const master = fs.readFileSync(
    path.join(assetDir(asset.id), "hls/master.m3u8"),
    "utf8",
  );
  assert.match(master, /v480\/index.m3u8/);
  assert.match(master, /v240\/index.m3u8/);
  assert.equal(
    (await admin(`/api/admin/video-preview/${asset.id}/master.m3u8`)).status,
    200,
  );
  assert.equal(
    (await stranger(`/api/admin/video-preview/${asset.id}/master.m3u8`)).status,
    403,
  );
  const attached = await admin(`/api/admin/lessons/${lesson.id}`, "PUT", {
    ...lesson,
    video_asset_id: asset.id,
    status: "draft",
  });
  assert.equal(attached.status, 200);
  lesson = attached.data.lesson;
  assert.equal(
    (await student(`/api/videos/${lesson.id}/master.m3u8`)).status,
    404,
  );
});
test("subtítulos se validan y se mantienen privados; publicación conserva vídeo seleccionado", async () => {
  assert.equal(
    (
      await admin(
        `/api/admin/videos/${asset.id}/captions`,
        "PUT",
        "<script>bad</script>",
        { "content-type": "text/vtt" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await admin(
        `/api/admin/videos/${asset.id}/captions`,
        "PUT",
        "WEBVTT\n\n00:00.000 --> 00:03.000\nHola, clase.\n",
        { "content-type": "text/vtt" },
      )
    ).status,
    200,
  );
  const published = await admin(`/api/admin/lessons/${lesson.id}`, "PUT", {
    ...lesson,
    status: "published",
  });
  assert.equal(published.status, 200);
  lesson = published.data.lesson;
  const aula = await student("/api/courses/video-course/classroom");
  assert.equal(aula.data.lessons.length, 1);
  assert.equal(aula.data.lessons[0].video.captions, true);
  assert.equal(
    (
      await admin(
        `/api/admin/videos/${asset.id}/captions`,
        "PUT",
        "WEBVTT\n\n00:00.000 --> 00:03.000\nCambio\n",
        { "content-type": "text/vtt" },
      )
    ).status,
    409,
  );
});
test("manifiesto, variantes, segmentos, HEAD y subtítulos comprueban matrícula en cada petición", async () => {
  for (const resource of [
    "master.m3u8",
    "v480/index.m3u8",
    "v480/seg-000000.ts",
    "captions.vtt",
  ]) {
    const url = `/api/videos/${lesson.id}/${resource}`;
    assert.equal((await student(url)).status, 200);
    assert.equal((await stranger(url)).status, 403);
    assert.equal((await client()(url)).status, 401);
  }
  const master = await student(`/api/videos/${lesson.id}/master.m3u8`);
  assert.equal(master.headers.get("cache-control"), "private, no-store");
  assert.equal(master.headers.get("vary"), "Cookie");
  assert.equal(
    (await student(`/api/videos/${lesson.id}/master.m3u8`, "HEAD")).status,
    200,
  );
  assert.equal((await student(`/api/videos/${lesson.id}/source`)).status, 404);
  assert.equal(
    (await client()(`/uploads/videos/${asset.id}/hls/master.m3u8`)).headers
      .get("content-type")
      ?.includes("mpegurl"),
    false,
  );
  assert.equal(
    (
      await admin("/api/admin/videos/uploads", "POST", {
        lessonId: lesson.id,
        name: "next.mp4",
        size: 100,
      })
    ).status,
    409,
  );
});
test("posición se guarda por alumno, limita duración y no habilita completar por reproducción", async () => {
  assert.equal(
    (
      await student(`/api/lessons/${lesson.id}/position`, "POST", {
        position: 4.5,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await stranger(`/api/lessons/${lesson.id}/position`, "POST", {
        position: 4.5,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await student(`/api/lessons/${lesson.id}/position`, "POST", {
        position: 99999,
      })
    ).status,
    400,
  );
  const row = (await student("/api/courses/video-course/classroom")).data
    .lessons[0];
  assert.equal(row.position_seconds, 4.5);
  assert.equal(row.completed, false);
});
test("retirar matrícula, cerrar sesión y pasar a borrador revoca nuevas solicitudes", async () => {
  const db = getDatabase(),
    uid = db
      .prepare("SELECT id FROM users WHERE email='video-student@test.local'")
      .get().id;
  db.prepare("DELETE FROM enrollments WHERE user_id=? AND course_id=?").run(
    uid,
    course.id,
  );
  assert.equal(
    (await student(`/api/videos/${lesson.id}/v480/seg-000000.ts`)).status,
    403,
  );
  db.prepare(
    "INSERT INTO enrollments(user_id,course_id,payment_id) VALUES(?,?,?)",
  ).run(uid, course.id, paymentId);
  assert.equal((await student("/api/auth/logout", "POST", {})).status, 200);
  assert.equal(
    (await student(`/api/videos/${lesson.id}/master.m3u8`)).status,
    401,
  );
  assert.equal(
    (
      await admin(`/api/admin/lessons/${lesson.id}`, "PUT", {
        ...lesson,
        status: "draft",
      })
    ).status,
    200,
  );
  assert.equal(
    (await stranger(`/api/videos/${lesson.id}/master.m3u8`)).status,
    404,
  );
});
test("vista gratuita permite sólo clases publicadas y se cierra al archivar curso", async () => {
  lesson = (
    await admin(`/api/admin/lessons/${lesson.id}`, "PUT", {
      ...lesson,
      is_free: 1,
      status: "published",
    })
  ).data.lesson;
  assert.equal(
    (await client()(`/api/videos/${lesson.id}/master.m3u8`)).status,
    200,
  );
  const preview = await client()(
    `/api/courses/video-course/preview/${lesson.id}`,
  );
  assert.equal(preview.status, 200);
  assert.match(preview.data.lesson.video.url, /master.m3u8$/);
  await admin(`/api/admin/courses/${course.id}`, "DELETE");
  assert.equal(
    (await client()(`/api/videos/${lesson.id}/master.m3u8`)).status,
    401,
  );
});
test("archivo falso falla en procesamiento, no se puede asociar y puede retirarse", async () => {
  const draft = (
    await admin(`/api/admin/courses/${course.id}/lessons`, "POST", {
      title: "Archivo falso",
    })
  ).data.lesson;
  const bad = (
    await admin("/api/admin/videos/uploads", "POST", {
      lessonId: draft.id,
      name: "fake.mp4",
      size: 20,
    })
  ).data;
  await write(bad.id, 0, Buffer.alloc(20));
  await admin(`/api/admin/videos/uploads/${bad.id}/finish`, "POST", {});
  const result = await waitAsset(bad.id);
  assert.equal(result.state, "failed");
  assert.match(result.error, /MP4/);
  assert.equal(
    (
      await admin(`/api/admin/lessons/${draft.id}`, "PUT", {
        ...draft,
        video_asset_id: bad.id,
        status: "published",
      })
    ).status,
    400,
  );
  assert.equal(
    (await admin(`/api/admin/videos/uploads/${bad.id}`, "DELETE")).status,
    200,
  );
  assert.equal(fs.existsSync(assetDir(bad.id)), false);
});
test("asociar activo de otra clase se rechaza; eliminar clase retira sus vídeos físicos", async () => {
  const other = (
    await admin(`/api/admin/courses/${course.id}/lessons`, "POST", {
      title: "Otra clase",
    })
  ).data.lesson;
  assert.equal(
    (
      await admin(`/api/admin/lessons/${other.id}`, "PUT", {
        ...other,
        video_asset_id: asset.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (await admin(`/api/admin/videos/uploads/${asset.id}`, "DELETE")).status,
    409,
  );
  assert.equal(
    (await admin(`/api/admin/lessons/${lesson.id}`, "DELETE")).status,
    200,
  );
  assert.equal(fs.existsSync(assetDir(asset.id)), false);
  assert.equal(
    getDatabase()
      .prepare("SELECT id FROM video_assets WHERE id=?")
      .get(asset.id),
    undefined,
  );
});
