import { expect, test } from "@playwright/test";

// Contraste WCAG entre dos colores "rgb(r, g, b)" / "rgba(r, g, b, a)" opacos.
const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("el título del documento cambia con la ruta", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Movilidad · BIKI Valladolid");
  await page.getByRole("link", { name: "Guardadas" }).click();
  await expect(page).toHaveTitle("Guardadas · Movilidad BIKI");
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page).toHaveTitle("Histórico · Movilidad BIKI");
  await page.getByRole("link", { name: "Más" }).click();
  await expect(page).toHaveTitle("Más · Movilidad BIKI");
  await page.getByRole("link", { name: "Mapa", exact: true }).click();
  await expect(page).toHaveTitle("Movilidad · BIKI Valladolid");
});

test("declara un favicon y se sirve", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.locator('link[rel~="icon"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const response = await request.get(new URL(href, page.url()).href);
    expect(response.status(), href).toBe(200);
    expect(response.headers()["content-type"], href).toMatch(/image\//);
  }
});

test("la CSP del <meta> no incluye frame-ancestors (solo funciona como cabecera)", async ({ page }) => {
  const consola = [];
  page.on("console", (message) => consola.push(message.text()));
  await page.goto("/");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).not.toContain("frame-ancestors");
  expect(consola.filter((text) => text.includes("frame-ancestors"))).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`.primary-button tiene estilo propio y contraste AA (${theme})`, async ({ page }) => {
    await page.goto("/");
    // El banner de analítica solo existe en producción: se inyecta un botón con la misma clase.
    const estilo = await page.evaluate((tema) => {
      document.documentElement.dataset.theme = tema;
      const boton = Object.assign(document.createElement("button"), { className: "primary-button", textContent: "Aceptar" });
      document.body.append(boton);
      const s = getComputedStyle(boton);
      return { fondo: s.backgroundColor, color: s.color, radio: parseFloat(s.borderTopLeftRadius), borde: parseFloat(s.borderTopWidth) };
    }, theme);
    expect(estilo.fondo).not.toBe("rgba(0, 0, 0, 0)");
    expect(estilo.radio).toBeGreaterThanOrEqual(8);
    expect(contrast(estilo.color, estilo.fondo)).toBeGreaterThanOrEqual(4.5);
  });
}

test("el botón «Cómo llegar» del popup tiene texto blanco con contraste AA", async ({ page }) => {
  await page.goto("/");
  await page.locator(".station-marker").first().click({ force: true });
  const boton = page.locator(".map-directions-button");
  await expect(boton).toBeVisible();
  const estilo = await boton.evaluate((el) => ({ color: getComputedStyle(el).color, fondo: getComputedStyle(el).backgroundColor }));
  expect(estilo.color).toBe("rgb(255, 255, 255)");
  expect(contrast(estilo.color, estilo.fondo)).toBeGreaterThanOrEqual(4.5);
});

test("el botón de favorito mide al menos 24x24 px (WCAG 2.5.8)", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.locator("[data-panel-toggle]").click(); // en móvil la lista arranca colapsada
  await expect(page.locator(".favorite-button").first()).toBeVisible();
  const box = await page.locator(".favorite-button").first().boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
});

test.describe("hoja de estaciones en móvil", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "solo móvil"));

  for (const expandida of [false, true]) {
    test(`el tirador mide al menos 24 px de alto y la atribución no tapa la hoja (${expandida ? "expandida" : "colapsada"})`, async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector(".station-card", { state: "attached" });
      if (expandida) await page.locator("[data-panel-toggle]").click();
      await page.waitForTimeout(600);
      const medidas = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const atribucion = rect(".leaflet-control-attribution");
        const hoja = rect(".station-panel");
        const mapa = rect("#map");
        const solapa = atribucion.left < hoja.right && atribucion.right > hoja.left && atribucion.top < hoja.bottom && atribucion.bottom > hoja.top;
        const dentroDelMapa = atribucion.left >= mapa.left && atribucion.right <= mapa.right && atribucion.top >= mapa.top && atribucion.bottom <= mapa.bottom;
        return { tirador: rect(".station-panel-handle").height, solapa, dentroDelMapa, visible: atribucion.width > 0 && atribucion.height > 0 };
      });
      expect(medidas.tirador).toBeGreaterThanOrEqual(24);
      expect(medidas.visible).toBe(true);
      expect(medidas.dentroDelMapa).toBe(true);
      expect(medidas.solapa).toBe(false);
    });
  }
});
