const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { config } = require("./config");
const { getDatabase } = require("./db");
const { seedAll } = require("./db/seed");
const { SQLiteSessionStore } = require("./db/session-store");
const { createAuthMiddleware } = require("./middleware/auth");
const { verifyOrigin } = require("./middleware/origin");
const { errorHandler } = require("./middleware/error-handler");
const { requestId } = require("./utils/http");
const logger = require("./utils/logger");
const { createSettingsService } = require("./services/settings");
const { createAuditService } = require("./services/audit");
const { createCmsService } = require("./services/cms");
const { createCourseService } = require("./services/courses");
const { createCertificateService } = require("./services/certificates");
const {
  createCertificateLayoutService,
} = require("./services/certificate-layout");
const { createAuthRoutes } = require("./routes/auth");
const { createPublicRoutes } = require("./routes/public");
const { createStudentRoutes } = require("./routes/student");
const { createPaymentRoutes } = require("./routes/payments");
const { createFileRoutes } = require("./routes/files");
const { createAdminCoreRoutes } = require("./routes/admin-core");
const { createAdminCmsRoutes } = require("./routes/admin-cms");
const { createVideoService } = require("./services/video");
const { createVideoRoutes } = require("./routes/video");

function createApp() {
  const db = getDatabase();
  seedAll(db);
  const settings = createSettingsService(db);
  const audit = createAuditService(db);
  const cms = createCmsService(db);
  const courses = createCourseService(db);
  const certificateLayout = createCertificateLayoutService(db);
  const certificates = createCertificateService(
    db,
    settings,
    certificateLayout,
  );
  const auth = createAuthMiddleware(db);
  const app = express();
  const video = createVideoService(db);
  app.locals.videoService = video;
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.id = requestId();
    res.setHeader("X-Request-Id", req.id);
    next();
  });
  const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    styleSrcAttr: ["'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    frameSrc: [
      "'self'",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://player.vimeo.com",
      "https://www.google.com",
      "https://maps.google.com",
    ],
    mediaSrc: ["'self'", "blob:", "https:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
  if (config.nodeEnv === "production")
    cspDirectives.upgradeInsecureRequests = [];
  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  const store = new SQLiteSessionStore(db);
  store.clearExpired();
  setInterval(() => store.clearExpired(), 60 * 60 * 1000).unref();
  app.use(
    session({
      store,
      name: "connect.sid",
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(auth.attachUser);
  app.use(verifyOrigin);
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api/"))
        logger.info("http_request", {
          requestId: req.id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
          userId: req.user?.id || null,
        });
    });
    next();
  });

  app.use("/api/auth", createAuthRoutes({ db, auth, audit }));
  app.use("/api", createPublicRoutes({ db, settings, cms, courses }));
  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      version: require("../package.json").version,
      time: new Date().toISOString(),
    }),
  );
  app.use("/api", createVideoRoutes({ db, auth, video, audit }));
  app.use(
    "/api",
    createStudentRoutes({ db, auth, courses, certificates, audit }),
  );
  app.use("/api", createPaymentRoutes({ db, auth, settings, audit }));
  app.use("/api", createFileRoutes({ db, auth }));
  app.use(
    "/api/admin",
    createAdminCoreRoutes({
      db,
      auth,
      courses,
      settings,
      audit,
      certificates,
      certificateLayout,
      video,
    }),
  );
  app.use("/api/admin", createAdminCmsRoutes({ auth, cms, audit }));

  app.use(
    "/uploads",
    express.static(config.publicUploadDir, {
      index: false,
      maxAge: config.nodeEnv === "production" ? "1d" : 0,
    }),
  );
  app.use(
    express.static(config.publicDir, {
      index: false,
      maxAge: config.nodeEnv === "production" ? "1h" : 0,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}uploads${path.sep}`))
          res.setHeader("Cache-Control", "public, max-age=86400");
      },
    }),
  );
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(config.publicDir, "index.html"));
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({ error: "Recurso no encontrado." });
    next();
  });
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
