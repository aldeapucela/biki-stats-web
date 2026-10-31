# Medición de la disponibilidad a la hora de llegada

Cómo se obtiene el «Es probable que haya hueco» del modo «En ruta» (issue [#29](https://github.com/aldeapucela/biki-stats-web/issues/29)), qué se midió antes de fijarlo y qué no dice.

## Qué se muestra

Para la estación donde se recoge la bici y para la que se deja, la tarjeta de ruta enseña dos cosas distintas:

1. **Lo de ahora**: bicis (mecánicas y eléctricas) o huecos libres, tal como los da la API.
2. **Una frecuencia histórica a la hora de llegada**: de las veces en que, **en el mismo tipo de día, en la misma franja horaria y con tantas bicis (o huecos) como hay ahora**, hubo bici (o hueco) pasados 10, 20, 30 o 45 minutos. Se enseña en cuatro tramos (casi seguro, probable, dudoso, poco probable) y con el número de lecturas.

**No es una previsión.** No sabe nada del tiempo, de eventos ni de lo que haga cada persona. Es lo que pasó en situaciones parecidas.

## De dónde sale la tabla

`src/availability-table.json` la genera `scripts/build-availability.py` con el histórico `raw` de la API pública, solo con la biblioteca estándar de Python:

```bash
python3 scripts/build-availability.py --from 2026-09-29 --to 2026-10-31T06:00 --cache /ruta/cache --download
```

- La API limita a 10.000 puntos por petición, así que el script baja cada estación en tramos de 2 días y con 3 peticiones en paralelo (unos 50 minutos para las 104 estaciones). La caché permite recalcular sin volver a bajar.
- Se remuestrea a una rejilla de 5 minutos con la última lectura de hasta 10 minutos de antigüedad.
- Cada par «ahora → dentro de 10/20/30/45 min» cuenta en la celda `tipo de día × franja de la hora de llegada × estado ahora (0, 1, 2, 3 o más)`.
- Franjas por hora de Madrid: 0–7, 7–10, 10–14, 14–17, 17–21 y 21–24 h. Tipos de día: laborable, sábado y domingo o festivo nacional de fecha fija.
- Se excluyen las estaciones con la misma lectura más de 48 h seguidas (sensor parado): en la tabla actual, la 54 y la 98.

`scripts/medir-disponibilidad.py` (necesita numpy) repite la medición que justifica el diseño. La tabla del script de producción y la de esa medición se calcularon con dos implementaciones independientes y coinciden en las 576 celdas.

## Qué se midió (29-sep a 31-oct-2026, 104 estaciones)

El instrumento:

- El histórico con huecos libres empieza el 29-sep; antes solo hay bicis.
- La cadencia era de 30 s hasta el 21-oct y es de 5 min desde el 22-oct.
- Con el remuestreo hay dato en el 99,6 % de las celdas.

El experimento, entrenando con 29-sep a 20-oct y probando con 21-oct a 31-oct (y al revés para comprobar que no depende del reparto). Error cuadrático medio de la probabilidad (Brier, menor es mejor) donde ahora quedan 2 o menos, que es donde la respuesta importa:

| Bici disponible a… | «Si hay ahora, habrá luego» | Solo hora y tipo de día | Estado ahora + franja + tipo de día |
|---|---|---|---|
| 10 min | 0,066 | 0,124 | **0,055** |
| 20 min | 0,108 | 0,118 | **0,077** |
| 30 min | 0,136 | 0,111 | **0,086** |

| Hueco disponible a… | «Si hay ahora, habrá luego» | Solo hora y tipo de día | Estado ahora + franja + tipo de día |
|---|---|---|---|
| 10 min | 0,088 | 0,114 | **0,067** |
| 20 min | 0,131 | 0,099 | **0,079** |
| 30 min | 0,151 | 0,087 | **0,077** |

- Condicionar a lo que hay ahora mejora a las dos bases en los seis casos y en las dos particiones. Una regresión logística con tendencia y ocupación no lo mejora.
- Una tabla única para toda la ciudad rinde igual que una por estación.
- La probabilidad está calibrada (p. ej. bici a 20 min: prevista 86,2 % y observada 86,9 % en un tramo; 96,9 % y 96,2 % en otro).
- El aviso de «no habrá» como sí o no no mejora a la persistencia: la ganancia está en la probabilidad.

### Mínimo de lecturas y tramos

Comparando la misma celda calculada con la primera y la segunda mitad del periodo:

| Lecturas en la celda | Diferencia mediana entre mitades | p90 |
|---|---|---|
| 100–299 | 0,06–0,15 | 0,21–0,30 |
| 300–999 | 0,03 | 0,09–0,11 |
| 1000 o más | 0,01 | 0,03–0,06 |

Por eso la app **no da cifra con menos de 300 lecturas** (`MIN_READINGS`) y enseña tramos, no un porcentaje exacto. Con 3 o más bicis (o huecos) ahora, toda celda con lecturas suficientes tiene frecuencia de 0,99 o más: de ahí `ALTERNATIVE_MIN = 3` para sugerir otra estación.

## Límites

- **Solo 32 días de otoño**, con un festivo (12-oct) y cuatro fines de semana completos. No hay invierno, verano, vacaciones ni eventos.
- Los festivos locales y los móviles (Semana Santa) no están: cuentan como laborable.
- Con 0 huecos ahora hay pocas lecturas (los huecos casi nunca se agotan), así que la app suele decir «sin datos suficientes» en ese caso y se queda con el aviso en tiempo real.
- El tiempo andando (5 km/h) y en bici (15 km/h) con factor de rodeo 1,3 son supuestos no medidos.
- La tabla es un instante: conviene regenerarla cada cierto tiempo (al menos cada estación del año).
