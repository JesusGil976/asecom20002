require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getDatabase, closeDatabase } = require("../db");
const { config } = require("../config");
const { assetDir, dirSize } = require("./video");
let activeChild;
let terminating = false;
process.on("SIGTERM", () => {
  terminating = true;
  activeChild?.kill("SIGKILL");
});
function execute(
  binary,
  args,
  { maxBytes = 512 * 1024, timeout = config.videoProcessingMs, guard } = {},
) {
  if (terminating) return Promise.reject(new Error("Procesamiento detenido."));
  return new Promise((resolve, reject) => {
    let output = "",
      error = "",
      exceeded = false;
    const child = (activeChild = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
    }));
    const timer = setTimeout(() => {
      exceeded = true;
      child.kill("SIGKILL");
    }, timeout);
    const monitor =
      guard &&
      setInterval(() => {
        try {
          if (!guard()) {
            exceeded = true;
            child.kill("SIGKILL");
          }
        } catch {
          exceeded = true;
          child.kill("SIGKILL");
        }
      }, 2000);
    child.stdout.on("data", (bytes) => {
      output += bytes;
      if (output.length > maxBytes) {
        exceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (bytes) => {
      error = (error + bytes).slice(-8192);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      clearInterval(monitor);
      activeChild = null;
      if (terminating || exceeded || code !== 0)
        reject(
          new Error(
            exceeded
              ? "El vídeo supera los límites de procesamiento o almacenamiento."
              : "No se pudo procesar el vídeo. Comprueba el archivo y la instalación de FFmpeg.",
          ),
        );
      else resolve(output);
    });
  });
}
async function processVideo(id) {
  const db = getDatabase(),
    asset = db
      .prepare("SELECT * FROM video_assets WHERE id=? AND state='queued'")
      .get(id);
  if (!asset) return;
  const folder = assetDir(id),
    source = path.join(folder, "source"),
    output = path.join(folder, "hls");
  db.prepare(
    "UPDATE video_assets SET state='processing',error='',updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(id);
  try {
    const file = fs.openSync(source, "r"),
      signature = Buffer.alloc(12);
    fs.readSync(file, signature, 0, 12, 0);
    fs.closeSync(file);
    const format = ["ftyp", "moov", "mdat", "wide", "free"].includes(
      signature.toString("ascii", 4, 8),
    )
      ? "mov"
      : signature.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
        ? "matroska"
        : null;
    if (!format) throw new Error("Sube un vídeo MP4, MOV o WebM válido.");
    const inputArgs = [
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      format,
      ...(format === "mov" ? ["-enable_drefs", "0"] : []),
      "-i",
      source,
    ];
    const probe = JSON.parse(
      await execute(
        config.ffprobePath,
        [
          "-v",
          "error",
          ...inputArgs,
          "-show_format",
          "-show_streams",
          "-of",
          "json",
        ],
        { timeout: 30000 },
      ),
    );
    const stream = probe.streams?.find(
      (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
    );
    const duration = Number(probe.format?.duration);
    if (
      !stream ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > config.maxVideoDuration ||
      stream.width > 4096 ||
      stream.height > 4096
    )
      throw new Error("El vídeo no tiene una duración o resolución admitida.");
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output, { mode: 0o700 });
    const heights = config.videoHeights.filter((h) => h <= stream.height);
    if (!heights.length)
      heights.push(Math.max(2, Math.floor(stream.height / 2) * 2));
    const audio = probe.streams.some((s) => s.codec_type === "audio");
    const other = db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN state IN ('uploading','queued','processing') THEN MAX(stored_bytes,expected_bytes*3) ELSE stored_bytes END),0) n FROM video_assets WHERE id!=?",
      )
      .get(id).n;
    const budget = Math.min(
      config.videoStorageBytes - other,
      config.maxProcessedVideoBytes,
    );
    const guard = () =>
      dirSize(folder) <= budget &&
      fs.statfsSync(folder).bavail * fs.statfsSync(folder).bsize >
        128 * 1024 * 1024;
    const entries = [];
    for (const height of heights) {
      const name = `v${height}`;
      fs.mkdirSync(path.join(output, name));
      const playlist = path.join(output, name, "index.m3u8");
      await execute(
        config.ffmpegPath,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-y",
          ...inputArgs,
          "-map",
          "0:v:0",
          ...(audio ? ["-map", "0:a:0"] : ["-an"]),
          "-sn",
          "-dn",
          "-map_metadata",
          "-1",
          "-vf",
          `scale=-2:${height},setsar=1`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          String(config.videoCrf),
          "-pix_fmt",
          "yuv420p",
          "-threads",
          "1",
          "-force_key_frames",
          "expr:gte(t,n_forced*6)",
          ...(audio ? ["-c:a", "aac", "-b:a", "96k", "-ac", "2"] : []),
          "-f",
          "hls",
          "-hls_time",
          "6",
          "-hls_playlist_type",
          "vod",
          "-hls_flags",
          "independent_segments",
          "-hls_segment_filename",
          path.join(output, name, "seg-%06d.ts"),
          playlist,
        ],
        { guard },
      );
      if (!guard())
        throw new Error("El vídeo supera la cuota de almacenamiento.");
      const bytes = dirSize(path.join(output, name));
      const bandwidth = Math.ceil(((bytes * 8) / duration) * 1.3);
      const width =
        Math.floor(((stream.width / stream.height) * height) / 2) * 2;
      entries.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}\n${name}/index.m3u8`,
      );
    }
    fs.writeFileSync(
      path.join(output, "master.m3u8"),
      "#EXTM3U\n#EXT-X-VERSION:3\n" + entries.join("\n") + "\n",
      { mode: 0o600 },
    );
    // Keep only the optimized delivery files. The administrator retains the local original.
    const bytes = dirSize(folder);
    db.prepare(
      "UPDATE video_assets SET state='ready',stored_bytes=?,duration_seconds=?,error='',updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(bytes, duration, id);
    try {
      fs.unlinkSync(source);
      db.prepare("UPDATE video_assets SET stored_bytes=? WHERE id=?").run(
        dirSize(folder),
        id,
      );
    } catch {}
    // Do not switch the source automatically: the editor explicitly selects and publishes it.
  } catch (error) {
    fs.rmSync(output, { recursive: true, force: true });
    db.prepare(
      "UPDATE video_assets SET state=?,stored_bytes=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      terminating ? "queued" : "failed",
      dirSize(folder),
      terminating ? "" : String(error.message).slice(0, 300),
      id,
    );
  }
}
if (require.main === module)
  processVideo(process.argv[2])
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(closeDatabase);
module.exports = { processVideo };
