# Plan de la issue #1: feat: implementar el diseño responsive del frontend de Movilidad (mapa e histórico)

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/1
- **Repositorio de seguimiento:** `aldeapucela/biki-stats-web`
- **Repositorio de implementación:** `aldeapucela/biki-stats-web`
- **Estado:** IMPLEMENTADO Y VALIDADO
- **Rama:** `feat/1/diseno-responsive-frontend`
- **Base de rama:** `main`

## Resumen verificable de la issue

La issue solicita una SPA informativa responsive para BIKI Valladolid, con vistas de mapa/estaciones e histórico, adaptada a móvil y escritorio y a temas claro y oscuro. Debe consumir exclusivamente la API pública de solo lectura, mantener estados accesibles de carga/error/sin datos/frescura y desplegarse como sitio estático en GitHub Pages.

El repositorio web está actualmente en preparación y no contiene aplicación funcional. El backend ha definido la API v1 en `biki-stats-core` y la implementación está disponible en el PR https://github.com/aldeapucela/biki-stats-core/pull/10. El frontend se desarrollará en paralelo contra ese contrato, usando fixtures explícitos solo en desarrollo hasta disponer de una API local con datos.

## Alcance confirmado y exclusiones

Incluido en el MVP:

- Shell de la SPA, navegación accesible y rutas/vistas Mapa, Guardadas, Histórico y Más.
- Vista responsive de estaciones con lista, búsqueda, filtros, mapa real, marcadores y selección sincronizada.
- Geolocalización opt-in y orden por distancia usando `/stations/nearby`; sin permiso se mantiene la lista normal y no se inventan distancias.
- Favoritos persistidos en `localStorage`, sin cuenta ni sincronización remota.
- Histórico de 24 horas, 7 días, 30 días y 90 días con gráficos SVG accesibles y tarjetas de estadísticas.
- Temas claro/oscuro, preferencia persistente y respeto inicial a `prefers-color-scheme`.
- Estados de carga, error, API no disponible, sin datos, histórico ausente, localización denegada y datos obsoletos.
- Configuración, build y despliegue estático para `https://biki.aldeapucela.org`.
- Footer, atribuciones, licencias y enlaces a los repositorios.

Fuera de alcance:

- Alquiler, reserva, desbloqueo, devolución o cualquier operación de escritura.
- Autenticación, cuentas, backend adicional, persistencia remota de favoritos o analítica invasiva.
- Búsqueda de direcciones/geocodificación: la búsqueda de estaciones será textual por nombre mediante `q`.
- Crear o modificar la API, el collector o la migración histórica del repositorio core.
- Reproducir el mapa esquemático de los mockups como mapa definitivo.

## Contexto y dependencias

- API pública: `https://api.aldeapucela.org/biki/api/v1`.
- API local por defecto: `http://localhost:8000/api/v1`.
- Web pública: `https://biki.aldeapucela.org`.
- API v1: `GET /health`, `/stations`, `/stations/{station_id}`, `/stations/nearby`, `/stations/{station_id}/history` y `/stations/{station_id}/summary`.
- Las respuestas usan `status`, `code`, `data`, `errors` y `meta`; los datos pueden ser `null`, estar obsoletos o tener huecos. El frontend no debe reinterpretar `null` como cero.
- La captura backend ocurre aproximadamente cada cinco minutos; el polling visual será de 60 segundos, mostrando `observed_at`, `data_age_seconds` e `is_stale` cuando proceda.
- Las 10 referencias visuales deben versionarse en `docs/design/`, con nombres por vista, tema y dispositivo, antes de cerrar la implementación visual. Si no están disponibles en el entorno, se debe mantener la especificación textual y dejar constancia de la limitación en el PR.

## Propuesta técnica (NO EJECUTAR)

### Base de aplicación

- Crear una aplicación con Vite, JavaScript vanilla y Tailwind CSS; usar npm y scripts reproducibles de desarrollo, test, build y preview.
- Organizar módulos por responsabilidad: shell/navegación, vistas, componentes visuales, cliente API, adaptadores de datos, estado local, tema, geolocalización, mapa y gráficos.
- Configurar `VITE_API_BASE_URL`, con valor de producción `https://api.aldeapucela.org/biki` y fallback local `http://localhost:8000`; el cliente añadirá `/api/v1` y no se fijarán URLs de entorno dentro de componentes.
- Configurar Vite para el dominio personalizado, incluir `CNAME` para `biki.aldeapucela.org` y documentar el workflow de GitHub Pages, variables y comprobaciones de despliegue.

