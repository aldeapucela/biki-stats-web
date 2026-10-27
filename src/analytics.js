const CONSENT_KEY = "movilidad.analyticsConsent";
const DEFAULT_TRACKER_URL = "https://stats.aldeapucela.org/";
const DEFAULT_SITE_ID = "32";

const allowedEvents = {
  map: {
    select_marker: "station",
    select_station_card: "station",
    expand_results: "bottom_sheet",
    collapse_results: "bottom_sheet",
    center_on_user: "manual",
    location_permission: new Set(["granted", "denied", "prompt", "unavailable"]),
    apply_filter: new Set(["all", "electric_available", "low_occupancy", "high_occupancy"]),
  },
  search: { submit: new Set(["with_results", "without_results"]) },
  station: {
    view_detail: "station_id",
    save: "station_id",
    remove_save: "station_id",
  },
  saved: { open_station: "station_id" },
  history: {
    select_station: "station_id",
    select_period: new Set(["24h", "7d", "30d", "90d"]),
    view_chart: new Set(["occupancy", "composition"]),
    interact_chart: "closed_type",
  },
  ui: { change_theme: new Set(["light", "dark"]) },
  external: { open_link: new Set(["license", "github", "aldea_pucela", "api_github"]) },
};

const safeStorage = (storage) => storage || {
  getItem: () => null,
  setItem: () => {},
};

const getStorage = (windowObject) => {
  try { return windowObject?.localStorage; } catch { return null; }
};

const normalizeUrl = (value) => {
  try {
    const url = new URL(value || DEFAULT_TRACKER_URL, DEFAULT_TRACKER_URL);
    return `${url.toString().replace(/\/$/, "")}/`;
  } catch {
    return DEFAULT_TRACKER_URL;
  }
};

export function getAnalyticsConfig(env = import.meta.env) {
  const enabled = env.PROD === true && env.VITE_ANALYTICS_ENABLED !== "false";
  return {
    enabled,
    trackerUrl: normalizeUrl(env.VITE_MATOMO_URL || DEFAULT_TRACKER_URL),
    siteId: String(env.VITE_MATOMO_SITE_ID || DEFAULT_SITE_ID),
  };
}

export function hasPrivacySignal(navigatorObject = globalThis.navigator) {
  if (!navigatorObject) return false;
  return navigatorObject.globalPrivacyControl === true
    || navigatorObject.doNotTrack === "1"
    || navigatorObject.doNotTrack === "yes"
    || navigatorObject.msDoNotTrack === "1";
}

export function isAllowedEvent(category, action, name) {
  const actionRules = allowedEvents[category];
  if (!actionRules || !(action in actionRules)) return false;
  const rule = actionRules[action];
  if (rule instanceof Set) return rule.has(name);
  if (rule === "station_id") return typeof name === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(name);
  if (rule === "closed_type") return typeof name === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(name);
  return rule === name;
}

export function createAnalytics({
  env = import.meta.env,
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  navigatorObject = globalThis.navigator,
  storage = getStorage(windowObject),
} = {}) {
  const config = getAnalyticsConfig(env);
  const localStorage = safeStorage(storage);
  let initialized = false;
  let lastPageview = null;

  const getConsent = () => {
    try {
      const value = localStorage.getItem(CONSENT_KEY);
      return value === "granted" || value === "denied" ? value : null;
    } catch {
      return null;
    }
  };

  const canTrack = () => config.enabled && getConsent() === "granted" && !hasPrivacySignal(navigatorObject);
  const push = (...command) => {
    if (!canTrack() || !windowObject) return false;
    windowObject._paq = windowObject._paq || [];
    windowObject._paq.push(command);
    return true;
  };

  const init = () => {
    if (initialized || !canTrack() || !windowObject) return initialized;
    windowObject._paq = windowObject._paq || [];
    windowObject._paq.push(["setTrackerUrl", `${config.trackerUrl}matomo.php`]);
    windowObject._paq.push(["setSiteId", config.siteId]);
    windowObject._paq.push(["enableLinkTracking"]);
    initialized = true;

    if (documentObject && !documentObject.getElementById("matomo-script")) {
      const script = documentObject.createElement("script");
      script.id = "matomo-script";
      script.async = true;
      script.src = `${config.trackerUrl}matomo.js`;
      documentObject.head?.appendChild(script);
    }
    return true;
  };

  const setConsent = (value) => {
    if (value !== "granted" && value !== "denied") return false;
    try { localStorage.setItem(CONSENT_KEY, value); } catch { return false; }
    if (value === "granted") init();
    return true;
  };

  const shouldShowConsentBanner = () => config.enabled && !hasPrivacySignal(navigatorObject) && getConsent() === null;

  const trackPageView = (route) => {
    if (route === lastPageview || !init()) return false;
    lastPageview = route;
    push("setCustomUrl", route === "map" ? "/" : `/${route}`);
    push("setDocumentTitle", ({ map: "Mapa", saved: "Guardadas", history: "Histórico", more: "Más" })[route] || "Movilidad BIKI");
    return push("trackPageView");
  };

  const trackEvent = (category, action, name, value) => {
    if (!isAllowedEvent(category, action, name) || (value !== undefined && !Number.isFinite(value))) return false;
    return value === undefined ? push("trackEvent", category, action, name) : push("trackEvent", category, action, name, value);
  };

  return {
    config,
    getConsent,
    hasPrivacySignal: () => hasPrivacySignal(navigatorObject),
    shouldShowConsentBanner,
    setConsent,
    init,
    trackPageView,
    trackEvent,
  };
}

export const analytics = createAnalytics();
