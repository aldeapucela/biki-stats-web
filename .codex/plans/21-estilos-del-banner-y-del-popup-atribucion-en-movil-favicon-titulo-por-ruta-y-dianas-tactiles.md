# Plan de la issue #21: fix: estilos del banner y del popup, atribución en móvil, favicon, título por ruta y dianas táctiles

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/21
- **Repositorio de seguimiento:** `aldeapucela/biki-stats-web`
- **Repositorio de implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-10-27)
- **Rama futura:** `fix/21/estilos-banner-popup-favicon-dianas` (creada desde `main`)
- **Base de rama:** `main`

## Resumen verificable de la issue

Siete defectos medidos en producción el 27-oct-2026 (Chrome, escritorio y móvil 390x844). La #21 sale de la #18, que mantiene lo pendiente (contraste general, foco de teclado, semántica ARIA, información solo por color). El plan original de la #18 (`.codex/plans/18-...md`) se divide así: lo de esta issue aquí, el resto sigue en la #18.

Medido antes del cambio (producción, con datos simulados):

| Defecto | Medida |
| --- | --- |
| Botón "Aceptar" | fondo transparente, borde 0, radio 0 (`primary-button` sin definir) |
| "Cómo llegar" | texto `rgb(0,120,168)` sobre `rgb(244,124,66)` |
| Atribución en móvil | `z-index` 1000 frente a 500 de la hoja; tapa "Actualizado hace menos de 1 min" |
| Consola | error CSP `frame-ancestors` en cada carga |
| Favicon | no declarado; `/favicon.ico` 404 |
| Título | "Movilidad · BIKI Valladolid" en las 4 rutas |
| Dianas | favorito 23x22 px; tirador del panel 356x5 px; tema 34x46 px |

## Alcance confirmado y exclusiones

Dentro: los siete defectos de la tabla. Excepción: el botón de tema (34x46) ya cumple el mínimo AA de 24x24 (WCAG 2.5.8); la issue lo citaba por error y no se toca.

Fuera: contraste general del resto de la interfaz (depende de la paleta, issue #19), foco tras re-renderizar (issue #16), semántica ARIA, información solo por color.

## Contexto y dependencias

- La atribución de OpenStreetMap es obligatoria: ocultarla bajo la hoja inferior no es una opción; se mueve a una zona visible del mapa.
- El banner de analítica solo aparece en producción (`import.meta.env.PROD`), no en el servidor de desarrollo: los tests e2e no pueden verlo; se comprueba la regla CSS directamente y se capturan imágenes de la compilación de producción.
- Puede requerir rebase si se mergean antes #12, #14, #15 o #20 (tocan `main.js` y `styles.css`).

## Propuesta técnica (NO EJECUTAR)

1. `styles.css`: variables `--accent-strong` (`#b54f20`, 5,12:1 con blanco), `--accent-strong-hover` (`#94401a`, 6,98:1); `.primary-button` con el tamaño y radio de `.secondary-button`; variante oscura (`#ffb18b` con texto `#2a1209`, 10,02:1).
2. `.leaflet-container .map-directions-button` con texto blanco y fondo `--accent-strong` (el blanco sobre el naranja actual da 2,69:1).
3. En móvil, mover `.leaflet-bottom.leaflet-right` (donde está la atribución) a la esquina superior izquierda del mapa, solo con CSS.
4. `index.html`: quitar `frame-ancestors` del `<meta>` de CSP; `<link rel="icon">` a `public/favicon.svg` y respaldo `public/favicon.png`.
5. `main.js`: `document.title` por ruta dentro de `render()`.
6. Dianas: `.favorite-button` de al menos 32x32 sin cambiar el diseño de la tarjeta (margen negativo); `.station-panel-handle` con `flex: none` para que no se comprima.

## Dudas y decisiones (resolver TODAS antes de codificar)

| Duda | Alternativas | Decisión aprobada | Estado |
| --- | --- | --- | --- |
| La issue era una lista parcial. ¿Cómo cerrarla? | A) `Refs`. B) Dividir. C) `Closes` con casillas pendientes. | B: issue nueva #21 para este subconjunto; la #18 marca las casillas movidas y sigue abierta | Resuelta |
| ¿Qué icono? | A) Marca actual de la cabecera. B) Esperar a #19. C) Icono de Aldea Pucela. | A, provisional (SVG y PNG de respaldo) | Resuelta |
| ¿Qué color para el botón primario? | A) Naranja más oscuro que cumpla AA con variables CSS. B) Esperar a #19. | A: `--accent-strong`, cambiable con la paleta | Resuelta |
| ¿Dónde va la atribución en móvil? | A) Debajo de la hoja (queda oculta). B) Esquina superior izquierda del mapa. | B: la atribución es obligatoria y debe verse | Resuelta |
| ¿Se añade axe a los e2e? | A) Sí. B) No. | B: se mide con axe a mano; los e2e comprueban estilos y tamaños concretos | Resuelta |

## Pruebas y validación propuestas

- e2e en `desktop` y `mobile` que fallen con el código actual: título por ruta; favicon declarado y servido; el `<meta>` de CSP sin `frame-ancestors`; `.primary-button` con fondo y texto con contraste AA (se inyecta el botón en la página); texto del popup blanco; favorito de al menos 24x24; en móvil, tirador de al menos 24 px y atribución dentro del mapa sin solaparse con la hoja (colapsada y expandida).
- `npm test`, `npm run build`, `--repeat-each=3`.
- Capturas antes y después (compilación de producción con la API simulada): banner, popup, atribución en móvil.

## Riesgos y criterios de aceptación

Riesgos: conflictos con otras PRs; el tirador de 28 px empuja el contenido de la hoja 23 px hacia abajo.

Criterios de aceptación: los de la issue #21.

## Autorización expresa para empezar a escribir código

- [x] Todas las dudas resueltas (con las opciones recomendadas del plan).
- [x] Recibida autorización explícita para **implementar esta issue**.
- **Referencia o texto de autorización:** mensaje de Pablo del 2026-10-27: «Si, compieza a escibir #18» (trabajo de la #18, que se implementa en la #21 al dividirla).

**Mientras falte cualquiera de las condiciones anteriores, solo editar este documento.**
