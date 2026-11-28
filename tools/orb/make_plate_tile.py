"""Builds assets/orb-parts/plate-blade-a.png and -b.png: metal patches cut from ChatGPT's shell blade art for the
orb's shell plates (the user chose the blade art over a Blender texture, accepting that it is soft: ~130 px).
Takes the largest fully opaque square inside two blades and upscales it to 512. Run after tools/split_orb_parts.py."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd

PARTS = 'assets/orb-parts/'

def clean_square(name):
    im = Image.open(PARTS + name + '.png').convert('RGBA')
    a = np.asarray(im)[..., 3] > 250
    d = nd.distance_transform_edt(a)
    y, x = np.unravel_index(d.argmax(), d.shape)
    h = int(d.max() / 2 ** 0.5) - 2                     # half side of the largest square inside that circle
    return im.crop((x - h, y - h, x + h, y + h)).convert('RGB')

def mirror_tile(sq, size):
    sq = sq.resize((size // 2, size // 2), Image.LANCZOS)
    t = Image.new('RGB', (size, size))
    t.paste(sq, (0, 0)); t.paste(sq.transpose(Image.FLIP_LEFT_RIGHT), (size // 2, 0))
    t.paste(sq.transpose(Image.FLIP_TOP_BOTTOM), (0, size // 2))
    t.paste(sq.transpose(Image.ROTATE_180), (size // 2, size // 2))
    return t

if __name__ == '__main__':
    for tag, name in (('a', 'blade-bottom-right'), ('b', 'blade-left')):
        clean_square(name).resize((512, 512), Image.LANCZOS).save(PARTS + f'plate-blade-{tag}.png')
        print('wrote', PARTS + f'plate-blade-{tag}.png')
