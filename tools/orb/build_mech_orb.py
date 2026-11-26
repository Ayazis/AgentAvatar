# Blender scene: the clockwork orb from ChatGPT's parts (assets/source/orb-parts/), built as real geometry so
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
STATES = {
    'off':      dict(gear=0, gimbal=0.0, open=0.0,  open_p=0.0,  glow=0.15, glow_p=0.0, beats=1),
    'idle':     dict(gear=1, gimbal=0.5, open=0.05, open_p=0.03, glow=1.0,  glow_p=0.3, beats=2),
    'thinking': dict(gear=3, gimbal=1.0, open=0.25, open_p=0.05, glow=1.5,  glow_p=0.4, beats=6),
    'talking':  dict(gear=2, gimbal=0.7, open=0.45, open_p=0.25, glow=2.0,  glow_p=0.8, beats=12),
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

# Proportions below are measured from ChatGPT's face-on parts (assets/orb-parts/*-face.png, gear-large.png):
# each part is described as fractions of its own outer radius, so it keeps the art's weight at any size.

# -- large spoked gear behind the bearing: 36 teeth, heavy rim, 7 broad spokes, bolted hub
RG = 0.98
gearL = empty('GearL', mech, loc=(0, 0, -0.2))
drive(gearL, 'rotation_euler', 2, f'-T*tau*{S["gear"]}')
gear_disc('gear_rim', 0.85 * RG, RG, 36, 0.62 * RG, 0.1 * RG, M_BRONZE, gearL)   # rim .62-.85, teeth .85-1
hub = lathe('gear_hub', [(0.09, -0.07), (0.25 * RG, -0.07), (0.25 * RG, 0.06), (0.2 * RG, 0.1), (0.09, 0.1)],
            M_BRONZE, gearL); bevel(hub, 0.015, 3)
lathe('gear_bore', box_profile(0.0, 0.09, -0.071, 0.101), M_HOLE, gearL)
def spoke(parent, a):
    """Tapered spoke from hub to rim, wide like the art's (windows between them are smaller than the spokes)."""
    r0, r1, w0, w1, d = 0.22 * RG, 0.66 * RG, 0.15 * RG, 0.2 * RG, 0.08 * RG
    vs = [(r0, -w0 / 2, -d / 2), (r1, -w1 / 2, -d / 2), (r1, w1 / 2, -d / 2), (r0, w0 / 2, -d / 2),
          (r0, -w0 / 2, d / 2), (r1, -w1 / 2, d / 2), (r1, w1 / 2, d / 2), (r0, w0 / 2, d / 2)]
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    o = mesh_obj('spoke', vs, fs, M_BRONZE, parent); o.rotation_euler = (0, 0, a); bevel(o, 0.02, 3)
for k in range(7):
    a = TAU * k / 7
    spoke(gearL, a)
    rivet(gearL, (0.17 * RG * math.cos(a + TAU / 14), 0.17 * RG * math.sin(a + TAU / 14), 0.1), (0, 0, 1), 0.022, M_BRASS)
    rivet(gearL, (0.735 * RG * math.cos(a), 0.735 * RG * math.sin(a), 0.05 * RG), (0, 0, 1), 0.026, M_BRASS)

# -- pinion: 12 blocky teeth, thick body, stepped hub and a deep bore (turns 3x as fast, so the loop closes)
RP = 0.27
pa = math.radians(-35)
pin = empty('Pinion', mech, loc=(1.15 * math.cos(pa), 1.15 * math.sin(pa), -0.2))
drive(pin, 'rotation_euler', 2, f'T*tau*{S["gear"] * 3}+{TAU / 24}')
gear_disc('pinion_teeth', 0.78 * RP, RP, 12, 0.3 * RP, 0.5 * RP, M_STEEL, pin, blocky=True)
ph = lathe('pinion_hub', [(0.3 * RP, -0.3 * RP), (0.64 * RP, -0.3 * RP), (0.64 * RP, 0.3 * RP), (0.58 * RP, 0.34 * RP),
                          (0.48 * RP, 0.34 * RP), (0.46 * RP, 0.42 * RP), (0.36 * RP, 0.44 * RP), (0.3 * RP, 0.42 * RP)],
           M_STEEL, pin); bevel(ph, 0.008, 2)
lathe('pinion_bore', box_profile(0.0, 0.3 * RP, -0.31 * RP, 0.43 * RP), M_HOLE, pin)

# -- bearing housing with the core in its bore: chunky, solid metal from .33 to .95 of its radius
RB = 0.62
bear = empty('Bearing', mech)
race = lathe('bear_race', [(0.33 * RB, -0.07), (0.45 * RB, -0.07), (0.45 * RB, 0.15), (0.42 * RB, 0.18),
                           (0.36 * RB, 0.18), (0.33 * RB, 0.15)], M_BRASS, bear); bevel(race, 0.012, 3)
lathe('bear_glow', box_profile(0.32 * RB, 0.335 * RB, -0.05, 0.16), M_RACE, bear)
plate = lathe('bear_plate', [(0.45 * RB, -0.07), (0.6 * RB, -0.07), (0.6 * RB, 0.1), (0.57 * RB, 0.12),
                             (0.45 * RB, 0.12)], M_BRONZE, bear); bevel(plate, 0.012, 3)
lathe('bear_slot', box_profile(0.6 * RB, 0.72 * RB, -0.07, 0.02), M_DARK, bear)        # recessed slotted band
for k in range(6):                                                                      # bridges across the slot
    a = TAU * k / 6 + TAU / 12
    br = box('bridge', (0.13 * RB, 0.07, 0.07), M_BRONZE, bear)
    br.location = (0.66 * RB * math.cos(a), 0.66 * RB * math.sin(a), 0.0); br.rotation_euler = (0, 0, a); bevel(br, 0.01, 2)
outer = lathe('bear_outer', [(0.72 * RB, -0.09), (0.95 * RB, -0.09), (0.95 * RB, 0.06), (0.9 * RB, 0.13),
                             (0.72 * RB, 0.13)], M_BRONZE, bear); bevel(outer, 0.015, 3)
for k in range(3):                                                                      # three bolt lugs
    a = TAU * k / 3 + math.pi / 2
    lug = lathe('lug', [(0.0, -0.09), (0.15 * RB, -0.09), (0.15 * RB, 0.1), (0.12 * RB, 0.14), (0.0, 0.14)], M_BRONZE,
                bear, segs=48, loc=(0.92 * RB * math.cos(a), 0.92 * RB * math.sin(a), 0)); bevel(lug, 0.012, 3)
    rivet(bear, (0.92 * RB * math.cos(a), 0.92 * RB * math.sin(a), 0.14), (0, 0, 1), 0.04, M_BRASS)
for k in range(16):
    a = TAU * (k + 0.5) / 16
    rivet(bear, (0.835 * RB * math.cos(a), 0.835 * RB * math.sin(a), 0.13), (0, 0, 1), 0.022, M_BRASS)
for k in range(12):
    a = TAU * k / 12
    rivet(bear, (0.52 * RB * math.cos(a), 0.52 * RB * math.sin(a), 0.12), (0, 0, 1), 0.017, M_BRASS)

# -- core: glowing amber dome sitting in the bearing's bore, with a light inside
core = empty('Core', mech, loc=(0, 0, 0.06))
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.2)
me = bpy.data.meshes.new('core'); bm.to_mesh(me); bm.free(); me.shade_smooth(); me.materials.append(M_CORE)
link(bpy.data.objects.new('core', me), core)
L = bpy.data.lights.new('coreLight', 'POINT'); L.color = (1.0, 0.5, 0.15); L.shadow_soft_size = 0.18
link(bpy.data.objects.new('coreLight', L), core).location = (0, 0, 0.3)
pulse = f'({S["glow"]}*(1+{S["glow_p"]}*sin(T*tau*{S["beats"]})))'
drive(L, 'energy', -1, f'45*{pulse}')
drive(CORE_K.inputs[1], 'default_value', -1, f'6*{pulse}')
drive(E_RACE.inputs['Strength'], 'default_value', -1, f'2.5*{pulse}')
drive(CORE_NZ.inputs['W'], 'default_value', -1, 'sin(T*tau)*0.6') if 'W' in CORE_NZ.inputs else None
if hasattr(CORE_NZ, 'noise_dimensions'): CORE_NZ.noise_dimensions = '4D'

