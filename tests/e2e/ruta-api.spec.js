import { expect, test } from "@playwright/test";
import { fixtureStations } from "../../src/fixtures.js";

// Corre sin fixtures (ver playwright.config.js): la API se simula con `page.route` para fabricar los estados que los datos
// de desarrollo no tienen (estación sin bicis, sin huecos, obsoleta). Martes 27-oct-2026, 17:00 en Madrid.
const NOW = new Date("2026-10-27T16:00:00Z");
const cors = { "access-control-allow-origin": "*" };
const json = (body) => ({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
const success = (data) => json({ status: "success", code: 200, data, errors: null, meta: { pagination: { limit: 100, offset: 0, returned: data.length, has_more: false } } });

// 1 Fuente Dorada: 1 bici · 2 Plaza España: 0 bicis · 3 Campo Grande: 25 bicis y 0 huecos · 4 Universidad: 2 bicis · 5 Estación del Norte: 13 bicis y 12 huecos
const with_ = (id, patch) => (station) => (station.station_id === id ? { ...station, ...patch } : station);
const base = [
  with_("1", { bikes: { mechanical: 1, electric: 0 }, free_docks: 20 }),
  with_("2", { bikes: { mechanical: 0, electric: 0 }, free_docks: 30 }),
  with_("3", { bikes: { mechanical: 18, electric: 7 }, free_docks: 0 }),
];
const stationsFor = (patches = []) => [...base, ...patches].reduce((list, patch) => list.map(patch), fixtureStations);

async function mock(page, context, { patches = [], user = { latitude: 41.6523, longitude: -4.7245 } } = {}) {
  const stations = stationsFor(patches);
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/v1/stations/nearby**", (route) => route.fulfill(success(stations.map((station) => ({ ...station, distance_m: 100 })))));
  await page.route(/\/api\/v1\/stations(\?.*)?$/, (route) => route.fulfill(success(stations)));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(user);
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  await page.locator(".page-heading [data-action='locate']").click();
  await expect(page.locator(".user-location-marker")).toBeVisible();
}

async function pick(page, stationId, button) {
  const handle = page.locator("[data-panel-toggle]");
  if (await handle.isVisible() && await page.locator(".station-panel.collapsed").count()) await handle.click();
  await page.locator(`.station-card[data-station="${stationId}"] .${button}-button`).click();
}

test("sin bicis en la salida avisa, da la frecuencia baja a la llegada y ofrece las estaciones más cercanas con bicis", async ({ page, context }) => {
  await mock(page, context);
  await pick(page, "2", "origin");
  const leg = page.locator(".origin-leg");
  await expect(leg.locator(".destination-alert")).toContainText("no queda ninguna bici");
  // Llegando en unos 3 min cae en el horizonte de 10 min: con 0 bicis ahora, un laborable a esa hora hubo bici en ~1 de cada 3.
  await expect(leg.locator(".route-outlook")).toHaveAttribute("data-level", "unlikely");
  await expect(leg.locator(".route-outlook")).toContainText("Poco probable que quede alguna bici");
  await expect(leg.locator(".route-alt")).toContainText(/Cerca con bicis: Campo Grande .* · Estación del Norte/);
  await leg.locator(".route-alt .link-button", { hasText: "Estación del Norte" }).click();
  await expect(page.locator(".origin-leg h3")).toHaveText("Estación del Norte");
});

test("con la salida lejos de la ubicación la frecuencia es «dudosa» y no un sí o un no", async ({ page, context }) => {
  // A ~780 m al norte de Plaza España: unos 13 min andando, horizonte de 20 min.
  await mock(page, context, { user: { latitude: 41.6578, longitude: -4.724 } });
  await pick(page, "2", "origin");
  const outlook = page.locator(".origin-leg .route-outlook");
  await expect(outlook).toHaveAttribute("data-level", "doubtful");
  await expect(outlook).toContainText("Dudoso que quede alguna bici");
});

test("sin huecos en el destino avisa, no inventa cifra con pocas lecturas y cambia a una alternativa con un clic", async ({ page, context }) => {
  await mock(page, context);
  await pick(page, "3", "destination");
  const leg = page.locator(".destination-leg");
  await expect(leg.locator(".destination-alert").first()).toContainText("no queda ningún hueco libre");
  // Con 0 huecos ahora a esa hora hay menos de 300 lecturas parecidas: el aviso es no dar cifra.
  await expect(leg.locator(".route-outlook")).toHaveClass(/muted/);
  await expect(leg.locator(".route-outlook")).toContainText(/Sin datos suficientes para estimar a las 17:\d\d/);
  await expect(leg.locator(".route-alt")).toContainText(/Cerca con huecos: Estación del Norte .* · Plaza España/);
  await leg.locator(".route-alt .link-button", { hasText: "Estación del Norte" }).click();
  await expect(page.locator(".destination-leg h2")).toHaveText("Estación del Norte");
});

test("una estación con datos obsoletos no recibe estimación", async ({ page, context }) => {
  await mock(page, context, { patches: [with_("4", { is_stale: true, data_age_seconds: 1200 })] });
  await pick(page, "4", "origin");
  await expect(page.locator(".origin-leg .route-outlook")).toContainText("sin estimación para tu llegada");
});

test("si se tarda más de 45 minutos en llegar dice que no estima", async ({ page, context }) => {
  await mock(page, context, { user: { latitude: 41.7, longitude: -4.8 } });
  await pick(page, "4", "origin");
  await expect(page.locator(".origin-leg .route-outlook")).toContainText("Falta más de 45 min: sin estimación.");
});
