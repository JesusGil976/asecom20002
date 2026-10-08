import { api, getCsrf } from "./api.js";

// Bounded chunks avoid loading a full lesson into browser or server memory.
export async function uploadVideo(
  lessonId,
  file,
  { signal, onProgress = () => {} } = {},
) {
  const sample = new Uint8Array(
    await new Blob([file.slice(0, 65536), file.slice(-65536)]).arrayBuffer(),
  );
  const digest = crypto.subtle
    ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", sample))]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
    : String(file.lastModified);
  const key = `academiave-upload:${lessonId}:${file.size}:${digest}`;
  let upload;
  try {
    const old = localStorage.getItem(key);
    if (old) upload = await api(`/api/admin/videos/uploads/${old}`);
  } catch {}
  if (!upload || upload.state === "failed") {
    upload = await api("/api/admin/videos/uploads", {
      method: "POST",
      body: { lessonId, name: file.name, size: file.size },
    });
    try {
      localStorage.setItem(key, upload.id);
    } catch {}
  }
  if (upload.state !== "uploading") {
    try {
      localStorage.removeItem(key);
    } catch {}
    return upload;
  }
  while (upload.receivedBytes < file.size) {
    if (signal?.aborted)
      throw new Error(
        "Subida pausada. Selecciona el mismo archivo para continuar.",
      );
    const offset = upload.receivedBytes,
      chunk = file.slice(offset, offset + upload.chunkBytes);
    upload = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/admin/videos/uploads/${upload.id}/chunk`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-CSRF-Token", getCsrf());
      xhr.setRequestHeader("Upload-Offset", String(offset));
      xhr.timeout = 120000;
      const abort = () => xhr.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const cleanup = () => signal?.removeEventListener("abort", abort);
      xhr.upload.onprogress = (event) =>
        onProgress((offset + event.loaded) / file.size);
      xhr.onload = () => {
        cleanup();
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else
          reject(
            new Error(
              data?.error ||
                "La subida falló. Reintenta con el mismo archivo para continuar.",
            ),
          );
      };
      xhr.onerror = xhr.ontimeout = () => {
        cleanup();
        reject(
          new Error(
            "Se interrumpió la conexión. Reintenta con el mismo archivo para continuar.",
          ),
        );
      };
      xhr.onabort = () => {
        cleanup();
        reject(
          new Error(
            "Subida pausada. Selecciona el mismo archivo para continuar.",
          ),
        );
      };
      xhr.send(chunk);
    });
    onProgress(upload.receivedBytes / file.size);
  }
  const result = await api(`/api/admin/videos/uploads/${upload.id}/finish`, {
    method: "POST",
    body: {},
  });
  try {
    localStorage.removeItem(key);
  } catch {}
  return result;
}
