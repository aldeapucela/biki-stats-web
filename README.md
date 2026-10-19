# Movilidad · biki-stats-web

Frontend informativo de las estaciones BIKI de Valladolid. Es una SPA en JavaScript vanilla, Vite y Tailwind CSS; no ofrece alquiler, reserva ni operaciones sobre bicicletas.

## Desarrollo local

```bash
npm install
npm run dev
```

Por defecto usa fixtures simulados durante el desarrollo. Para consultar una API local real:

```bash
VITE_API_BASE_URL=http://localhost:8000 VITE_USE_FIXTURES=false npm run dev
```

En producción, la URL base es `https://api.aldeapucela.org/biki` y las rutas se resuelven bajo `/api/v1`.

## Pruebas y build

```bash
npm test
npm run build
npm run preview
npm run test:e2e
```

Los smoke tests de Playwright arrancan Vite automáticamente. Las fixtures solo se activan en desarrollo y se muestran con la etiqueta `DATOS SIMULADOS`; nunca se usan en el build de producción.

## Despliegue

El sitio está preparado para GitHub Pages con dominio personalizado `biki.aldeapucela.org`. Deben configurarse el workflow de Pages, DNS/HTTPS y CORS de la API para ese origen antes de publicar.

La cartografía usa OpenStreetMap mediante Leaflet y muestra su atribución. El código se publica bajo AGPL-3.0-only; los datos de terceros conservan sus propias condiciones.
