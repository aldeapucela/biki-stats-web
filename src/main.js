import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./styles.css";
import "./history-overrides.css";
import "./marca.css";
import "./destination.css";
import "./route.css";
import "./history-stats.css";
import { api, ApiError } from "./api.js";
import { createHistoryLoader } from "./history-loader.js";
import { analytics } from "./analytics.js";
import { bikesTone } from "./tone.js";
import { navigate, setDestination, setOrigin, setTheme, state, toggleFavorite } from "./state.js";
import { distanceMeters, docksDrop, estimateMinutes, recordSample } from "./destination.js";
import { alternatives, countFor, formatClock, outlook, planRoute } from "./availability.js";
import { TIME_ZONE, bestAndWorstHour, freeDocks, heatmapRows, hourlyAverages, madridParts, stationSlots, totalBikes } from "./history-stats.js";

let map;
let markers = [];
let refreshTimer;
const historyLoader = createHistoryLoader({ api, onChange: () => { if (state.route === "history") render(); } });

document.documentElement.dataset.theme = state.theme;
const routeTitles = { map: "Movilidad · BIKI Valladolid", saved: "Guardadas · Movilidad BIKI", history: "Histórico · Movilidad BIKI", more: "Más · Movilidad BIKI" };
const routeFromLocation = () => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/map") return "map";
  const route = path.slice(1);
  return ["saved", "history", "more"].includes(route) ? route : "map";
};
window.addEventListener("popstate", () => { state.route = routeFromLocation(); render(); });
window.addEventListener("hashchange", () => { state.route = window.location.hash.slice(2) || "map"; render(); });
window.addEventListener("storage", () => render());
// Delegado: los popups de Leaflet se crean fuera de los listeners que enlaza bindEvents().
document.addEventListener("click", (event) => {
  const chooseOrigin = event.target.closest?.("[data-origin]");
  const clearOrigin = event.target.closest?.("[data-origin-clear]");
  if (chooseOrigin || clearOrigin) {
    const originId = chooseOrigin?.dataset.origin;
    setOrigin(!originId || originId === state.originId ? null : originId);
    if (!state.destinationId) destinationSamples = [];
    render();
    return;
  }
  const choose = event.target.closest?.("[data-destination]");
  const clear = event.target.closest?.("[data-destination-clear]");
  if (!choose && !clear) return;
  const id = choose?.dataset.destination;
  if (!id || id === state.destinationId) setDestination(null);
  else { setDestination(id); destinationSamples = []; recordDestinationSample(); }
  render();
});

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const formatAge = (seconds) => seconds == null ? "Sin fecha" : seconds < 60 ? "hace menos de 1 min" : `hace ${Math.floor(seconds / 60)} min`;
const formatNumber = (value, digits = 0) => value == null ? "—" : Number(value).toLocaleString("es-ES", { maximumFractionDigits: digits });
const occupancyTone = (value) => value == null ? "unknown" : value >= 75 ? "high" : value <= 25 ? "low" : "medium";
const locationMessage = () => state.locationStatus === "requesting" ? "Solicitando ubicación…" : state.locationStatus === "available" ? "Ubicación activa" : state.locationStatus === "denied" ? "Ubicación no disponible" : "Cerca de mí";
const currentStation = () => state.stations.find((station) => station.station_id === state.selectedStationId) || state.stations[0];
const stationById = (stationId) => state.stations.find((station) => station.station_id === stationId);
// Lecturas de huecos libres del destino en esta sesión, para avisar de una bajada reciente.
let destinationSamples = [];
const recordDestinationSample = () => { if (state.destinationId) destinationSamples = recordSample(destinationSamples, Date.now(), stationById(state.destinationId)?.free_docks); };
const formatDistance = (meters) => (meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${formatNumber(meters / 1000, 1)} km`);
const osmBikeUrl = (latitude, longitude) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=%3B${latitude}%2C${longitude}`;
// Un error de la API solo sustituye a la lista si no hay estaciones que mostrar; con datos cargados
// se conserva la lista y se avisa aparte, sin bloquearla.
const stationsUnavailable = () => Boolean(state.error) && !state.stations.length;
const panelNotice = () => (state.error && state.stations.length ? "No se pudieron actualizar los datos. Se muestran los últimos recibidos." : state.nearbyError);
const apiError = (error) => (error instanceof ApiError ? error : new ApiError("No se pudo conectar con la API", "SERVICE_UNAVAILABLE", 503));
const focusStationOnMap = (stationId) => {
  const station = stationById(stationId);
  if (!map || station?.location?.latitude == null || station.location.longitude == null) return;
  const position = [station.location.latitude, station.location.longitude];
  map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
  markers.find((marker) => marker.stationId === stationId)?.openPopup();
};
const selectStation = (stationId, source = "station_card") => {
  state.selectedStationId = stationId;
  state.stationPanelExpanded = true;
  if (state.route === "saved") analytics.trackEvent("saved", "open_station", stationId);
  else if (source === "marker") analytics.trackEvent("map", "select_marker", stationId);
  else analytics.trackEvent("map", "select_station_card", stationId);
  render();
  requestAnimationFrame(() => {
    document.querySelector(`[data-station="${CSS.escape(stationId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    focusStationOnMap(stationId);
  });
};
const collapseStationPanel = () => {
  if (!state.stationPanelExpanded) return;
  state.stationPanelExpanded = false;
  const panel = document.querySelector(".station-panel");
  panel?.classList.remove("expanded");
  panel?.classList.add("collapsed");
};
const toggleStationPanel = () => {
  state.stationPanelExpanded = !state.stationPanelExpanded;
  analytics.trackEvent("map", state.stationPanelExpanded ? "expand_results" : "collapse_results", "bottom_sheet");
  const panel = document.querySelector(".station-panel");
  panel?.classList.toggle("expanded", state.stationPanelExpanded);
  panel?.classList.toggle("collapsed", !state.stationPanelExpanded);
  document.querySelector("[data-panel-toggle]")?.setAttribute("aria-expanded", String(state.stationPanelExpanded));
};

function shell(content) {
  const links = [["map", "Mapa", "⌖"], ["saved", "Guardadas", "♡"], ["history", "Histórico", "◒"], ["more", "Más", "⋯"]];
  const routeHref = (route) => route === "map" ? "/" : `/${route}`;
  return `<div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" data-route="map" aria-label="Movilidad BIKI, ir al mapa"><span class="brand-mark"><img src="/aldea-pucela.jpg" alt="" width="32" height="32" /></span><span>Movilidad <strong>· BIKI</strong></span></a>
      <nav class="top-nav" aria-label="Navegación principal">${links.map(([route, label]) => `<a class="top-nav-link ${state.route === route ? "active" : ""}" href="${routeHref(route)}" data-route="${route}" aria-current="${state.route === route ? "page" : "false"}">${label}</a>`).join("")}</nav>
      <div class="top-actions"><span class="dev-badge ${api.useFixtures ? "" : "hidden"}">DATOS SIMULADOS</span><button class="icon-button" data-action="theme" aria-label="Cambiar tema">${state.theme === "dark" ? "☀" : "☾"}</button></div>
    </header>
    <main>${content}</main>
    <nav class="bottom-nav" aria-label="Navegación principal">${links.map(([route, label, icon]) => `<a class="nav-link ${state.route === route ? "active" : ""}" href="${routeHref(route)}" data-route="${route}" aria-current="${state.route === route ? "page" : "false"}"><span aria-hidden="true">${icon}</span>${label}</a>`).join("")}</nav>
    <footer class="site-footer"><span>Licencia contenido <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noreferrer" data-analytics-link="license">CC BY-SA 4.0</a></span><span>·</span><a href="https://github.com/aldeapucela/biki-stats-web" target="_blank" rel="noreferrer" data-analytics-link="github">Código GitHub</a><span>·</span><a href="https://aldeapucela.org/" target="_blank" rel="noreferrer" data-analytics-link="aldea_pucela">Proyecto creado por vecinos voluntarios de Aldea Pucela</a></footer>
    ${analytics.shouldShowConsentBanner() ? `<aside class="analytics-consent" role="dialog" aria-labelledby="analytics-consent-title"><div><strong id="analytics-consent-title">Analítica de uso</strong><p>Usamos Matomo para mejorar Movilidad. No enviamos búsquedas, coordenadas ni datos personales.</p></div><div class="analytics-consent-actions"><button type="button" class="secondary-button" data-analytics-consent="deny">Rechazar</button><button type="button" class="primary-button" data-analytics-consent="grant">Aceptar</button></div></aside>` : ""}
  </div>`;
}

// «Recojo aquí» fija la estación de salida y «Voy a esta estación» la de llegada (#27); una estación no puede ser las dos.
function routeButtons(station, pressed = false) {
  const id = esc(station.station_id);
  const isOrigin = state.originId === station.station_id; const isDestination = state.destinationId === station.station_id;
  return `<div class="route-buttons"><button type="button" class="origin-button" data-origin="${id}"${pressed ? ` aria-pressed="${isOrigin}"` : ""}>${isOrigin ? "Quitar salida" : "Recojo aquí"}</button><button type="button" class="destination-button" data-destination="${id}"${pressed ? ` aria-pressed="${isDestination}"` : ""}>${isDestination ? "Quitar destino" : "Voy a esta estación"}</button></div>`;
}

function stationCard(station, compact = false) {
  const tone = occupancyTone(station.occupancy_percent);
  const favorite = state.favorites.has(station.station_id);
  return `<article class="station-card ${state.selectedStationId === station.station_id ? "selected" : ""}" data-station="${esc(station.station_id)}" tabindex="0">
    <div class="station-card-head"><div><h3>${esc(station.name)}</h3><p>${station.distance_m != null ? `${formatNumber(station.distance_m)} m de distancia` : formatAge(station.data_age_seconds)}</p></div><button class="favorite-button" data-favorite="${esc(station.station_id)}" aria-label="${favorite ? "Quitar de" : "Guardar"} ${esc(station.name)}">${favorite ? "★" : "☆"}</button></div>
    <div class="occupancy-row"><span class="status-dot ${tone}"></span><strong>${station.occupancy_percent == null ? "Sin ocupación" : `${formatNumber(station.occupancy_percent, 0)}% ocupada`}</strong><span class="capacity">${station.capacity == null ? "—" : `${formatNumber(station.capacity)} plazas`}</span></div>
    <div class="occupancy-bar"><span class="bar-fill ${tone}" style="width:${Math.min(100, station.occupancy_percent || 0)}%"></span></div>
    <div class="station-metrics"><span><i class="bike mechanical"></i>${formatNumber(station.bikes?.mechanical)} mecánicas</span><span><i class="bike electric"></i>${formatNumber(station.bikes?.electric)} eléctricas</span><span><i class="dock"></i>${formatNumber(station.free_docks)} libres</span></div>
    ${routeButtons(station, true)}
    ${compact ? "" : `<p class="freshness ${station.is_stale ? "stale" : ""}">${station.is_stale ? "Datos posiblemente obsoletos · " : "Actualizado "}${formatAge(station.data_age_seconds)}</p>`}
  </article>`;
}

function stationTooltip(station) {
  const latitude = station.location?.latitude;
  const longitude = station.location?.longitude;
  const directionsUrl = latitude != null && longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}&travelmode=bicycling`
    : null;
  return `<div class="station-popup-content"><strong>${esc(station.name)}</strong><span>${station.occupancy_percent == null ? "Sin ocupación" : `${formatNumber(station.occupancy_percent, 0)}% ocupada`}</span><span>${formatNumber(station.bikes?.mechanical)} mecánicas · ${formatNumber(station.bikes?.electric)} eléctricas</span><span>${formatNumber(station.free_docks)} anclajes libres${station.capacity == null ? "" : ` de ${formatNumber(station.capacity)}`}</span>${routeButtons(station)}${directionsUrl ? `<a class="map-directions-button" href="${directionsUrl}" target="_blank" rel="noreferrer">Cómo llegar</a><a class="map-directions-link" href="${osmBikeUrl(latitude, longitude)}" target="_blank" rel="noreferrer">En OpenStreetMap (bici)</a>` : ""}</div>`;
}

function filterStations() {
  const query = state.query.trim().toLocaleLowerCase();
  return state.stations.filter((station) => {
    const matchesQuery = !query || station.name.toLocaleLowerCase().includes(query);
    const value = station.occupancy_percent;
    const matchesFilter = state.filter === "all" || (state.filter === "low" && value != null && value <= 25) || (state.filter === "high" && value != null && value >= 75) || (state.filter === "electric" && (station.bikes?.electric || 0) > 0);
    return matchesQuery && matchesFilter;
  });
}

function mapLayout() {
  return `<div class="map-layout"><aside class="station-panel ${state.stationPanelExpanded ? "expanded" : "collapsed"}" aria-label="Lista de estaciones"><button type="button" class="station-panel-handle" data-panel-toggle aria-label="${state.stationPanelExpanded ? "Minimizar" : "Expandir"} listado de estaciones" aria-expanded="${state.stationPanelExpanded}"><span aria-hidden="true"></span></button><div class="search-wrap"><label for="station-search" class="sr-only">Buscar estación</label><span aria-hidden="true">⌕</span><input id="station-search" type="search" placeholder="Buscar por nombre" value="${esc(state.query)}" /></div><div class="filter-chips" role="group" aria-label="Filtros de ocupación">${[["all", "Todas"], ["electric", "Eléctricas"], ["low", "Poca ocupación"], ["high", "Muy ocupadas"]].map(([key, label]) => `<button class="chip ${state.filter === key ? "active" : ""}" data-filter="${key}">${label}</button>`).join("")}</div><div class="panel-status"><span>${filterStations().length} estaciones</span><span>${state.updatedAt ? `Consulta ${state.updatedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : state.loading ? "Cargando…" : "Sin datos"}</span></div><div id="station-list" class="station-list">${state.loading ? loadingState() : filterStations().map((station) => stationCard(station)).join("") || emptyState("No hay estaciones que coincidan", "Prueba con otro nombre o filtro.")}</div></aside><div id="map" class="map-container" aria-label="Mapa de estaciones BIKI"></div></div>`;
}

const OUTLOOK_TEXT = {
  bike: { sure: "Casi seguro que quedará alguna bici", likely: "Es probable que quede alguna bici", doubtful: "Dudoso que quede alguna bici", unlikely: "Poco probable que quede alguna bici" },
  dock: { sure: "Casi seguro que habrá hueco", likely: "Es probable que haya hueco", doubtful: "Dudoso que haya hueco", unlikely: "Poco probable que haya hueco" },
};
const frequencyText = (kind, p) => {
  const noun = kind === "bike" ? "bici" : "hueco";
  if (p >= 0.95) return `Casi siempre hubo ${noun} en ocasiones parecidas`;
  if (p < 0.05) return `Casi nunca hubo ${noun} en ocasiones parecidas`;
  return `Hubo ${noun} en unas ${Math.min(9, Math.max(1, Math.round(p * 10)))} de cada 10 ocasiones parecidas`;
};
// Frecuencia histórica de que haya bici (salida) o hueco (llegada) a la hora en que se llegará, condicionada a lo que hay ahora.
function outlookLine(kind, station, minutes) {
  if (minutes == null) return "";
  if (station.is_stale) return `<p class="route-outlook muted">Datos posiblemente obsoletos: sin estimación para tu llegada.</p>`;
  const result = outlook(kind, countFor(kind, station), minutes);
  if (!result.ok) {
    const message = { far: "Falta más de 45 min: sin estimación.", few: `Sin datos suficientes para estimar a las ${result.arrival ? formatClock(result.arrival) : "esa hora"}.` }[result.reason];
    return message ? `<p class="route-outlook muted">${message}</p>` : "";
  }
  return `<p class="route-outlook" data-level="${result.level}"><strong>${OUTLOOK_TEXT[kind][result.level]}</strong> cuando llegues (${formatClock(result.arrival)}, en unos ${minutes} min).<small>${frequencyText(kind, result.p)} (${formatNumber(result.n)} lecturas). Frecuencia histórica, no una previsión.</small></p>`;
}
// Ofrece las estaciones cercanas con disponibilidad cuando ahora no queda nada o la frecuencia a la llegada es dudosa o baja.
function alternativesLine(kind, station, minutes) {
  const count = countFor(kind, station);
  const result = minutes != null && !station.is_stale ? outlook(kind, count, minutes) : { ok: false };
  if (!(count === 0 || (result.ok && (result.level === "doubtful" || result.level === "unlikely")))) return "";
  const list = alternatives(state.stations, kind, station.location, station.station_id);
  if (!list.length) return "";
  const attribute = kind === "bike" ? "data-origin" : "data-destination";
  return `<p class="route-alt">Cerca con ${kind === "bike" ? "bicis" : "huecos"}: ${list.map(({ station: other, meters }) => `<button type="button" class="link-button" ${attribute}="${esc(other.station_id)}">${esc(other.name)}</button> (${formatDistance(meters)})`).join(" · ")}</p>`;
}
const freshnessLine = (station) => `<p class="freshness ${station.is_stale ? "stale" : ""}">${station.is_stale ? "Datos posiblemente obsoletos · " : "Actualizado "}${formatAge(station.data_age_seconds)}</p>`;
const missingLeg = (clearAttribute, label) => `<div class="route-leg missing"><p>La estación que elegiste ya no está disponible.</p><button type="button" class="secondary-button" ${clearAttribute}>${label}</button></div>`;

function originLeg(station, plan) {
  if (!station) return missingLeg("data-origin-clear", "Quitar salida");
  const bikes = countFor("bike", station);
  const meters = state.userLocation && station.location?.latitude != null ? distanceMeters(state.userLocation, station.location) : null;
  const trip = meters != null
    ? `A ${formatDistance(meters)} en línea recta · unos ${plan.walk} min andando (estimado, no es una ruta)`
    : state.geoDenied ? "Sin tu ubicación no se puede calcular cuánto tardas en llegar." : `<button type="button" class="link-button" data-action="locate">Activar mi ubicación</button> para ver cuánto tardas en llegar`;
  return `<div class="route-leg origin-leg"><div class="destination-head"><div><p class="eyebrow">1 · DONDE RECOJO LA BICI</p><h3>${esc(station.name)}</h3></div><button type="button" class="secondary-button" data-origin-clear>Quitar salida</button></div>
    <p class="origin-bikes"><strong>${formatNumber(bikes)}</strong> ${bikes === 1 ? "bici" : "bicis"} ahora <span>(${formatNumber(station.bikes?.mechanical)} mecánicas · ${formatNumber(station.bikes?.electric)} eléctricas)</span></p>
    ${bikes === 0 ? `<p class="destination-alert" role="status">Ahora mismo no queda ninguna bici.</p>` : ""}
    ${outlookLine("bike", station, plan.pickup)}${alternativesLine("bike", station, plan.pickup)}
    <p class="destination-trip">${trip}</p>${freshnessLine(station)}</div>`;
}

function destinationLeg(station, plan, origin) {
  if (!station) return missingLeg("data-destination-clear", "Quitar destino");
  const hasPosition = station.location?.latitude != null && station.location?.longitude != null;
  const from = origin?.location?.latitude != null ? origin.location : state.userLocation;
  const meters = from && hasPosition ? distanceMeters(from, station.location) : null;
  const trip = meters != null
    ? `${origin ? "De la salida al destino:" : "A"} ${formatDistance(meters)} en línea recta · unos ${plan.ride} min en bici (estimado, no es una ruta)`
    : state.geoDenied ? "Sin tu ubicación no se puede calcular la distancia." : `<button type="button" class="link-button" data-action="locate">Activar mi ubicación</button> para ver la distancia`;
  const drop = docksDrop(destinationSamples);
  const docks = station.free_docks;
  const arrival = plan.drop != null ? new Date(Date.now() + plan.drop * 60_000) : null;
  return `<div class="route-leg destination-leg"><div class="destination-head"><div><p class="eyebrow">${origin || state.originId ? "2 · DONDE LA DEJO" : "TU DESTINO"}</p><h2>${esc(station.name)}</h2></div><button type="button" class="secondary-button" data-destination-clear>Quitar destino</button></div>
    <p class="destination-docks"><strong>${formatNumber(docks)}</strong> ${docks === 1 ? "hueco libre" : "huecos libres"} para dejar tu bici${station.capacity == null ? "" : ` de ${formatNumber(station.capacity)}`}</p>
    <p class="destination-bikes">${formatNumber(station.bikes?.mechanical)} mecánicas · ${formatNumber(station.bikes?.electric)} eléctricas</p>
    ${docks === 0 ? `<p class="destination-alert" role="status">Ahora mismo no queda ningún hueco libre.</p>` : ""}
    ${drop ? `<p class="destination-alert" role="status">Los huecos bajan: ahora ${formatNumber(drop.to)}, hace ${drop.minutes} min había ${formatNumber(drop.from)}.</p>` : ""}
    ${outlookLine("dock", station, plan.drop)}${alternativesLine("dock", station, plan.drop)}
    <p class="destination-trip">${trip}</p>
    ${origin && arrival ? `<p class="route-total">Llegarías a dejarla sobre las ${formatClock(arrival)} (en unos ${plan.drop} min).</p>` : ""}
    ${freshnessLine(station)}</div>`;
}

function routeCard() {
  if ((!state.originId && !state.destinationId) || !state.stations.length) return "";
  const origin = state.originId ? stationById(state.originId) : null;
  const destination = state.destinationId ? stationById(state.destinationId) : null;
  const plan = planRoute({ user: state.userLocation, origin, destination });
  const alone = !state.originId && !destination;
  return `<section class="destination-card ${state.originId ? "with-origin" : ""} ${alone ? "missing" : ""}" aria-label="${state.originId ? "Tu ruta" : "Estación destino"}">${state.originId ? originLeg(origin, plan) : ""}${state.destinationId ? destinationLeg(destination, plan, origin) : `<p class="route-hint">Elige en el mapa o en la lista dónde la dejas con «Voy a esta estación».</p>`}</section>`;
}

function mapView() {
  return `<section class="page map-page"><div class="page-heading"><div><p class="eyebrow">VALLADOLID · INFORMACIÓN EN TIEMPO DIFERIDO</p><h1>Estaciones BIKI</h1><p class="lede">Consulta bicicletas y anclajes disponibles cerca de ti.</p></div><button class="secondary-button" data-action="locate" ${state.locationStatus === "requesting" ? "disabled" : ""}>⌖ ${locationMessage()}</button></div>
    ${panelNotice() ? `<p class="panel-notice" role="status">${esc(panelNotice())}</p>` : ""}
    ${stationsUnavailable() ? `<div class="map-error">${errorState(state.error)}</div>` : `${routeCard()}${mapLayout()}`}</section>`;
}

function historyView() {
  const station = currentStation();
  const periods = [["24h", "24 h"], ["7d", "7 días"], ["30d", "30 días"], ["90d", "90 días"]];
  const historyQuery = state.historyQuery.trim().toLocaleLowerCase();
  const historyStations = state.stations.filter((item) => !historyQuery || item.name.toLocaleLowerCase().includes(historyQuery));
  const stationOptions = historyStations.length ? historyStations.map((item) => `<button type="button" class="history-option ${item.station_id === station?.station_id ? "selected" : ""}" role="option" aria-selected="${item.station_id === station?.station_id}" data-history-station="${esc(item.station_id)}">${esc(item.name)}</button>`).join("") : `<div class="history-option-empty">No hay estaciones que coincidan</div>`;
  const expanded = state.historyPickerOpen;
  const inputValue = expanded ? state.historyQuery : station?.name || "";
  return `<section class="page history-page"><div class="page-heading"><div><p class="eyebrow">ANÁLISIS DE DISPONIBILIDAD</p><h1>Histórico</h1><p class="lede">Observa cómo cambia cada estación. Los huecos representan datos que no se capturaron.</p></div></div><div class="history-controls"><div class="history-station-picker"><label for="history-station-search">Estación</label><div class="history-combobox"><div class="history-combobox-input"><input id="history-station-search" role="combobox" aria-controls="history-station-options" aria-expanded="${expanded}" type="search" placeholder="Buscar estación" value="${esc(inputValue)}" autocomplete="off" /><button type="button" class="history-combobox-toggle" data-history-toggle aria-label="${expanded ? "Cerrar" : "Abrir"} selector de estaciones" aria-expanded="${expanded}">${expanded ? "⌃" : "⌄"}</button></div>${expanded ? `<div id="history-station-options" class="history-combobox-options" role="listbox" aria-label="Estaciones">${stationOptions}</div>` : ""}</div></div><div class="period-tabs" role="tablist" aria-label="Periodo histórico">${periods.map(([key, label]) => `<button role="tab" aria-selected="${state.period === key}" class="period-tab ${state.period === key ? "active" : ""}" data-period="${key}">${label}</button>`).join("")}</div></div>${station ? `<div id="history-content">${historyContent(station)}</div>` : emptyState("No hay estaciones", "La API todavía no ha devuelto estaciones.")}</section>`;
}

function historyContent(station) {
  const entry = historyLoader.get(station.station_id, state.period);
  if (!entry || (entry.history.data === undefined && entry.summary.data === undefined && [entry.history, entry.summary].some((part) => part.status === "loading"))) return loadingState(entry?.slow ? SLOW_MESSAGE : "Cargando histórico…");
  if (entry.history.data === undefined && entry.summary.data === undefined) return partError("No se pudo cargar el histórico", entry.history.error || entry.summary.error, "all");
  const points = entry.history.data?.points || [];
  const summary = entry.summary.data;
  const chart = entry.history.data === undefined ? (entry.history.status === "loading" ? loadingState("Cargando gráfico…") : partError("No se pudo cargar el gráfico", entry.history.error, "history")) : points.length ? stackedChart(points) : emptyState("Sin observaciones", "No hay datos históricos para este periodo.");
  const hasPoints = points.length > 0;
  const observations = summary ? `<p class="data-note">${formatNumber(summary.observations)} observaciones · última ${esc(formatDate(summary.last_observed_at))}. ${summary.missing_buckets ? `Faltan ${summary.missing_buckets} periodos y se muestran como ausencia de datos, no inventados.` : "Sin periodos vacíos."}</p>` : `<p class="data-note">Sin resumen: no se puede saber cuántas observaciones hay ni si faltan periodos.</p>`;
  return `${historyNotice(entry)}${hasPoints ? lastReadingCard(points[points.length - 1]) : ""}${summaryKpis(summary)}${hasPoints ? hourKpis(points) : ""}${hasPoints && state.period !== "24h" ? heatmap(points) : ""}<div class="chart-card"><div class="card-heading"><div><p class="eyebrow">EVOLUCIÓN</p><h2>Bicis disponibles a lo largo del tiempo</h2></div><span class="legend"><i class="legend-dot mechanical"></i>Mecánicas <i class="legend-dot electric"></i>Eléctricas</span></div>${chart}</div>${observations}`;
}

const hourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;
const hourKpi = (label, entry, unit) => `<div class="kpi-card"><span>${label}</span><strong>${entry ? hourLabel(entry.hour) : "—"}</strong><small>${entry ? `${formatNumber(entry.value, 1)} ${unit} de media` : "Sin datos"}</small></div>`;

function summaryKpis(summary) {
  return `<div class="history-kpis"><div class="kpi-card"><span>Ocupación media</span><strong>${formatNumber(summary?.occupancy?.average_percent, 1)}%</strong><small>${state.period} · ${summary ? `${summary.observations || 0} observaciones` : "sin resumen"}</small></div><div class="kpi-card"><span>Máxima ocupación</span><strong>${formatNumber(summary?.occupancy?.maximum_percent, 1)}%</strong><small>${formatDate(summary?.occupancy?.maximum_at)}</small></div><div class="kpi-card"><span>Mínima ocupación</span><strong>${formatNumber(summary?.occupancy?.minimum_percent, 1)}%</strong><small>${formatDate(summary?.occupancy?.minimum_at)}</small></div><div class="kpi-card"><span>Bicis medias</span><div class="average-bikes"><div><i class="legend-dot mechanical"></i><strong>${formatNumber(summary?.bikes?.mechanical_average, 1)}</strong><small>Mecánicas</small></div><div><i class="legend-dot electric"></i><strong>${formatNumber(summary?.bikes?.electric_average, 1)}</strong><small>Eléctricas</small></div></div></div></div>`;
}

// Mejor y peor hora, en hora de Madrid, para coger (bicis) y para dejar (huecos libres).
function hourKpis(points) {
  const bikes = bestAndWorstHour(hourlyAverages(points, totalBikes));
  const docks = bestAndWorstHour(hourlyAverages(points, freeDocks));
  return `<div class="hour-kpis">${hourKpi("Mejor hora para coger", bikes?.best, "bicis")}${hourKpi("Peor hora para coger", bikes?.worst, "bicis")}${hourKpi("Mejor hora para dejar", docks?.best, "huecos")}${hourKpi("Peor hora para dejar", docks?.worst, "huecos")}</div>`;
}

// La estación dibujada: un anclaje por plaza (bici mecánica, eléctrica o hueco libre) en la última lectura.
function lastReadingCard(point) {
  const { mechanical, electric, free, total } = stationSlots(point);
  const slot = (type) => `<i class="slot ${type}"></i>`;
  return `<div class="now-card"><p class="eyebrow">ÚLTIMA LECTURA · ${esc(formatDate(point.timestamp))}</p><h2>${formatNumber(mechanical + electric)} bicis<span> de ${formatNumber(total)} anclajes</span></h2><div class="slot-row" role="img" aria-label="${mechanical} bicis mecánicas, ${electric} eléctricas y ${free} huecos libres">${slot("mechanical").repeat(mechanical)}${slot("electric").repeat(electric)}${slot("free").repeat(free)}</div><p class="slot-legend"><span>${slot("mechanical")}${mechanical} mecánicas</span><span>${slot("electric")}${electric} eléctricas</span><span>${slot("free")}${free} huecos libres para dejar la tuya</span></p></div>`;
}

function heatmap(points) {
  const perDay = state.period === "7d";
  const { rows, max } = heatmapRows(points, state.period);
  const cell = (label, hour, value) => {
    const when = `${label} ${hourLabel(hour)}`;
    if (value === null) return `<i class="hm-cell none" data-detail="${when} · sin datos"></i>`;
    const share = max ? value / max : 0;
    return `<i class="hm-cell${value === 0 ? " zero" : ""}${share >= 0.5 ? " strong" : ""}" style="--v:${share.toFixed(2)}" data-detail="${when} · ${formatNumber(value, 1)} bicis${perDay ? "" : " de media"}"><b>${Math.round(value)}</b></i>`;
  };
  const hours = Array.from({ length: 24 }, (_, hour) => `<span class="hm-h">${hour % 3 === 0 ? hour : ""}</span>`).join("");
  const body = rows.map((row) => `<div class="hm-row"><span class="hm-label">${row.label}</span><div class="hm-cells">${row.cells.map((value, hour) => cell(row.label, hour, value)).join("")}</div></div>`).join("");
  return `<div class="chart-card"><div class="card-heading"><div><p class="eyebrow">CUÁNDO HAY BICIS</p><h2>${perDay ? "Cada día, hora a hora" : "Un día típico de la semana"}</h2></div><span class="legend hm-legend">0<i class="hm-scale"></i>${formatNumber(max, 0)} bicis</span></div><p class="chart-readout hm-readout" aria-live="polite">Pasa el cursor o toca una casilla para ver el dato</p><div class="heatmap" role="img" aria-label="Mapa de calor de bicis disponibles por hora. Las mejores y peores horas están en las tarjetas de arriba."><div class="hm-row"><span class="hm-label"></span><div class="hm-cells">${hours}</div></div>${body}</div></div>`;
}

const chartDayFormat = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, weekday: "short", day: "numeric" });
const chartHourFormat = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const chartDateFormat = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, day: "numeric", month: "short" });

// Barras de bicis (mecánicas + eléctricas) con ejes. Los huecos libres ya no se apilan: eran más de la mitad del
// alto y escondían lo que importa. Las horas y los días del eje van en hora de Madrid.
function stackedChart(points) {
  const width = 900; const height = 260; const left = 38; const right = 8; const top = 10; const bottom = 30;
  const innerWidth = width - left - right; const innerHeight = height - top - bottom;
  const peak = Math.max(...points.map(totalBikes), 1);
  const step = Math.max(1, Math.ceil(peak / 4 / 5) * 5);
  const ceiling = Math.ceil(peak / step) * step;
  const y = (value) => top + innerHeight - (value / ceiling) * innerHeight;
  const slot = innerWidth / points.length; const barWidth = Math.max(2, slot * 0.78);
  const spanHours = (Date.parse(points[points.length - 1].timestamp) - Date.parse(points[0].timestamp)) / 3600000;
  const tick = (x, text, anchor) => `<text class="chart-tick" x="${x}" y="${height - 10}" text-anchor="${anchor}">${text}</text>`;
  const grid = [];
  for (let value = 0; value <= ceiling; value += step) grid.push(`<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-tick" x="${left - 6}" y="${y(value) + 4}" text-anchor="end">${value}</text>`);
  const labels = []; const every = Math.max(1, Math.round(points.length / 6)); let lastDay = null;
  points.forEach((point, index) => {
    const at = new Date(point.timestamp); const x = left + index * slot;
    if (spanHours <= 36) { if (index % every === 0) labels.push(tick(x + slot / 2, chartHourFormat.format(at), "middle")); return; }
    if (spanHours > 24 * 8) { if (index % every === 0) labels.push(tick(x + slot / 2, chartDateFormat.format(at), "middle")); return; }
    const { dayKey } = madridParts(point.timestamp);
    if (dayKey === lastDay) return;
    lastDay = dayKey;
    const next = points.findIndex((other, position) => position > index && madridParts(other.timestamp).dayKey !== dayKey);
    if (index === 0 && next > 0 && next * slot < 70) return; // primer día casi vacío: su etiqueta pisaría a la siguiente
    labels.push(`<line class="chart-grid day" x1="${x}" x2="${x}" y1="${top}" y2="${top + innerHeight}"/>${tick(x + 4, chartDayFormat.format(at), "start")}`);
  });
  const bars = points.map((point, index) => {
    const x = left + index * slot + (slot - barWidth) / 2; const mechanical = point.mechanical || 0; const electric = point.electric || 0;
    return `<g class="chart-col" data-time="${formatDate(point.timestamp)}" data-mechanical="${formatNumber(mechanical)}" data-electric="${formatNumber(electric)}" data-free="${formatNumber(point.free_docks)}"><rect class="chart-hit" x="${left + index * slot}" y="${top}" width="${slot}" height="${innerHeight}"/><rect class="svg-electric" x="${x}" y="${y(mechanical + electric)}" width="${barWidth}" height="${y(mechanical) - y(mechanical + electric)}"/><rect class="svg-mechanical" x="${x}" y="${y(mechanical)}" width="${barWidth}" height="${y(0) - y(mechanical)}"/></g>`;
  }).join("");
  return `<p class="chart-readout" aria-live="polite">Pasa el cursor o toca una barra para ver el detalle</p><div class="chart-scroll"><svg class="stacked-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barras apiladas de bicicletas mecánicas y eléctricas disponibles a lo largo del periodo">${grid.join("")}${labels.join("")}${bars}</svg></div>`;
}

// Lectura al pasar el cursor o tocar (el <title> de SVG no sale en pantallas táctiles).
document.addEventListener("pointerover", (event) => {
  const cell = event.target.closest?.(".hm-cell");
  if (cell) { const out = document.querySelector(".hm-readout"); if (out) out.textContent = cell.dataset.detail; return; }
  const column = event.target.closest?.(".chart-col");
  const out = document.querySelector(".chart-readout:not(.hm-readout)");
  if (!column || !out) return;
  document.querySelectorAll(".chart-col.on").forEach((node) => node.classList.remove("on"));
  column.classList.add("on");
  const { time, mechanical, electric, free } = column.dataset;
  out.innerHTML = `<strong>${time}</strong> · <i class="legend-dot mechanical"></i>${mechanical} mecánicas <i class="legend-dot electric"></i>${electric} eléctricas · ${free} huecos libres`;
});

function savedView() {
  const saved = state.stations.filter((station) => state.favorites.has(station.station_id));
  return `<section class="page narrow-page"><div class="page-heading"><div><p class="eyebrow">TU SELECCIÓN</p><h1>Guardadas</h1><p class="lede">Tus estaciones favoritas se quedan en este dispositivo.</p></div></div>${saved.length ? `<div class="saved-grid">${saved.map((station) => stationCard(station)).join("")}</div>` : emptyState("Todavía no tienes estaciones guardadas", "Pulsa la estrella de una estación para encontrarla aquí rápidamente.")}</section>`;
}

function moreView() {
  return `<section class="page narrow-page"><div class="page-heading"><div><p class="eyebrow">PROYECTO ABIERTO</p><h1>Más</h1><p class="lede">Información para entender los datos y colaborar con Movilidad.</p></div></div><div class="info-grid"><article class="info-card"><span class="info-icon">⌁</span><h2>Datos transparentes</h2><p>La información procede de la API pública de Movilidad y se captura aproximadamente cada cinco minutos. Mostramos siempre cuándo se observó cada dato y si puede estar obsoleto.</p></article><article class="info-card"><span class="info-icon">♧</span><h2>Proyecto vecinal</h2><p>Movilidad es un proyecto abierto de Aldea Pucela para informar sobre las estaciones BIKI de Valladolid, sin acciones de alquiler ni reserva.</p></article><article class="info-card"><span class="info-icon">⌘</span><h2>Colabora</h2><p><a href="https://github.com/aldeapucela/biki-stats-web" target="_blank" rel="noreferrer" data-analytics-link="github">Código del frontend</a> · <a href="https://github.com/aldeapucela/biki-stats-core" target="_blank" rel="noreferrer" data-analytics-link="api_github">API y datos</a> · <a href="https://aldeapucela.org/" target="_blank" rel="noreferrer" data-analytics-link="aldea_pucela">Aldea Pucela</a></p></article></div><div class="info-card settings-card"><h2>Preferencias</h2><div class="preference-row"><span>Tema de la interfaz</span><button class="secondary-button" data-action="theme">${state.theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}</button></div><p class="small-note">Código AGPL-3.0-only. El contenido original autorizado se publica bajo CC BY-SA 4.0. Los datos de terceros conservan sus propias condiciones.</p></div></section>`;
}

const loadingState = (message = "Cargando estaciones…") => `<div class="state-card"><span class="spinner"></span><p>${message}</p></div>`;
const emptyState = (title, message) => `<div class="state-card empty"><span class="state-icon">◌</span><h2>${title}</h2><p>${message}</p></div>`;
const errorState = (error) => `<div class="state-card error"><span class="state-icon">!</span><h2>No se pudieron cargar los datos</h2><p>${esc(error?.message || "Comprueba la conexión e inténtalo de nuevo.")}</p><button class="secondary-button" data-action="reload">Reintentar</button></div>`;
const SLOW_MESSAGE = "Esta consulta tarda más de lo habitual. Los periodos largos pueden necesitar varios segundos…";
const partError = (title, error, part) => `<div class="state-card error"><span class="state-icon">!</span><h2>${title}</h2><p>${esc(error?.message || "Comprueba la conexión e inténtalo de nuevo.")}</p><button class="secondary-button" data-history-retry="${part}">Reintentar</button></div>`;
function historyNotice(entry) {
  const { history, summary } = entry;
  if (summary.data === undefined && summary.status === "error") return `<div class="history-notice error" role="status"><span>No se pudo cargar el resumen: ${esc(summary.error?.message || "error desconocido")}. Los valores se muestran como «—».</span><button class="secondary-button" data-history-retry="summary">Reintentar</button></div>`;
  const loading = [history, summary].some((part) => part.status === "loading" && part.data === undefined);
  if (loading && entry.slow) return `<div class="history-notice" role="status">${SLOW_MESSAGE}</div>`;
  if (summary.data === undefined && summary.status === "loading") return `<div class="history-notice" role="status">Cargando resumen…</div>`;
  return "";
}
const formatDate = (value) => value ? new Date(value).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sin fecha";

function getCurrentPosition() {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 300_000, timeout: 10_000 }));
}

async function loadStations(useLocation = false) {
  state.loading = true; state.error = null; render();
  try {
    const response = await api.listAllStations();
    state.nearbyMode = useLocation;
    state.stations = response.data || [];
    state.updatedAt = new Date(); state.geoDenied = false;
    recordDestinationSample();
  } catch (error) { state.error = apiError(error); } finally { state.loading = false; render(); }
}

// La ubicación automática solo se pide si las estaciones se cargaron: un error de la API no se borra.
const locateAfterLoad = () => {
  if (!state.error && !state.locationRequested && !api.useFixtures) locateUser(false);
};

async function locateUser(manual = true) {
  if (manual) analytics.trackEvent("map", "center_on_user", "manual");
  state.locationRequested = true;
  state.locationStatus = "requesting";
  state.locationError = null;
  state.nearbyError = null;
  render();
  if (!navigator.geolocation) {
    analytics.trackEvent("map", "location_permission", "unavailable");
    state.locationStatus = "denied";
    state.locationError = "Este navegador no permite obtener la ubicación.";
    state.geoDenied = true;
    state.nearbyMode = false;
    render();
    return;
  }
  try {
    const { coords } = await getCurrentPosition();
    state.userLocation = { latitude: coords.latitude, longitude: coords.longitude };
    state.locationStatus = "available";
    analytics.trackEvent("map", "location_permission", "granted");
    state.geoDenied = false;
    state.nearbyMode = true;
    render();
    try {
      const response = await api.nearby(coords.latitude, coords.longitude);
      state.stations = (response.data || []).sort((a, b) => (a.distance_m ?? Number.MAX_SAFE_INTEGER) - (b.distance_m ?? Number.MAX_SAFE_INTEGER));
      state.updatedAt = new Date();
      state.error = null;
      recordDestinationSample();
    } catch (error) {
      // La ubicación funciona; el fallo es de la API y no debe presentarse como un problema de permisos.
      state.nearbyMode = false;
      if (state.stations.length) state.nearbyError = "No se pudo ordenar por cercanía. Se muestran las estaciones disponibles.";
      else state.error = apiError(error);
    }
  } catch (error) {
    analytics.trackEvent("map", "location_permission", error?.code === 1 ? "denied" : "unavailable");
    state.locationStatus = "denied";
    state.locationError = error?.code === 1 ? "Permiso de ubicación denegado." : "No se pudo obtener tu ubicación.";
    state.geoDenied = true;
    state.nearbyMode = false;
  } finally {
    state.loading = false;
    render();
  }
}

function loadHistory() {
  const station = currentStation(); if (!station) return;
  historyLoader.load(station.station_id, state.period);
}

function renderMap() { document.querySelector("#map")?.remove(); renderMapInstance(); }
function renderMapInstance() {
  const container = document.querySelector("#map");
  if (!container || !state.stations.length) return;
  if (map) map.remove();
  const center = state.userLocation ? [state.userLocation.latitude, state.userLocation.longitude] : [41.652, -4.724];
  map = L.map(container, { zoomControl: false }).setView(center, state.userLocation ? 14 : 13);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = () => {
    const el = L.DomUtil.create("div", "map-legend");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "Leyenda del mapa");
    el.innerHTML = `<span><b class="marker-value mechanical">M</b>mecánica</span><span><b class="marker-value electric">E</b>eléctrica</span><span><i class="bikes-none"></i>sin bicis</span><span><i class="bikes-partial"></i>falta un tipo</span><span class="legend-greens"><i class="bikes-ok-low"></i><i class="bikes-ok-mid"></i><i class="bikes-ok-high"></i>de las dos: 1, 2–3, 4 o más</span>`;
    L.DomEvent.disableClickPropagation(el);
    return el;
  };
  legend.addTo(map);
  if (state.userLocation) L.circleMarker(center, { radius: 9, color: "#73579f", fillColor: "#b9a7d7", fillOpacity: 0.95, weight: 3, className: "user-location-marker" }).addTo(map).bindTooltip("Tu ubicación");
  const positionOf = (station) => (station?.location?.latitude != null && station.location.longitude != null ? [station.location.latitude, station.location.longitude] : null);
  const originAt = positionOf(state.originId ? stationById(state.originId) : null);
  const destinationAt = positionOf(state.destinationId ? stationById(state.destinationId) : null);
  // Andando hasta la salida (punteada fina) y en bici de la salida al destino (la línea de la #27); sin salida, del usuario al destino.
  if (state.userLocation && originAt) L.polyline([center, originAt], { className: "route-walk-line", interactive: false }).addTo(map);
  if (originAt && destinationAt) L.polyline([originAt, destinationAt], { className: "destination-line", interactive: false }).addTo(map);
  else if (destinationAt && state.userLocation && !state.originId) L.polyline([center, destinationAt], { className: "destination-line", interactive: false }).addTo(map);
  const visibleStations = filterStations();
  markers = visibleStations.filter((station) => station.location?.latitude != null).map((station) => {
    const selected = state.selectedStationId === station.station_id;
    const marker = L.marker([station.location.latitude, station.location.longitude], { icon: L.divIcon({ className: `station-marker bikes-${bikesTone(station)}${selected ? " selected" : ""}${state.destinationId === station.station_id ? " destination" : ""}${state.originId === station.station_id ? " origin" : ""}`, html: `<span class="marker-values"><span class="marker-value mechanical">M ${formatNumber(station.bikes?.mechanical)}</span><span class="marker-value electric">E ${formatNumber(station.bikes?.electric)}</span></span>`, iconSize: [48, 44], iconAnchor: [24, 22] }) }).addTo(map).bindPopup(stationTooltip(station), { className: "station-popup", closeButton: true, autoClose: true, closeOnClick: true, maxWidth: 260 });
    marker.stationId = station.station_id;
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      selectStation(station.station_id);
    });
    return marker;
  });
  map.on("click", collapseStationPanel);
  map.on("dragstart zoomstart", collapseStationPanel);
  const LocateControl = L.Control.extend({
    onAdd() {
      const button = L.DomUtil.create("button", "map-locate-button");
      button.type = "button";
      button.title = "Centrar en mi ubicación";
      button.setAttribute("aria-label", "Centrar en mi ubicación");
      button.innerHTML = "⌾";
      L.DomEvent.disableClickPropagation(button);
      L.DomEvent.on(button, "click", () => locateUser(true));
      return button;
    },
  });
  new LocateControl({ position: "topright" }).addTo(map);
  if (state.destinationFit && (originAt || destinationAt)) {
    state.destinationFit = false;
    // Solo al elegir salida o destino: como el mapa se recrea en cada refresco, encuadrar siempre pelearía con el usuario.
    const points = [state.userLocation ? center : null, originAt, destinationAt].filter(Boolean);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { animate: false, padding: [60, 60], maxZoom: 17 });
    else map.setView(points[0], Math.max(map.getZoom(), 16), { animate: false });
  }
  setTimeout(() => map?.invalidateSize(), 50);
}

