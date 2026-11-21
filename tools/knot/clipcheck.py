"""usage: python tools/knot/clipcheck.py [SUBSTEPS=4]
Find where the procedural (raw, before sim.py) ribbons pass through each other: step the animation finely and flag vertex/surface pairs
that are close and have swapped sides since the previous step."""
import sys, numpy as np
from scipy.spatial import cKDTree
import knot_geom as kg

NS, NU = kg.NS, kg.NU
SUB = int(sys.argv[1]) if len(sys.argv) > 1 else 6
NF = 48


def normals(V):
    return np.vstack([_n(V[:NS*NU]), _n(V[NS*NU:])])


def _n(V):
    G = V.reshape(NS, NU, 3)
    ts = np.gradient(G, axis=0); tu = np.gradient(G, axis=1)
    n = np.cross(ts, tu); n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)
    return n.reshape(-1, 3)


def both(t):
    vl, vr = kg.frame(t); return np.vstack([vl, vr])


rib = np.r_[np.zeros(NS*NU, int), np.ones(NS*NU, int)]
sidx = np.tile(np.repeat(np.arange(NS), NU), 2)
slen = np.r_[np.repeat(kg.L['s'], NU), np.repeat(kg.R['s'], NU)]


def pairs(V, n, rad=8.0):
    tree = cKDTree(V)
    P = np.array(sorted(tree.query_pairs(rad)))
    if not len(P): return P
    i, j = P[:, 0], P[:, 1]
    far = (rib[i] != rib[j]) | (np.abs(slen[i]-slen[j]) > 90)     # not just neighbours on the same cloth
    return P[far]


steps = (NF-1)*SUB
prevV = both(0.0); prevN = normals(prevV)
report = {}
for k in range(1, steps+1):
    t = k/steps
    V = both(t); N = normals(V)
    P = pairs(V, N)
    if len(P):
        i, j = P[:, 0], P[:, 1]
        d_now = np.einsum('ij,ij->i', V[i]-V[j], N[j])
        d_prev = np.einsum('ij,ij->i', prevV[i]-prevV[j], prevN[j])
        lat = np.linalg.norm((V[i]-V[j]) - d_now[:, None]*N[j], axis=1)
        bad = (np.sign(d_now) != np.sign(d_prev)) & (lat < 6) & (np.abs(d_prev) < 40)
        if bad.any():
            f = k/SUB
            kind = np.where(rib[i[bad]] != rib[j[bad]], 'L-R', np.where(rib[i[bad]] == 0, 'L-L', 'R-R'))
            for kd in set(kind):
                sel = kind == kd
                c = V[i[bad][sel]].mean(0)
                report.setdefault(int(f), []).append((kd, int(sel.sum()), c.round().astype(int).tolist(),
                                                      int(np.median(sidx[i[bad][sel]])), int(np.median(sidx[j[bad][sel]]))))
    prevV, prevN = V, N
for f in sorted(report):
    print(f, report[f])
