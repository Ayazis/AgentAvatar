"""Builds the idle -> knot flipbook (assets/knot/frame_0N.webp + knot.json) from ChatGPT's frames in assets/source/idle-to-knot/.
Keys out the flat purple backdrop to alpha, and works out where the frames sit in the jacket's picture frame by matching
frame_01's jacket box to the idle pose's box in assets/ (so run tools/build_poses.py first).
Also writes the knotted jacket for the shader: knot.webp (last frame, edge colour bled out like the atlas) and
knot-depth.webp (depth in R, same recipe as the idle/off poses), both laid over the same box."""
import json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, OUT = 'assets/source/idle-to-knot/', 'assets/knot/'
os.makedirs(OUT, exist_ok=True)
frames = sorted(f for f in os.listdir(SRC) if re.fullmatch(r'frame_\d+\.png', f))

# hold per frame (ms) from timing.txt: lines like "frame_01.png   120 ms   Idle"
holds = {m[1]: int(m[2]) for m in re.finditer(r'(frame_\d+\.png)\s+(\d+)\s*ms', open(SRC+'timing.txt', encoding='utf-8').read())}

def key(path):
  im = np.asarray(Image.open(path).convert('RGB'), np.float32)
  bg = np.median(np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3)]), 0)
  d = np.abs(im - bg).sum(2)
  a = np.clip((d - 18)/(55 - 18), 0, 1); a = a*a*(3 - 2*a)
  rgb = np.where(a[..., None] > .01, (im - bg*(1 - a[..., None]))/np.maximum(a[..., None], .01), 0)   # remove the backdrop's tint from soft edges
  return np.dstack([np.clip(rgb, 0, 255), a*255]).astype(np.uint8), a

out = []
for i, f in enumerate(frames):
  rgba, a = key(SRC+f)
  name = f.replace('.png', '.webp')
  Image.fromarray(rgba, 'RGBA').save(OUT+name, quality=90, method=6)
  out.append({'file': name, 'ms': holds.get(f, 100)})
  if i == 0: first = a
  last = rgba

# the knotted jacket as the shader's fifth "pose": colour with bled edges, and a soft depth from its coverage
rgb, a = last[..., :3].astype(np.float32)/255, last[..., 3].astype(np.float32)/255
blur = lambda x: nd.gaussian_filter(x, 3)
wa = blur(a)[..., None]; fill = np.stack([blur(rgb[..., c]*a) for c in range(3)], -1)/np.maximum(wa, 1e-4)
rgb = np.where(a[..., None] > .5, rgb, fill)
Image.fromarray((np.dstack([rgb, a])*255 + .5).clip(0, 255).astype(np.uint8), 'RGBA').save(OUT+'knot.webp', quality=88, method=6)
g = nd.gaussian_filter(a, 60)
dep = (.26 + .45*g/g.max())*(a > .02)
Image.fromarray(np.repeat((dep*255 + .5).astype(np.uint8)[::2, ::2, None], 3, -1), 'RGB').save(OUT+'knot-depth.webp', quality=85, method=6)

# idle jacket box in picture coords (st: x 0…1 across, y 0…1 down, 2:3 frame) from the built pose data
b = np.frombuffer(open('assets/bounds.bin', 'rb').read(), np.uint8).reshape(6, 640, 4).astype(np.float64)
spans = json.load(open('assets/poses.json'))['spans']
xs = []
for row in (2, 3):
  e = np.stack([(b[row, :, 0]*256 + b[row, :, 1])/65535, (b[row, :, 2]*256 + b[row, :, 3])/65535], 1)
  e = e[e[:, 1] > e[:, 0]]; xs += [e[:, 0].min(), e[:, 1].max()]
st0x, st1y0, st1y1 = min(xs), min(spans[2][0], spans[3][0]), max(spans[2][1], spans[3][1])

ys, xx = np.nonzero(first > .5)
H = first.shape[0]
k = (st1y1 - st1y0)/(ys.max() - ys.min())     # picture heights per frame pixel
box = {'x': st0x - xx.min()*k*1.5, 'y': st1y0 - ys.min()*k, 'w': first.shape[1]*k*1.5, 'h': H*k}   # in st units
json.dump({'box': box, 'frames': out}, open(OUT+'knot.json', 'w'), indent=1)
print(len(out), 'frames,', sum(f['ms'] for f in out), 'ms; box', {k: round(v, 4) for k, v in box.items()})
