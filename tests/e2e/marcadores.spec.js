import { expect, test } from "@playwright/test";

const parse = (rgb) => rgb.match(/[\d.]+/g).map(Number);
const luminance = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Mezcla un color con alfa sobre un fondo opaco.
const over = ([r, g, b, a = 1], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];

test("el color del marcador es un semáforo por tipo de bici, no por el total ni por el porcentaje", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  // Fixtures (M+E): Fuente Dorada 11+5, Plaza España 4+1, Campo Grande 18+7, Universidad 2+0, Estación del Norte 10+3.
  const clases = await page.locator(".station-marker").evaluateAll((els) => els.map((el) => el.className));
  const cuenta = (tono) => clases.filter((c) => c.includes(`bikes-${tono}`)).length;
  expect(cuenta("ok-high")).toBe(2);
  expect(cuenta("ok-mid")).toBe(1);
  expect(cuenta("ok-low")).toBe(1);
  expect(cuenta("partial")).toBe(1);
  expect(clases.some((c) => c.split(/\s+/).some((t) => ["low", "medium", "high", "bikes-ok", "bikes-few"].includes(t)))).toBe(false);
});

test("cada marcador muestra a la vez las bicis mecánicas y las eléctricas", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  const textos = await page.locator(".station-marker").evaluateAll((els) => els.map((el) => el.innerText.replace(/\s+/g, " ").trim()));
  for (const texto of textos) expect(texto).toMatch(/^M \d+ E \d+$/);
});

for (const tono of ["ok-high", "ok-mid", "ok-low", "partial"]) {
  test(`las dos chapas del marcador (${tono}) tienen contraste AA`, async ({ page }) => {
    await page.goto("/");
    const marcador = page.locator(`.station-marker.bikes-${tono}`).first();
    await marcador.waitFor({ state: "attached" });
    const colores = await marcador.evaluate((el) => {
      const c = (e) => getComputedStyle(e);
      return { base: c(el).backgroundColor, m: [c(el.querySelector(".mechanical")).backgroundColor, c(el.querySelector(".mechanical")).color], e: [c(el.querySelector(".electric")).backgroundColor, c(el.querySelector(".electric")).color] };
    });
    const base = parse(colores.base);
    expect(contrast(parse(colores.m[1]), parse(colores.m[0]))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parse(colores.e[1]), over(parse(colores.e[0]), base))).toBeGreaterThanOrEqual(4.5);
  });
}

test("la leyenda es visible, está dentro del mapa y no tapa los controles", async ({ page }) => {
  await page.goto("/");
  const leyenda = page.getByRole("group", { name: "Leyenda del mapa" });
  await expect(leyenda).toBeVisible();
  await expect(leyenda).toContainText("mecánica");
  await expect(leyenda).toContainText("eléctrica");
  await expect(leyenda).toContainText("falta un tipo");
  const medidas = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const l = document.querySelector(".map-legend").getBoundingClientRect();
    const mapa = r("#map, .map-container");
    const solapa = (b) => l.left < b.right && l.right > b.left && l.top < b.bottom && l.bottom > b.top;
    const hoja = document.querySelector(".station-panel").getBoundingClientRect();
    return { dentro: l.left >= mapa.left && l.right <= mapa.right && l.top >= mapa.top && l.bottom <= mapa.bottom, zoom: solapa(r(".leaflet-control-zoom")), hoja: solapa(hoja) && getComputedStyle(document.querySelector(".station-panel")).position === "absolute" };
  });
  expect(medidas.dentro).toBe(true);
  expect(medidas.zoom).toBe(false);
  expect(medidas.hoja).toBe(false);
});

test("el mapa base va en grises para que sus colores no se confundan con los de los marcadores", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".station-marker");
  const filtro = await page.locator(".leaflet-tile-pane").evaluate((el) => getComputedStyle(el).filter);
  expect(filtro).toContain("grayscale(1)");
  // Los marcadores no deben heredar el filtro: van en otro panel.
  expect(await page.locator(".leaflet-marker-pane").evaluate((el) => getComputedStyle(el).filter)).toBe("none");
});
