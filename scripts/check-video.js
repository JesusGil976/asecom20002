require("dotenv").config();
const { spawnSync } = require("child_process");
const { config } = require("../src/config");
for (const binary of [config.ffmpegPath, config.ffprobePath]) {
  const result = spawnSync(binary, ["-version"], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(
      "No se pudo ejecutar " +
        binary +
        ". Instala FFmpeg y configura FFMPEG_PATH/FFPROBE_PATH si es necesario.",
    );
    process.exitCode = 1;
  } else console.log(result.stdout.split("\n")[0]);
}
