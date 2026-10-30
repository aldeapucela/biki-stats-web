# Plan de la issue #27: feat: estación destino con huecos en tiempo real, distancia y tiempo estimado sobre el mapa

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/27
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-10-30), como PR en borrador pendiente del acuerdo de los mantenedores en la #19
- **Rama:** `feat/27/estacion-destino` (desde `main`)

## Resumen verificable de la issue

El usuario fija una estación destino («Voy a esta estación») y ve sus huecos y bicis en tiempo real, un aviso si los huecos bajan, y la distancia en línea recta y el tiempo estimado en bici desde su ubicación, con una línea sobre el mapa. Sin servicios externos ni cambios de CSP.

## Alcance y exclusiones

Dentro: `src/destination.js` (cálculo), `src/destination.css`, `state.js` (destino persistido), tarjeta destino, botón en popup y tarjetas, línea y marcador resaltado, enlaces de «cómo llegar» en modo bici. Fuera: previsión de huecos a la llegada, ruta real por calles, agrupación y paleta global (siguen en la #19), dibujo de anclajes (llega con la PR del histórico, #26).

## Decisiones

| Duda | Decisión | Estado |
| --- | --- | --- |
| Umbral del aviso de bajada | 3 o más huecos en 15 min. Medido con la API pública (30-oct-2026, 104 estaciones, 3 días `raw`): en 15 min bajan el 18,6 %, p90 = 1, p95 = 2, p99 = 4 | Resuelta (medida) |
| Velocidad de bici y factor de rodeo | 15 km/h y 1,3. Supuestos NO medidos: la API no tiene viajes ni rutas; el tiempo se rotula como estimación | Abierta |
| ¿Una o varias estaciones destino? | Una | Resuelta |
| Aviso con poca historia | Solo con lecturas de esta sesión (en memoria); sin lecturas previas no hay aviso | Abierta |
| Apple Maps | No se incluye: no he verificado su modo bici | Resuelta |

## Pruebas

`tests/destination.test.js` (vitest: haversine, tiempo estimado, ventana y umbral del aviso) y `tests/e2e/destino.spec.js` (popup, persistencia, lista, teclado, sin y con ubicación, enlaces de cómo llegar). Capturas antes y después.

## Autorización expresa para empezar a escribir código

- [x] Dudas resueltas salvo las dos marcadas como abiertas.
- [x] Autorización explícita de Pablo (2026-10-30): «Si, escribell».
