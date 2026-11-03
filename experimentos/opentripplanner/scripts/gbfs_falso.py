"""Feed GBFS v3 falso para la issue #31 (paso 2): sirve una foto fija del feed real de BIKI y deja cambiar a mano
bicis, huecos y banderas de alquiler/devolución de estaciones concretas, para ver si OpenTripPlanner las tiene en cuenta.
Uso: python3 -I gbfs_falso.py [PUERTO] [URL_BASE_VISTA_DESDE_OTP]
  Cambiar:  curl -X POST localhost:8099/set -d '{"69": {"bikes": 0}, "16": {"docks": 0}}'   (vacío = foto original)
Campos por estación: bikes, docks (enteros), renting, returning (booleanos)."""
import json, sys, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UP = "https://valladolid.publicbikesystem.net/customer/gbfs/v3.0/"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
BASE = (sys.argv[2] if len(sys.argv) > 2 else f"http://host.docker.internal:{PORT}").rstrip("/") + "/"
get = lambda n: json.load(urllib.request.urlopen(UP + n, timeout=30))
SNAP = {n: get(n) for n in ("gbfs.json", "station_information", "station_status", "system_information",
                           "system_pricing_plans", "system_regions", "vehicle_types", "geofencing_zones", "gbfs_versions")}
OVR = {}

def feed(nombre):
    d = json.loads(json.dumps(SNAP[nombre])); d["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()); d["ttl"] = 10
    if nombre == "gbfs.json":
        for f in d["data"]["feeds"]: f["url"] = BASE + f["url"].rsplit("/", 1)[1]
    if nombre == "gbfs_versions":
        for v in d["data"]["versions"]: v["url"] = BASE + "gbfs.json"
    if nombre == "station_status":
        for s in d["data"]["stations"]:
            o = OVR.get(s["station_id"])
            if not o: continue
            s["last_reported"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            if "bikes" in o:
                s["num_vehicles_available"] = o["bikes"]
                for i, t in enumerate(s["vehicle_types_available"]): t["count"] = o["bikes"] if i == 0 else 0
            if "docks" in o:
                s["num_docks_available"] = o["docks"]
                for g in s.get("vehicle_docks_available", []): g["count"] = o["docks"]
            if "renting" in o: s["is_renting"] = o["renting"]
            if "returning" in o: s["is_returning"] = o["returning"]
    return d

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, d, code=200):
        b = json.dumps(d).encode(); self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        n = self.path.strip("/").split("?")[0] or "gbfs.json"
        self._send(feed(n)) if n in SNAP else self._send({"error": n}, 404)
    def do_POST(self):
        global OVR
        OVR = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}"); self._send({"overrides": OVR})

ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
