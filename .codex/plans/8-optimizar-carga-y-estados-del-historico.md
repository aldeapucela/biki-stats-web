# Plan de la issue #8: Optimizar carga y estados del histórico

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/8
- **Repositorio de seguimiento:** `aldeapucela/biki-stats-web`
- **Repositorio de implementación:** `aldeapucela/biki-stats-web`
- **Estado:** EN IMPLEMENTACIÓN (autorizada)
- **Rama:** `feat/8/optimizar-carga-historico`
- **Base de rama:** `main`

## Resumen verificable de la issue

Mejorar la carga de la vista Histórico para que los cambios de periodo no provoquen esperas largas ni peticiones duplicadas o obsoletas. La issue pide: cancelar la petición anterior al cambiar de estación o periodo, caché en memoria por estación y periodo, estados de carga y error diferenciados para consultas lentas de 30 y 90 días, tolerar fallo parcial (resumen o puntos), conservar las granularidades actuales y añadir pruebas. Se pide además adaptarse a un endpoint combinado de backend, que aún no existe (https://github.com/aldeapucela/biki-stats-core/issues/20). La issue no tiene comentarios ni asignados.

## Alcance confirmado y exclusiones

Incluido (no depende del backend):

- Cancelar con `AbortController` la carga en curso al cambiar de estación o de periodo, y descartar sus resultados.
- Caché en memoria por `estación:periodo`, con invalidación al cambiar de estación y cuando se refrescan los datos.
- Estados de carga y error diferenciados; aviso visible en cargas lentas de 30 y 90 días.
- Fallo parcial: si falla `summary` pero llegan los puntos (o al revés), mostrar lo disponible y avisar de lo que falta, sin bloquear la vista. Reintento por parte.
- Pruebas: cambios rápidos de periodo, cancelación, caché y errores parciales.
- Mantener sin cambios las pestañas `24 h`, `7 días`, `30 días`, `90 días` y sus granularidades (`hour` hasta 7 días, `day` en 30 y 90), el formato de gráficos, KPIs y huecos.

Fuera de alcance:

- Crear o modificar el endpoint combinado o cualquier cosa del backend (`biki-stats-core`, issue #20).
- Cambiar el contrato de la API, rediseñar la vista o tocar el mapa.
- Cambios de estilo no necesarios para los nuevos estados.

## Contexto y dependencias

Estado actual (verificado en `main`, `src/main.js`):

- `loadHistory()` (≈l.207) lanza `api.history` y `api.summary` en paralelo con `Promise.all`; si una falla, falla todo y se guarda `{ error }` en la caché.
- No hay cancelación: `api.history/summary` ya aceptan `signal`, pero `loadHistory` no lo pasa. Una respuesta tardía de otra estación o periodo se escribe igualmente en la caché.
- La caché (`historyCache`, un `Map` por `estación:periodo`) se vacía entera al elegir otra estación (≈l.301) y nunca se invalida por datos nuevos: el refresco de 60 s solo recarga estaciones.
- Un error queda cacheado y no se reintenta hasta cambiar de estación.
- El estado de carga es un único texto, «Cargando histórico…», sin distinguir periodos lentos.

Dependencias:

- Endpoint combinado: https://github.com/aldeapucela/biki-stats-core/issues/20 (sin implementar). Esta issue deja un único punto de carga para enchufarlo después.
- Hay PRs abiertos propios que tocan archivos cercanos: web#12 (`src/api.js`, `src/main.js` en `loadStations`, `tests/api.test.js`) y web#14 (CI, `tests/e2e/navigation.spec.js`). Esta rama sale de `main` según las reglas; si se mergean antes, habrá que rebasar.

## Propuesta técnica (NO EJECUTAR)

1. Extraer la lógica de carga a un módulo nuevo (`src/history-loader.js`), testable sin DOM: recibe `api`, devuelve el resultado por partes (`history`, `summary`) y acepta `AbortSignal`. `main.js` solo la invoca y pinta.
2. Un `AbortController` por carga activa; al cambiar estación o periodo se aborta el anterior. Las respuestas con `signal.aborted` no tocan la caché ni la vista.
3. Entrada de caché con estado por parte: `{ history: {status, data, error}, summary: {status, data, error} }`, en lugar de un único `loading/error`.
4. `Promise.allSettled` para las dos peticiones; pintar lo que llegue. Si falta una parte, la tarjeta correspondiente muestra su error con botón «Reintentar» que repite solo esa parte.
5. Aviso de carga lenta para 30 y 90 días pasado un umbral (ver duda 3) sin bloquear la pantalla.
6. Invalidación: al cambiar de estación (como hoy) y por caducidad de la entrada (ver duda 2). Los errores no se cachean como definitivos.
7. Punto único `fetchHistoryBundle(stationId, period, signal)`: hoy hace las dos peticiones; cuando exista el endpoint combinado se sustituye ahí sin tocar el resto.

## Dudas y decisiones (resolver TODAS antes de codificar)

| Duda | Alternativas | Decisión aprobada | Estado |
| --- | --- | --- | --- |
| 1. ¿Dónde vive la lógica? `main.js` es un único fichero y no se puede probar sin DOM | a) módulo nuevo `src/history-loader.js` con vitest; b) dejarlo en `main.js` y probar solo con e2e | Módulo `src/history-loader.js` con vitest | Aprobada |
| 2. Caducidad de la caché: la issue dice «invalidar al actualizar datos» y la captura es cada ~5 min | a) solo al cambiar estación; b) TTL igual al intervalo de captura (~5 min), verificable en la API; c) invalidar con el refresco de 60 s | TTL = 300 s, intervalo de captura **medido**: 288 puntos en 24 h, huecos de 300,36 a 300,86 s | Aprobada |
| 3. Umbral para mostrar «carga lenta» | El umbral se mide, no se elige: medir latencias reales de `/history` y `/summary` de 30 y 90 días contra la API pública y fijarlo sobre esa distribución, citando la cifra. La issue de backend da referencias (24 h 0,16–0,34 s; 7 d hasta 4,65 s; 30 d algunas >20 s; 90 d hasta 2,9 s), que no bastan para decidir | `SLOW_AFTER_MS` = 1500 ms. Medido el 25-oct-2026 (2 estaciones x 3 repeticiones): 24 h en frío 0,19–0,29 s y cualquier repetición ~0,2 s; en frío 7 d 3,5–3,7 s, 30 d 2–23 s (history) y 6,5–7,3 s (summary), 90 d 2,5–4,2 s. Aplica a todos los periodos, no solo a 30 y 90 d, porque 7 d también tarda segundos | Aprobada |
| 4. Fallo parcial: qué se pinta si falta `summary` (KPIs, donut, calidad del dato) o `history` (gráfico) | a) «—» en KPIs y aviso; b) ocultar tarjetas afectadas | «—» en KPIs, aviso y «Reintentar» solo de esa parte; sin ceros inventados | Aprobada |
| 5. Reintento automático | a) ninguno, solo manual; b) un reintento con espera | Solo reintento manual | Aprobada |
| 6. Rama y commits | `feat/8/optimizar-carga-historico`; commits `feat: …` con `Refs:` a la issue #8; PR contra `main` | Según AGENTS.md | Confirmada |
| 7. Identidad de los commits y PR | Autor: el del propietario de la cuenta; sin trailers de herramientas externas ni mención a asistentes | Indicado por el solicitante | Confirmada |
| 8. Descubierto al medir: la API cachea por URL exacta y el frontend mandaba `to=ahora` distinto en cada petición | a) no tocar; b) redondear `to` hacia arriba a 300 s en `dateRange` | Medido en 3 estaciones: misma URL 0,2 s, desplazada 1 s 2–11 s. Se aplica (b); la API acepta `to` futuro | Aprobada (dentro de «evitar peticiones duplicadas») |

