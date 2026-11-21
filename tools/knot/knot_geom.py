"""Rosie's lapels as two ribbons, animated from idle into a wrapped knot. Pure numpy.
Units are image pixels of the 1254px art: x right, y down, z toward the camera."""
import numpy as np

NS, NU = 260, 25          # samples along / across each ribbon

# idle silhouettes traced from idle-to-knot/frame_01.png: rows of (y, left x, right x) or explicit pairs
L_ROWS = [(118, 514, 514), (160, 472, 519), (190, 435, 510), (220, 390, 500), (250, 340, 490), (280, 285, 481),
          (310, 244, 474), (340, 253, 469), (370, 271, 466), (400, 293, 466), (430, 318, 468), (460, 314, 473),
          (490, 308, 480), (520, 303, 489), (550, 301, 500), (580, 300, 512), (610, 301, 523), (640, 306, 531),
          (670, 315, 527), (700, 325, 523), (730, 330, 520), (760, 335, 518), (790, 341, 519), (820, 352, 521),
          (850, 366, 526), (880, 385, 532)]
L_TAIL = [((409, 910), (541, 900)), ((437, 940), (552, 930)), ((471, 970), (566, 958)), ((510, 1000), (584, 988)),
          ((560, 1026), (600, 1018)), ((612, 1048), (612, 1048))]
R_PAIRS = [((790, 298), (790, 298)), ((785, 310), (801, 310)), ((792, 340), (826, 340)), ((798, 370), (855, 370)),
           ((802, 400), (885, 400)), ((804, 430), (916, 430)), ((805, 460), (949, 460)), ((803, 490), (987, 490)),
           ((798, 520), (1005, 515)), ((786, 550), (977, 550)), ((769, 580), (945, 580)), ((748, 610), (938, 610)),
           ((724, 640), (930, 640)), ((699, 670), (925, 670)), ((672, 700), (919, 700)), ((648, 730), (913, 730)),
           ((622, 760), (907, 760)), ((599, 790), (901, 790)), ((578, 820), (895, 820)), ((560, 850), (891, 850)),
           ((543, 880), (869, 880)), ((527, 915), (829, 910)), ((512, 950), (772, 940)), ((498, 990), (705, 970)),
           ((485, 1030), (640, 1000)), ((473, 1065), (575, 1045)), ((462, 1100), (462, 1100))]


def smooth(a, k=5):
    w = np.hanning(2*k+3)[1:-1]; w /= w.sum()
    pad = np.concatenate([np.repeat(a[:1], k, 0), a, np.repeat(a[-1:], k, 0)])
    return np.stack([np.convolve(pad[:, i], w, 'valid') for i in range(a.shape[1])], 1)


def norm(v):
    return v/np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def ss(e0, e1, x):  # smoothstep
    t = np.clip((x-e0)/(e1-e0), 0, 1); return t*t*(3-2*t)


def ribbon(pairs, z):
    """spine c (N,3), half-width h (N,), width dir b (N,3), arc length s (N,)"""
    p = np.array(pairs, float); l, r = p[:, 0], p[:, 1]
    c, hv = (l+r)/2, (r-l)/2
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]
    s = np.linspace(0, d[-1], NS)
    c = np.stack([np.interp(s, d, c[:, i]) for i in (0, 1)], 1)
    hv = np.stack([np.interp(s, d, hv[:, i]) for i in (0, 1)], 1)
    c, hv = smooth(c, 3), smooth(hv, 4)
    h = np.linalg.norm(hv, axis=1); b = hv/np.maximum(h, 1e-6)[:, None]
    ok = h > 3
    for i in (0, 1): b[:, i] = np.interp(np.arange(NS), np.nonzero(ok)[0], b[ok, i])
    h[0] = h[-1] = 0
    c3 = np.c_[c, np.full(NS, z)]; b3 = norm(np.c_[b, np.zeros(NS)])
    return dict(c=c3, h=h, b=b3, s=s, len=s[-1])


L = ribbon([((l, y), (r, y)) for y, l, r in L_ROWS] + L_TAIL, 14.0)
R = ribbon(R_PAIRS, 0.0)
L['fix'] = float(np.interp(450, L['c'][:, 1], L['s']))     # everything above these lines stays put
R['fix'] = float(np.interp(600, R['c'][:, 1], R['s']))


