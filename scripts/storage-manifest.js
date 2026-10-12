const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
function filesIn(root) {
  const results = [];
  function walk(folder) {
    if (!fs.existsSync(folder)) return;
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      if (item.isSymbolicLink())
        throw new Error("No se admiten enlaces simbólicos en el respaldo.");
      const file = path.join(folder, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.isFile()) results.push(file);
      else throw new Error("Tipo de archivo no admitido en el respaldo.");
    }
  }
  walk(root);
  return results.sort();
}
async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
module.exports = { filesIn, hashFile };
