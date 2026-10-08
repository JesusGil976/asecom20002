const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data");

const publicUploadDir = process.env.PUBLIC_UPLOAD_DIR
  ? path.resolve(process.env.PUBLIC_UPLOAD_DIR)
  : path.join(root, "public", "uploads");

const config = {
  root,
  publicDir: path.join(root, "public"),
  dataDir,
  dbFile: process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE)
    : path.join(dataDir, "academy.sqlite"),
  privateUploadDir: path.join(dataDir, "uploads", "private"),
  publicUploadDir,
  certificateTemplateDir: path.join(publicUploadDir, "certificates"),
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  publicUrl: String(process.env.PUBLIC_URL || "").trim(),
  sessionSecret: String(process.env.SESSION_SECRET || "dev-only-change-me"),
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  maxReceiptBytes: Number(process.env.MAX_RECEIPT_BYTES || 8 * 1024 * 1024),
  maxImageBytes: Number(process.env.MAX_IMAGE_BYTES || 8 * 1024 * 1024),
  maxPdfBytes: Number(process.env.MAX_PDF_BYTES || 20 * 1024 * 1024),
  maxVideoBytes: Number(process.env.MAX_VIDEO_BYTES || 1073741824),
  videoStorageBytes: Number(process.env.VIDEO_STORAGE_BYTES || 21474836480),
  maxProcessedVideoBytes: Number(
    process.env.MAX_PROCESSED_VIDEO_BYTES || 4294967296,
  ),
  maxVideoDuration: Number(process.env.MAX_VIDEO_DURATION_SECONDS || 10800),
  videoProcessingMs: Number(
    process.env.VIDEO_PROCESSING_TIMEOUT_MS || 14400000,
  ),
  videoHeights: String(process.env.VIDEO_HEIGHTS || "720,480")
    .split(",")
    .map(Number)
    .filter(
      (n, i, a) =>
        Number.isInteger(n) &&
        n >= 144 &&
        n <= 1080 &&
        n % 2 === 0 &&
        a.indexOf(n) === i,
    )
    .sort((a, b) => b - a)
    .slice(0, 3),
  videoCrf: Number(process.env.VIDEO_CRF || 28),
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  logLevel: process.env.LOG_LEVEL || "info",
};

for (const key of [
  "maxVideoBytes",
  "videoStorageBytes",
  "maxProcessedVideoBytes",
  "maxVideoDuration",
  "videoProcessingMs",
]) {
  if (!Number.isSafeInteger(config[key]) || config[key] <= 0)
    throw new Error("Configuración de vídeo inválida: " + key);
}
if (
  !config.videoHeights.length ||
  !Number.isInteger(config.videoCrf) ||
  config.videoCrf < 18 ||
  config.videoCrf > 35
)
  throw new Error("VIDEO_HEIGHTS o VIDEO_CRF no válidos.");

function assertProductionConfig() {
  if (config.nodeEnv !== "production") return;
  if (
    config.sessionSecret.length < 32 ||
    config.sessionSecret === "dev-only-change-me"
  ) {
    throw new Error(
      "SESSION_SECRET debe tener al menos 32 caracteres en producción.",
    );
  }
  if (!/^https:\/\//i.test(config.publicUrl)) {
    throw new Error("PUBLIC_URL debe ser una URL HTTPS en producción.");
  }
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  if (adminPassword.length < 12 || adminPassword === "CambiaEstaClave123!") {
    throw new Error(
      "ADMIN_PASSWORD debe configurarse con una contraseña fuerte en producción.",
    );
  }
  const requiredMail = ["MAIL_HOST", "MAIL_USER", "MAIL_PASSWORD"];
  if (requiredMail.some((name) => !String(process.env[name] || "").trim())) {
    throw new Error("Falta configurar MAIL_HOST, MAIL_USER y MAIL_PASSWORD.");
  }
}

module.exports = { config, assertProductionConfig };
