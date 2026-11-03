# Plan de la issue #29: feat: modo «En ruta» con bici y hueco en tiempo real y frecuencia histórica a la hora de llegada

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/29
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-10-31), como PR en borrador pendiente del acuerdo de los mantenedores en la #19
- **Rama:** `feat/29/modo-en-ruta`. **Desviación de la guía:** sale de `feat/27/estacion-destino`, no de `main`, porque usa el destino de la #27 (PR #28, sin mergear). La PR se abre contra esa rama y se reorienta a `main` cuando se mergee la #28.

## Resumen verificable de la issue

El usuario elige dónde recoge la bici y dónde la deja. La app muestra, para cada extremo, si hay bici o hueco **ahora**, y qué frecuencia histórica hay de que lo haya **a la hora en que llegará**, con el número de lecturas. Si el destino se queda sin huecos (o el origen sin bicis) sugiere la estación cercana con disponibilidad.

## Alcance y exclusiones

Dentro:
- `src/availability.js` (puro): tipo de día, franja, horizonte, consulta a la tabla, niveles, tiempos de la ruta y alternativas.
- `src/availability-table.json`: tabla generada con `scripts/build-availability.py` (estado ahora × franja × tipo de día × horizonte).
- `scripts/build-availability.py` y `docs/MEDICION_DISPONIBILIDAD.md`: cómo se genera la tabla y qué mide.
- `state.js` (`originId` persistido), botón «Recojo aquí», tarjeta «Tu ruta», marcador de origen, línea de ruta.
- Tests vitest y e2e; capturas antes y después.

Fuera: endpoint en `core` (la medición muestra que no hace falta para empezar), ruta real calle a calle, meteorología y eventos, calendario de festivos locales.

## Medición previa (comentario de la issue)

Resultado resumido, con 104 estaciones, 29-sep a 31-oct-2026: la frecuencia por hora sola no supera a «si hay ahora, habrá luego» a 10 y 20 min; **condicionar al estado actual sí supera a las dos bases** (Brier en la zona de riesgo, bici a 20 min: 0,108 → 0,077) y una tabla única rinde igual que una por estación. Con menos de 300 lecturas por celda la estimación no es estable.

## Decisiones

| Duda | Decisión | Estado |
| --- | --- | --- |
| Qué se muestra como «probabilidad» | Frecuencia histórica condicionada al estado actual, en cuatro tramos (casi seguro ≥ 90 %, probable 70–90 %, dudoso 40–70 %, poco probable < 40 %) y «unas N de cada 10 veces». No un porcentaje exacto: la diferencia p90 entre mitades de la muestra ronda el 10 % | Resuelta (medida) |
| Mínimo de lecturas | 300 por celda; por debajo, «sin datos suficientes» | Resuelta (medida) |
| Dónde vive la tabla | Fichero estático en el repo regenerable con un script; el endpoint de `core` queda como paso posterior | Resuelta |
| Horizontes | 10, 20, 30 y 45 min; se usa el primero que cubre el tiempo hasta la llegada; más allá de 45 min no se estima | Resuelta |
| Estado «ahora» de la tabla | 0, 1, 2 y 3 o más (bicis para recoger, huecos para dejar) | Resuelta (medida) |
| Alternativa si falla un extremo | Las 2 estaciones más cercanas con 3 o más (bicis o huecos) ahora; sin radio fijo | Resuelta |
| Velocidad andando | 5 km/h con el mismo factor de rodeo 1,3 de la #27. Supuesto NO medido | Abierta (rotulado como estimación) |
| Festivos | Festivos nacionales de fecha fija cuentan como domingo; sin calendario local ni festivos móviles. La muestra solo tiene un festivo | Abierta (se dice en la app y en la PR) |
| Estaciones 54 y 98 | Excluidas al generar la tabla (más de 48 h seguidas con la misma lectura). La app no las trata distinto | Abierta |

## Pruebas

- `tests/availability.test.js` (vitest): tipo de día y franja en hora de Madrid (cambio de hora y medianoche), horizonte, tramos, mínimo de lecturas, tiempos de la ruta, alternativas, coherencia de la tabla.
- `tests/e2e/ruta.spec.js`: elegir origen y destino, semáforos en tiempo real, estimación a la llegada con el reloj fijado, persistencia, quitar, alternativa con la API simulada, teclado.
- Los nuevos e2e deben fallar contra la rama base (M7).
- Capturas antes y después en escritorio y móvil.

## Autorización expresa para empezar a escribir código

- [x] Dudas resueltas salvo las marcadas como abiertas.
- [x] Autorización explícita de Pablo (2026-10-31): «Si, crea una issue con el planteamiento, mides, planificas y ejecutas».
