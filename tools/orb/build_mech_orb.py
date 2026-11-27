# Blender scene: the clockwork orb from ChatGPT's parts, built as real geometry so
# perspective and lighting are correct: shell blades, a two-ring gimbal, a spoked gear + pinion, a bearing housing
# and an amber core. Materials use ChatGPT's PBR maps in assets/source/orb-materials/.
# Run:  blender -b -P tools/orb/build_mech_orb.py -- [--state idle|thinking|talking|off] [--frames N] [--res PX]
#                                                    [--still F] [--transparent] [--save]
# Frames go to tools/orb/out/mech/<state>/ (loops seamlessly), stills to tools/orb/out/mech/still_<state>_<F>.png.
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
STATE = arg('--state', 'idle')
FRAMES = arg('--frames', 144)
RES = arg('--res', 720)
STILL = arg('--still', -1)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MATS = os.path.join(ROOT, 'assets', 'source', 'orb-materials')
OUT = os.path.join(HERE, 'out', 'mech')
TAU = math.tau

# per state: gear turns per loop, gimbal swing, blade opening (rest + pulse), core glow (base, pulse, pulses per loop)
STATES = {   # gear turns per loop, shell opening distance + pulse, shell turns (in 1/5ths: 5-fold symmetric), core glow
    'off':      dict(gear=0, open=0.0,  open_p=0.0,  shell=0, glow=0.15, glow_p=0.0, beats=1),
    'idle':     dict(gear=1, open=0.28, open_p=0.04, shell=1, glow=1.0,  glow_p=0.3, beats=2),
    'thinking': dict(gear=3, open=0.42, open_p=0.06, shell=2, glow=1.5,  glow_p=0.4, beats=6),
    'talking':  dict(gear=2, open=0.55, open_p=0.18, shell=1, glow=2.0,  glow_p=0.8, beats=12),
}
S = STATES[STATE]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.fps = 24

# ---------------- materials ----------------
def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt, nt.nodes.new('ShaderNodeOutputMaterial')

def img(name, non_color=False):
    im = bpy.data.images.load(os.path.join(MATS, name + '.png'), check_existing=True)
    if non_color: im.colorspace_settings.name = 'Non-Color'
    return im

def tex(nt, image, vec, blend=0.3):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = image
    t.projection = 'BOX'; t.projection_blend = blend
    nt.links.new(vec, t.inputs['Vector'])
    return t

AVG = {'bronze': (0.36, 0.22, 0.12), 'steel': (0.6, 0.6, 0.58)}   # rough averages of ChatGPT's color maps

