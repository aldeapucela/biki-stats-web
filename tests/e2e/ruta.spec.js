import { expect, test } from "@playwright/test";

// Martes 27-oct-2026, 17:00 en Madrid: franja 17-21 h de un laborable. Con el reloj fijo, la estimación es reproducible.
const NOW = new Date("2026-10-27T16:00:00Z");
// Cerca de Fuente Dorada; Universidad (2 bicis) queda a ~1,2 km y Estación del Norte (12 huecos) más lejos aún.
const USER = { latitude: 41.652, longitude: -4.724 };

// En móvil el panel arranca colapsado y se vuelve a colapsar cuando el mapa se encuadra. Se mira la clase y no `aria-expanded`:
// collapseStationPanel() no actualiza ese atributo (defecto ya presente en main, fuera de esta PR).
async function expandStationPanel(page) {
  const handle = page.locator("[data-panel-toggle]");
  if (await handle.isVisible() && await page.locator(".station-panel.collapsed").count()) {
    await handle.click();
    await expect(page.locator(".station-panel.expanded")).toHaveCount(1);
  }
}

async function open(page) {
  await page.clock.setFixedTime(NOW);
  await page.goto("/");
  await page.waitForSelector(".station-marker");
}

async function pickFromList(page, stationId, button) {
  await expandStationPanel(page);
  await page.locator(`.station-card[data-station="${stationId}"] .${button}-button`).click();
}

async function locate(page, context) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(USER);
  await page.locator(".page-heading [data-action='locate']").click();
  await expect(page.locator(".user-location-marker")).toBeVisible();
}

test("se elige la estación de salida desde el popup y la tarjeta muestra las bicis de ahora", async ({ page }) => {
  await open(page);
  await page.locator(".station-marker").nth(3).dispatchEvent("click");
  const popup = page.locator(".station-popup-content");
  const name = (await popup.locator("strong").first().textContent()).trim();
  await popup.locator(".origin-button").click();
  const leg = page.locator(".origin-leg");
  await expect(leg).toBeVisible();
  await expect(leg.locator("h3")).toHaveText(name);
  await expect(leg.locator(".origin-bikes")).toContainText(/\d+\s+bicis?\s+ahora/);
  await expect(leg).toContainText("DONDE COJO LA BICI");
  // Con solo salida elegida se pide el destino y se ve la marca en el mapa.
  await expect(page.locator(".route-hint")).toContainText("Voy a esta estación");
  await expect(page.locator(".station-marker.origin")).toHaveCount(1);
});

test("la salida se conserva al recargar y se quita desde la tarjeta", async ({ page }) => {
  await open(page);
  await pickFromList(page, "4", "origin");
  await expect(page.locator(".origin-leg h3")).toHaveText("Universidad");
  await page.reload();
  await expect(page.locator(".origin-leg h3")).toHaveText("Universidad");
  await page.locator("[data-origin-clear]").click();
  await expect(page.locator(".destination-card")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".destination-card")).toHaveCount(0);
});

test("la salida se elige desde la lista con el teclado sin cambiar la estación seleccionada", async ({ page }) => {
  await open(page);
  await expandStationPanel(page);
  const card = page.locator('.station-card[data-station="2"]');
  await card.locator(".origin-button").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".origin-leg h3")).toHaveText("Plaza España");
  await expect(page.locator('.station-card[data-station="2"] .origin-button')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.station-card[data-station="2"]')).not.toHaveClass(/selected/);
});

test("una estación no puede ser salida y destino a la vez: elegirla en un extremo la quita del otro", async ({ page }) => {
  await open(page);
  await pickFromList(page, "4", "origin");
  await pickFromList(page, "4", "destination");
  await expect(page.locator(".origin-leg")).toHaveCount(0);
  await expect(page.locator(".destination-card h2")).toHaveText("Universidad");
  await pickFromList(page, "4", "origin");
  await expect(page.locator(".destination-leg")).toHaveCount(0);
  await expect(page.locator(".origin-leg h3")).toHaveText("Universidad");
});

test("con salida, destino y ubicación se estima cuándo se llega y qué frecuencia histórica hay a esa hora", async ({ page, context }) => {
  await open(page);
  await locate(page, context);
  await pickFromList(page, "4", "origin");
  await pickFromList(page, "5", "destination");
  const origin = page.locator(".origin-leg");
  const destination = page.locator(".destination-leg");
  await expect(origin.locator(".destination-trip")).toContainText(/min andando \(estimado, no es una ruta\)/);
  await expect(origin.locator(".route-outlook")).toContainText("Casi seguro que quedará alguna bici");
  await expect(origin.locator(".route-outlook")).toContainText(/cuando llegues \(17:\d\d, en unos \d+ min\)/);
  await expect(origin.locator(".route-outlook small")).toContainText(/ocasiones parecidas \(.* lecturas\)\. Frecuencia histórica, no una previsión\./);
  await expect(destination.locator(".destination-trip")).toContainText(/De la salida al destino: .* en línea recta · unos \d+ min en bici/);
  await expect(destination.locator(".route-outlook")).toContainText("Casi seguro que habrá hueco");
  await expect(destination.locator(".route-total")).toContainText(/sobre las 17:\d\d \(en unos \d+ min\)/);
  // Dos tramos en el mapa: andando hasta la salida y en bici hasta el destino.
  await expect(page.locator(".route-walk-line")).toHaveCount(1);
  await expect(page.locator(".destination-line")).toHaveCount(1);
  await expect(page.locator(".station-marker.origin")).toHaveCount(1);
  await expect(page.locator(".station-marker.destination")).toHaveCount(1);
});

test("sin ubicación se estima solo el tramo en bici y se ofrece activarla", async ({ page }) => {
  await open(page);
  await pickFromList(page, "4", "origin");
  await pickFromList(page, "5", "destination");
  await expect(page.locator(".origin-leg .destination-trip")).toContainText("Activar mi ubicación");
  // Sin ubicación se supone que se sale ya: la salida usa el dato de ahora y el destino, la frecuencia a la llegada.
  await expect(page.locator(".origin-leg .route-outlook")).toHaveCount(0);
  await expect(page.locator(".destination-leg .route-outlook")).toContainText("Casi seguro que habrá hueco");
  await expect(page.locator(".route-walk-line")).toHaveCount(0);
});
