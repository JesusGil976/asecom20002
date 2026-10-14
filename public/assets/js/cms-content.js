// Shared by the editor, preview and public page. No arbitrary HTML is accepted.
import { esc } from "./ui.js";
export function sectionAnchors(sections) {
  const used = new Set(sections.map((s) => s.settings?.anchor).filter(Boolean));
  return sections.map((s, i) => {
    if (s.settings?.anchor) return s.settings.anchor;
    const base =
      { hero: "inicio", about: "nosotros", locations: "sedes" }[
        s.section_type
      ] || `seccion-${s.section_key || i + 1}`;
    let id = base,
      n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  });
}
export function richText(text) {
  const inline = (value) =>
    esc(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
        // Inspect the original URL, then escape once for the HTML attribute.
        const raw = url
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");
        if (!/^(https:\/\/|\/(?!\/))/.test(raw) || /[\\\x00-\x20]/.test(raw))
          return label;
        return `<a href="${esc(raw)}" ${raw.startsWith("/") ? "data-link" : 'rel="noopener"'}>${label}</a>`;
      });
  let list = false,
    html = "";
  for (const line of String(text || "").split("\n")) {
    const bullet = line.match(/^[-*] (.+)/);
    if (bullet) {
      if (!list) html += "<ul>";
      list = true;
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    if (list) {
      html += "</ul>";
      list = false;
    }
    const heading = line.match(/^(#{1,3}) (.+)/);
    if (heading)
      html += `<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  return html + (list ? "</ul>" : "");
}
