# Plan de la issue #17: fix: un error de la API se muestra como "No hay estaciones que coincidan"

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/17
- **Repositorio de seguimiento:** `aldeapucela/biki-stats-web`
- **Repositorio de implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-10-27)
- **Rama futura:** `fix/17/error-api-oculto` (creada desde `main`)
- **Base de rama:** `main`

## Resumen verificable de la issue

Con la API caída (500 o conexión abortada) y sin ubicación disponible, producción muestra "No hay estaciones que coincidan", sin mensaje de error ni botón "Reintentar", y sin mapa. Reproducido el 27-oct-2026.

## Alcance confirmado y exclusiones

Dentro:
- Que el error de carga de estaciones se mantenga visible con "Reintentar".
- Que un fallo de red en `/nearby` no se presente como "permiso denegado".
- Pruebas e2e de ambos casos.

Fuera: el refresco que recrea el mapa (issue #16), accesibilidad y estilos (issue #18).

## Contexto y dependencias

- `loadStations()` guarda el fallo en `state.error` (`src/main.js:174`), pero el arranque encadena `locateUser(false)` (`:360-362`), que empieza con `state.error = null` (`:182`). Si la ubicación no está disponible, el error no se restituye y `mapView` cae al estado vacío.
- [medido el 27-oct-2026 sobre producción, con ubicación concedida (41,652; -4,724) y solo `/stations/nearby` fallando] En `locateUser`, el `catch` solo copia el error si es `ApiError` (`:210`):
  - Red caída en `/nearby` (`TypeError` de `fetch`, no envuelto en `request`): el botón dice "Ubicación no disponible" aunque la ubicación sí funcionó; la lista de 100 estaciones se conserva y no hay aviso.
  - `/nearby` devolviendo 500 (`ApiError`): aparece "No se pudieron cargar los datos / Error interno" con "Reintentar" y la lista queda en 0 tarjetas, aunque `/stations` había cargado bien. Un endpoint auxiliar tapa datos buenos.
- Las PRs #12 y #15 modifican `loadStations`/`api.js`: conflicto probable en `src/main.js` y `src/api.js`; habrá que rebasar contra `main` tras su merge.
- Los e2e actuales corren con fixtures (`playwright.config.js`, `VITE_USE_FIXTURES` distinto de `false`): no pueden simular una API caída sin una configuración adicional.

## Propuesta técnica (NO EJECUTAR)

1. Quitar `state.error = null` de `locateUser` y limpiarlo solo cuando una carga termina bien (en `loadStations`, ya se limpia al empezar).
2. Envolver los fallos de red de `/nearby` en `ApiError` (como ya hace `loadStations`) y usar `state.locationError` para el estado de ubicación, separado de `state.error` (estaciones).
3. Si `loadStations` falló, no encadenar `locateUser(false)`.
4. (Diseño final) Con error y sin estaciones, la tarjeta de error sustituye al layout vacío del mapa, a ancho completo y bajo el título: en móvil el panel arranca colapsado y el error quedaba oculto bajo el pliegue y la barra inferior. Distinguir en `mapView` "sin resultados por filtro" de "no se pudieron cargar": prevalece el error **solo si no hay estaciones que mostrar**.
4b. Si `/nearby` falla pero ya hay estaciones cargadas, conservar la lista y mostrar un aviso no bloqueante ("No se pudo ordenar por cercanía"), sin el estado de error a pantalla completa.
5. Tests e2e con un segundo proyecto de Playwright que arranque con `VITE_USE_FIXTURES=false` y simule `http://localhost:8000/api/v1/**` con `page.route` (500 y `abort`), con y sin geolocalización.

## Dudas y decisiones (resolver TODAS antes de codificar)

| Duda | Alternativas | Decisión aprobada | Estado |
| --- | --- | --- | --- |
| ¿Cómo probar la API caída en e2e si los e2e usan fixtures? | A) Segundo `webServer`/proyecto con `VITE_USE_FIXTURES=false` y `page.route`. B) Test unitario del estado con vitest extrayendo la lógica de `main.js`. | A: segundo servidor Playwright (puerto 5175) con `VITE_USE_FIXTURES=false` y `page.route`. Corrección durante la implementación: con `http://localhost:8000` la CSP de `index.html` (`connect-src`) bloquea la petición antes de `page.route`, y los tests pasaban sin probar nada; la base de la API del servidor de test es `https://api.aldeapucela.org/biki`, interceptada, y los tests cuentan las peticiones servidas por el mock | Resuelta |
| ¿Dónde guardar el estado de ubicación? | A) Campo nuevo `state.locationError` (ya existe y no se usa para esto). B) Reutilizar `state.error`. | Campo nuevo `state.nearbyError` (aviso de `/nearby`), no `locationError`: este solo describe permisos de ubicación | Resuelta |
| ¿Conflicto con las PRs #12, #14 y #15? | A) Rama desde `main` y rebasar al mergearse. B) Esperar al merge de #12/#14/#15. | A: rama desde `main`, `git worktree` aparte | Resuelta |
| El e2e es requisito de CI en #14. ¿Aceptamos añadir tests nuevos antes de que se mergee #14? | A) Sí. B) Esperar a #14. | A: tests añadidos ya (proyectos `api-desktop` y `api-mobile`) | Resuelta |

## Pruebas y validación propuestas

- `npm test` y `npm run build`.
- `npx playwright test --repeat-each=3` (el proyecto tiene intermitencias conocidas por el viewport y la carrera de foco).
- Casos e2e a cubrir: `/stations` en 500; `/stations` abortada; `/nearby` en 500 con ubicación concedida (la lista debe conservarse); `/nearby` abortada con ubicación concedida (el botón no debe decir "no disponible"). Capturas antes y después de cada estado (el cambio es visual).
- Comprobación manual: bloquear `api.aldeapucela.org` en DevTools, denegar la ubicación y recargar; el mensaje y "Reintentar" aparecen; al desbloquear y pulsar "Reintentar" carga la lista.

## Riesgos y criterios de aceptación

Riesgos: conflictos con otras PRs; flakiness de e2e nuevos.

Criterios de aceptación (de la issue):
- Con la API en 500 o sin red se ve "No se pudieron cargar los datos" con "Reintentar", haya o no ubicación.
- "Reintentar" recupera la lista cuando la API vuelve.
- Pruebas para ambos casos, con y sin geolocalización.

## Autorización expresa para empezar a escribir código

- [x] Todas las dudas resueltas (con las opciones recomendadas del plan).
- [x] Recibida autorización explícita para **implementar esta issue**.
- **Referencia o texto de autorización:** mensaje de Pablo del 2026-10-27: «Si, escribe el codigo de la #17».

**Mientras falte cualquiera de las condiciones anteriores, solo editar este documento.**
