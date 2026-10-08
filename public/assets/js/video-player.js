import { api } from "./api.js";
import { state } from "./state.js";
import { esc } from "./ui.js";

const instances = new Map();
export function videoMarkup(lesson, { remember = false } = {}) {
  if (!lesson.video?.url) return "";
  return `<div class="native-player"><div class="classroom-player"><video controls playsinline preload="metadata" controlslist="nodownload" data-native-video data-source="${esc(lesson.video.url)}" data-lesson="${lesson.id}" data-position="${Number(lesson.position_seconds) || 0}" data-remember="${remember ? "1" : "0"}" aria-label="${esc(lesson.title)}">${lesson.video.captions ? `<track kind="subtitles" src="${esc(lesson.video.url.replace("master.m3u8", "captions.vtt"))}" srclang="es" label="Español">` : ""}</video></div><div class="player-tools"><label>Velocidad <select data-speed><option value="0.75">0,75×</option><option value="1" selected>Normal</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label><label>Calidad <select data-quality><option value="-1">Automática</option></select></label><span class="muted" data-player-status role="status"></span></div></div>`;
}
export function mountPlayers(root = document) {
  for (const [element, entry] of instances)
    if (!element.isConnected) {
      entry.dispose();
      instances.delete(element);
    }
  root.querySelectorAll("[data-native-video]").forEach((element) => {
    if (instances.has(element)) return;
    const wrapper = element.closest(".native-player"),
      status = wrapper.querySelector("[data-player-status]");
    const remember = element.dataset.remember === "1" && state.user;
    let hls,
      savedAt = 0,
      resumed = false,
      stopped = false,
      position = Number(element.dataset.position) || 0;
    const persist = (force = false) => {
      if (
        stopped ||
        !resumed ||
        !remember ||
        !Number.isFinite(element.currentTime) ||
        (!force && Date.now() - savedAt < 15000)
      )
        return;
      position = element.currentTime;
      savedAt = Date.now();
      api(`/api/lessons/${element.dataset.lesson}/position`, {
        method: "POST",
        body: { position },
        keepalive: force,
      }).catch(() => {});
    };
    const resume = () => {
      if (resumed || !Number.isFinite(element.duration)) return;
      resumed = true;
      if (position > 0 && position < element.duration - 3) {
        element.currentTime = position;
        status.textContent = "Continúa desde donde lo dejaste.";
      }
    };
    element.addEventListener("loadedmetadata", resume);
    element.addEventListener("timeupdate", () => persist());
    element.addEventListener("pause", () => persist(true));
    element.addEventListener("ended", () => persist(true));
    wrapper.querySelector("[data-speed]").onchange = (e) => {
      element.playbackRate = Number(e.target.value);
    };
    const quality = wrapper.querySelector("[data-quality]");
    const failed = () => {
      status.textContent =
        "No se pudo reproducir el vídeo. Comprueba tu conexión y vuelve a entrar al aula.";
    };
    const nativeHls = element.canPlayType("application/vnd.apple.mpegurl");
    if (
      nativeHls &&
      (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ||
        !window.Hls?.isSupported())
    ) {
      element.src = element.dataset.source;
      quality.closest("label").hidden = true;
      element.addEventListener("error", failed);
    } else if (window.Hls?.isSupported()) {
      hls = new window.Hls({
        enableWorker: false,
        maxBufferLength: 30,
        backBufferLength: 30,
      });
      hls.loadSource(element.dataset.source);
      hls.attachMedia(element);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        for (const [index, level] of hls.levels.entries())
          quality.add(new Option(`${level.height}p`, String(index)));
        if (hls.levels.length < 2) quality.closest("label").hidden = true;
      });
      quality.onchange = (e) => {
        hls.currentLevel = Number(e.target.value);
      };
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          failed();
          hls.destroy();
        }
      });
    } else {
      status.textContent =
        "Este navegador no admite el reproductor. Usa una versión reciente de Chrome, Firefox, Edge o Safari.";
    }
    instances.set(element, {
      dispose() {
        if (stopped) return;
        stopped = true;
        if (remember && resumed) {
          position = element.currentTime;
          api(`/api/lessons/${element.dataset.lesson}/position`, {
            method: "POST",
            body: { position },
            keepalive: true,
          }).catch(() => {});
        }
        hls?.destroy();
        element.removeAttribute("src");
        element.load();
      },
    });
  });
}
new MutationObserver(() => {
  for (const [element, entry] of instances)
    if (!element.isConnected) {
      entry.dispose();
      instances.delete(element);
    }
}).observe(document.body, { childList: true, subtree: true });
window.addEventListener("pagehide", () => {
  for (const [element] of instances) {
    if (element.dataset.remember === "1")
      api(`/api/lessons/${element.dataset.lesson}/position`, {
        method: "POST",
        body: { position: element.currentTime },
        keepalive: true,
      }).catch(() => {});
  }
});
