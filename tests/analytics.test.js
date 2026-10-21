import { describe, expect, it } from "vitest";
import { createAnalytics, getAnalyticsConfig, hasPrivacySignal, isAllowedEvent } from "../src/analytics.js";

const setup = (overrides = {}) => {
  const values = new Map();
  const scripts = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const windowObject = { _paq: [] };
  const documentObject = {
    head: { appendChild: (script) => scripts.push(script) },
    createElement: () => ({}),
    getElementById: (id) => scripts.find((script) => script.id === id),
  };
  const analytics = createAnalytics({
    env: { PROD: true, VITE_ANALYTICS_ENABLED: "true", VITE_MATOMO_URL: "https://stats.aldeapucela.org/", VITE_MATOMO_SITE_ID: "32" },
    windowObject,
    documentObject,
    navigatorObject: {},
    storage,
    ...overrides,
  });
  return { analytics, values, windowObject, scripts };
};

describe("analítica Matomo", () => {
  it("solo habilita la analítica en producción", () => {
    expect(getAnalyticsConfig({ PROD: false }).enabled).toBe(false);
    expect(getAnalyticsConfig({ PROD: true, VITE_ANALYTICS_ENABLED: "false" }).enabled).toBe(false);
    expect(getAnalyticsConfig({ PROD: true, VITE_ANALYTICS_ENABLED: "true" }).enabled).toBe(true);
  });

  it("requiere consentimiento y carga el tracker una sola vez", () => {
    const { analytics, windowObject, scripts } = setup();
    expect(analytics.init()).toBe(false);
    expect(analytics.shouldShowConsentBanner()).toBe(true);
    expect(analytics.setConsent("granted")).toBe(true);
    expect(scripts).toHaveLength(1);
    expect(analytics.init()).toBe(true);
    expect(analytics.trackPageView("map")).toBe(true);
    expect(analytics.trackPageView("map")).toBe(false);
    expect(windowObject._paq.filter(([command]) => command === "trackPageView")).toHaveLength(1);
    expect(scripts).toHaveLength(1);
  });

  it("bloquea el seguimiento cuando el visitante expresa no seguimiento", () => {
    const { analytics, windowObject } = setup({ navigatorObject: { globalPrivacyControl: true } });
    expect(analytics.shouldShowConsentBanner()).toBe(false);
    analytics.setConsent("granted");
    expect(analytics.trackEvent("map", "select_marker", "station-1")).toBe(false);
    expect(windowObject._paq).toHaveLength(0);
  });

  it("acepta solo eventos y valores cerrados", () => {
    expect(isAllowedEvent("map", "apply_filter", "electric_available")).toBe(true);
    expect(isAllowedEvent("map", "apply_filter", "electric")).toBe(false);
    expect(isAllowedEvent("search", "submit", "texto de búsqueda")).toBe(false);
    expect(isAllowedEvent("station", "save", "station-1")).toBe(true);
    expect(isAllowedEvent("station", "save", "nombre de la estación")).toBe(false);
    expect(hasPrivacySignal({ doNotTrack: "1" })).toBe(true);
    expect(hasPrivacySignal({ doNotTrack: "0" })).toBe(false);
  });
});
