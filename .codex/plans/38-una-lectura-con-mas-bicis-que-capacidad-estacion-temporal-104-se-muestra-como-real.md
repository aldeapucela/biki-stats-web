# Plan de la issue #38: fix: una lectura con más bicis que capacidad (estación temporal 104) se muestra como real

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/38
- **Issue relacionada en `core`:** https://github.com/aldeapucela/biki-stats-core/issues/34 (la raíz: la API sigue sirviendo estaciones que ya no están en el feed)
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-11-03)
- **Rama:** `fix/38/lectura-imposible` (desde `main`, 42a30f4)

## Resumen verificable de la issue

La estación temporal 104 (estadio Zorrilla) llegó a dar 396 mecánicas + 396 eléctricas con capacidad 1. La web la pintaba como real. Si las bicis superan la capacidad, la lectura se trata como no fiable: sin cifras, marcador gris, aviso en la tarjeta y sin botones de salida ni destino.

## Alcance y exclusiones

Dentro: `src/reliability.js` (regla y saneado), `src/api.js` (aplicado a `/stations` y `/stations/nearby`, así lo heredan mapa, lista, destino y ruta), aviso y botones en `src/main.js`. Fuera: ocultar estaciones solo por obsoletas (taparía averías reales), y que `core` deje de servir estaciones que ya no están en el feed (issue core#34).

## Decisiones

| Duda | Decisión | Estado |
| --- | --- | --- |
| Regla | Bicis (M + E) mayor que capacidad. Medido el 3-nov-2026 en las 104 estaciones: en 103 bicis + huecos está entre el 90 % y el 100 % de la capacidad; la 104 está en 891 veces | Resuelta (medida) |
| ¿Ocultar o marcar? | Marcar: gris, sin cifras y con aviso. Ocultar tapa la causa | Resuelta |
| Estación ya elegida como salida o destino | Se deja el botón de quitarla | Resuelta |

## Pruebas

`tests/reliability.test.js` (vitest: detección, estaciones coherentes, saneado y respuesta de la API) y un caso en `tests/e2e/api-errors.spec.js` con la lectura real de la 104 simulada: sin 396 ni 99, marcador gris, aviso, sin botones y sin tocar a una estación coherente. Visto fallar sobre el código anterior. Capturas antes y después.

## Autorización expresa para empezar a escribir código

- [x] Dudas resueltas.
- [x] Autorización explícita de Pablo (2026-11-03): «Si» a abrir issue y PR para el arreglo de la web.
