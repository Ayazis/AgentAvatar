"""Splits ChatGPT's orb part sheets (assets/source/orb-parts/) into one tight PNG per part in assets/orb-parts/,
plus parts.json with each part's crop box and centre in the 1254x1254 source canvas (so blades can open from where they sit).
Parts are found as connected shapes of alpha > 24; faint edge alpha within 12 px is given to the nearest part (stray haze further out is dropped) so nothing is cut off."""
import json
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, OUT, PAD = 'assets/source/orb-parts/', 'assets/orb-parts/', 4
# names in label order (scipy labels shapes top to bottom, then left to right)
SHEETS = {
  'mechanism-parts.png': ['ring-steel', 'ring-bronze', 'gear-large', 'gear-pinion', 'bearing', 'shaft'],
  'shell-blades.png': ['blade-top', 'blade-left', 'blade-top-right', 'blade-bottom-right', 'blade-bottom-left'],
  'core.png': ['core'],
}

def split(sheet, names, manifest):
  im = np.asarray(Image.open(SRC+sheet).convert('RGBA'))
  a = im[..., 3]
  lab, n = nd.label(a > 24)
  sizes = np.bincount(lab.ravel()); sizes[0] = 0
  keep = [i for i in range(1, n+1) if sizes[i] > 300]
  assert len(keep) == len(names), f'{sheet}: found {len(keep)} parts, expected {len(names)}'
  # give every faint pixel to the nearest labelled part
  lab = np.where(np.isin(lab, keep), lab, 0)
  dist, (iy, ix) = nd.distance_transform_edt(lab == 0, return_indices=True)
  owner = lab[iy, ix] * (a > 0) * (dist <= 12)
  H, W = a.shape
  for i, name in zip(keep, names):
    ys, xs = np.nonzero(owner == i)
    y0, y1 = max(ys.min()-PAD, 0), min(ys.max()+PAD+1, H)
    x0, x1 = max(xs.min()-PAD, 0), min(xs.max()+PAD+1, W)
    part = im[y0:y1, x0:x1].copy()
    part[..., 3] = np.where(owner[y0:y1, x0:x1] == i, part[..., 3], 0)
    Image.fromarray(part).save(OUT+name+'.png', optimize=True)
    manifest[name] = {'sheet': sheet, 'x': int(x0), 'y': int(y0), 'w': int(x1-x0), 'h': int(y1-y0),
                      'cx': round((x0+x1)/2, 1), 'cy': round((y0+y1)/2, 1)}
    print(f'{name:20s} {x1-x0:4d}x{y1-y0:<4d} at {x0},{y0}')

if __name__ == '__main__':
  import os; os.makedirs(OUT, exist_ok=True)
  manifest = {'canvas': 1254}
  for sheet, names in SHEETS.items(): split(sheet, names, manifest)
  json.dump(manifest, open(OUT+'parts.json', 'w'), indent=1)
