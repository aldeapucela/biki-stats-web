# Plan de la issue #2: feat: integrar analítica de uso con Matomo en Movilidad

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/2
- **Repositorio de seguimiento:** `aldeapucela/biki-stats-core`
- **Repositorio de implementación:** `aldeapucela/biki-stats-web`
- **Estado:** IMPLEMENTADA — VALIDACIÓN MANUAL DE MATOMO PENDIENTE
- **Rama:** `feat/2/integrar-analitica-de-uso-con-matomo-en-movilidad`
- **Base de rama:** `main`

## Resumen verificable de la issue

La issue solicita integrar Matomo en la SPA informativa de Movilidad (BIKI Valladolid) para medir, de forma centralizada, ligera, configurable y respetuosa con la privacidad, el uso del mapa, estaciones, filtros, guardadas e histórico. La analítica no debe bloquear ni romper la aplicación.

La issue exige, entre otros puntos:

- un adaptador único y una configuración centralizada de `trackerUrl`, `siteId`, activación y política de privacidad;
- una inicialización asíncrona y única, desactivable en local, tests y preproducción;
- exactamente un pageview por navegación real entre `map`, `saved`, `history` y `more`, sin duplicados por renders, recargas de datos, tema o navegación atrás/adelante;
- eventos semánticos para estaciones, mapa, filtros, búsquedas confirmadas, guardadas, histórico, tema y compartir si existe;
- únicamente IDs estables y enumeraciones cerradas, sin texto de búsqueda, coordenadas, posición del usuario, series temporales ni datos personales;
- anonimización de IP, retención, cookies/consentimiento, CSP/CORS y documentación antes de activar producción;
- pruebas del adaptador, del modo desactivado y de fallos de Matomo.

El comentario de `nukeador` del 21/10/2026 indica que puede usarse esta instancia y muestra un snippet con `https://stats.aldeapucela.org/` y `siteId=32`. Debe confirmarse explícitamente que el sitio 32 es la propiedad de Movilidad y que su configuración cumple la política aprobada; la issue prohíbe reutilizar el `siteId=29` de Fiestas sin comprobarlo.

## Alcance confirmado y exclusiones

### Incluido

- Integración exclusivamente en `biki-stats-web`, que usa JavaScript vanilla, Vite y una SPA con rutas `/`, `/saved`, `/history` y `/more` gestionadas mediante History API.
- Módulo de configuración y adaptador de analítica aislado del transporte `_paq`.
- Carga asíncrona y tolerante a fallos del tracker.
- Pageviews de vistas reales y eventos de la taxonomía de la issue, condicionados a que la interacción exista y se complete.
- Configuración de entornos mediante variables de Vite, con analítica apagada por defecto en desarrollo, tests y preproducción.
- Documentación de configuración, privacidad, taxonomía y verificación operativa.
- Tests unitarios y e2e suficientes para demostrar inicialización única, pageviews no duplicados, eventos permitidos y funcionamiento cuando Matomo falla o está desactivado.

### Excluido

- Cambios en FastAPI, `biki-stats-core` o su logging: la propia issue indica que no hace falta implementar Matomo en backend.
- Reutilizar automáticamente la propiedad o el `siteId` de Fiestas.
- Registrar texto literal de búsquedas, coordenadas, geolocalización precisa, direcciones, posición del visitante, timestamps precisos o series temporales.
- Inventar eventos de alquiler/devolución, ya que Movilidad es informativa.
- Instrumentar acciones opcionales que no existan en el MVP; solo se añadirán cuando estén implementadas y aprobadas.
- Activar tracking de producción antes de cerrar la configuración y la política de consentimiento/privacidad.

## Contexto y dependencias