### Contrato API y estados

- Implementar un cliente `fetch` de solo lectura que compruebe el envoltorio común, traduzca errores estables y soporte cancelación de peticiones obsoletas.
- Usar `/stations` para el listado; aplicar en cliente los filtros de ocupación `poca` (`occupancy_percent <= 25`) y `muy alta` (`occupancy_percent >= 75`) porque no forman parte de los filtros del backend.
- Usar `/stations/nearby` solo con permiso de geolocalización y mostrar `distance_m`; si se deniega o falla, ofrecer la lista sin distancias.
- Mapear 24 h y 7 días a histórico horario; 30 y 90 días a histórico diario. Mantener los huecos recibidos, no interpolar y mostrar una explicación cuando no haya observaciones.
- Usar los KPIs y composición de `/summary` sin recalcular métricas incompatibles en el navegador; mantener coherentes tarjetas, barras y dona.
- Fixtures de desarrollo explícitos y visualmente marcados como simulados; nunca activar fixtures en producción.

### Mapa y visualización

- Usar Leaflet con teselas de OpenStreetMap y atribución visible conforme a sus condiciones.
- Representar estaciones con marcadores legibles y color/estado coherente con ocupación; sincronizar foco/selección entre marcador y tarjeta y permitir detalles sin depender de hover.
- Usar SVG propio y CSS para barras apiladas, composición y estados vacíos, con resumen textual o tabla alternativa para lectores de pantalla.
- Mantener la semántica visual de mecánicas naranja, eléctricas violeta y anclajes libres gris, comprobando contraste en ambos temas.

### Vistas y experiencia

- Escritorio: panel lateral con marca, búsqueda, chips/filtros y tarjetas; mapa amplio a la derecha.
- Móvil: cabecera, búsqueda, frescura, mapa usable y lista inferior desplazable, con navegación inferior accesible y áreas seguras para notch/barras del sistema.
- Guardadas: pantalla de favoritos por IDs de estación en `localStorage`, con estados vacío y estación eliminada/no disponible.
- Más: panel informativo con origen de datos, frescura, ayuda, licencias, repositorios y contacto/enlaces del proyecto.
- Marca visible: `Movilidad · BIKI`; no mostrar el distintivo de concepto de los mockups.
- Incorporar el pie legal exacto de la issue, separando licencia AGPL del código y CC BY-SA del contenido autorizado y respetando las condiciones de datos de terceros.

### Accesibilidad y rendimiento

- Objetivo WCAG 2.2 AA: landmarks, foco visible, navegación por teclado, nombres accesibles, estados anunciables, contraste, zoom, `prefers-reduced-motion` y alternativa textual de gráficos/mapa.
- Pausar o reducir polling cuando la pestaña no esté visible, cancelar solicitudes superadas y evitar renders innecesarios de marcadores.
- No guardar coordenadas de geolocalización ni enviar ubicación a terceros; solo persistir favoritos y preferencia de tema.

## Dudas y decisiones

| Duda | Alternativas | Decisión aprobada | Estado |
| --- | --- | --- | --- |
| Identidad visible | Movilidad; biki.; combinación | `Movilidad · BIKI` | Resuelta |
| Base técnica | Vite vanilla; HTML/Tailwind CLI; Astro | Vite + JavaScript vanilla + Tailwind | Resuelta |
| Cartografía | Leaflet; MapLibre; aplazar mapa | Leaflet + OpenStreetMap | Resuelta |
| Gráficos | SVG propio; Chart.js; ECharts | SVG propio + CSS | Resuelta |
| Alcance inicial | Mapa+Histórico; añadir Guardadas; todo incluido | Mapa + Histórico + Guardadas básicas y Más informativo | Resuelta |
| Filtros de ocupación | 33/66; 25/75; solo API | Poca `<=25%`, muy alta `>=75%` | Resuelta |
| Refresco | Manual; 5 min; 60 s | Cada 60 s con frescura visible y stale del backend | Resuelta |
| Favoritos | Cuenta; localStorage; aplazar | `localStorage`, sin cuenta | Resuelta |
| API pública | URL fija; runtime; variable de build | `VITE_API_BASE_URL`, producción `https://api.aldeapucela.org/biki` | Resuelta |
| Ruta API | `/biki/api/v1`; `/biki/v1`; `/api/v1` | `/biki/api/v1/...` | Resuelta |
| Publicación | URL proyecto; dominio; ambos | `https://biki.aldeapucela.org` | Resuelta |
| Datos sin API | Solo API; MSW; fixtures explícitos | Fixtures solo en desarrollo y marcados | Resuelta |
| Referencias visuales | Issue; repositorio; texto | Versionarlas en `docs/design/` | Resuelta |
| Tests | Manual; Vitest; Vitest+Playwright | Vitest + smoke tests Playwright | Resuelta |