def pbr_metal(name, base, tint, rough_lo, rough_hi, aniso=0.0, bump=0.15, scale=1.2, edge=None, detail=0.45):
    """Metal from ChatGPT's color/rough maps, box-projected in object space. `edge` brightens grazing angles."""
    m, nt, out = node_mat(name)
    avg = AVG[base]
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Anisotropic'].default_value = aniso
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    col = tex(nt, img(base + '-color'), mp.outputs['Vector'])
    rgh = tex(nt, img(base + '-rough', True), mp.outputs['Vector'])
    soft = nt.nodes.new('ShaderNodeMix'); soft.data_type = 'RGBA'
    soft.inputs['Factor'].default_value = 1 - detail; soft.inputs['B'].default_value = (*avg, 1)
    nt.links.new(col.outputs['Color'], soft.inputs['A'])
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0; mul.inputs['B'].default_value = (*tint, 1)
    nt.links.new(soft.outputs['Result'], mul.inputs['A'])
    color_out = mul.outputs['Result']
    if edge:
        lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        mx.inputs['B'].default_value = (*edge, 1)
        nt.links.new(lw.outputs['Facing'], mx.inputs['Factor'])
        nt.links.new(color_out, mx.inputs['A'])
        color_out = mx.outputs['Result']
    nt.links.new(color_out, b.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value = rough_lo; rr.inputs['To Max'].default_value = rough_hi
    nt.links.new(rgh.outputs['Color'], rr.inputs['Value'])
    nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.02
    nt.links.new(rgh.outputs['Color'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

def plain_metal(name, color, rough, metallic=1.0):
    m, nt, out = node_mat(name)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic; b.inputs['Roughness'].default_value = rough
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

M_BRONZE = pbr_metal('Bronze', 'bronze', (1.75, 1.55, 1.2), 0.22, 0.42, aniso=0.35, bump=0.06, detail=0.4)
M_BRASS = pbr_metal('BrassBright', 'bronze', (2.2, 2.1, 1.5), 0.14, 0.28, bump=0.04, scale=2, detail=0.25)
M_STEEL = pbr_metal('Gunmetal', 'steel', (0.85, 0.8, 0.76), 0.2, 0.34, aniso=0.6, bump=0.1, edge=(0.95, 0.65, 0.4))
M_BLADE = pbr_metal('BladeBronze', 'steel', (0.55, 0.42, 0.34), 0.2, 0.34, aniso=0.7, bump=0.08, scale=0.7,
                    edge=(1.0, 0.5, 0.2))
M_DARK = plain_metal('DarkIron', (0.015, 0.012, 0.01), 0.75, 0.0)
M_HOLE = plain_metal('Hole', (0.004, 0.003, 0.002), 0.8, 0.0)

def core_mat():
    """Glowing amber: swirling emission, darker at the rim, glossy coat on top."""
    m, nt, out = node_mat('Core')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (0.12, 0.025, 0.0, 1)
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Coat Weight'].default_value = 0.3; b.inputs['Coat Roughness'].default_value = 0.08
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.5; nz.inputs['Detail'].default_value = 8
    nz.inputs['Distortion'].default_value = 1.5
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.45; ramp.color_ramp.elements[0].color = (1.0, 0.3, 0.0, 1)
    ramp.color_ramp.elements[1].position = 1.0; ramp.color_ramp.elements[1].color = (1.0, 0.78, 0.3, 1)
    # colour follows both the swirl and the centre-ness, so the middle burns yellow and the edge glows deep orange
    mixf = nt.nodes.new('ShaderNodeMath'); mixf.operation = 'MULTIPLY_ADD'; mixf.inputs[1].default_value = 0.5
    nt.links.new(nz.outputs['Fac'], mixf.inputs[0])
    nt.links.new(mixf.outputs[0], ramp.inputs['Fac'])
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs['Facing'], inv.inputs[1])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 3.0
    nt.links.new(inv.outputs[0], pw.inputs[0])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 12.0
    nt.links.new(pw.outputs[0], k.inputs[0])
    nt.links.new(pw.outputs[0], mixf.inputs[2])
    nt.links.new(ramp.outputs['Color'], b.inputs['Emission Color'])
    nt.links.new(k.outputs[0], b.inputs['Emission Strength'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m, k, nz
M_CORE, CORE_K, CORE_NZ = core_mat()

def glow_mat(name, color, k):
    m, nt, out = node_mat(name)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = k
    nt.links.new(e.outputs[0], out.inputs[0])
    return m, e
M_RACE, E_RACE = glow_mat('RaceGlow', (1.0, 0.45, 0.08), 6)

# ---------------- helpers ----------------
def link(o, parent=None):
    bpy.context.collection.objects.link(o)
    if parent: o.parent = parent
    return o

def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    e = link(bpy.data.objects.new(name, None), parent)
    e.location = loc; e.rotation_euler = rot
    return e

def finish(me):
    """Smooth shading with hard edges above 40 degrees, so revolved and curved parts don't show facets."""
    me.shade_smooth()
    if hasattr(me, 'set_sharp_from_angle'): me.set_sharp_from_angle(angle=math.radians(40))

def mesh_obj(name, verts, faces, mat, parent=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    finish(me)
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me), parent)

def bevel(o, w, seg=3, angle=50):
    b = o.modifiers.new('bevel', 'BEVEL'); b.width = w; b.segments = seg
    b.limit_method = 'ANGLE'; b.angle_limit = math.radians(angle); b.harden_normals = False
    return o

def solidify(o, t, offset=0):
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = t; s.offset = offset
    return o

def lathe(name, profile, mat, parent=None, segs=128, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Revolve a closed (r, z) profile around Z; add bevel() for soft highlights on its corners."""
    vs, fs, n = [], [], len(profile)
    for i in range(segs):
        a = TAU * i / segs
        for r, z in profile:
            vs.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(segs):
        j = (i + 1) % segs
        for k in range(n):
            l = (k + 1) % n
            fs.append((i * n + k, j * n + k, j * n + l, i * n + l))
    o = mesh_obj(name, vs, fs, mat, parent)
    o.location = loc; o.rotation_euler = rot
    return o

def box_profile(r0, r1, z0, z1):
    return [(r0, z0), (r1, z0), (r1, z1), (r0, z1)]

_rivet = {}
def rivet(parent, loc, normal, size, mat):
    """Domed rivet head sitting on a surface with the given normal."""
    key = (size, mat.name)
    if key not in _rivet:
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=size)
        for v in bm.verts:
            if v.co.z < 0: v.co.z = 0
            v.co.z *= 0.6
        me = bpy.data.meshes.new('rivet'); bm.to_mesh(me); bm.free(); me.shade_smooth(); me.materials.append(mat)
        _rivet[key] = me
    o = link(bpy.data.objects.new('rivet', _rivet[key]), parent)
    o.location = loc
    o.rotation_euler = Vector(normal).to_track_quat('Z', 'Y').to_euler()
    return o

def hole(parent, loc, normal, r, depth=0.02):
    """A dark plug just under the surface reads as a drilled hole."""
    c = cyl('hole', r, depth, M_HOLE, parent, verts=16)
    c.location = loc
    c.rotation_euler = Vector(normal).to_track_quat('Z', 'Y').to_euler()
    return c

def box(name, size, mat, parent=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); finish(me); me.materials.append(mat)
    return link(bpy.data.objects.new(name, me), parent)

def cyl(name, r, depth, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), verts=32):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); finish(me); me.materials.append(mat)
    o = link(bpy.data.objects.new(name, me), parent)
    o.location = loc; o.rotation_euler = rot
    return o

def drive(o, path, idx, expr):
    d = (o.driver_add(path, idx) if idx >= 0 else o.driver_add(path)).driver
    d.type = 'SCRIPTED'
    d.expression = expr.replace('T', f'((frame-1)/{FRAMES})')

def gear_disc(name, r_root, r_tip, teeth, r_in, depth, mat, parent=None, blocky=False):
    """Toothed annulus: trapezoid teeth between r_root and r_tip, hole of radius r_in, extruded and bevelled."""
    outline = []
    prof = ((0.0, r_root), (0.1, r_root), (0.13, r_tip), (0.47, r_tip), (0.5, r_root)) if blocky else \
           ((0.0, r_root), (0.06, r_root), (0.16, r_tip), (0.46, r_tip), (0.56, r_root))
    for t in range(teeth):
        a0 = TAU * t / teeth; p = TAU / teeth
        for f, r in prof:
            outline.append((a0 + f * p, r))
    vs, fs, n = [], [], len(outline)
    for a, r in outline:
        vs.append((r * math.cos(a), r * math.sin(a), 0))
    for a, r in outline:
        vs.append((r_in * math.cos(a), r_in * math.sin(a), 0))
    for i in range(n):
        j = (i + 1) % n
        fs.append((i, n + i, n + j, j))
    o = mesh_obj(name, vs, fs, mat, parent)
    o.data.shade_flat()          # long thin radial quads streak when smooth-shaded
    solidify(o, depth); bevel(o, min(0.018, depth * 0.15), 3)
    return o

# ---------------- scene graph ----------------
root = empty('Orb')
drive(root, 'location', 2, '0.03*sin(T*tau)')                       # gentle float
drive(root, 'rotation_euler', 2, '0.05*sin(T*tau)')

# the mechanism faces the camera at a three-quarter angle
mech = empty('Mech', root, rot=(math.radians(68), 0, math.radians(-24)))
drive(mech, 'rotation_euler', 0, f'{math.radians(68)}+0.04*sin(T*tau+1)')

# Parts are built from ChatGPT's v2 face textures (assets/source/orb-faces/v2/): each face's alpha is traced into
# a solid of real thickness; its base color, height (bump) and roughness go on the front and back, and its
# outer-edge strip wraps the sides. Face PNGs are 2048 square with the part's outer diameter at 90% of the width.
FACES = os.path.join(ROOT, 'assets', 'source', 'orb-faces', 'v2')

def face_img(stem, non_color=False):
    im = bpy.data.images.load(os.path.join(FACES, stem + '.png'), check_existing=True)
    if non_color: im.colorspace_settings.name = 'Non-Color'
    return im

def concentric_brush(nt, scale):
    """Fine concentric lines (brushing that follows the circle), as a 0..1 value."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    cmb = nt.nodes.new('ShaderNodeCombineXYZ')
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    xy = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sep.outputs['X'], xy.inputs['X']); nt.links.new(sep.outputs['Y'], xy.inputs['Y'])
    nt.links.new(xy.outputs[0], ln.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 4
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = scale
    nt.links.new(ln.outputs['Value'], mul.inputs[0])
    nt.links.new(mul.outputs[0], cmb.inputs['X'])
    ang = nt.nodes.new('ShaderNodeMath'); ang.operation = 'ARCTAN2'
    nt.links.new(sep.outputs['Y'], ang.inputs[0]); nt.links.new(sep.outputs['X'], ang.inputs[1])
    am = nt.nodes.new('ShaderNodeMath'); am.operation = 'MULTIPLY'; am.inputs[1].default_value = 0.6
    nt.links.new(ang.outputs[0], am.inputs[0]); nt.links.new(am.outputs[0], cmb.inputs['Y'])
    nt.links.new(cmb.outputs[0], nz.inputs['Vector'])
    return nz.outputs['Fac']

def face_mat(name, stem, relief, tint_to=None, tint_k=0.0, brush=0.15, rough_lo=0.12, rough_hi=0.6):
    """Metal from one ChatGPT face: base color, roughness and height through the mesh's planar UVs.
    Circular anisotropy and fine concentric bump give it real brushed highlights under Blender's lights."""
    m, nt, out = node_mat(name)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Anisotropic'].default_value = 0.55
    tg = nt.nodes.new('ShaderNodeTangent'); tg.direction_type = 'RADIAL'; tg.axis = 'Z'
    nt.links.new(tg.outputs[0], b.inputs['Tangent'])
    uv = nt.nodes.new('ShaderNodeUVMap')
    col = nt.nodes.new('ShaderNodeTexImage'); col.image = face_img(stem + '-basecolor')
    rgh = nt.nodes.new('ShaderNodeTexImage'); rgh.image = face_img(stem + '-roughness', True)
    hgt = nt.nodes.new('ShaderNodeTexImage'); hgt.image = face_img(stem + '-height', True)
    for t in (col, rgh, hgt):
        t.extension = 'EXTEND'; nt.links.new(uv.outputs['UV'], t.inputs['Vector'])
    color = col.outputs['Color']
    if tint_to:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['Factor'].default_value = tint_k
        mx.inputs['B'].default_value = (*tint_to, 1); nt.links.new(color, mx.inputs['A']); color = mx.outputs['Result']
    nt.links.new(color, b.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value = rough_lo; rr.inputs['To Max'].default_value = rough_hi
    nt.links.new(rgh.outputs['Color'], rr.inputs['Value']); nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Distance'].default_value = relief
    nt.links.new(hgt.outputs['Color'], bp.inputs['Height'])
    bp2 = nt.nodes.new('ShaderNodeBump'); bp2.inputs['Strength'].default_value = brush; bp2.inputs['Distance'].default_value = 0.002
    nt.links.new(concentric_brush(nt, 900), bp2.inputs['Height']); nt.links.new(bp.outputs['Normal'], bp2.inputs['Normal'])
    nt.links.new(bp2.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

def edge_mat(name, stem, tint_to=None, tint_k=0.0):
    """Side walls: ChatGPT's outer-edge strip, U once round the part, V across the thickness."""
    m, nt, out = node_mat(name)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = 0.28
    b.inputs['Anisotropic'].default_value = 0.6
    tg = nt.nodes.new('ShaderNodeTangent'); tg.direction_type = 'RADIAL'; tg.axis = 'Z'
    nt.links.new(tg.outputs[0], b.inputs['Tangent'])
    uv = nt.nodes.new('ShaderNodeUVMap')
    col = nt.nodes.new('ShaderNodeTexImage'); col.image = face_img(stem + '-outer-edge-basecolor'); col.extension = 'REPEAT'
    nt.links.new(uv.outputs['UV'], col.inputs['Vector'])
    color = col.outputs['Color']
    if tint_to:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['Factor'].default_value = tint_k
        mx.inputs['B'].default_value = (*tint_to, 1); nt.links.new(color, mx.inputs['A']); color = mx.outputs['Result']
    nt.links.new(color, b.inputs['Base Color'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

def face_part(name, stem, diameter, thick, parent, back_stem=None, relief=0.02, N=512, loc=(0, 0, 0), **look):
    """Trace the face's alpha (at the 0.5 iso line) into a flat mesh, then give it a back and side walls.
    Front faces +Z (material 0), back faces at z = -thick (material 1), sides (material 2)."""
    import numpy as np
    img = face_img(stem + '-basecolor')
    W, H = img.size
    px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px)
    alpha = px.reshape(H, W, 4)[..., 3]                    # rows run bottom to top in Blender
    s_ = W // N
    cells = alpha[:N * s_, :N * s_].reshape(N, s_, N, s_).mean((1, 3))
    keep = cells > 0.5
    pad = np.pad(cells, 1)
    C = (pad[:-1, :-1] + pad[1:, :-1] + pad[:-1, 1:] + pad[1:, 1:]) / 4       # value at each cell corner
    gy, gx = np.gradient(C)
    # outline = directed cell edges between kept and empty cells, counter-clockwise around the solid
    kp = np.pad(keep, 1); M = N + 1
    ii, jj = np.nonzero(keep)
    c = lambda i, j: i * M + j
    sides = [(~kp[ii, jj + 1], c(ii, jj), c(ii, jj + 1)),              # below empty: bottom edge, left to right
             (~kp[ii + 1, jj + 2], c(ii, jj + 1), c(ii + 1, jj + 1)),  # right empty
             (~kp[ii + 2, jj + 1], c(ii + 1, jj + 1), c(ii + 1, jj)),  # above empty
             (~kp[ii + 1, jj], c(ii + 1, jj), c(ii, jj))]               # left empty
    ea = np.concatenate([s0[m] for m, s0, s1 in sides]); eb = np.concatenate([s1[m] for m, s0, s1 in sides])
    corners, inv = np.unique(np.r_[ea, eb], return_inverse=True)
    ea, eb = inv[:len(ea)], inv[len(ea):]
    ci, cj = corners // M, corners % M
    # slide each outline corner onto the 0.5 iso line of the alpha, then smooth along the outline
    g2 = gx[ci, cj] ** 2 + gy[ci, cj] ** 2 + 1e-9
    k = (0.5 - C[ci, cj]) / g2
    dx, dy = k * gx[ci, cj], k * gy[ci, cj]
    n = np.hypot(dx, dy); f_ = np.minimum(1, 0.7 / np.maximum(n, 1e-9))
    P = np.stack([cj + dx * f_, ci + dy * f_], 1)
    nxt = np.arange(len(P)); prv = np.arange(len(P)); nxt[ea] = eb; prv[eb] = ea
    for _ in range(3):
        P = 0.5 * P + 0.25 * (P[nxt] + P[prv])
    canvas = diameter / 0.9
    verts = [((x / N - 0.5) * canvas, (y / N - 0.5) * canvas, 0.0) for x, y in P]
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bv = [bm.verts.new(v) for v in verts]
    for a_, b_ in zip(ea, eb):
        if a_ != b_: bm.edges.new((bv[a_], bv[b_]))
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=bm.edges[:])
    for f in bm.faces:
        if f.normal.z < 0: f.normal_flip()
    bm.faces.ensure_lookup_table()
    front = bm.faces[:]
    rim = []
    for f in front:
        for l in f.loops:
            if len(l.edge.link_faces) == 1: rim.append((l.vert, l.link_loop_next.vert))
    back = {v: bm.verts.new((v.co.x, v.co.y, -thick)) for v in bm.verts[:]}
    for f in front:
        nf = bm.faces.new([back[v] for v in reversed(f.verts)]); nf.material_index = 1
    for a_, b_ in rim:
        sf = bm.faces.new((b_, a_, back[a_], back[b_])); sf.material_index = 2
    uvl = bm.loops.layers.uv.new('UV')
    for f in bm.faces:
        if f.material_index < 2:
            for l in f.loops:
                l[uvl].uv = (l.vert.co.x / canvas + 0.5, l.vert.co.y / canvas + 0.5)
        else:
            us = [(math.atan2(l.vert.co.y, l.vert.co.x) / TAU) % 1.0 for l in f.loops]
            if max(us) - min(us) > 0.5: us = [u + 1 if u < 0.5 else u for u in us]
            for l, u in zip(f.loops, us):
                l[uvl].uv = (u, (l.vert.co.z + thick) / thick)
    bm.to_mesh(me); bm.free()
    me.shade_smooth()
    if hasattr(me, 'set_sharp_from_angle'): me.set_sharp_from_angle(angle=math.radians(35))
    me.materials.append(face_mat(name + '_front', stem, relief, **look))
    me.materials.append(face_mat(name + '_back', back_stem or stem, relief, **look))
    me.materials.append(edge_mat(name + '_edge', stem.replace('-front', ''), look.get('tint_to'), look.get('tint_k', 0.0)))
    o = link(bpy.data.objects.new(name, me), parent); o.location = loc
    bevel(o, min(0.012, thick * 0.12), 2, angle=40)
    return o

# -- large gear behind the bearing: 40 teeth (one at 0°, every 9°), 7 spokes
RG = 0.8                                    # small enough that the pinion clears the turning brass ring
gearL = empty('GearL', mech, loc=(0, 0, -0.16))
GEAR_PHASE = math.radians(5.5)            # puts a tooth gap toward the pinion at -35°
drive(gearL, 'rotation_euler', 2, f'{GEAR_PHASE}-T*tau*{S["gear"]}')
face_part('gear', 'large-gear-front', 2 * RG, 0.08, gearL, relief=0.02)

# -- pinion: 12 teeth (one at 0°, every 30°); pitch radii in the 40:12 ratio so the teeth really mesh
RP = RG * 0.944 * 12 / 40 / 0.8945
PA = math.radians(-35)
DIST = 0.944 * RG + 0.8945 * RP
pin = empty('Pinion', mech, loc=(DIST * math.cos(PA), DIST * math.sin(PA), -0.16))
drive(pin, 'rotation_euler', 2, f'{math.radians(25)}+T*tau*{S["gear"]}*40/12')
face_part('pinion', 'steel-pinion-front', 2 * RP, 0.16, pin, relief=0.025, tint_to=(0.34, 0.32, 0.3), tint_k=0.35)

# -- bearing housing, the core sits in its bore (bore = 30% of its radius)
RB = 0.56
bear = empty('Bearing', mech, loc=(0, 0, 0.1))
face_part('bearing', 'bronze-bearing-front', 2 * RB, 0.18, bear, back_stem='bronze-bearing-back', relief=0.03)

# -- core: glowing amber dome in the bearing's bore, with a light inside
core = empty('Core', mech, loc=(0, 0, 0.06))
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.3 * RB * 0.97)
me = bpy.data.meshes.new('core'); bm.to_mesh(me); bm.free(); me.shade_smooth(); me.materials.append(M_CORE)
link(bpy.data.objects.new('core', me), core)
L = bpy.data.lights.new('coreLight', 'POINT'); L.color = (1.0, 0.5, 0.15); L.shadow_soft_size = 0.15
link(bpy.data.objects.new('coreLight', L), core).location = (0, 0, 0.35)
pulse = f'({S["glow"]}*(1+{S["glow_p"]}*sin(T*tau*{S["beats"]})))'
drive(L, 'energy', -1, f'45*{pulse}')
drive(CORE_K.inputs[1], 'default_value', -1, f'6*{pulse}')
drive(CORE_NZ.inputs['W'], 'default_value', -1, 'sin(T*tau)*0.6') if 'W' in CORE_NZ.inputs else None
if hasattr(CORE_NZ, 'noise_dimensions'): CORE_NZ.noise_dimensions = '4D'

# -- shell: five large flat steel hexagons round the core. Closed, they huddle into a rough orb around it;
# opening pushes each plate outward along its own direction. The front stays open so the core shows.
from mathutils import Matrix
M_EDGEGLOW, _ = glow_mat('EdgeGlow', (1.0, 0.42, 0.1), 5)
M_PLATE = pbr_metal('PlateSteel', 'steel', (0.8, 0.78, 0.76), 0.16, 0.32, aniso=0.6, bump=0.08, scale=0.8,
                    edge=(0.95, 0.93, 0.9))
M_PLATE_IN = pbr_metal('PlateInset', 'steel', (0.42, 0.41, 0.4), 0.22, 0.4, aniso=0.5, bump=0.1, scale=1.2)
M_RIVET = plain_metal('RivetSteel', (0.75, 0.73, 0.7), 0.25)
RSH, RH = 1.8, 1.1                                    # shell radius, hex radius
# dodecahedron layout: front ring of 5 (52° from the view axis), back ring of 5 offset 36° (128°), one at the back.
# The front face (0°) is left open so the core shows.
dirs = [(math.radians(52), TAU * k / 5 + math.pi / 2) for k in range(5)] +        [(math.radians(122), TAU * (k + 0.5) / 5 + math.pi / 2) for k in range(5)] + [(math.pi, 0.0)]
panels = []
for al, th in dirs:
    n = Vector((math.sin(al) * math.cos(th), -math.cos(al), math.sin(al) * math.sin(th)))
    c = n * RSH
    ref = Vector((0, -1, 0)) if abs(n.y) < 0.99 else Vector((1, 0, 0))
    u = ref.cross(n).normalized(); w = n.cross(u)
    panels.append([c + RH * (math.cos(b) * u + math.sin(b) * w) for b in [TAU * i / 6 for i in range(6)]])
scale = 1.0
GAP, PT = 1.0, 0.08                                   # plate thickness

def plate(name, pts, parent):
    """Flat sharp plate in its own frame (z = outward normal), lightly chamfered, raised gunmetal inset,
    rivets near the corners and a glowing outline on the outer face."""
    o = mesh_obj(name, pts, [tuple(range(len(pts)))], M_PLATE, parent)
    o.data.shade_flat(); solidify(o, PT, -1); bevel(o, 0.008, 1, angle=30)
    ins = mesh_obj(name + '_inset', [q * 0.62 for q in pts], [tuple(range(len(pts)))], M_PLATE_IN, o)
    ins.data.shade_flat(); ins.location = (0, 0, 0.012); solidify(ins, 0.024); bevel(ins, 0.006, 1, angle=30)
    for q in pts:
        rivet(o, q * 0.8, (0, 0, 1), 0.03, M_RIVET)
    cu = bpy.data.curves.new(name + '_glow', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.008
    sp = cu.splines.new('POLY'); sp.points.add(len(pts)); sp.use_cyclic_u = False
    for i, q in enumerate(pts + [pts[0]]):
        sp.points[i].co = (q.x * 0.985, q.y * 0.985, 0.002, 1)
    cu.materials.append(M_EDGEGLOW)
    link(bpy.data.objects.new(name + '_glow', cu), o)
    return o

shell = empty('Shell', root)
drive(shell, 'rotation_euler', 1, f'T*tau*{S["shell"]}/5')     # 5 identical plates: 1/5 turn loops seamlessly
CAM = Vector((0, -1, 0))
k = 0
for pts in panels:
    pts = [q * scale for q in pts]
    c = sum(pts, Vector()) / len(pts); n = c.normalized()
    u = (pts[0] - c).normalized(); w = n.cross(u)
    basis = Matrix((u, w, n)).transposed()
    local = [Vector(((q - c).dot(u) * GAP, (q - c).dot(w) * GAP, 0)) for q in pts]
    h = empty(f'panel{k}', shell, loc=tuple(c), rot=basis.to_euler())
    # each plate slides out along its own normal; a little per-plate variation so they don't move as one
    var = 1 + 0.18 * math.sin(k * 2.39)
    drive(h, 'location', 0, f'{c.x}+{n.x}*{var}*({S["open"]}+{S["open_p"]}*(0.5+0.5*sin(T*tau*{max(1, S["beats"] // 2)}+{k * 0.7})))')
    drive(h, 'location', 1, f'{c.y}+{n.y}*{var}*({S["open"]}+{S["open_p"]}*(0.5+0.5*sin(T*tau*{max(1, S["beats"] // 2)}+{k * 0.7})))')
    drive(h, 'location', 2, f'{c.z}+{n.z}*{var}*({S["open"]}+{S["open_p"]}*(0.5+0.5*sin(T*tau*{max(1, S["beats"] // 2)}+{k * 0.7})))')
    plate(f'plate{k}', local, h)
    k += 1
print('shell plates:', k)

# ---------------- camera, lights, world ----------------
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 85
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 12.6; cam_d.dof.aperture_fstop = 5.6
cam = link(bpy.data.objects.new('cam', cam_d))
cam.location = (0, -13, 1.2); cam.rotation_euler = (math.radians(84.7), 0, 0)
sc.camera = cam

def area(name, loc, color, energy, size):
    l = bpy.data.lights.new(name, 'AREA'); l.color = color; l.energy = energy; l.size = size
    o = link(bpy.data.objects.new(name, l)); o.location = loc
    o.rotation_euler = (-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area('key', (-5, -7, 6), (1.0, 0.94, 0.88), 1500, 5)    # soft warm-white key, upper left
area('fill', (7, -7, -2), (0.6, 0.7, 0.95), 500, 8)      # cool fill, lower right
area('rimR', (6, 6, 3), (1.0, 0.55, 0.22), 1400, 2)     # copper rims from behind
area('rimL', (-6, 6, -3), (1.0, 0.6, 0.3), 1000, 2)
area('top', (0, 2, 8), (1.0, 0.85, 0.7), 700, 4)

w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.008, 0.006, 0.006, 1)
bg.inputs['Strength'].default_value = 1
# reflections see a soft studio (bright above, warm below) so metal isn't black; the camera still sees the dark bg
wn = w.node_tree
grad = wn.nodes.new('ShaderNodeTexGradient'); tco = wn.nodes.new('ShaderNodeTexCoord')
sepz = wn.nodes.new('ShaderNodeSeparateXYZ'); wn.links.new(tco.outputs['Generated'], sepz.inputs[0])
rampw = wn.nodes.new('ShaderNodeValToRGB')
rampw.color_ramp.elements[0].position = 0.35; rampw.color_ramp.elements[0].color = (0.05, 0.03, 0.02, 1)
rampw.color_ramp.elements[1].position = 0.75; rampw.color_ramp.elements[1].color = (0.55, 0.52, 0.5, 1)
mz = wn.nodes.new('ShaderNodeMath'); mz.operation = 'MULTIPLY_ADD'; mz.inputs[1].default_value = 0.5; mz.inputs[2].default_value = 0.5
nz_ = wn.nodes.new('ShaderNodeVectorMath'); nz_.operation = 'NORMALIZE'
wn.links.new(tco.outputs['Generated'], nz_.inputs[0])
sep2 = wn.nodes.new('ShaderNodeSeparateXYZ'); wn.links.new(nz_.outputs[0], sep2.inputs[0])
wn.links.new(sep2.outputs['Z'], mz.inputs[0]); wn.links.new(mz.outputs[0], rampw.inputs['Fac'])
studio = wn.nodes.new('ShaderNodeBackground'); studio.inputs['Strength'].default_value = 1.0
wn.links.new(rampw.outputs['Color'], studio.inputs['Color'])
lp = wn.nodes.new('ShaderNodeLightPath'); mixw = wn.nodes.new('ShaderNodeMixShader')
wn.links.new(lp.outputs['Is Camera Ray'], mixw.inputs['Fac'])
wn.links.new(studio.outputs[0], mixw.inputs[1]); wn.links.new(bg.outputs[0], mixw.inputs[2])
wn.links.new(mixw.outputs[0], wn.nodes['World Output'].inputs['Surface'])

# ---------------- render settings ----------------
r = sc.render
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
r.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
r.resolution_x = r.resolution_y = RES
r.film_transparent = '--transparent' in argv
sc.view_settings.view_transform = 'AgX'
looks = [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items_static]
sc.view_settings.look = 'AgX - Punchy' if 'AgX - Punchy' in looks else 'None'
ee = sc.eevee
for attr, val in [('taa_render_samples', 64), ('use_raytracing', True), ('use_shadows', True),
                  ('ray_tracing_method', 'SCREEN'), ('use_fast_gi', True)]:
    try:
        if hasattr(ee, attr): setattr(ee, attr, val)
    except Exception: pass
if hasattr(ee, 'ray_tracing_options'):
    ee.ray_tracing_options.resolution_scale = '1'

try:   # bloom + a soft glow around the core (Blender 4.2+ compositor API)
    ng = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
    sc.compositing_node_group = ng
    rl = ng.nodes.new('CompositorNodeRLayers')
    gl = ng.nodes.new('CompositorNodeGlare')
    outn = ng.nodes.new('NodeGroupOutput')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    for key, v in [('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 1.5), ('Strength', 0.25), ('Size', 0.55)]:
        if key in gl.inputs: gl.inputs[key].default_value = v
    if hasattr(gl, 'glare_type'): gl.glare_type = 'BLOOM'
    ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
    ng.links.new(gl.outputs['Image'], outn.inputs[0])
except Exception as ex:
    print('bloom setup skipped:', ex)

os.makedirs(os.path.join(OUT, STATE), exist_ok=True)
if '--save' in argv:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'mech_orb.blend'))
if STILL >= 0:
    sc.frame_set(STILL)
    r.filepath = os.path.join(OUT, f'still_{STATE}_{STILL:03d}.png')
    bpy.ops.render.render(write_still=True)
else:
    r.filepath = os.path.join(OUT, STATE, 'f_')
    r.image_settings.file_format = 'PNG'
    bpy.ops.render.render(animation=True)
