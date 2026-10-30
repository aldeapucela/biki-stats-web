# Plan de la issue #25: feat: histórico que responde cuándo coger y dejar bici, con mapa de calor y gráfico con ejes

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/25
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-10-30), como PR en borrador pendiente del acuerdo de los mantenedores en la #19
- **Rama:** `feat/25/historico-cuando-coger-y-dejar` (desde `main`)

## Resumen verificable de la issue

Segundo paso de la discusión #19 (punto 4): el histórico responde «¿habrá bici?», «¿habrá hueco?» y «¿a qué hora me conviene?». Se mantienen los KPI de ocupación y se añaden mejor/peor hora para coger y para dejar, una tarjeta de última lectura dibujada, un mapa de calor día × hora y un gráfico solo de bicis con ejes y lectura táctil.

## Alcance y exclusiones

Dentro: `src/history-stats.js` (cálculos en hora de Madrid), `src/history-stats.css`, `historyContent` y `stackedChart` en `src/main.js`. Fuera: agrupación de marcadores, popup y tarjeta del mapa, paleta y tipografías globales (siguen en la #19) y cualquier enlace al histórico desde el mapa (descartado).

## Decisiones

| Duda | Decisión | Estado |
| --- | --- | --- |
| ¿Se pierden los KPI de ocupación? | No: se mantienen los cuatro y se añade una segunda fila | Resuelta |
| Mejor/peor hora | Para coger (bicis de media) y para dejar (huecos libres de media), en hora de Madrid | Resuelta |
| ¿Donut y «Calidad del dato»? | Se retiran; la calidad pasa a una línea bajo el gráfico | Resuelta |
| Enlace al histórico desde el mapa | Descartado | Resuelta |
| Mapa de calor a 30 y 90 días | Un día típico de la semana (media por día y hora) | Abierta: validar con datos reales |
| Mejor/peor hora con pocas lecturas (24 h) | Se calcula con las lecturas disponibles | Abierta: sin mínimo de lecturas, pendiente de medir (M6) |

## Pruebas

`tests/history-stats.test.js` (vitest: hora de Madrid en invierno y verano, medias, empates, mapa de calor) y `tests/e2e/historico.spec.js` (última lectura, KPI, mapa de calor a 7/30 días y ausencia a 24 h, eje y lectura al tocar, solo bicis, móvil abre en lo reciente). Capturas antes y después.

## Autorización expresa para empezar a escribir código

- [x] Dudas resueltas salvo las dos marcadas como abiertas.
- [x] Autorización explícita de Pablo (2026-10-30): «No, abre la issue con las capturas y la PR».