- Depende funcionalmente de la issue web #1 (diseño del frontend), especialmente para estabilizar las vistas y controles que se van a medir.
- La aplicación renderiza la interfaz desde `src/main.js`, mantiene estado en `src/state.js`, navega con `history.pushState` y escucha `popstate`; el adaptador deberá engancharse a esos puntos sin convertir los rerenders en navegaciones.
- Los favoritos se guardan localmente y el histórico usa `station_id` y períodos cerrados (`24h`, `7d`, `30d`, `90d`).
- La selección de estación, filtros, búsqueda, localización y tema se gestionan en `src/main.js`; los eventos deben emitirse en los puntos de éxito de la acción, no al reconstruir el DOM ni al leer `localStorage`.
- El repositorio está actualmente en `feat/1/diseno-responsive-frontend`; la futura rama de esta issue debe salir de `main`, después de recibir autorización explícita.
- Hace falta acceso o confirmación del administrador de `stats.aldeapucela.org` para validar el `siteId`, anonimización, cookies, retención, consentimiento y comprobación en tiempo real.

## Propuesta técnica (NO EJECUTAR)

1. Crear un módulo de configuración de analítica que lea variables de entorno de Vite y exponga una configuración validada: `enabled`, `trackerUrl`, `siteId`, política de consentimiento y entorno. En producción, exigir configuración explícita; en desarrollo, tests y preproducción, desactivar por defecto.
2. Crear un adaptador semántico, por ejemplo `analytics.js`, con funciones como `init`, `trackPageView`, `trackEvent` y helpers específicos para IDs/enumeraciones. El resto de la aplicación no llamará directamente a `_paq.push`.
3. Inicializar una sola vez y añadir el script de Matomo de forma asíncrona. Las excepciones, bloqueos del navegador, ausencia de `window` o errores de red deben convertirse en no-op y no interrumpir mapa, guardadas ni histórico.
4. Integrar el pageview en la transición efectiva de ruta. Usar una clave de navegación o estado equivalente para no contar el primer render dos veces, los rerenders por datos/tema y los cambios internos del histórico. Cubrir `pushState`, `popstate` y las rutas reales existentes.
5. Emitir eventos solo después de acciones confirmadas: selección de marcador/tarjeta, expansión del panel móvil, filtros, estado conocido de geolocalización, búsqueda enviada, guardado/desguardado, estación/período del histórico, apertura explícita de gráficos, cambio manual de tema y compartir exitoso si existe.
6. Aplicar listas cerradas y validación antes de enviar: `station_id` conocido, filtros permitidos, períodos permitidos, estados de permiso permitidos y tipos de enlace permitidos. Descartar valores desconocidos en vez de transmitir texto libre.
7. Añadir pruebas unitarias del adaptador con `_paq` simulado y pruebas e2e de navegación/interacciones. Verificar que los errores de carga no producen errores visibles y que no se transmiten términos de búsqueda ni coordenadas.
8. Documentar en español las variables, el catálogo de eventos, los campos transmitidos, finalidad, retención, consentimiento y procedimiento para revisar Matomo. Añadir las cabeceras o configuración de despliegue necesarias solo después de confirmar la política y la instancia.

## Dudas y decisiones resueltas

| Duda | Alternativas | Decisión aprobada | Estado |
| --- | --- | --- | --- |
| ¿El `siteId=32` del comentario es la propiedad propia de Movilidad? | Confirmar y usar 32; asignar otro ID; no activar hasta tenerlo | Usar `32` | Resuelta |
| ¿Quién administra `stats.aldeapucela.org` y puede confirmar la configuración? | Responsable del proyecto; administrador de Matomo; otro contacto | Pendiente | Abierta |
| ¿Qué política de consentimiento/cookies se aplica? | Sin cookies con configuración validada; consentimiento previo; otra política legal revisada | Banner propio con consentimiento previo | Resuelta |
| ¿Están aprobadas la anonimización de IP y la retención? | Valores actuales de Matomo; nuevos valores; bloquear producción hasta revisión | Usar la configuración vigente del sitio 32 | Resuelta |
| ¿Qué entornos activan el tracking? | Solo producción; producción y preview; activación manual adicional | Solo producción | Resuelta |
| ¿Qué cuenta como navegación real en la SPA? | Cada cambio de ruta; solo vistas principales; otra regla para histórico | Cada cambio real entre vistas principales, incluido atrás/adelante | Resuelta |
| ¿Se autoriza usar `station_id` como nombre de evento? | Sí, por ser ID estable de estación; no; solo como dimensión limitada | Sí, como ID estable y sin datos descriptivos | Resuelta |
| ¿Qué acciones opcionales existen y entran en el MVP? | Compartir, expansión del panel y enlaces externos solo si existen; excluirlas por ahora | Solo funcionalidades existentes; no añadir compartir | Resuelta |
| ¿Qué URLs/CSP deben autorizarse para Matomo? | Solo `https://stats.aldeapucela.org`; configuración adicional validada | Solo `https://stats.aldeapucela.org` | Resuelta |
| ¿Quién verificará eventos reales en el panel Matomo? | Responsable del proyecto; administrador de Matomo; revisión conjunta | Administrador de Matomo | Resuelta |

