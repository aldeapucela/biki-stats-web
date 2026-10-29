import { defineConfig, devices } from "@playwright/test";

const desktop = { ...devices["Desktop Chrome"], channel: "chrome" };
const mobile = { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// `api-errors.spec.js` necesita la API "de verdad" (sin fixtures) para simular sus fallos con
// `page.route`: corre en un segundo servidor (puerto 5175) con VITE_USE_FIXTURES=false. La base de la
// API es la de producción porque la CSP de index.html solo permite conectar a ese origen (con
// http://localhost:8000 el navegador bloquea la petición antes de que `page.route` la vea); las
// peticiones se interceptan todas, no sale ninguna a la red.
export default defineConfig({
  testDir: "./tests/e2e",
  webServer: [
    { command: "npm run dev -- --host 127.0.0.1 --port 5174", port: 5174, reuseExistingServer: false },
    { command: "npm run dev -- --host 127.0.0.1 --port 5175", port: 5175, reuseExistingServer: false, env: { VITE_USE_FIXTURES: "false", VITE_API_BASE_URL: "https://api.aldeapucela.org/biki" } },
  ],
  use: { baseURL: "http://127.0.0.1:5174", trace: "on-first-retry" },
  projects: [
    { name: "desktop", testIgnore: /api-errors/, use: desktop },
    { name: "mobile", testIgnore: /api-errors/, use: mobile },
    { name: "api-desktop", testMatch: /api-errors/, use: { ...desktop, baseURL: "http://127.0.0.1:5175" } },
    { name: "api-mobile", testMatch: /api-errors/, use: { ...mobile, baseURL: "http://127.0.0.1:5175" } },
  ],
});
