"""Paso 3 de la issue #31: factor de rodeo (distancia por calle / línea recta) entre estaciones BIKI según OTP.
Uso: python3 -I medir_rodeo.py URL_OTP ESTACIONES.json SALIDA.json [N_PARES] [SEMILLA]
ESTACIONES.json es la respuesta GraphQL de vehicleRentalStations (data.vehicleRentalStations).
Mide a pie y en bici por la red de calles; NO mide la velocidad real (en OTP es un parámetro)."""
import json, math, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from concurrent.futures import ThreadPoolExecutor
from otp_plan import plan

base, est, salida = sys.argv[1:4]
n = int(sys.argv[4]) if len(sys.argv) > 4 else 1500
random.seed(int(sys.argv[5]) if len(sys.argv) > 5 else 1)
S = json.load(open(est))["data"]["vehicleRentalStations"]

def hav(a, b):
    r = math.radians; dl = r(b["lat"] - a["lat"]); dn = r(b["lon"] - a["lon"])
    h = math.sin(dl / 2) ** 2 + math.cos(r(a["lat"])) * math.cos(r(b["lat"])) * math.sin(dn / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))

pares = [(a, b) for i, a in enumerate(S) for b in S[i + 1:]]
random.shuffle(pares); pares = pares[:n]

def uno(par):
    a, b = par; out = {"a": a["stationId"], "b": b["stationId"], "recta": hav(a, b)}
    for nombre, modos in (("pie", "[{mode:WALK}]"), ("bici", "[{mode:BICYCLE}]")):
        try:
            its = plan(base, a["lat"], a["lon"], b["lat"], b["lon"], modos)
            out[nombre] = min(sum(l["distance"] for l in it["legs"]) for it in its) if its else None
            out[nombre + "_s"] = min(it["duration"] for it in its) if its else None
        except Exception as e:
            out[nombre] = None; out["error_" + nombre] = str(e)[:120]
    return out

t = time.time()
with ThreadPoolExecutor(4) as ex: res = list(ex.map(uno, pares))
json.dump({"n": len(res), "segundos": round(time.time() - t, 1), "resultados": res}, open(salida, "w"))
print(f"{len(res)} pares en {time.time()-t:.0f} s")
