let csrfToken = "";
export function setCsrf(token) {
  csrfToken = token || "";
}
export function getCsrf() {
  return csrfToken;
}
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    options = { ...options, body: JSON.stringify(body) };
  }
  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method) && csrfToken)
    headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = new Error(data?.error || `Error HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
