"""Resume rodeo_todos.json (salida de medir_rodeo.py): factor de rodeo por modo y por tramo de distancia en línea recta."""
import json, statistics as st, sys
d = json.load(open(sys.argv[1])); R = d["resultados"]; print("pares:", d["n"], "| segundos:", d["segundos"])
def pct(x, p): x = sorted(x); return x[min(len(x) - 1, int(p / 100 * len(x)))]
for modo in ("pie", "bici"):
    ok = [r for r in R if r.get(modo) and r["recta"] > 0]
    print(f"\n[{modo}] válidos {len(ok)} de {len(R)}; errores {sum(1 for r in R if r.get('error_' + modo))}")
    f = [r[modo] / r["recta"] for r in ok]
    print("  factor global: p5=%.2f p25=%.2f mediana=%.2f media=%.2f p75=%.2f p95=%.2f" % (pct(f, 5), pct(f, 25), st.median(f), st.mean(f), pct(f, 75), pct(f, 95)))
    for lo, hi in ((0, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 99999)):
        g = [r[modo] / r["recta"] for r in ok if lo <= r["recta"] < hi]
        if g: print(f"  recta {lo}-{hi} m: n={len(g)} mediana={st.median(g):.2f} p10={pct(g, 10):.2f} p90={pct(g, 90):.2f}")
    v = [r[modo] / r[modo + "_s"] * 3.6 for r in ok if r.get(modo + "_s")]
    print("  velocidad implícita que usa OTP (distancia/tiempo, km/h): p10=%.1f mediana=%.1f p90=%.1f" % (pct(v, 10), st.median(v), pct(v, 90)))