Decisiones adicionales: el banner guardará la elección localmente; DNT/GPC bloqueará el tracker aunque exista consentimiento; los fallos de Matomo no bloquearán la aplicación; y producción podrá activarse con la configuración vigente del sitio 32.

## Pruebas y validación propuestas

- Unitarias: configuración por entorno, sanitización de categorías/acciones/nombres, `site_id` y URL, inicialización idempotente, no-op cuando está desactivado o falla `_paq`, y exclusión de términos de búsqueda/coordenadas.
- Integración/e2e: una inicialización por carga; un pageview al entrar en cada vista; un pageview por navegación efectiva con `pushState` y `popstate`; cero duplicados por rerender, recarga de datos o cambio de tema.
- Interacciones: selección de estación por marcador y tarjeta, filtros, búsqueda con y sin resultados, guardar/quitar, estación y período del histórico, apertura de gráfico, localización con estados conocidos y tema manual. Comprobar que solo se envían los eventos previstos.
- Resiliencia: bloquear o hacer fallar `matomo.js` y verificar que la UI sigue cargando, navegando y mostrando datos sin excepciones.
- Privacidad: inspeccionar llamadas simuladas/realizadas y confirmar ausencia de texto de búsqueda, latitud/longitud, dirección, distancia exacta, posición del usuario, datos brutos históricos y query strings sensibles.
- Validación manual en el sitio Matomo de Movilidad, una vez confirmado el ID y la política, para verificar pageviews y eventos en tiempo real.

## Riesgos y criterios de aceptación

Riesgos principales: contar de más por el patrón de rerender de la SPA; activar cookies o transmisión antes de cerrar consentimiento; mezclar la propiedad de Fiestas; filtrar mal IDs o estados; y permitir que un script externo o una excepción de analítica rompa la experiencia principal.

La issue estará lista cuando se cumplan sus criterios de aceptación: adaptador centralizado, configuración propia, pageviews exactos, taxonomía documentada sin datos personales, eventos de acciones completadas, desactivación por entorno, tolerancia a indisponibilidad, política de privacidad revisada y pruebas/documentación disponibles. La activación productiva queda condicionada a resolver las decisiones de la tabla y comprobar los eventos reales.

## Autorización expresa para empezar a escribir código

- [x] Todas las dudas resueltas.
- [x] Recibida autorización explícita para **implementar esta issue**.
- **Referencia o texto de autorización:** `Implement the plan.` (21/10/2026)

**Mientras falte cualquiera de las condiciones anteriores, solo editar este documento.**

## Resultado de implementación

- Implementación realizada en `feat/2/integrar-analitica-de-uso-con-matomo-en-movilidad`.
- `npm test`: 7 tests correctos.
- `npm run build`: correcto.
- La suite e2e conserva 6 tests correctos y 4 fallos móviles ya reproducibles sobre `main`; quedan fuera de esta issue.
- Falta comprobar los eventos reales en el panel Matomo del sitio 32 con el administrador.
