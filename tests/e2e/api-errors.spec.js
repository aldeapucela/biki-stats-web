import { expect, test } from "@playwright/test";
import { fixtureStations } from "../../src/fixtures.js";

// Estos tests corren sin fixtures (ver playwright.config.js): la API se simula con `page.route`.
const cors = { "access-control-allow-origin": "*" };
const json = (body, status = 200) => ({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
const success = (data) => json({ status: "success", code: 200, data, errors: null, meta: { pagination: { limit: 100, offset: 0, returned: data.length, has_more: false } } });
const failure = () => json({ status: "error", code: 500, data: null, errors: [{ code: "INTERNAL_ERROR", message: "Error interno" }], meta: {} }, 500);
const nearbyStations = fixtureStations.map((station, index) => ({ ...station, distance_m: 300 + index * 150 }));

// `stations` y `nearby` son "ok" | "500" | "red"; `api.stations = "ok"` simula que la API se recupera.
// `api.calls` cuenta las peticiones servidas por el mock: sin ellas, un bloqueo del navegador (p. ej. por
// CSP) se confundiría con un fallo simulado y el test pasaría sin probar nada.
async function mockApi(page, api) {
  api.calls = { stations: 0, nearby: 0 };
  const respond = (name, data) => (route) => {
    api.calls[name] += 1;
    const mode = api[name];
    return mode === "ok" ? route.fulfill(success(data)) : mode === "500" ? route.fulfill(failure()) : route.abort();
  };
  await page.route("**/api/v1/stations/nearby**", respond("nearby", nearbyStations));
  await page.route(/\/api\/v1\/stations(\?.*)?$/, respond("stations", fixtureStations));
}

const grantLocation = async (context) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 41.6523, longitude: -4.7245 });
};

for (const mode of ["500", "red"]) {
  test(`con /stations en ${mode === "500" ? "500" : "fallo de red"} muestra el error y Reintentar, y se recupera`, async ({ page }) => {
    const api = { stations: mode, nearby: "ok" };
    await mockApi(page, api);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "No se pudieron cargar los datos" })).toBeVisible();
    // El mensaje demuestra que la petición simulada se sirvió: el 500 trae "Error interno"; la red caída, el genérico.
    await expect(page.getByText(mode === "500" ? "Error interno" : "No se pudo conectar con la API")).toBeVisible();
    expect(api.calls.stations).toBeGreaterThan(0);
    await expect(page.getByText("No hay estaciones que coincidan")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeVisible();
    api.stations = "ok";
    await retry.click();
    await expect(page.locator(".station-card")).toHaveCount(fixtureStations.length);
    await expect(page.getByRole("heading", { name: "No se pudieron cargar los datos" })).toHaveCount(0);
  });
}

test("la ubicación automática no tapa un error de /stations", async ({ page, context }) => {
  await grantLocation(context);
  const api = { stations: "500", nearby: "ok" };
  await mockApi(page, api);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No se pudieron cargar los datos" })).toBeVisible();
  expect(api.calls.stations).toBeGreaterThan(0);
  // Con /nearby disponible y ubicación concedida, la app no debe haber sustituido el error por una lista.
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.locator(".station-card")).toHaveCount(0);
  expect(api.calls.nearby).toBe(0);
});

for (const mode of ["500", "red"]) {
  test(`con /nearby en ${mode === "500" ? "500" : "fallo de red"} y ubicación concedida conserva la lista y avisa`, async ({ page, context }) => {
    await grantLocation(context);
    const api = { stations: "ok", nearby: mode };
    await mockApi(page, api);
    await page.goto("/");
    await expect(page.locator("[data-action=locate]")).toContainText("Ubicación activa");
    expect(api.calls.nearby).toBeGreaterThan(0);
    await expect(page.locator(".panel-notice")).toContainText("No se pudo ordenar por cercanía");
    await expect(page.locator(".station-card")).toHaveCount(fixtureStations.length);
    await expect(page.getByRole("heading", { name: "No se pudieron cargar los datos" })).toHaveCount(0);
    await expect(page.locator("[data-action=locate]")).not.toContainText("no disponible");
  });
}
