"""Builds an extra knotted-jacket look: python3 tools/build_variant.py NAME [--fill-holes]
reads assets/source/NAME.png and writes assets/NAME/NAME.webp + NAME-depth.webp. --fill-holes makes dark openings
(like a hood) opaque instead of letting them key out with the backdrop; leave it off for shapes with a see-through loop (the scarf).
Same recipe as the end of tools/build_knot.py: key out the flat purple backdrop, bleed the edge colour outward, make a
soft depth from the coverage. It sits in the same box as the knotted jacket (assets/knot/knot.json), so the two are swappable."""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

NAME = sys.argv[1]
OUT = f'assets/{NAME}/'
os.makedirs(OUT, exist_ok=True)
im = np.asarray(Image.open(f'assets/source/{NAME}.png').convert('RGB'), np.float32)
bg = np.median(np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3)]), 0)
d = np.abs(im - bg).sum(2)
a = np.clip((d - 18)/(55 - 18), 0, 1); a = a*a*(3 - 2*a)
if '--fill-holes' in sys.argv:
  a = np.maximum(a, nd.binary_fill_holes(nd.binary_closing(a > .5, iterations=3)).astype(np.float32))
rgb = np.where(a[..., None] > .01, (im - bg*(1 - a[..., None]))/np.maximum(a[..., None], .01), 0)
rgb = np.clip(rgb, 0, 255)/255

blur = lambda x: nd.gaussian_filter(x, 3)
wa = blur(a)[..., None]; fill = np.stack([blur(rgb[..., c]*a) for c in range(3)], -1)/np.maximum(wa, 1e-4)
rgb = np.where(a[..., None] > .5, rgb, fill)
Image.fromarray((np.dstack([rgb, a])*255 + .5).clip(0, 255).astype(np.uint8), 'RGBA').save(OUT+f'{NAME}.webp', quality=88, method=6)
g = nd.gaussian_filter(a, 60)
dep = (.26 + .45*g/g.max())*(a > .02)
Image.fromarray(np.repeat((dep*255 + .5).astype(np.uint8)[::2, ::2, None], 3, -1), 'RGB').save(OUT+f'{NAME}-depth.webp', quality=85, method=6)
print('coverage', round(float((a > .5).mean()), 3))
