"""Collision pass over the procedural knot: steps through the animation in substeps and keeps every bit of cloth
on the side of the other cloth it was on a moment before (with a minimum gap), so nothing passes through.
Writes out/frames.npz with the corrected vertices of both ribbons per frame.
usage: python tools/knot/sim.py [NFRAMES=48] [SUBSTEPS=4]"""
import os, sys, time, numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter
import knot_geom as kg

NF = int(sys.argv[1]) if len(sys.argv) > 1 else 48
SUB = int(sys.argv[2]) if len(sys.argv) > 2 else 4
NS, NU = kg.NS, kg.NU; NV = NS*NU
GAP, XY, ITER, KEEP = 5.0, 5.0, 12, 0.9

rib = np.r_[np.zeros(NV, int), np.ones(NV, int)]
sid = np.tile(np.repeat(np.arange(NS), NU), 2)


def normals(V):
    out = []
    for k in (0, 1):
        G = V[k*NV:(k+1)*NV].reshape(NS, NU, 3)
        n = np.cross(np.gradient(G, axis=0), np.gradient(G, axis=1))
        out.append((n/np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)).reshape(-1, 3))
    return np.vstack(out)


def raw(t):
    vl, vr = kg.frame(t); return np.vstack([vl, vr])


def smooth(D):
    out = np.empty_like(D)
    for k in (0, 1):
        G = D[k*NV:(k+1)*NV].reshape(NS, NU, 3)
        out[k*NV:(k+1)*NV] = np.stack([gaussian_filter(G[..., c], (2.5, 1.5), mode='nearest') for c in range(3)], -1).reshape(-1, 3)
    return out


def solve(V, Vp, D0):
    """push cloth along z only: any two bits that overlap on screen keep the front/back order they had a
    moment ago, at least GAP apart. Going round an edge or through a hole never overlaps, so it stays free."""
    D = D0.copy(); left = 0
    for it in range(ITER):
        Vc = V + D
        P = cKDTree(Vc[:, :2]).query_pairs(XY, output_type='ndarray')
        if not len(P): break
        i, j = P[:, 0], P[:, 1]
        keep = (rib[i] != rib[j]) | (np.abs(sid[i]-sid[j]) > 14)
        i, j = i[keep], j[keep]
        side = np.sign(Vp[i, 2]-Vp[j, 2]); side[side == 0] = 1
        dz = Vc[i, 2]-Vc[j, 2]
        viol = side*dz < GAP; left = int(viol.sum())
        if not left: break
        i, j, sd, amt = i[viol], j[viol], side[viol], (GAP - side[viol]*dz[viol])*0.5
        push = np.zeros(len(V)); cnt = np.zeros(len(V))
        np.add.at(push, i, sd*amt); np.add.at(push, j, -sd*amt)
        np.add.at(cnt, i, 1); np.add.at(cnt, j, 1)
        push /= np.maximum(cnt, 1)
        sm = smoothz(push)
        peak = np.abs(push).max(); spk = np.abs(sm).max()
        D[:, 2] += sm*min(peak/max(spk, 1e-6), 3.0)
    return D, left


def smoothz(p):
    out = np.empty_like(p)
    for k in (0, 1):
        out[k*NV:(k+1)*NV] = gaussian_filter(p[k*NV:(k+1)*NV].reshape(NS, NU), (2.0, 1.2), mode='nearest').ravel()
    return out


steps = (NF-1)*SUB
Vp = raw(0.0); D = np.zeros_like(Vp)
out = np.zeros((NF, 2*NV, 3), np.float32); out[0] = Vp
t0 = time.time()
for k in range(1, steps+1):
    V = raw(k/steps)
    D, left = solve(V, Vp, D*KEEP)
    Vp = V + D
    if k % SUB == 0:
        f = k//SUB; out[f] = Vp
        print(f'frame {f:2d}  max push {np.linalg.norm(D, axis=1).max():5.1f}px  unresolved {left}  ({time.time()-t0:.0f}s)', flush=True)
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUTDIR, exist_ok=True)
np.savez_compressed(os.path.join(OUTDIR, 'frames.npz'), V=out, NS=NS, NU=NU)
print('saved', os.path.join(OUTDIR, 'frames.npz'))
