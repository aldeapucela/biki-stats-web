const FAVORITES_KEY = "movilidad.favoriteStations";
const THEME_KEY = "movilidad.theme";

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

const routeFromLocation = () => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/map") return "map";
  const route = path.slice(1);
  return ["saved", "history", "more"].includes(route) ? route : "map";
};

export const state = {
  route: routeFromLocation(),
  stations: [],
  selectedStationId: null,
  favorites: new Set(readJson(FAVORITES_KEY, [])),
  theme: localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  query: "",
  filter: "all",
  period: "24h",
  historyQuery: "",
  historyPickerOpen: false,
  loading: false,
  error: null,
  updatedAt: null,
  geoDenied: false,
  nearbyMode: false,
  userLocation: null,
  locationRequested: false,
  locationStatus: "idle",
  locationError: null,
};

export function persistFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites])); }
export function toggleFavorite(id) { state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id); persistFavorites(); }
export function setTheme(theme) { state.theme = theme; localStorage.setItem(THEME_KEY, theme); document.documentElement.dataset.theme = theme; }
export function navigate(route) {
  const path = route === "map" ? "/" : `/${route}`;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