# -- gimbal: two heavy washers (band = 20% of radius, as in the art), big enough to clear the pinion
gim = empty('Gimbal', root, rot=(math.radians(20), math.radians(-15), math.radians(10)))
outerG = empty('OuterG', gim)
drive(outerG, 'rotation_euler', 0, f'1.05+{0.45 * S["gimbal"]}*sin(T*tau)')
R1 = 2.2; W1, T1 = 0.2 * R1, 0.07 * R1                 # steel: outer radius, radial band, thickness
ring1 = lathe('ring_steel', box_profile(R1 - W1, R1, -T1 / 2, T1 / 2), M_STEEL, outerG, segs=192)
bevel(ring1, 0.025, 4)
for k in range(16):
    a = TAU * (k + 0.5) / 16
    for zs in (1, -1):
        hole(outerG, ((R1 - W1 / 2) * math.cos(a), (R1 - W1 / 2) * math.sin(a), zs * T1 / 2), (0, 0, zs), 0.045, 0.02)
innerG = empty('InnerG', outerG)
drive(innerG, 'rotation_euler', 1, f'0.7+{0.6 * S["gimbal"]}*sin(T*tau*2+0.8)')
R2 = 1.74; W2, T2 = 0.2 * R2, 0.07 * R2                # bronze, riveted on both faces
ring2 = lathe('ring_bronze', box_profile(R2 - W2, R2, -T2 / 2, T2 / 2), M_BRONZE, innerG, segs=192)
bevel(ring2, 0.025, 4)
for k in range(14):
    a = TAU * k / 14
    for zs in (1, -1):
        rivet(innerG, ((R2 - W2 / 2) * math.cos(a), (R2 - W2 / 2) * math.sin(a), zs * T2 / 2), (0, 0, zs), 0.045, M_BRASS)

