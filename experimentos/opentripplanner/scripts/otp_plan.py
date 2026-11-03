"""Pide una ruta a OTP (API GraphQL de GTFS) con bici de alquiler y devuelve las etapas.
Uso como módulo: plan(base, lat1, lon1, lat2, lon2) -> lista de itinerarios."""
import json, urllib.request

def plan(base, lat1, lon1, lat2, lon2, modes='[{mode:BICYCLE, qualifier:RENT},{mode:WALK}]', extra=""):
    q = ('{ plan(from:{lat:%s,lon:%s}, to:{lat:%s,lon:%s}, transportModes:%s %s) { itineraries { duration walkDistance legs { mode distance duration '
         'from { name vehicleRentalStation { stationId } } to { name vehicleRentalStation { stationId } } } } } }') % (lat1, lon1, lat2, lon2, modes, extra)
    req = urllib.request.Request(base + "/otp/gtfs/v1", json.dumps({"query": q}).encode(), {"Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=60))
    if d.get("errors"): raise RuntimeError(d["errors"])
    return d["data"]["plan"]["itineraries"]

def resumen(it):
    return [(l["mode"], round(l["distance"]), l["duration"],
             (l["from"].get("vehicleRentalStation") or {}).get("stationId"),
             (l["to"].get("vehicleRentalStation") or {}).get("stationId")) for l in it["legs"]]

if __name__ == "__main__":
    import sys
    for it in plan("http://localhost:8080", *sys.argv[1:5]): print(it["duration"], resumen(it))
