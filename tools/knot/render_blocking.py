"""Flat-shaded (Workbench) render of the knot, for judging motion.
blender -b -P tools/knot/render_blocking.py -- OUTDIR [NFRAMES=40] [SIZE=627] [YAW_DEG=0] [ONLY=1,5,9]
env KNOT_NPZ=path/to/frames.npz  render the collision-corrected frames from sim.py instead of the raw motion
env KNOT_COLOR=1                 orange left lapel / blue right lapel, to see which strand is where"""
import sys, os, importlib
import bpy
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import knot_geom as kg; importlib.reload(kg)

argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, 'frames')
NF = int(argv[1]) if len(argv) > 1 else 40
SIZE = int(argv[2]) if len(argv) > 2 else 627
YAW = float(argv[3]) if len(argv) > 3 else 0.0
ONLY = [int(x) for x in argv[4].split(',')] if len(argv) > 4 else None
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.film_transparent = False
sh = sc.display.shading
sh.light = 'STUDIO'; sh.color_type = 'OBJECT'
sh.show_shadows = True; sh.show_cavity = True; sh.cavity_type = 'BOTH'
sh.show_object_outline = True; sh.object_outline_color = (0.02, 0, 0.03)
sh.background_type = 'VIEWPORT'; sh.background_color = (0.10, 0.0, 0.085)
try: sc.world  # noqa
except Exception: pass
sc.render.image_settings.file_format = 'PNG'

def to_bl(v):  # px -> blender units, y up, 1 unit = 100 px
    return np.c_[(v[:, 0]-627)/100, (627-v[:, 1])/100, v[:, 2]/100]

F = kg.faces()
objs = []
COLS = ((0.95, 0.55, 0.25, 1), (0.25, 0.45, 0.95, 1)) if os.environ.get('KNOT_COLOR') else ((0.35, 0.55, 0.95, 1), (0.20, 0.33, 0.75, 1))
for name, col in zip('LR', COLS):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(0, 0, 0)]*(kg.NS*kg.NU), [], F); me.update()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.color = col
    sc.collection.objects.link(ob); objs.append(ob)

cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 12.54
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
import math
yw = math.radians(YAW); piv = (0.0 if YAW == 0 else -0.6, -2.4, 0.3)
co.location = (piv[0]+30*math.sin(yw), 0, piv[2]+30*math.cos(yw)); co.rotation_euler = (0, yw, 0)

NPZ = os.environ.get('KNOT_NPZ')
BAKED = np.load(NPZ)['V'] if NPZ else None
if BAKED is not None: NF = len(BAKED)
for f in range(NF):
    if ONLY and f not in ONLY: continue
    t = f/(NF-1)
    verts = (BAKED[f][:kg.NS*kg.NU], BAKED[f][kg.NS*kg.NU:]) if BAKED is not None else kg.frame(t)
    for ob, v in zip(objs, verts):
        ob.data.vertices.foreach_set('co', to_bl(v).astype(np.float32).ravel()); ob.data.update()
    sc.render.filepath = os.path.join(OUT, f'f_{f:03d}.png')
    bpy.ops.render.render(write_still=True)
print('DONE', NF)
