# Plan de la issue #35: feat: marcadores en semáforo por tipo de bici, mapa base en grises e identidad de Aldea Pucela

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/35
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-11-02), como PR en borrador pendiente del acuerdo de los mantenedores en la #19
- **Rama:** `feat/35/semaforo-por-tipo-y-marca` (desde `main`, a8629e4)

## Resumen verificable de la issue

El color del marcador pasa a ser un semáforo por tipo de bici (rojo sin bicis, naranja si falta un tipo, tres verdes si hay de las dos), el mapa base se desatura con un filtro CSS y la cabecera, los acentos y los botones usan el morado de Aldea Pucela con su logo.

## Alcance y exclusiones

Dentro: `src/tone.js` (regla), `src/styles.css` (tonos, leyenda, mapa en grises), `src/marca.css` (tokens de marca), `src/main.js` (leyenda y logo), `public/aldea-pucela.jpg`. Fuera: agrupación de marcadores, escala continua de rojo a azul, tarjeta y popup con el mismo criterio que el marcador (el punto y la barra de ocupación siguen como están), cambio de proveedor de mapa base.

## Decisiones

| Duda | Decisión | Estado |
| --- | --- | --- |
| Cortes de los verdes | 1, 2-3 y 4 o más bicis del tipo con menos. Medido con la API pública (1-nov-2026, 104 estaciones): 19, 37 y 12 estaciones | Resuelta (medida) |
| Mapa base | Filtro CSS sobre OpenStreetMap. CARTO devuelve una tesela «API KEY REQUIRED» con HTTP 200 (comprobado el 1-nov-2026) | Resuelta |
| ¿M0 con E8 es naranja? | Sí, falta un tipo | Abierta (a confirmar por los mantenedores) |
| Logo de la asociación | Copia de vivienda.aldeapucela.org | Abierta (permiso) |
| Violeta `#6b4895` (vivienda) o `#66517D` (aldeapucela.org, citado en la #19) | `#6b4895`; cambiarlo son dos variables | Abierta |

## Pruebas

`tests/tone.test.js` (vitest: rojo, naranja, tres verdes y tipos ausentes) y `tests/e2e/marcadores.spec.js` (clases por estación, contraste AA de las chapas M/E, leyenda, mapa base en grises). Cada prueba nueva se ha visto fallar sobre el código anterior. Capturas antes y después.

## Autorización expresa para empezar a escribir código

- [x] Dudas resueltas salvo las tres marcadas como abiertas.
- [x] Autorización explícita de Pablo (2026-11-01): «Te doy el go» para el semáforo; «usa en el resto los colores de aldeapucela» para la marca; (2026-11-02) «sube esta última con lo que teníamos».
