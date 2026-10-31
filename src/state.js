const FAVORITES_KEY = "movilidad.favoriteStations";
const THEME_KEY = "movilidad.theme";
const DESTINATION_KEY = "movilidad.destinationStation";
const ORIGIN_KEY = "movilidad.originStation";

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
  originId: readJson(ORIGIN_KEY, null),
  destinationId: readJson(DESTINATION_KEY, null),
  destinationFit: false,
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
  nearbyError: null,
  stationPanelExpanded: false,
};

export function persistFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites])); }
export function toggleFavorite(id) { state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id); persistFavorites(); }
const persist = (key, id) => {
  try { id ? localStorage.setItem(key, JSON.stringify(id)) : localStorage.removeItem(key); } catch { /* sin almacenamiento: dura lo que la sesión */ }
};
// Una estación no puede ser a la vez donde se coge y donde se deja: elegirla en un extremo la quita del otro.
export function setDestination(id) {
  if (id && id === state.originId) setOrigin(null);
  state.destinationId = id;
  state.destinationFit = Boolean(id);
  persist(DESTINATION_KEY, id);
}
export function setOrigin(id) {
  if (id && id === state.destinationId) setDestination(null);
  state.originId = id;
  state.destinationFit = Boolean(id);
  persist(ORIGIN_KEY, id);
}
export function setTheme(theme) { state.theme = theme; localStorage.setItem(THEME_KEY, theme); document.documentElement.dataset.theme = theme; }
export function navigate(route) {
  const path = route === "map" ? "/" : `/${route}`;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
