"""Builds the pose atlas (assets/atlas.webp, depth.webp, bounds.bin, poses.json): ChatGPT's Off + Idle panels, our own Working lapels.
Atlas layout (1024x1920): rows of 640 px per stage (0 off, 1 idle, 2 working), left panel in x 0-511, right in 512-1023,
each panel rectified per row between its left/right edge. BOUNDS (640x6 RGBA) holds those edges (16-bit) per stage/side."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

# usage: python tools/build_poses.py [scale=1.15] [centreY=.6]
K, Y0 = float(sys.argv[1]) if len(sys.argv) > 1 else 1.15, float(sys.argv[2]) if len(sys.argv) > 2 else .6
SRC, OUT = 'assets/source/', 'assets/'
ART = np.asarray(Image.open(SRC+'working-art.webp').convert('RGB'), np.float32)/255
MASKS = np.asarray(Image.open(SRC+'working-masks.webp').convert('RGB').resize((1024, 1536), Image.BILINEAR), np.float32)/255
theirs = np.asarray(Image.open(SRC+'chatgpt-poses.webp').convert('RGBA'), np.float32)/255
bounds = np.frombuffer(open(SRC+'chatgpt-bounds.bin', 'rb').read(), np.uint8).reshape(6, 640, 4).astype(np.float64)
SPAN = {(0,0):(0.33532695,0.59266348),(0,1):(0.33086124,0.66802233),(1,0):(0.21028708,0.76961722),(1,1):(0.31188198,0.73724083)}

atlas = np.zeros((1920, 1024, 4), np.float32); depth = np.zeros((1920, 1024), np.float32)
edges = np.zeros((6, 640, 2)); spans = {}
# their Off + Idle: copy cells, rescale geometry around the frame centre so they sit at our jacket's size and height
for st in (0, 1):
  for side in (0, 1):
    cell = theirs[st*640:(st+1)*640, side*512:(side+1)*512]
    atlas[st*640:(st+1)*640, side*512:(side+1)*512] = cell
    a = nd.gaussian_filter(cell[..., 3], (40, 40))
    depth[st*640:(st+1)*640, side*512:(side+1)*512] = (.2 + .45*a/a.max() + .12*side)*(cell[..., 3] > .02)
    b = bounds[st*2+side]
    e = np.stack([(b[:, 0]*256+b[:, 1])/65535, (b[:, 2]*256+b[:, 3])/65535], 1)
    edges[st*2+side] = .5 + (e-.5)*K
    y0, y1 = SPAN[(st, side)]; spans[(st, side)] = (Y0 + (y0-.5)*K, Y0 + (y1-.5)*K)
# ours: split the lapels, rectify each
lab, n = nd.label(MASKS[..., 0] > .35)
sizes = nd.sum(np.ones_like(lab), lab, range(1, n+1)); big = np.argsort(sizes)[::-1][:2] + 1
cx = [nd.center_of_mass(lab == i)[1] for i in big]; order = [big[int(np.argmin(cx))], big[int(np.argmax(cx))]]
H, W = MASKS.shape[:2]
for side, lid in enumerate(order):
  own = nd.binary_dilation(lab == lid, iterations=6)
  alpha = MASKS[..., 0]*own
  ys = np.nonzero((alpha > .5).any(1))[0]; y0, y1 = (ys.min()-2)/H, (ys.max()+3)/H
  spans[(2, side)] = (y0, y1)
  vv = (np.arange(640)+.5)/640; rows = (y0 + vv*(y1-y0))*H - .5
  ext = np.zeros((640, 2))
  for i, r in enumerate(rows):
    line = alpha[int(np.clip(round(r), 0, H-1))]; xs = np.nonzero(line > .5)[0]
    ext[i] = ((xs.min()-2)/W, (xs.max()+3)/W) if len(xs) else (np.nan, np.nan)
  for c in (0, 1):  # fill empty rows
    good = ~np.isnan(ext[:, c]); ext[:, c] = np.interp(np.arange(640), np.nonzero(good)[0], ext[good, c])
  edges[4+side] = ext
  uu = (np.arange(512)+.5)/512
  X = (ext[:, :1] + uu[None]*(ext[:, 1:]-ext[:, :1]))*W - .5; Y = np.repeat(rows[:, None], 512, 1)
  samp = lambda ch: nd.map_coordinates(ch, [Y, X], order=1, mode='nearest')
  cell = atlas[1280:1920, side*512:(side+1)*512]
  for c in range(3): cell[..., c] = samp(ART[..., c])
  cell[..., 3] = np.clip(samp(alpha), 0, 1)
  depth[1280:1920, side*512:(side+1)*512] = samp(MASKS[..., 1])
# premultiply-free: give transparent texels the nearby colour so edges don't go dark
rgb = atlas[..., :3]; a = atlas[..., 3]
blur = lambda x: nd.gaussian_filter(x, 3)
wa = blur(a)[..., None]; fill = np.stack([blur(rgb[..., c]*a) for c in range(3)], -1)/np.maximum(wa, 1e-4)
atlas[..., :3] = np.where(a[..., None] > .5, rgb, fill)
b = np.round(np.clip(edges, 0, 1)*65535).astype(np.uint32)
packed = np.stack([b[..., 0] >> 8, b[..., 0] & 255, b[..., 1] >> 8, b[..., 1] & 255], -1).astype(np.uint8)
def save(arr, mode, q, name): Image.fromarray(arr, mode).save(OUT+name, 'WEBP', quality=q, method=6)
save((atlas*255+.5).clip(0,255).astype(np.uint8), 'RGBA', 88, 'atlas.webp')
save(np.repeat((depth.clip(0,1)*255+.5).astype(np.uint8)[..., None], 3, -1)[::2, ::2].copy(), 'RGB', 85, 'depth.webp')
open(OUT+'bounds.bin', 'wb').write(packed.tobytes())
spans = [[round(float(v), 5) for v in spans[(s, d)]] for s in range(3) for d in (0, 1)]
json.dump({'scale': K, 'centreY': Y0, 'spans': spans}, open(OUT+'poses.json', 'w'), indent=1)
print('built', spans)