## Pruebas y validación propuestas

- Unit tests con Vitest para normalización del envoltorio API, errores, ocupación, filtros 25/75, formato de frescura, periodos y adaptación de histórico.
- Tests de cliente para loading, éxito, `null`, colección vacía, 404, 422, 503, timeout y datos obsoletos.
- Playwright smoke en móvil y escritorio, con tema claro/oscuro: mapa/lista, selección sincronizada, búsqueda/filtros, geolocalización permitida y denegada, favoritos, histórico por los cuatro periodos y navegación a Más.
- Comprobaciones de teclado, foco, zoom, reduced motion, contraste y alternativa textual de gráficos; ejecutar Lighthouse/axe o equivalente en el flujo crítico.
- `npm run build` y `npm run preview` con la configuración de producción; verificar que no quedan fixtures activos.
- Prueba de integración contra API local y fixture; prueba manual contra `https://api.aldeapucela.org/biki/api/v1` cuando el despliegue backend esté disponible.
- Verificar CORS desde `https://biki.aldeapucela.org`, cabeceras de caché y comportamiento cuando el backend no responde.
- Validar el workflow de GitHub Pages y la resolución de `https://biki.aldeapucela.org` sin rutas rotas ni recursos con base incorrecta.

## Riesgos y criterios de aceptación

- Riesgo principal: las capturas visuales no están aún disponibles en el repositorio; el PR debe adjuntarlas/versionarlas o declarar la limitación antes de aprobar fidelidad visual.
- Riesgo de contrato: el frontend depende del PR #10 del backend; cualquier cambio de rutas o campos debe actualizar ambos repositorios y sus referencias cruzadas.
- Riesgo de OSM: se deben respetar atribución, política de uso de teselas y condiciones de terceros; no se debe asumir que las teselas públicas soportan tráfico ilimitado.
- Riesgo de GitHub Pages: el dominio personalizado, HTTPS, CORS y la base de assets deben comprobarse en CI/preview.

Criterios de aceptación verificables:

- Las vistas Mapa, Guardadas, Histórico y Más funcionan en móvil/escritorio y claro/oscuro.
- Las estaciones, ocupación, tipos de bici, frescura, errores y huecos proceden del contrato API o de fixtures de desarrollo claramente identificados.
- Los cuatro periodos históricos muestran los mismos datos/agregaciones en KPIs y gráficos, sin interpolar observaciones.
- Búsqueda, filtros, geolocalización opt-in, selección mapa-tarjeta y favoritos locales funcionan con estados vacíos y fallos.
- La interfaz alcanza los criterios WCAG 2.2 AA acordados y es usable con teclado, táctil, zoom y lector de pantalla.
- Build, tests, preview y despliegue en `https://biki.aldeapucela.org` pasan; el footer, atribuciones y licencias son correctos.
- La documentación explica desarrollo local, variables, fixtures, API, tests y publicación.

## Autorización expresa para empezar a escribir código

- [x] Todas las dudas resueltas.
- [x] Recibida autorización explícita para **implementar esta issue**.
- **Referencia o texto de autorización:** `Implement the plan.` (usuario, 2026-10-19)

## Resultado de implementación

- Implementado el MVP Vite + JavaScript vanilla + Tailwind con mapa Leaflet/OpenStreetMap, vistas Mapa/Guardadas/Histórico/Más, temas, favoritos locales, fixtures de desarrollo y cliente API configurable.
- Añadidos tests Vitest, smoke tests Playwright para escritorio/móvil, build de producción y workflow de GitHub Pages.
- Validación realizada: `npm test` (3 tests), `npm run test:e2e` (4 tests), `npm run build`, `npm audit --omit=dev --audit-level=high` y `git diff --check` superados.
- Pendiente externo: versionar las 10 capturas visuales cuando sean facilitadas; no se han inventado assets de referencia.

**Mientras falte cualquiera de las condiciones anteriores, solo editar este documento.**
