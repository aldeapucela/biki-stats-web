import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

// GitHub Pages sirve 404.html ante rutas desconocidas (/history, /saved, /more).
// Al ser una copia de index.html, la SPA arranca y resuelve la ruta en el cliente.
const spaFallback = () => ({
  name: "spa-fallback-404",
  apply: "build",
  closeBundle() {
    copyFileSync("dist/index.html", "dist/404.html");
  },
});

export default defineConfig({
  base: "/",
  plugins: [spaFallback()],
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
});