def axle(parent, direction, r0, r1, rad, mat, collars=()):
    d = Vector(direction).normalized()
    e = empty('axle', parent, rot=d.to_track_quat('Z', 'Y').to_euler())
    c = cyl('shaft', rad, r1 - r0, mat, e, loc=(0, 0, (r0 + r1) / 2), verts=24); bevel(c, rad * 0.3, 2)
    for z, cr, cd in collars:
        cc = cyl('collar', cr, cd, M_BRASS, e, loc=(0, 0, z), verts=32); bevel(cc, 0.01, 2)
    return e
# pins between the rings (ride with the outer ring), and the outer ring's axle out to the shell
for s in (1, -1):
    axle(outerG, (0, s, 0), R2 - 0.05, R1 - W1 + 0.05, 0.05, M_STEEL, [((R2 + R1 - W1) / 2, 0.08, 0.06)])
    axle(gim, (s, 0, 0), R1 - 0.1, 2.62, 0.06, M_STEEL,
         [(R1 + 0.07, 0.1, 0.08), (2.42, 0.085, 0.07), (2.56, 0.11, 0.09)])

# -- shell blades: five curved sphere segments around the view axis, each with a rolled lip, opening outward
def blade(name, R, span, lat0, lat1, mat, parent, n=72, m=14, hook=0.0):
    """Sphere segment centred on +X. Longitude runs in the XZ plane (the view plane, since the camera looks
    along +Y), latitude toward ±Y (negative = toward the camera). Tapers to points at both ends, sharper at u=1."""
    vs, fs, lip = [], [], []
    for i in range(n + 1):
        u = i / n
        lon = (u - 0.5) * span
        taper = math.sin(math.pi * min(1.0, u * 1.15)) ** 0.75 * (1 - 0.55 * u) + 0.02   # broad heel, sharp tip
        mid = (lat0 + lat1) / 2 + hook * (u - 0.35) ** 2 * 2.5      # ends sweep inward: a crescent on screen
        half = (lat1 - lat0) / 2 * taper
        for j in range(m + 1):
            v = j / m
            lat = mid - half + 2 * half * v
            x = R * math.cos(lat) * math.cos(lon); z = R * math.cos(lat) * math.sin(lon); y = R * math.sin(lat)
            vs.append((x, y, z))
        lip.append(vs[-(m + 1)])        # front (lat-min) edge gets the rolled lip
    for i in range(n):
        for j in range(m):
            a = i * (m + 1) + j
            fs.append((a, a + m + 1, a + m + 2, a + 1))
    o = mesh_obj(name, vs, fs, mat, parent)
    solidify(o, 0.1, 1); bevel(o, 0.02, 3, angle=30)
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    cu = bpy.data.curves.new(name + '_lip', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.085; cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(lip) - 1)
    for i, q in enumerate(lip):
        t = math.sin(math.pi * i / (len(lip) - 1)) ** 0.5     # lip thins out at the tips
        sp.points[i].co = (*(Vector(q) * (1 - 0.012)), 1); sp.points[i].radius = max(t, 0.05)
    cu.materials.append(M_BLADE)
    link(bpy.data.objects.new(name + '_lip', cu), o)
    return o

shell = empty('Shell', root, rot=(math.radians(-6), 0, 0))
drive(shell, 'rotation_euler', 1, '0.06*sin(T*tau)')         # slow sway round the view axis
blade_specs = [  # angle round the view axis (deg, 0 = right, 90 = up), span (rad), lat range (rad), hook
    (150, 1.6, -0.72, -0.1, -0.5), (78, 1.0, -0.65, -0.12, -0.6), (18, 0.75, -0.7, -0.17, -0.7),
    (-50, 1.45, -0.8, -0.08, -0.5), (-125, 1.1, -0.65, -0.12, -0.55)]
open_expr = f'({S["open"]}+{S["open_p"]}*(0.5+0.5*sin(T*tau*{max(1, S["beats"] // 2)})))'
for k, (phi, span, l0, l1, hook) in enumerate(blade_specs):
    h = empty(f'bladeH{k}', shell, rot=(0, -math.radians(phi), 0))   # rotate +X round Y to angle phi
    piv = empty(f'bladeO{k}', h)
    drive(piv, 'location', 0, f'0.35*{open_expr}*{1 + 0.12 * math.sin(k * 2.1)}')   # push outward
    drive(piv, 'rotation_euler', 2, f'0.3*{open_expr}')                          # and swing back like a petal
    blade(f'blade{k}', 2.75, span, l0, l1, M_BLADE, piv, hook=hook)

# ---------------- camera, lights, world ----------------
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 85
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 15.6; cam_d.dof.aperture_fstop = 5.6
cam = link(bpy.data.objects.new('cam', cam_d))
cam.location = (0, -16, 1.5); cam.rotation_euler = (math.radians(84.65), 0, 0)
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