function bindEvents() {
  document.querySelector("[data-panel-toggle]")?.addEventListener("click", toggleStationPanel);
  document.querySelectorAll("[data-action='theme']").forEach((button) => button.addEventListener("click", () => { const theme = state.theme === "dark" ? "light" : "dark"; setTheme(theme); analytics.trackEvent("ui", "change_theme", theme); render(); }));
  document.querySelectorAll("[data-history-retry]").forEach((button) => button.addEventListener("click", () => {
    const station = currentStation();
    if (station) historyLoader.retry(station.station_id, state.period, button.dataset.historyRetry === "all" ? undefined : button.dataset.historyRetry);
  }));
  document.querySelectorAll("[data-action='reload']").forEach((button) => button.addEventListener("click", () => loadStations().then(locateAfterLoad)));
  document.querySelectorAll("[data-action='locate']").forEach((button) => button.addEventListener("click", () => locateUser()));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    if (state.filter === button.dataset.filter) return;
    state.filter = button.dataset.filter;
    const filterId = { all: "all", electric: "electric_available", low: "low_occupancy", high: "high_occupancy" }[state.filter];
    analytics.trackEvent("map", "apply_filter", filterId);
    render();
  }));
  document.querySelector("#station-search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.stationPanelExpanded = true;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector("#station-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(state.query.length, state.query.length);
    });
  });
  document.querySelector("#station-search")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const resultCount = filterStations().length;
    analytics.trackEvent("search", "submit", resultCount ? "with_results" : "without_results", resultCount);
  });
  document.querySelector("#station-search")?.addEventListener("focus", () => {
    if (state.stationPanelExpanded) return;
    state.stationPanelExpanded = true;
    render();
    requestAnimationFrame(() => document.querySelector("#station-search")?.focus());
  });
  document.querySelectorAll("[data-favorite]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const stationId = button.dataset.favorite;
    const saved = state.favorites.has(stationId);
    toggleFavorite(stationId);
    analytics.trackEvent("station", saved ? "remove_save" : "save", stationId);
    render();
  }));
  document.querySelectorAll("[data-station]").forEach((card) => {
    const source = state.route === "saved" ? "saved" : "station_card";
    card.addEventListener("click", (event) => { if (!event.target.closest("[data-destination], [data-origin]")) selectStation(card.dataset.station, source); });
    card.addEventListener("keydown", (event) => { if (event.target.closest("button")) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectStation(card.dataset.station, source); } });
  });
  document.querySelector("#history-station-search")?.addEventListener("input", (event) => {
    state.historyQuery = event.target.value;
    state.historyPickerOpen = true;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector("#history-station-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(state.historyQuery.length, state.historyQuery.length);
    });
  });
  document.querySelector("[data-history-toggle]")?.addEventListener("click", () => {
    state.historyPickerOpen = !state.historyPickerOpen;
    render();
    if (state.historyPickerOpen) requestAnimationFrame(() => document.querySelector("#history-station-search")?.focus());
  });
  document.querySelector("#history-station-search")?.addEventListener("focus", () => {
    if (state.historyPickerOpen) return;
    state.historyQuery = "";
    state.historyPickerOpen = true;
    render();
    requestAnimationFrame(() => document.querySelector("#history-station-search")?.focus());
  });
  document.querySelectorAll("[data-history-station]").forEach((button) => button.addEventListener("click", () => { state.selectedStationId = button.dataset.historyStation; analytics.trackEvent("history", "select_station", button.dataset.historyStation); state.historyQuery = ""; state.historyPickerOpen = false; historyLoader.clear(); render(); }));
  document.querySelector("#history-station-search")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      state.historyPickerOpen = false;
      render();
    }
  });
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => { if (state.period === button.dataset.period) return; state.period = button.dataset.period; analytics.trackEvent("history", "select_period", state.period); render(); }));
  document.querySelectorAll("[data-analytics-link]").forEach((link) => link.addEventListener("click", () => analytics.trackEvent("external", "open_link", link.dataset.analyticsLink)));
  document.querySelectorAll("[data-analytics-consent]").forEach((button) => button.addEventListener("click", () => { analytics.setConsent(button.dataset.analyticsConsent === "grant" ? "granted" : "denied"); render(); }));
  document.querySelectorAll("[data-route]").forEach((link) => link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.dataset.route);
  }));
}

function render() {
  document.title = routeTitles[state.route] ?? routeTitles.map;
  const content = state.route === "history" ? historyView() : state.route === "saved" ? savedView() : state.route === "more" ? moreView() : mapView();
  document.querySelector("#app").innerHTML = shell(content); bindEvents();
  // En móvil el gráfico es más ancho que la pantalla: se abre en lo más reciente, que es lo que se busca.
  document.querySelectorAll(".history-page .chart-scroll").forEach((node) => { node.scrollLeft = node.scrollWidth; });
  analytics.trackPageView(state.route);
  if (state.route === "map") renderMapInstance();
  if (state.route === "history" && state.stations.length) loadHistory();
  clearInterval(refreshTimer); refreshTimer = setInterval(() => { if (document.visibilityState === "visible" && state.route !== "more") state.nearbyMode ? locateUser() : loadStations(); }, 60_000);
}

render();
loadStations().then(locateAfterLoad);
