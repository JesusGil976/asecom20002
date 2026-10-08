require("dotenv").config();
const fs = require("fs"),
  path = require("path");
const { getDatabase, closeDatabase } = require("../src/db");
const { config } = require("../src/config");
const { filesIn, hashFile } = require("./storage-manifest");
async function main() {
  if (!process.argv.includes("--confirm-stopped"))
    throw new Error(
      "Detén primero el servidor y el procesamiento de vídeos. Uso: npm run backup -- --confirm-stopped",
    );
  const target = path.join(
    config.dataDir,
    "backups",
    "academy-" + new Date().toISOString().replace(/[:.]/g, "-"),
  );
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  const db = getDatabase();
  await db.backup(path.join(target, "academy.sqlite"));
  const Database = require("better-sqlite3"),
    snapshot = new Database(path.join(target, "academy.sqlite"));
  snapshot.pragma("journal_mode=DELETE");
  snapshot.close();
  for (const [source, name] of [
    [config.privateUploadDir, "private"],
    [config.publicUploadDir, "public"],
  ]) {
    filesIn(source);
    fs.mkdirSync(path.join(target, name));
    if (fs.existsSync(source))
      fs.cpSync(source, path.join(target, name), { recursive: true });
  }
  const files = [];
  for (const file of filesIn(target))
    files.push({
      path: path.relative(target, file).split(path.sep).join("/"),
      size: fs.statSync(file).size,
      sha256: await hashFile(file),
    });
  fs.writeFileSync(
    path.join(target, "manifest.json"),
    JSON.stringify(
      {
        version: 1,
        created_at: new Date().toISOString(),
        consistency:
          "Server and video worker stopped by operator; SQLite + private/public uploads",
        files,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(target);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