# ---------- path building ----------
def bezier(p0, p1, p2, p3, n=60):
    t = np.linspace(0, 1, n)[:, None]
    return (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3


def tail(p, d0, dt, length, k, step=4.0):
    pts, d = [p], norm(np.asarray(d0, float))
    for _ in range(int(length/step)):
        d = norm(d*(1-k*step) + dt*k*step); p = p + d*step; pts.append(p)
    return np.array(pts)


def plane_perp(T, prev):
    v = np.array([T[1], -T[0], 0.0]); n = np.linalg.norm(v)
    return v/n if n > .25 else prev


class Path:
    """polyline with per-point width direction target (in-plane or axis) and gather"""
    def __init__(s): s.P, s.W, s.G = [], [], []   # points, axis-weight, gather

    def add(s, pts, w, g):
        if s.P: pts, w, g = pts[1:], w[1:], g[1:]
        s.P.append(pts); s.W.append(w); s.G.append(g)

    def done(s):
        s.P, s.W, s.G = np.concatenate(s.P), np.concatenate(s.W), np.concatenate(s.G)
        s.d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(s.P, axis=0), axis=1))]; return s

    def at(s, q):
        q = np.clip(q, 0, s.d[-1]-1e-3)
        P = np.stack([np.interp(q, s.d, s.P[:, i]) for i in range(3)], 1)
        return P, np.interp(q, s.d, s.W), np.interp(q, s.d, s.G)


# ---------- the knot: a half knot, tied like a neckerchief ----------
# R crosses OVER L (front, heading down), goes UNDER/behind L, comes up THROUGH the opening of the V above
# the crossing, out toward the camera, and folds down over the front. The circle R makes lies in the plane
# spanned by "down" and "toward camera", so it links L, and its width runs along N_AX (a level band).
DL = norm(np.array([0.42, 1.0, 0.0]))        # L's direction through the knot


