"""clip check on the baked frames (out/frames.npz); pairs that were far apart on screen the frame before are
false alarms from fast motion, so also look at the close-ups.: overlapping-on-screen pairs whose depth order flipped between frames"""
import os, numpy as np
from scipy.spatial import cKDTree
import knot_geom as kg
V = np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'frames.npz'))['V'].astype(float); NV = kg.NS*kg.NU
rib = np.r_[np.zeros(NV, int), np.ones(NV, int)]; sid = np.tile(np.repeat(np.arange(kg.NS), kg.NU), 2)
for f in range(1, len(V)):
    A, B = V[f-1], V[f]
    P = cKDTree(B[:, :2]).query_pairs(3.0, output_type='ndarray')
    i, j = P[:, 0], P[:, 1]; k = (rib[i] != rib[j]) | (np.abs(sid[i]-sid[j]) > 14); i, j = i[k], j[k]
    flip = np.sign(A[i, 2]-A[j, 2]) != np.sign(B[i, 2]-B[j, 2])
    tight = np.abs(B[i, 2]-B[j, 2]) < 2
    n = int((flip | tight).sum())
    if n: print(f, n, B[i[flip | tight]].mean(0).round().astype(int).tolist())
