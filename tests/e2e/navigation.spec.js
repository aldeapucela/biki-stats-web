import { expect, test } from "@playwright/test";

test("navega entre mapa, guardadas, histórico y más", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Estaciones BIKI" })).toBeVisible();
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await expect(page.locator(".history-kpis")).toBeVisible();
  await expect(page.locator(".stacked-chart")).toBeVisible();
  const historySearch = page.locator("#history-station-search");
  await historySearch.fill("Fuente");
  await expect(historySearch).toBeFocused();
  await expect(page.locator("[data-history-station]")).toHaveCount(1);
  await page.getByRole("button", { name: /cerrar selector/i }).click();
  await expect(page.locator("#history-station-options")).toHaveCount(0);
  await page.getByRole("button", { name: /abrir selector/i }).click();
  await expect(page.locator("#history-station-options")).toBeVisible();
  await page.getByRole("tab", { name: "7 días" }).click();
  await expect(page.getByRole("tab", { name: "7 días" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "24 h" }).click();
  await expect(page.getByRole("tab", { name: "24 h" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Guardadas" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("heading", { name: "Guardadas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Más" }).click();
  await expect(page).toHaveURL(/\/more$/);
  await expect(page.getByRole("heading", { name: "Más" })).toBeVisible();
});

test("abre directamente las rutas SEO-friendly", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await page.getByRole("link", { name: "Mapa", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Estaciones BIKI" })).toBeVisible();
});

test("cambia tema y guarda una estación", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /guardar/i }).first().click();
  await page.getByRole("link", { name: "Guardadas" }).click();
  await expect(page.locator(".saved-grid .station-card")).toHaveCount(1);
  await page.getByRole("button", { name: /cambiar tema/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("centra el mapa, ordena por cercanía y sincroniza el marcador con la lista", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 41.6523, longitude: -4.7245 });
  await page.goto("/");
  await page.locator(".map-locate-button").click();
  await expect(page.locator(".station-card").nth(1)).toBeVisible();
  const distances = await page.locator(".station-card").evaluateAll((cards) => cards.slice(0, 2).map((card) => {
    const match = card.querySelector(".station-card-head p")?.textContent.match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  }));
  expect(distances[0]).toBeLessThanOrEqual(distances[1]);
  await page.locator(".station-marker").first().click();
  await expect(page.locator(".station-card.selected")).toHaveCount(1);
  await expect(page.locator(".station-marker.selected")).toHaveCount(1);
});

test("mantiene el foco al buscar y filtra la lista y el mapa", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Buscar estación" });
  const stationName = await page.locator(".station-card h3").first().textContent();
  await search.fill(stationName.trim());
  await expect(search).toBeFocused();
  await expect(page.locator(".station-card")).toHaveCount(1);
  await expect(page.locator(".station-marker")).toHaveCount(1);
  await expect(page.locator(".station-card h3")).toHaveText(stationName.trim());
});
