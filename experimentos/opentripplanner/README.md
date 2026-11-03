# Experimento: OpenTripPlanner como motor de rutas del modo «En ruta»

Issue [#31](https://github.com/aldeapucela/biki-stats-web/issues/31). Es investigación: **no cambia la app**. Contiene los scripts, la configuración y los resultados para repetirlo. Fecha de las pruebas: 31-oct-2026.

## Entorno

- OpenTripPlanner **2.9.0** (imagen Docker `opentripplanner/opentripplanner:2.9.0`), sin datos de transporte público, con las opciones por defecto.
- Calles: extracto de OpenStreetMap de Castilla y León de Geofabrik del 29-oct-2026 (179 MB).
- Alquiler de bicis: feed público GBFS v3.0 de BIKI (`valladolid.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json`), con `vehicle-rental` y `sourceType: gbfs` (`config/router-config.json`).
- Máquina de pruebas: Mac con 4 núcleos y 27 GB.
- **No se ha usado ni sondeado el servidor de Vallabus.**

## Resultados

### 1. ¿Lee el feed GBFS v3 de BIKI? Sí

OTP carga las **104 estaciones**. Comparadas con nuestra API: 102 coinciden en bicis y huecos y 2 difieren en 1 unidad (estaciones 65 y 13). Las lecturas se tomaron en momentos distintos, así que es coherente con el desfase entre capturas y no con un error de lectura.

### 2. ¿Usa la disponibilidad al elegir estación? Sí para bicis y huecos; no para `is_returning`

Con un feed falso derivado de la foto real (`scripts/gbfs_falso.py`) se cambió una sola estación cada vez y se pidió la misma ruta. 7 rutas entre estaciones al azar (`resultados/disponibilidad.json`). Cuántas veces cambió la estación elegida:

| Cambio en el feed | Rutas que cambian |
| --- | --- |
| 0 bicis en la estación de recogida | 7 de 7 (recoge en otra) |
| 0 huecos en la de dejada | 7 de 7 (deja en otra; en 1 caso no queda ruta en bici y propone ir andando) |
| Recogida con `is_renting=false` (control positivo) | 7 de 7 |
| Dejada con `is_returning=false` (control positivo) | **0 de 7** |
| Estación ajena a 0 bicis y 0 huecos (control negativo) | 0 de 7 |

- Los controles hacen lo esperado, salvo uno: **el control positivo de la dejada (`is_returning=false`) no cambió ninguna ruta**, así que OTP no parece respetar esa bandera al elegir dónde dejar. La prueba sí puede detectar el efecto: con 0 huecos la dejada cambió las 7 veces. No se ha medido si BIKI usa esa bandera para cerrar estaciones, así que es un hallazgo a tener presente, no un bloqueo.
- Es la disponibilidad **de ahora**. OTP no sabe nada de lo que habrá a la hora de llegada: eso lo seguiría aportando la tabla de frecuencias de la #29.
- Se pidieron 8 rutas y una se descartó porque la ruta intacta ya no tenía tramo en bici.

### 3. Factor de rodeo (distancia por calle / línea recta), 5.356 pares de estaciones

Todos los pares de las 104 estaciones, por la red de calles de OTP (`resultados/rodeo-resumen.txt`):

| Modo | p25 | Mediana | p75 | p95 |
| --- | --- | --- | --- | --- |
| A pie | 1,14 | **1,19** | 1,28 | 1,45 |
| En bici | 1,26 | **1,36** | 1,49 | 1,79 |

- El 1,3 de la #27 queda cerca para la bici (mediana 1,36) y **alto para andar** (1,19).
- El factor baja con la distancia: en bici, mediana 1,44 por debajo de 1 km y 1,28 por encima de 4 km.
- **Lo que no se puede medir con OTP es la velocidad real**: es un parámetro suyo (implícito en estas rutas: 4,5 km/h andando y 13,2 km/h en bici). Los 5 y 15 km/h de la app siguen siendo supuestos hasta que haya datos de viajes reales.
- OTP elige rutas pensadas para bicicleta, no necesariamente la que sigue cada persona.

### 4. Costes medidos aquí

- Construir el grafo de calles: unos 9 minutos con 4 núcleos (en dos ocasiones). El grafo guardado ocupa 225 MB y cargarlo ya guardado tarda segundos.
- Memoria en marcha: de 2,3 a 3,0 GB.
- Respuesta de una ruta en bici de alquiler: mediana 87 ms, p90 236 ms (30 peticiones seguidas, en local).
- CORS: este OTP devuelve `Access-Control-Allow-Origin` con el origen de la petición, sin configuración adicional. Un servidor de otro dominio exigiría añadirlo a `connect-src` de la CSP del `index.html`.

## Qué no sabemos

- Qué versión y configuración usa Vallabus, y si su servidor es público o puede usarse.
- Si la app debe llamar a un OTP propio, a uno de terceros o mediante `core`: quién lo aloja y mantiene.
- Cómo se comporta en horas punta o con el feed real fallando (las pruebas usan una foto fija).
- La velocidad real de las personas.

## Cómo repetirlo

```bash
# data/ lleva el .osm.pbf, config/build-config.json y config/router-config.json
docker run -d --name otp-biki -p 8080:8080 -e JAVA_TOOL_OPTIONS="-Xmx6g" \
  -v "$PWD/data:/var/opentripplanner" opentripplanner/opentripplanner:2.9.0 --build --serve

python3 -I scripts/medir_rodeo.py http://localhost:8080 resultados/estaciones.json rodeo.json 6000 1
python3 -I scripts/resumir_rodeo.py rodeo.json
```

Para el paso 2 hay que arrancar `scripts/gbfs_falso.py`, un segundo OTP cuyo `router-config.json` apunte a él (`frequency: 5s`) y `scripts/probar_disponibilidad.py`.

## Propuesta de decisión (la toma el equipo)

OTP resuelve lo que hoy estimamos a ojo (ruta por calle, factor de rodeo) y respeta bicis y huecos de ahora. No sustituye la frecuencia a la hora de llegada. Lo que decidiría el equipo es quién lo aloja: sin un OTP accesible, esto no se puede usar. Si lo hubiera, la app podría pedirle la ruta y poner encima la frecuencia, con la estimación actual como respaldo.
