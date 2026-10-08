require("dotenv").config();

const { createApp } = require("./src/app");
const { config, assertProductionConfig } = require("./src/config");
const { closeDatabase } = require("./src/db");

assertProductionConfig();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "server_started",
      port: server.address().port,
      env: config.nodeEnv,
    }),
  );
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  await app.locals.videoService.close();
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
