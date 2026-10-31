#!/usr/bin/env python3
"""Genera src/availability-table.json: frecuencia histórica de que haya bici (o hueco) dentro de 10, 20, 30 o 45 min,
condicionada a cuántas bicis (o huecos) hay ahora, a la franja horaria y al tipo de día.

Solo usa la biblioteca estándar. El método y sus límites están en docs/MEDICION_DISPONIBILIDAD.md.

  python3 scripts/build-availability.py --from 2026-09-29 --to 2026-10-31 --cache /ruta/cache
  python3 scripts/build-availability.py --from ... --to ... --cache /ruta/cache --download   # primero baja el histórico

Con --download pide a la API pública el histórico `raw` de cada estación en tramos de 2 días (la API limita a 10.000
puntos por petición) y con 3 peticiones en paralelo, para no cargar el servidor. Tarda unos 50 minutos.
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo

API = "https://api.aldeapucela.org/biki/api/v1"
MADRID = ZoneInfo("Europe/Madrid")
STEP = 300  # rejilla de 5 min
MAX_STALE_STEPS = 2  # sin dato si la última lectura tiene más de 10 min
HORIZONS = [10, 20, 30, 45]
BAND_STARTS = [0, 7, 10, 14, 17, 21]  # franjas por hora local de llegada: 0-7, 7-10, 10-14, 14-17, 17-21, 21-24
STATES = 4  # bicis (o huecos) ahora: 0, 1, 2, 3 o más
FROZEN_HOURS = 48  # una estación con la misma lectura más de 48 h seguidas se trata como sensor parado
FIXED_HOLIDAYS = [[1, 1], [1, 6], [5, 1], [8, 15], [10, 12], [11, 1], [12, 6], [12, 8], [12, 25]]  # nacionales de fecha fija


def day_type(local):
    """0 laborable, 1 sábado, 2 domingo o festivo nacional de fecha fija."""
    if [local.month, local.day] in FIXED_HOLIDAYS:
        return 2
    return 0 if local.weekday() < 5 else (1 if local.weekday() == 5 else 2)


def band_of(hour):
    return max(i for i, start in enumerate(BAND_STARTS) if hour >= start)


def get_json(url, tries=5):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=100) as response:
                return json.load(response)
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None


def list_stations():
    stations = []
    while True:
        page = get_json(f"{API}/stations?limit=100&offset={len(stations)}")
        stations += page["data"]
        if not page["meta"]["pagination"]["has_more"]:
            return stations


def download(cache, start, end):
    os.makedirs(cache, exist_ok=True)
    stations = list_stations()

    def one(station):
        path = os.path.join(cache, f"{station['station_id']}.json")
        if os.path.exists(path):
            return station["station_id"], "en caché"
        points, failed, t = [], 0, start
        while t < end:
            e = min(t + dt.timedelta(days=2), end)
            url = f"{API}/stations/{station['station_id']}/history?from={t:%Y-%m-%dT%H:%M:%SZ}&to={e:%Y-%m-%dT%H:%M:%SZ}&granularity=raw&limit=10000"
            data = get_json(url)
            if not data or not data.get("data"):
                failed += 1
            else:
                points += [(p["timestamp"], p["mechanical"], p["electric"], p["free_docks"], p["capacity"]) for p in data["data"]["points"]]
            t = e
        if failed == 0:
            with open(path, "w") as handle:
                json.dump(points, handle)
        return station["station_id"], f"{len(points)} puntos, {failed} tramos fallidos"

    with ThreadPoolExecutor(3) as pool:
        for sid, message in pool.map(one, stations):
            print(sid, message, flush=True)


def to_epoch(text):
    return dt.datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()


def resample(points, grid):
    """Última lectura anterior o igual a cada instante de la rejilla; None si es más vieja de 10 min o no hay.
    Devuelve (bicis, huecos): bicis = mecánicas + eléctricas."""
    rows = sorted((to_epoch(p[0]), p[1], p[2], p[3]) for p in points)
    bikes, docks = [None] * len(grid), [None] * len(grid)
    j = -1
    for i, g in enumerate(grid):
        while j + 1 < len(rows) and rows[j + 1][0] <= g:
            j += 1
        if j >= 0 and g - rows[j][0] <= MAX_STALE_STEPS * STEP:
            _, mechanical, electric, free = rows[j]
            bikes[i] = mechanical + electric if mechanical is not None and electric is not None else None
            docks[i] = free
    return bikes, docks


def longest_run_hours(series):
    best = current = 1
    for i in range(1, len(series)):
        if series[i] is not None and series[i] == series[i - 1]:
            current += 1
            best = max(best, current)
        else:
            current = 1
    return best * STEP / 3600


def build(cache, start, end):
    steps = int((end - start).total_seconds() // STEP)
    grid = [(start + dt.timedelta(seconds=STEP * i)).timestamp() for i in range(steps)]
    local = [(start + dt.timedelta(seconds=STEP * i)).astimezone(MADRID) for i in range(steps)]
    cell = [(day_type(l), band_of(l.hour)) for l in local]  # tipo de día y franja del instante de llegada
    series, excluded = {}, []
    for name in sorted(os.listdir(cache)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(cache, name)) as handle:
            points = json.load(handle)
        if not points:
            continue
        bikes, docks = resample(points, grid)
        if longest_run_hours(bikes) > FROZEN_HOURS:
            excluded.append(name[:-5])
            continue
        series[name[:-5]] = (bikes, docks)
    cells = 3 * len(BAND_STARTS) * STATES
    table = {}
    for kind, which in (("bike", 0), ("dock", 1)):
        table[kind] = {}
        for horizon in HORIZONS:
            k = horizon // 5
            hits, total = [0] * cells, [0] * cells
            for pair in series.values():
                values = pair[which]
                for t in range(steps - k):
                    now, later = values[t], values[t + k]
                    if now is None or later is None:
                        continue
                    day, band = cell[t + k]
                    index = (day * len(BAND_STARTS) + band) * STATES + min(int(now), STATES - 1)
                    total[index] += 1
                    hits[index] += 1 if later >= 1 else 0
            table[kind][str(horizon)] = [[round(hits[i] / total[i], 3), total[i]] if total[i] else [None, 0] for i in range(cells)]
    return {
        "generated": dt.date.today().isoformat(),
        "window": {"from": start.date().isoformat(), "to": end.date().isoformat()},
        "stations": len(series),
        "excluded_stations": excluded,
        "horizons": HORIZONS,
        "band_starts": BAND_STARTS,
        "states": STATES,
        "fixed_holidays": FIXED_HOLIDAYS,
        "index": "((tipo_de_dia * franjas + franja) * estados + estado_ahora); tipo_de_dia: 0 laborable, 1 sábado, 2 domingo o festivo",
        "table": table,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from", dest="start", required=True, help="primer día UTC, AAAA-MM-DD")
    parser.add_argument("--to", dest="end", required=True, help="último día UTC (excluido), AAAA-MM-DD")
    parser.add_argument("--cache", required=True, help="carpeta con un JSON por estación")
    parser.add_argument("--download", action="store_true", help="bajar el histórico a la caché antes de calcular")
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "src", "availability-table.json"))
    args = parser.parse_args()
    start = dt.datetime.fromisoformat(args.start).replace(tzinfo=dt.timezone.utc)
    end = dt.datetime.fromisoformat(args.end).replace(tzinfo=dt.timezone.utc)
    if args.download:
        download(args.cache, start, end)
    result = build(args.cache, start, end)
    with open(args.out, "w") as handle:
        json.dump(result, handle, separators=(",", ":"))
    print(f"{result['stations']} estaciones, excluidas {result['excluded_stations']}, escrito {os.path.relpath(args.out)}", file=sys.stderr)


if __name__ == "__main__":
    main()
