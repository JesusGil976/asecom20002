export const state = {
  user: null,
  csrfToken: "",
  site: null,
  design: null,
  navigation: [],
  locations: [],
};
export function applyDesign(tokens = {}) {
  const root = document.documentElement;
  const map = {
    primary: "--primary",
    primary_dark: "--primary-dark",
    secondary: "--secondary",
    accent: "--accent",
    background: "--background",
    surface: "--surface",
    surface_muted: "--surface-muted",
    text: "--text",
    text_muted: "--text-muted",
    border: "--border",
    success: "--success",
    warning: "--warning",
    danger: "--danger",
    font_family: "--font-family",
    radius_sm: "--radius-sm",
    radius_md: "--radius-md",
    radius_lg: "--radius-lg",
    shadow: "--shadow",
    content_width: "--content-width",
  };
  for (const [key, prop] of Object.entries(map)) {
    if (tokens[key]) root.style.setProperty(prop, tokens[key]);
  }
  root.dataset.density = tokens.density || "comfortable";
  root.dataset.buttons = tokens.button_style || "rounded";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tokens.primary || "#006b5f");
}
