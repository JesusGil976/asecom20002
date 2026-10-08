require("dotenv").config();
const fs = require("fs"),
  path = require("path");
const { config } = require("../src/config");
const { filesIn, hashFile } = require("./storage-manifest");
async function main() {
  const source = process.argv[2];
  if (!source || !process.argv.includes("--confirm-stopped"))
    throw new Error(
      "Uso: npm run restore -- /ruta/backup --confirm-stopped. Detén primero el servidor y el procesamiento de vídeos.",
    );
  const root = path.resolve(source),
    manifest = JSON.parse(
      fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
    );
  if (manifest.version !== 1 || !Array.isArray(manifest.files))
    throw new Error("Manifiesto inválido.");
  const expected = new Set();
  for (const entry of manifest.files) {
    if (
      typeof entry.path !== "string" ||
      !/^(academy\.sqlite|(?:private|public)\/.+)$/.test(entry.path) ||
      entry.path.split("/").some((p) => p === ".." || p === ".") ||
      expected.has(entry.path)
    )
      throw new Error("Ruta inválida en backup.");
    expected.add(entry.path);
    const file = path.resolve(root, entry.path);
    if (
      !file.startsWith(root + path.sep) ||
      !fs.statSync(file).isFile() ||
      fs.statSync(file).size !== entry.size ||
      (await hashFile(file)) !== entry.sha256
    )
      throw new Error("Backup alterado o incompleto: " + entry.path);
  }
  const actual = filesIn(root)
    .map((file) => path.relative(root, file).split(path.sep).join("/"))
    .filter((file) => file !== "manifest.json");
  if (
    actual.length !== expected.size ||
    actual.some((file) => !expected.has(file))
  )
    throw new Error(
      "Backup alterado o incompleto: contiene archivos no incluidos en el manifiesto.",
    );
  if (!expected.has("academy.sqlite"))
    throw new Error("Falta la base de datos.");
  const Database = require("better-sqlite3"),
    check = new Database(path.join(root, "academy.sqlite"), { readonly: true });
  try {
    if (
      check.pragma("integrity_check", { simple: true }) !== "ok" ||
      check.pragma("foreign_key_check").length
    )
      throw new Error(
        "La base de datos no supera la comprobación de integridad.",
      );
  } finally {
    check.close();
  }
  const tag = ".restore-" + Date.now(),
    staged = [],
    done = [];
  const targets = [
    config.privateUploadDir,
    config.publicUploadDir,
    config.dbFile,
  ];
  if (
    targets.some((a, i) =>
      targets.some(
        (b, j) => i !== j && (a === b || a.startsWith(b + path.sep)),
      ),
    )
  )
    throw new Error("Las rutas de datos y archivos no deben solaparse.");
  try {
    for (const [name, destination] of [
      ["private", config.privateUploadDir],
      ["public", config.publicUploadDir],
    ]) {
      const stage = destination + tag + "-stage";
      fs.mkdirSync(stage, { recursive: true, mode: 0o700 });
      if (fs.existsSync(path.join(root, name)))
        fs.cpSync(path.join(root, name), stage, { recursive: true });
      staged.push({
        stage,
        destination,
        previous: destination + tag + "-previous",
      });
    }
    fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
    const stageDb = config.dbFile + tag + "-stage";
    fs.copyFileSync(path.join(root, "academy.sqlite"), stageDb);
    staged.push({
      stage: stageDb,
      destination: config.dbFile,
      previous: config.dbFile + tag + "-previous",
    });
    for (const suffix of ["-wal", "-shm"]) {
      const file = config.dbFile + suffix;
      if (fs.existsSync(file)) {
        const swap = {
          destination: file,
          previous: file + tag + "-previous",
          existed: true,
          installed: false,
        };
        fs.renameSync(file, swap.previous);
        done.push(swap);
      }
    }
    for (const swap of staged) {
      swap.existed = fs.existsSync(swap.destination);
      swap.installed = false;
      done.push(swap);
      if (swap.existed) fs.renameSync(swap.destination, swap.previous);
      fs.renameSync(swap.stage, swap.destination);
      swap.installed = true;
    }
    console.log(
      "Restaurado con carpetas completas, sin archivos sobrantes. Copias anteriores: " +
        tag +
        "-previous junto a cada ruta de datos.",
    );
  } catch (error) {
    for (const swap of done.reverse()) {
      if (swap.installed)
        fs.rmSync(swap.destination, { recursive: true, force: true });
      if (swap.existed && fs.existsSync(swap.previous))
        fs.renameSync(swap.previous, swap.destination);
    }
    throw error;
  } finally {
    for (const swap of staged)
      if (fs.existsSync(swap.stage))
        fs.rmSync(swap.stage, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
