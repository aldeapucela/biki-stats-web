import { expect, test } from "@playwright/test";

async function openHistory(page, period = "7d") {
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await page.locator(`[data-period="${period}"]`).click();
  await expect(page.locator(".stacked-chart")).toBeVisible();
}

test("la última lectura dibuja la estación: un anclaje por plaza", async ({ page }) => {
  await openHistory(page);
  const row = page.locator(".slot-row");
  await expect(row).toBeVisible();
  const [, mecanicas, electricas, libres] = (await row.getAttribute("aria-label")).match(/(\d+) bicis mecánicas, (\d+) eléctricas y (\d+) huecos libres/);
  await expect(row.locator(".slot.mechanical")).toHaveCount(Number(mecanicas));
  await expect(row.locator(".slot.electric")).toHaveCount(Number(electricas));
  await expect(row.locator(".slot.free")).toHaveCount(Number(libres));
  await expect(page.locator(".now-card h2")).toContainText(`de ${Number(mecanicas) + Number(electricas) + Number(libres)} anclajes`);
});

test("conserva los KPI de ocupación y añade mejor y peor hora para coger y para dejar", async ({ page }) => {
  await openHistory(page);
  for (const label of ["Ocupación media", "Máxima ocupación", "Mínima ocupación", "Bicis medias"]) {
    await expect(page.locator(".kpi-card", { hasText: label })).toBeVisible();
  }
  for (const label of ["Mejor hora para coger", "Peor hora para coger", "Mejor hora para dejar", "Peor hora para dejar"]) {
    const card = page.locator(".hour-kpis .kpi-card", { hasText: label });
    await expect(card).toBeVisible();
    await expect(card.locator("strong")).toHaveText(/^\d{2}:00$/);
  }
});

test("el mapa de calor aparece a 7 días y desaparece a 24 h", async ({ page }) => {
  await openHistory(page, "7d");
  const heatmap = page.locator(".heatmap");
  await expect(heatmap).toBeVisible();
  const filas = await heatmap.locator(".hm-row").count();
  expect(await heatmap.locator(".hm-cell").count()).toBe((filas - 1) * 24); // la primera fila son las horas
  await page.locator('[data-period="24h"]').click();
  await expect(page.locator(".heatmap")).toHaveCount(0);
});

test("a 30 días el mapa de calor agrupa por día de la semana", async ({ page }) => {
  await openHistory(page, "30d");
  const etiquetas = await page.locator(".hm-row .hm-label").allTextContents();
  expect(etiquetas.filter(Boolean).length).toBeGreaterThan(0);
  expect(etiquetas.filter(Boolean).every((label) => /^(lun|mar|mié|jue|vie|sáb|dom)$/.test(label))).toBe(true);
});

test("el gráfico tiene eje con valores y una lectura al pasar o tocar (no solo un <title>)", async ({ page }) => {
  await openHistory(page);
  expect(await page.locator(".stacked-chart .chart-tick").count()).toBeGreaterThan(3);
  const lectura = page.locator(".chart-readout:not(.hm-readout)");
  await expect(lectura).toContainText("Pasa el cursor");
  await page.locator(".chart-col .chart-hit").nth(40).dispatchEvent("pointerover");
  await expect(lectura).toContainText(/mecánicas.*eléctricas.*huecos libres/);
  await page.locator(".hm-cell").nth(30).dispatchEvent("pointerover");
  await expect(page.locator(".hm-readout")).toContainText(/\d{2}:00 · /);
});

test("las barras solo suman bicis: el eje no llega a la capacidad y los huecos libres no se apilan", async ({ page }) => {
  await openHistory(page);
  await expect(page.locator(".stacked-chart .svg-docks")).toHaveCount(0);
  await expect(page.locator(".donut")).toHaveCount(0);
});

test("en el móvil el gráfico se abre en lo más reciente", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo aplica al viewport móvil");
  await openHistory(page);
  const { left, ancho, visible } = await page.locator(".history-page .chart-scroll").evaluate((el) => ({ left: el.scrollLeft, ancho: el.scrollWidth, visible: el.clientWidth }));
  expect(ancho).toBeGreaterThan(visible);
  expect(left).toBeGreaterThan(0);
});
