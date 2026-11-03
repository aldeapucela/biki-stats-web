"""Backtest de la tabla de disponibilidad (ver docs/MEDICION_DISPONIBILIDAD.md). Necesita numpy, a diferencia de
build-availability.py, que solo usa la biblioteca estándar.

¿Una frecuencia histórica por hora/tipo de día, o condicionada al estado actual, predice bici/hueco a la hora de llegada
mejor que la base «si hay ahora, habrá luego»? Histórico raw real (29-sep..31-oct-2026) en rejilla de 5 min. La carpeta
DIR_HIST es la caché que genera `build-availability.py --download`.

Uso: python3 -I scripts/medir-disponibilidad.py DIR_HIST [forward|reverse]
  forward: entrena con 29-sep..20-oct, prueba con 21-oct..31-oct. reverse: al revés (comprueba estabilidad)."""
import glob, json, sys, datetime as dt
from zoneinfo import ZoneInfo
import numpy as np

DATA = sys.argv[1]
SPLIT = sys.argv[2] if len(sys.argv) > 2 else "forward"
MAD = ZoneInfo("Europe/Madrid")
STEP = 300
T0 = dt.datetime(2026, 9, 29, tzinfo=dt.timezone.utc)
T1 = dt.datetime(2026, 10, 31, 6, 0, tzinfo=dt.timezone.utc)
N = int((T1 - T0).total_seconds() // STEP)
FESTIVOS = {dt.date(2026, 10, 12)}  # Fiesta Nacional (lunes) dentro de la ventana
MAX_STALE = 2  # sin dato si la última lectura es más vieja de 2 pasos (10 min)

grid_ts = np.array([(T0 + dt.timedelta(seconds=STEP * i)).timestamp() for i in range(N)])
local = [(T0 + dt.timedelta(seconds=STEP * i)).astimezone(MAD) for i in range(N)]
hour = np.array([l.hour for l in local])
day = np.array([l.date().toordinal() for l in local])
def tipo(l):
    if l.date() in FESTIVOS: return 2
    return 0 if l.weekday() < 5 else (1 if l.weekday() == 5 else 2)  # 0 laborable, 1 sábado, 2 domingo/festivo
daytype = np.array([tipo(l) for l in local])
hband = np.select([hour < 7, hour < 10, hour < 14, hour < 17, hour < 21], [0, 1, 2, 3, 4], 5)  # 6 franjas

def resample(points):
    ts = np.array([dt.datetime.fromisoformat(p[0].replace("Z", "+00:00")).timestamp() for p in points])
    bikes = np.array([p[1] + p[2] if p[1] is not None and p[2] is not None else np.nan for p in points], float)
    docks = np.array([p[3] if p[3] is not None else np.nan for p in points], float)
    cap = np.array([p[4] if p[4] is not None else np.nan for p in points], float)
    o = np.argsort(ts); ts, bikes, docks, cap = ts[o], bikes[o], docks[o], cap[o]
    idx = np.searchsorted(ts, grid_ts, side="right") - 1
    ic = np.clip(idx, 0, None)
    ok = (idx >= 0) & ((grid_ts - ts[ic]) <= MAX_STALE * STEP)
    f = lambda a: np.where(ok, a[ic], np.nan)
    return f(bikes), f(docks), f(cap)

B, D, C, ids = [], [], [], []
for f in sorted(glob.glob(f"{DATA}/*.json")):
    pts = json.load(open(f))
    if not pts: continue
    b, d, c = resample(pts); B.append(b); D.append(d); C.append(c); ids.append(f.rsplit("/", 1)[1][:-5])
B, D, C = np.array(B), np.array(D), np.array(C)
ns = len(ids)
print(f"split={SPLIT} estaciones={ns} pasos={N} ({N*STEP/86400:.1f} días)")
print(f"celdas con dato: bicis {np.isfinite(B).mean():.1%}  huecos {np.isfinite(D).mean():.1%}")

def racha_horas(x):
    best = cur = 1
    for i in range(1, len(x)):
        if np.isfinite(x[i]) and x[i] == x[i - 1]: cur += 1; best = max(best, cur)
        else: cur = 1
    return best * STEP / 3600
rb = np.array([racha_horas(B[i]) for i in range(ns)]); rd = np.array([racha_horas(D[i]) for i in range(ns)])
print("racha más larga con el MISMO nº de bicis (h): p50=%.1f p90=%.1f max=%.1f | mismo nº de huecos: p50=%.1f p90=%.1f max=%.1f"
      % (np.median(rb), np.percentile(rb, 90), rb.max(), np.median(rd), np.percentile(rd, 90), rd.max()))
print("estaciones con racha > 48 h en bicis:", int((rb > 48).sum()), "| en huecos:", int((rd > 48).sum()))

ALLDAYS = np.unique(day)
CUT = dt.date(2026, 10, 21).toordinal()
is_train_day = (day < CUT) if SPLIT == "forward" else (day >= CUT)

def logit_fit(X, y, it=25, l2=1.0):
    w = np.zeros(X.shape[1])
    for _ in range(it):
        p = 1 / (1 + np.exp(-X @ w)); g = X.T @ (p - y) + l2 * w
        H = (X * (p * (1 - p))[:, None]).T @ X + l2 * np.eye(X.shape[1])
        w -= np.linalg.solve(H, g)
    return w

def evaluar(M, delta_min, signal):
    k = delta_min // 5
    now, fut = M[:, :-k], M[:, k:]
    prev = np.concatenate([np.full((ns, 3), np.nan), M[:, :-k]], axis=1)[:, 3:3 + now.shape[1]]  # estado hace 15 min
    cap = C[:, :-k]
    ta = np.arange(N - k) + k  # instante de llegada
    hh, dd, hb = hour[ta], daytype[ta], hband[ta]
    valid = np.isfinite(now) & np.isfinite(fut)
    Y = (fut >= 1).astype(float)
    S = np.where(np.isfinite(now), np.minimum(np.nan_to_num(now), 3), 0).astype(int)
    tr = (is_train_day[:N - k])[None, :] & valid
    te = (~is_train_day[:N - k])[None, :] & valid

    # perfil: estación x tipo de día x hora de llegada (con nº de días que lo sostienen)
    prof = np.full((ns, 3, 24), np.nan); ndays = np.zeros((ns, 3, 24))
    for s in range(ns):
        for ty in range(3):
            for h in range(24):
                m = tr[s] & (dd == ty) & (hh == h)
                if m.any(): prof[s, ty, h] = Y[s][m].mean(); ndays[s, ty, h] = len(set(day[:N - k][m]))
    # condicionada agrupada: tipo de día x franja x estado ahora
    pool = np.full((3, 6, 4), np.nan)
    for ty in range(3):
        for b in range(6):
            for st in range(4):
                m = tr & (dd == ty)[None, :] & (hb == b)[None, :] & (S == st)
                if m.any(): pool[ty, b, st] = Y[m].mean()
    # condicionada por estación (franja x estado), encogida hacia la agrupada con peso m0
    m0 = 30.0
    st_p = np.full((ns, 6, 4), np.nan)
    for s in range(ns):
        for b in range(6):
            for st in range(4):
                m = tr[s] & (hb == b) & (S[s] == st)
                n = m.sum()
                prior = np.nanmean(pool[:, b, st]) if np.isfinite(pool[:, b, st]).any() else np.nan
                if n and np.isfinite(prior): st_p[s, b, st] = (Y[s][m].sum() + m0 * prior) / (n + m0)
                elif np.isfinite(prior): st_p[s, b, st] = prior

    ss, tt = np.nonzero(te)
    y = Y[ss, tt]
    P = {}
    P["persistencia"] = (S[ss, tt] >= 1).astype(float)
    P["perfil hora"] = prof[ss, dd[tt], hh[tt]]
    P["estado+franja (agrupada)"] = pool[dd[tt], hb[tt], S[ss, tt]]
    P["estado+franja por estación"] = st_p[ss, hb[tt], S[ss, tt]]
    # referencia: regresión logística agrupada con estado, tendencia, ocupación y hora
    def feats(ssx, ttx):
        n0 = np.nan_to_num(now[ssx, ttx]); tr15 = np.nan_to_num(now[ssx, ttx] - prev[ssx, ttx])
        ca = np.nan_to_num(cap[ssx, ttx], nan=20.0)
        h = hh[ttx] / 24 * 2 * np.pi
        return np.column_stack([np.ones(len(ssx)), np.minimum(n0, 3) == 0, np.minimum(n0, 3) == 1, np.minimum(n0, 3) == 2,
                                np.log1p(n0), tr15 / 5, n0 / np.maximum(ca, 1), np.sin(h), np.cos(h), dd[ttx] == 1, dd[ttx] == 2]).astype(float)
    sT, tT = np.nonzero(tr)
    sel = np.random.default_rng(0).choice(len(sT), size=min(len(sT), 400_000), replace=False)
    w = logit_fit(feats(sT[sel], tT[sel]), Y[sT[sel], tT[sel]])
    P["regresión logística (ref.)"] = 1 / (1 + np.exp(-feats(ss, tt) @ w))

    ok = np.ones(len(y), bool)
    for v in P.values(): ok &= np.isfinite(v)
    risk = (S[ss, tt] <= 2) & ok
    brier = lambda p, yy: float(np.mean((p - yy) ** 2))
    out = {"n_prueba": int(ok.sum()), "tasa_base": float(y[ok].mean()), "n_zona_riesgo(ahora<=2)": int(risk.sum()),
           "tasa_base_riesgo": float(y[risk].mean()) if risk.any() else None}
    tab = []
    for name, p in P.items():
        tab.append((name, brier(p[ok], y[ok]), brier(p[risk], y[risk]) if risk.any() else None))
    out["tabla"] = tab
    # calibración del mejor modelo simple (por estación) en zona de riesgo
    best = P["estado+franja por estación"]
    rel = []
    for lo, hi in ((0, .3), (.3, .6), (.6, .8), (.8, .9), (.9, 1.01)):
        m = risk & (best >= lo) & (best < hi)
        if m.sum() > 50: rel.append((f"[{lo:.1f},{min(hi,1):.1f})", int(m.sum()), round(float(best[m].mean()), 3), round(float(y[m].mean()), 3)))
    out["calibración estado+franja por estación (zona de riesgo): rango, n, prevista, observada"] = rel
    # aviso: «puede que NO haya» cuando P < umbral; precisión y exhaustividad frente a persistencia
    av = []
    for thr in (0.5, 0.7, 0.8, 0.9):
        for name in ("persistencia", "estado+franja por estación"):
            p = P[name][ok]; yy = y[ok]
            pred = p < thr; real = yy == 0
            tp = int((pred & real).sum()); fp = int((pred & ~real).sum()); fn = int((~pred & real).sum())
            av.append((thr, name, f"avisos={tp+fp} aciertan={tp/max(tp+fp,1):.2f} cubren={tp/max(tp+fn,1):.2f}"))
    out["avisos"] = av
    # perfil horario por número de días de muestra
    nd = ndays[ss, dd[tt], hh[tt]]
    cal = []
    for lo, hi in ((1, 4), (4, 8), (8, 15), (15, 40)):
        m = ok & (nd >= lo) & (nd < hi)
        if m.sum() > 300: cal.append((f"{lo}-{hi-1} días", int(m.sum()), round(brier(P['perfil hora'][m], y[m]), 4), round(brier(P['persistencia'][m], y[m]), 4)))
    out["perfil hora por días de muestra: grupo, n, Brier perfil, Brier persistencia"] = cal
    return out

for nombre, M in (("BICI disponible (mec+elec >= 1)", B), ("HUECO disponible (>= 1)", D)):
    for delta in (10, 20, 30):
        print(f"\n=== {nombre} — a {delta} min ===")
        r = evaluar(M, delta, nombre)
        for k, v in r.items():
            if k == "tabla":
                print("  modelo | Brier global | Brier zona riesgo")
                for name, a, b in v: print(f"    {name:32s} {a:.4f}   {b if b is None else round(b,4)}")
            elif isinstance(v, list):
                print(f"  {k}:")
                for row in v: print("    ", row)
            else: print(f"  {k}: {v}")