## Pruebas y validación propuestas

- Vitest (`tests/history-loader.test.js`) con `api` simulada:
  - cambios rápidos de periodo: solo cuenta la última respuesta;
  - cancelación: la señal se aborta y la respuesta tardía no entra en la caché;
  - caché: segunda visita al mismo `estación:periodo` no repite peticiones; caduca según la decisión 2;
  - errores parciales: falla `summary` y los puntos se conservan, y al revés; reintento solo de la parte caída;
  - error total no cacheado como definitivo.
- `npm test`, `npm run build` y `npm run test:e2e` (desktop y móvil) en verde; repetir e2e con `--repeat-each=3` por la intermitencia conocida del foco.
- Verificación manual en local contra la API real: cambiar rápido entre `24 h`, `7 días`, `30 días`, `90 días` y comprobar en la pestaña Red que las peticiones anteriores se cancelan.
- Capturas antes/después en el PR (estado de carga lenta y de error parcial), con la app levantada en local.

## Riesgos y criterios de aceptación

Riesgos:

- Conflictos de rebase con web#12 y web#14 si se mergean antes.
- La carrera de foco ya conocida en los selectores del histórico puede afectar a los e2e.
- Un umbral de «lento» mal elegido da avisos falsos: de ahí la medición previa.

Criterios de aceptación (de la issue):

- Cada cambio de periodo termina con una única respuesta funcional una vez exista el endpoint combinado (este PR deja el punto de enganche, no el endpoint).
- Las solicitudes obsoletas se abortan y no actualizan la vista.
- La caché evita repetir una consulta ya cargada durante la sesión.
- Cargas lentas y errores se muestran sin dejar la pantalla bloqueada.
- Gráficos, KPIs, huecos y granularidades se conservan.
- Pruebas de cambios rápidos, cancelación, caché y errores parciales.

## Autorización expresa para empezar a escribir código

- [x] Todas las dudas resueltas (propuestas aceptadas).
- [x] Recibida autorización explícita para **implementar esta issue**.
- **Referencia o texto de autorización:** «Puedes empezar» del solicitante, 2026-10-25, respondiendo a «¿Puedo empezar a escribir código para la issue #8?».

Autorizado: se puede implementar el alcance de este plan.
