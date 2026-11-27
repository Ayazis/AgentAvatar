"""Derive a normal map and a light-reach mask for the scarf base, so code can light it.

    python tools/scarf_normals.py

Reads assets/source/rosie-scarf-unlit.png and rosie-scarf-bright-lit.png, writes to assets/base/:
  scarf-normal.webp  surface normal (x right, y up, z toward the camera), stored as n * .5 + .5
  scarf-reach.webp   where ChatGPT's bright version gets light that the unlit one doesn't (0…1)
(Two files rather than one with alpha: browsers may wipe the colour of pixels whose alpha is 0.)

The normals are guessed from the shading of the unlit art: a blurred pass for the big folds, a sharp pass for
the twill weave. If assets/source/rosie-scarf-normal.png exists (ChatGPT's, same 1536×1024 framing), it is used instead.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
SRC, OUT = ROOT / 'assets/source', ROOT / 'assets/base'

def lum(img):
    a = np.asarray(img.convert('RGBA'), np.float32) / 255
    return (a[..., :3] @ np.array([.2126, .7152, .0722], np.float32)) * a[..., 3], a[..., 3]

unlit, alpha = lum(Image.open(SRC / 'rosie-scarf-unlit.png'))
bright, _ = lum(Image.open(SRC / 'rosie-scarf-bright-lit.png'))

def slopes(h, sigma, strength):
    s = gaussian_filter(h, sigma)
    gy, gx = np.gradient(s)
    return -gx * strength, gy * strength          # image y runs down; normal y runs up

# folds: lighter reads as higher (the art is lit softly from the front and above)
bx, by = slopes(unlit, 9, 55)
fx, fy = slopes(unlit, 1.1, 7)
nx, ny = bx + fx, by + fy
# fade to flat where the scarf ends, so the halo around it stays smooth
solid = gaussian_filter((alpha > .9).astype(np.float32), 3)
nx *= solid; ny *= solid
nz = np.ones_like(nx)
n = np.stack([nx, ny, nz], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)

# ChatGPT's painted normal map (same framing, green = up) wins when it's there; the guess above is the fallback
painted = SRC / 'rosie-scarf-normal.png'
if painted.exists():
    n = np.asarray(Image.open(painted).convert('RGB'), np.float32) / 255 * 2 - 1
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-4)
    print('using', painted.name)

reach = gaussian_filter(np.clip(bright - unlit, 0, None), 5)
reach /= max(np.percentile(reach[alpha > .5], 99), 1e-4)
reach = np.clip(reach, 0, 1)

OUT.mkdir(exist_ok=True)
Image.fromarray(((n * .5 + .5) * 255 + .5).astype(np.uint8), 'RGB').save(OUT / 'scarf-normal.webp', quality=92, method=6)
Image.fromarray((reach * 255 + .5).astype(np.uint8), 'L').save(OUT / 'scarf-reach.webp', quality=90, method=6)
print('wrote', OUT / 'scarf-normal.webp', 'and', OUT / 'scarf-reach.webp')