def catmull(P, n=24):
    P = np.asarray(P, float); P = np.vstack([2*P[0]-P[1], P, 2*P[-1]-P[-2]]); out = []
    for i in range(1, len(P)-2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        t = np.linspace(0, 1, n, endpoint=False)[:, None]
        out.append(0.5*((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t**2 + (-p0+3*p1-3*p2+p3)*t**3))
    out.append(P[-2][None]); return np.vstack(out)


def ease(x): x = np.clip(x, 0, 1); return x*x*(3-2*x)


# The tying strand's route through the knot, relative to the knot centre K (px; y down; z toward camera),
# drawn for a strand coming from the upper right (mirrored in x when the left lapel ties).
#   A          crosses OVER the core
#   P1..P4     swings round into a ring, facing the camera
#   P5..P8     goes UNDER: behind the core's tail and out on its far side
#   P9..P10    climbs BEHIND its own strand and comes forward through the V gap above the crossing
#   P11..P13   folds down OVER the front, over its own first crossing
#   P14..P16   goes THROUGH the ring, front to back, and drops out below
ROUTE = np.array([
    (0, -52, 50),                                                       # A: over
    (-62, -28, 44), (-112, 22, 38), (-108, 100, 26), (-48, 132, 0),     # ring
    (0, 128, -50), (34, 96, -78), (66, 40, -96), (142, 16, -52),       # under (drop back first), out the far side
    (102, -130, -100), (40, -249, -75),                                 # up BEHIND its own strand, into the V gap
    (34, -266, 80),                                                     # forward through the gap, above the crossing
    (0, -141, 115), (-34, -44, 105),                                    # down OVER the front, over its own crossing A
    (-50, 30, 56), (-50, 60, 2), (-52, 104, -75),                       # into the ring and through it, out the back
], float)*np.array([0.88, 0.88, 1.0])
# the ring and the under-pass stand on edge (width toward the camera) so the hole stays open
ROUTE_HOOP = np.array([0, .6, .85, .85, .75, .3, 0, 0, 0, 0, .5, .5, 0, 0, 0, 0, 0])   # under-pass lies flat behind the core
TIGHT = np.array([0.6, 0.6, 1.0])                    # how far the route shrinks when pulled tight

_ct = np.linspace(0, 1, 400)
def _density(f):   # time spent per bit of route: quick behind L, slow coming through the ring
    k = np.interp(f, np.linspace(0, 1, len(ROUTE)), np.arange(len(ROUTE)))
    return np.where((k > 4.8) & (k < 8.5), 0.5, np.where(k > 13.5, 1.5, np.where(k > 8.5, 1.3, 1.0)))   # hurry behind, linger through the ring
_cc = np.r_[0, np.cumsum((_density(_ct[1:])+_density(_ct[:-1]))/2*np.diff(_ct))]


def progress(w):
    return float(np.interp(w*_cc[-1], _cc, _ct))


def params(t):
    """t in [0,1] -> pose parameters"""
    m = ease(t/0.2)                                    # lift, gather
    go = ease((t-0.06)/0.6)                            # tip travels the route
    tight = ease((t-0.62)/0.24)                        # pull tight
    settle = t-0.86
    wob = np.exp(-max(settle, 0)/0.05)*np.sin(2*np.pi*max(settle, 0)/0.1) if settle > 0 else 0.0
    K = np.array([560, 884, 30.0])*(1-tight) + np.array([563, 866, 30.0])*tight + np.array([0, 8*wob, 0])
    return dict(m=m, go=progress(go), tight=tight, wob=wob, K=K, X=K+np.array([0, -52, 0])*(1-.5*tight),
                stretchC=1+0.12*m, stretchK=1+1.2*m-0.45*tight,
                gK=1-0.7*m+0.08*tight, gC=1-0.6*m-0.15*tight)


T1 = np.array([712, 1110, -10.0])    # L's tail tip, down right
T2 = np.array([415, 1070, 10.0])    # R's tail tip, down left


def rot2(v, ang):
    c, s_ = np.cos(ang), np.sin(ang); return np.array([c*v[0]-s_*v[1], s_*v[0]+c*v[1], v[2]])


def arclen(pts): return np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]


def path_core(rb, p, D, Ttip, g, wsign):
    """the strand that stays straight: down through the crossing, out to its tail"""
    X = p['X'] + np.array([0, 0, -30.0]); D = norm(np.asarray(D, float))
    i = int(np.searchsorted(rb['s'], rb['fix'])); c0 = rb['c'][i]; T0 = norm(rb['c'][i+1]-rb['c'][i])
    Q1, Q2 = X-60*D, X+40*D
    dd = np.linalg.norm(Q1-c0)
    b = bezier(c0, c0+T0*dd*.4, Q1-D*dd*.35, Q1)
    tdir = norm(rot2(norm(Ttip-Q2), np.radians(12*wsign*p['wob'])))
    tdir = norm(D*(1-p['tight']) + tdir*p['tight'])
    tl = tail(Q2, D, tdir, 700, 0.010)
    path = Path()
    path.add(b, np.zeros(len(b)), np.linspace(1, g, len(b)))
    seg = np.linspace(Q1, Q2, 20); path.add(seg, np.zeros(20), np.full(20, g))
    path.add(tl, np.zeros(len(tl)), g + (0.45-g)*ss(0, 160, arclen(tl)))
    return path.done(), i


SLACK, TAIL = 30.0, 230.0      # cloth ahead of the tip while threading; tail length once tight


def path_knot(rb, p, mirror, Ttip, g, stretch):
    """the strand that ties: over the core, round into a ring, under, and through the ring"""
    K = p['K']; flip = np.array([mirror, 1, 1.0])
    i = int(np.searchsorted(rb['s'], rb['fix'])); c0 = rb['c'][i]; T0 = norm(rb['c'][i+1]-rb['c'][i])
    sc = 1 - (1-TIGHT)*p['tight']
    route = catmull(K + ROUTE*flip*sc, 24)
    hoop = np.interp(np.linspace(0, len(ROUTE)-1, len(route)), np.arange(len(ROUTE)), ROUTE_HOOP)*(1-0.2*p['tight'])   # the ring stays on edge so its hole stays open
    A, tA = route[0], norm(route[1]-route[0])
    dd = np.linalg.norm(A-c0)
    b = bezier(c0, c0+T0*dd*.45, A-tA*dd*.35, A)
    lb, lr = arclen(b), arclen(route)
    loose = arclen(catmull(K + ROUTE*flip, 24))[-1]
    need = (lb[-1] + p['go']*loose + SLACK)*(1-p['tight']) + (lb[-1] + lr[-1] + TAIL)*p['tight']
    stretch = max(stretch, need/(rb['len']-rb['fix']))
    cloth = (rb['len']-rb['fix'])*stretch
    reveal = min(p['go']*lr[-1], max(cloth - lb[-1] - 40, 0))
    k = max(int(np.searchsorted(lr, reveal)), 2)
    rp, hp = route[:k], hoop[:k]
    path = Path()
    path.add(b, ss(lb[-1]*.6, lb[-1], lb)*hoop[0], 1-(1-g)*ss(0, lb[-1], lb))
    path.add(rp, hp, np.full(len(rp), g))
    Pe, te = rp[-1], norm(rp[-1]-rp[-2])
    tdir = norm(rot2(norm(Ttip-Pe), np.radians(-10*mirror*p['wob'])))
    pre = norm(np.array([-0.2*mirror, 1.0, 0.2]))     # loose tail just droops while it travels
    tdir = norm(pre*(1-p['tight']*p['go']) + tdir*p['tight']*p['go'])
    tl = tail(Pe, te, tdir, 900, 0.0025 + 0.02*p['tight'])
    lt = arclen(tl)
    path.add(tl, hp[-1]*(1-ss(0, 60, lt)), g + (1-g)*ss(60, 360, lt)*(0.3+0.7*p['tight']))
    return path.done(), i, stretch


def build(rb, path, i0, m, axis, stretch, pleat=1.0):
    """vertices (NS*NU,3) of one ribbon"""
    s = rb['s']; c, b, h = rb['c'].copy(), rb['b'].copy(), rb['h']
    q = (s - s[i0])*stretch
    P, Wa, G = path.at(np.maximum(q, 0))
    k = (s >= s[i0])[:, None]
    P = np.where(k, P, c); Wa = np.where(k[:, 0], Wa, 0); G = np.where(k[:, 0], G, 1)
    # blend idle -> knot by m (below the fixed line only)
    wfix = ss(s[i0]-60, s[i0]+80, s)[:, None]*m
    P = c + (P-c)*wfix
    G = 1 + (G-1)*wfix[:, 0]
    dtip = (s[-1]-s)*stretch                            # a scarf tail: wide at the knot, pointed at the tip
    h = h + (np.maximum(h, 62*np.clip(dtip/230, 0, 1)**0.75) - h)*wfix[:, 0]
    T = norm(np.gradient(P, axis=0))
    D = np.zeros_like(P); prev = b[0]
    for j in range(NS):
        dp = plane_perp(T[j], prev); prev = dp
        dk = norm((1-Wa[j]*wfix[j, 0])*dp + Wa[j]*wfix[j, 0]*np.asarray(axis))
        dj = norm(b[j]*(1-wfix[j, 0]) + dk*wfix[j, 0])
        dj = norm(dj - np.dot(dj, T[j])*T[j])
        if j and np.dot(dj, D[j-1]) < 0: dj = -dj
        D[j] = dj
    N = norm(np.cross(T, D))
    flip = N[:, 2:3] < 0          # keep normals mostly toward the camera for the pleat offset sign
    u = np.linspace(-1, 1, NU)
    hw = (h*G)[:, None]
    pl = pleat*(1-0.9*Wa*wfix[:, 0])[:, None]*(1-G)[:, None]*h[:, None]*0.16*np.sin(u[None]*np.pi*3.5)
    cup = 0.10*h[:, None]*(u[None]**2)
    off = (pl + cup)
    V = P[:, None] + hw[..., None]*u[None, :, None]*D[:, None] + off[..., None]*N[:, None]
    return V.reshape(-1, 3)


def frame(t):
    p = params(t)
    # L already lies on top of R, so L ties: over R, round, under R's tail, through its own ring
    pl, iL, stK = path_knot(L, p, -1, T1, p['gK'], 1.0)
    pr, iR = path_core(R, p, (-0.42, 1, 0), T2, p['gC'], -1)
    z = np.array([0, 0, 1.0])
    return build(L, pl, iL, p['m'], z, stK), build(R, pr, iR, p['m'], z, p['stretchC'])


def faces():
    f = []
    for j in range(NS-1):
        for k in range(NU-1):
            a = j*NU+k; f.append((a, a+1, a+NU+1, a+NU))
    return f


if __name__ == '__main__':
    print('L len', L['len'], 'fix', L['fix'], ' R len', R['len'], 'fix', R['fix'])
    for t in (0, .3, .6, 1):
        vl, vr = frame(t); print(t, vl.min(0).round(), vl.max(0).round(), vr.min(0).round(), vr.max(0).round())
