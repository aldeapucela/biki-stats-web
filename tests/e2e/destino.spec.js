import { expect, test } from "@playwright/test";

// En móvil el panel de estaciones arranca colapsado (lista oculta); en escritorio el tirador no se muestra.
async function expandStationPanel(page) {
  const handle = page.locator("[data-panel-toggle]");
  if (await handle.isVisible() && (await handle.getAttribute("aria-expanded")) === "false") {
    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");
  }
}

async function chooseFromPopup(page, index = 1) {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  await page.locator(".station-marker").nth(index).dispatchEvent("click");
  const popup = page.locator(".station-popup-content");
  await expect(popup).toBeVisible();
  const name = (await popup.locator("strong").first().textContent()).trim();
  await popup.locator(".destination-button").click();
  return name;
}

test("se elige el destino desde el popup y la tarjeta muestra huecos y bicis", async ({ page }) => {
  const name = await chooseFromPopup(page);
  const card = page.locator(".destination-card");
  await expect(card).toBeVisible();
  await expect(card.locator("h2")).toHaveText(name);
  await expect(card.locator(".destination-docks")).toContainText(/\d+\s+huecos? libres?/);
  await expect(card.locator(".destination-bikes")).toContainText(/mecánicas.*eléctricas/);
  await expect(card).toContainText(/Actualizado/);
});

test("el destino se conserva al recargar y se quita desde la tarjeta", async ({ page }) => {
  const name = await chooseFromPopup(page);
  await page.reload();
  await expect(page.locator(".destination-card h2")).toHaveText(name);
  await page.locator(".destination-card [data-destination-clear]").click();
  await expect(page.locator(".destination-card")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".destination-card")).toHaveCount(0);
});

test("se elige el destino desde la lista sin cambiar la estación seleccionada", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  await expandStationPanel(page);
  const card = page.locator(".station-card").nth(2);
  const id = await card.getAttribute("data-station");
  await card.locator(".destination-button").click();
  await expect(page.locator(".destination-card")).toBeVisible();
  await expect(page.locator(`.station-card[data-station="${id}"] .destination-button`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`.station-card[data-station="${id}"]`)).not.toHaveClass(/selected/);
});

test("con el teclado se elige el destino desde la tarjeta de la lista", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  await expandStationPanel(page);
  await page.locator(".station-card").first().locator(".destination-button").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".destination-card")).toBeVisible();
});

test("sin ubicación no hay distancia ni línea y se ofrece activarla", async ({ page }) => {
  await chooseFromPopup(page);
  await expect(page.locator(".destination-trip")).toContainText("Activar mi ubicación");
  await expect(page.locator(".destination-line")).toHaveCount(0);
});

test("con ubicación se ve la línea recta, la distancia y el tiempo rotulado como estimación", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 41.652, longitude: -4.724 });
  await chooseFromPopup(page);
  await page.locator(".page-heading [data-action='locate']").click();
  const trip = page.locator(".destination-trip");
  await expect(trip).toContainText(/en línea recta/);
  await expect(trip).toContainText(/min en bici \(estimado, no es una ruta\)/);
  await expect(page.locator(".destination-line")).toHaveCount(1);
});

test("el popup ofrece cómo llegar en modo bici sin enviar la ubicación a ningún servicio", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  await page.locator(".station-marker").nth(0).dispatchEvent("click");
  const popup = page.locator(".station-popup-content");
  await expect(popup.locator(".map-directions-button")).toHaveAttribute("href", /travelmode=bicycling/);
  await expect(popup.locator(".map-directions-link")).toHaveAttribute("href", /fossgis_osrm_bike/);
});
