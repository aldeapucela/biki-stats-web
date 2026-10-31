# Plan de la issue #31: feat: estudiar OpenTripPlanner como motor de rutas del modo En ruta (experimento)

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/31
- **Repositorio de seguimiento e implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN EXPERIMENTO (2026-10-31). Es investigación: no cambia la app.
- **Rama:** `feat/31/experimento-opentripplanner`, desde `main`. Solo contiene scripts y un informe en `experimentos/opentripplanner/`.

## Resumen verificable de la issue

Responder, con un OpenTripPlanner (OTP) local, si puede darnos la ruta real calle a calle para el modo «En ruta» (#29) y si usa la disponibilidad de bicis y huecos al calcularla. Medir el factor de rodeo y la velocidad en bici que hoy se suponen (1,3 y 15 km/h).

## Alcance y exclusiones

Dentro: OTP en Docker con un extracto de OpenStreetMap y el feed GBFS v3 público de BIKI; un feed falso para probar la disponibilidad; un script que pide rutas entre estaciones y resume la distribución; informe con resultados y límites.

Fuera: cambiar la app, desplegar un OTP, tocar `core`, usar el servidor de Vallabus.

## Pasos y criterio de cada uno

| Paso | Cómo se responde | Criterio |
| --- | --- | --- |
| 1. ¿Lee el feed v3? | OTP local con el feed real | Mismas estaciones y cifras que la API de BIKI |
| 2. ¿Usa la disponibilidad? | Feed falso con una estación a 0 bicis y otra a 0 huecos | La ruta debe cambiar al activar el caso; se prueba también con el feed intacto para ver que no es ruido (M7) |
| 3. Factor de rodeo y velocidad | Rutas reales entre pares de estaciones frente a línea recta | Se publica la distribución, no un valor elegido (M6) |
| 4. Costes | Memoria, tiempo de build y de respuesta, CORS | Cifras medidas en esta máquina, rotuladas como tales |
| 5. Decisión | Directo desde la app, mediante `core`, o descartar | Se propone, decide el equipo |

## Autorización expresa

- [x] Pablo (2026-10-31): «Vale, pues metemelo como un experimento en otra rama».
