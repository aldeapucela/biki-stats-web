"""Paso 2 de la issue #31: ¿tiene en cuenta OTP las bicis y los huecos al elegir estación?
Necesita gbfs_falso.py en marcha y un OTP que lo lea (frecuencia corta). Uso:
  python3 -I probar_disponibilidad.py URL_OTP URL_FALSO ESTACIONES.json [N_RUTAS] [SEMILLA]
Para cada ruta O->D: se pide con la foto intacta, y luego con (a) 0 bicis en la estación de recogida, (b) 0 huecos en la de
dejada, (c) recogida con is_renting=false y (d) dejada con is_returning=false (a y b son lo que preguntamos; c y d son los
controles positivos: deben cambiar la ruta o la prueba no sirve), y (e) una estación sin relación (control negativo: no debe cambiar)."""
import json, os, random, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from otp_plan import plan, resumen

otp, falso, est = sys.argv[1:4]
n = int(sys.argv[4]) if len(sys.argv) > 4 else 8
random.seed(int(sys.argv[5]) if len(sys.argv) > 5 else 3)
S = {s["stationId"].split(":")[-1]: s for s in json.load(open(est))["data"]["vehicleRentalStations"]}
def poner(o):
    urllib.request.urlopen(urllib.request.Request(falso + "/set", json.dumps(o).encode(), method="POST")); time.sleep(14)
def etapas(a, b):
    it = plan(otp, a["lat"], a["lon"], b["lat"], b["lon"])[0]
    bici = [l for l in it["legs"] if l["mode"] == "BICYCLE"]
    if not bici: return ("sin bici", "+".join(l["mode"] for l in it["legs"]), it["duration"])
    f = lambda x: (x["vehicleRentalStation"] or {}).get("stationId", "").split(":")[-1]
    return f(bici[0]["from"]), f(bici[-1]["to"]), it["duration"]

ids = list(S); random.shuffle(ids); filas = []
for i in range(0, 2 * n, 2):
    a, b = S[ids[i]], S[ids[i + 1]]
    poner({}); base = etapas(a, b)
    if base[0] == "sin bici": continue
    A, B = base[0], base[1]; otra = next(x for x in ids if x not in (A, B, ids[i], ids[i + 1]))
    esc = {"0 bicis en recogida": {A: {"bikes": 0}}, "0 huecos en dejada": {B: {"docks": 0}},
           "recogida is_renting=false (control +)": {A: {"renting": False}}, "dejada is_returning=false (control +)": {B: {"returning": False}},
           "estación ajena a 0 bicis y 0 huecos (control -)": {otra: {"bikes": 0, "docks": 0}}}
    fila = {"ruta": f"{ids[i]}->{ids[i+1]}", "intacta": base}
    for nombre, o in esc.items():
        poner(o); fila[nombre] = etapas(a, b)
    poner({}); filas.append(fila); print(json.dumps(fila, ensure_ascii=False), flush=True)
json.dump(filas, open("disponibilidad.json", "w"), ensure_ascii=False)
