# Plan de la issue #23: feat: marcadores del mapa por disponibilidad de bicis, con leyenda y colores de Aldea Pucela

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/23
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-10-29), como PR en borrador pendiente del acuerdo de los mantenedores en la #19
- **Rama:** `feat/23/marcadores-por-disponibilidad` (desde `main`)

## Resumen verificable de la issue

Primer paso de la discusión #19: el color del marcador pasa de depender del porcentaje de ocupación a depender de las bicis disponibles, con leyenda y colores de Aldea Pucela. Se conservan las dos chapas «M n» y «E n».

## Alcance y exclusiones

Dentro: función `bikesTone` (`src/tone.js`), colores y leyenda del mapa. Fuera: agrupación, popup y tarjeta, histórico, resto de la paleta (siguen en la #19).

## Decisiones

| Duda | Decisión | Estado |
| --- | --- | --- |
| ¿Esperar al acuerdo de la #19? | Pablo pidió implementarlo («Si, lo puedes implementar ya en el código?»); se abre PR en borrador y la decisión final es de los mantenedores | Resuelta |
| ¿Se pierde el aspecto de dos chapas? | No: se conservan, para ver ambos tipos a la vez | Resuelta |
| Umbrales | 4 o más = verde, 1 a 3 = ámbar, 0 = gris. Elegidos a ojo: pendiente de medirlos contra la distribución real (M6) | Abierta |

## Pruebas

`tests/tone.test.js` (vitest) y `tests/e2e/marcadores.spec.js` (colores por bicis, ambos tipos visibles, contraste AA, leyenda visible sin tapar controles). Capturas antes y después.

## Autorización expresa para empezar a escribir código

- [x] Dudas resueltas salvo los umbrales.
- [x] Autorización explícita de Pablo (2026-10-29): «Si, lo puedes implementar ya en el código?»
