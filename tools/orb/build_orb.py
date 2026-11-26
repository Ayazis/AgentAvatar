# Blender scene: an animated armillary orb matching
# assets/source/armillary-reference-v2/active-orb-mockup.png.
# Run:  blender -b -P tools/orb/build_orb.py -- [--frames N] [--res PX] [--still F] [--save]
# Renders PNG frames to tools/orb/out/frames/ (EEVEE). tools/orb/render.py wraps this and encodes mp4.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
FRAMES = arg('--frames', 144)
RES = arg('--res', 720)
STILL = arg('--still', -1)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
TAU = math.tau

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
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, nt, out

def metal(name, color, rough, rim=(1.0, 0.45, 0.08), rim_k=0.0, brushed=True):
    m, nt, out = node_mat(name)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = rough
    if brushed:
        b.inputs['Anisotropic'].default_value = 0.6
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (60, 1.5, 1.5)
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 8; nz.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeMapRange')
        ramp.inputs['To Min'].default_value = rough * 0.6; ramp.inputs['To Max'].default_value = rough * 1.5
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
        nt.links.new(nz.outputs['Fac'], ramp.inputs['Value'])
        nt.links.new(ramp.outputs['Result'], b.inputs['Roughness'])
    if rim_k > 0:
        lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.12
        pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 4.0
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = rim_k
        nt.links.new(lw.outputs['Facing'], pw.inputs[0])
        nt.links.new(pw.outputs[0], mul.inputs[0])
        b.inputs['Emission Color'].default_value = (*rim, 1)
        nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

def emissive(name, color, k):
    m, nt, out = node_mat(name)
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = k
    nt.links.new(e.outputs[0], out.inputs[0])
    return m, e

def denim():
    m, nt, out = node_mat('Denim')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = 0.85
    b.inputs['Sheen Weight'].default_value = 0.5
    b.inputs['Sheen Tint'].default_value = (0.5, 0.6, 1, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    # diagonal twill
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 260
    sin = nt.nodes.new('ShaderNodeMath'); sin.operation = 'SINE'
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 40; nz.inputs['Detail'].default_value = 8
    nt.links.new(tc.outputs['UV'], sep.inputs[0])
    nt.links.new(sep.outputs[0], add.inputs[0]); nt.links.new(sep.outputs[1], add.inputs[1])
    nt.links.new(add.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], sin.inputs[0])
    nt.links.new(tc.outputs['UV'], nz.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (0.025, 0.045, 0.16, 1)
    mix.inputs['B'].default_value = (0.09, 0.14, 0.38, 1)
    f = nt.nodes.new('ShaderNodeMath'); f.operation = 'MULTIPLY_ADD'
    f.inputs[1].default_value = 0.35; f.inputs[2].default_value = 0.0
    nt.links.new(sin.outputs[0], f.inputs[0])
    f2 = nt.nodes.new('ShaderNodeMath'); f2.operation = 'ADD'
    nt.links.new(f.outputs[0], f2.inputs[0]); nt.links.new(nz.outputs['Fac'], f2.inputs[1])
    nt.links.new(f2.outputs[0], mix.inputs['Factor'])
    # stitched orange hem near both edges (uv.y near 0.06 and 0.94)
    sepy = sep.outputs[1]
    d1 = nt.nodes.new('ShaderNodeMath'); d1.operation = 'PINGPONG'; d1.inputs[1].default_value = 0.5
    nt.links.new(sepy, d1.inputs[0])  # distance to nearer edge -> 0..0.5
    band = nt.nodes.new('ShaderNodeMapRange'); band.interpolation_type = 'SMOOTHSTEP'
    # use two compares for a thin line at 0.06
    cmp = nt.nodes.new('ShaderNodeMath'); cmp.operation = 'COMPARE'
    cmp.inputs[1].default_value = 0.06; cmp.inputs[2].default_value = 0.006
    nt.links.new(d1.outputs[0], cmp.inputs[0])
    dash = nt.nodes.new('ShaderNodeMath'); dash.operation = 'MULTIPLY'; dash.inputs[1].default_value = 180
    nt.links.new(sep.outputs[0], dash.inputs[0])
    dsin = nt.nodes.new('ShaderNodeMath'); dsin.operation = 'SINE'
    nt.links.new(dash.outputs[0], dsin.inputs[0])
    dgt = nt.nodes.new('ShaderNodeMath'); dgt.operation = 'GREATER_THAN'; dgt.inputs[1].default_value = -0.2
    nt.links.new(dsin.outputs[0], dgt.inputs[0])
    st = nt.nodes.new('ShaderNodeMath'); st.operation = 'MULTIPLY'
    nt.links.new(cmp.outputs[0], st.inputs[0]); nt.links.new(dgt.outputs[0], st.inputs[1])
    mix2 = nt.nodes.new('ShaderNodeMix'); mix2.data_type = 'RGBA'
    mix2.inputs['B'].default_value = (0.9, 0.38, 0.08, 1)
    nt.links.new(mix.outputs['Result'], mix2.inputs['A'])
    nt.links.new(st.outputs[0], mix2.inputs['Factor'])
    nt.links.new(mix2.outputs['Result'], b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
    nt.links.new(f2.outputs[0], bump.inputs['Height'])
    nt.links.new(bump.outputs[0], b.inputs['Normal'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

M_STEEL = metal('Steel', (0.58, 0.55, 0.52), 0.3, rim_k=2.5)
M_RING = metal('RingSteel', (0.55, 0.53, 0.52), 0.32, rim_k=0.6)
M_COPPER = metal('Copper', (0.85, 0.42, 0.2), 0.3, brushed=False, rim_k=1.5)
M_DARK = metal('DarkIron', (0.18, 0.16, 0.15), 0.4, brushed=False)
M_HOT, E_HOT = emissive('Hot', (1.0, 0.42, 0.06), 40)
M_EDGE, _ = emissive('Edge', (1.0, 0.38, 0.06), 12)
M_EDGE2, _ = emissive('Edge2', (1.0, 0.4, 0.1), 3)
M_CYAN, E_CYAN = emissive('Cyan', (0.1, 0.75, 1.0), 14)
M_CYANLINE, _ = emissive('CyanLine', (0.05, 0.5, 0.9), 1.2)
M_DENIM = denim()

# ---------------- mesh helpers ----------------
def mesh_obj(name, verts, faces, mat, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if smooth:
        me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o

def add_mod_solid(o, t):
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = t; s.offset = 0
    b = o.modifiers.new('bevel', 'BEVEL'); b.width = t * 0.3; b.segments = 2; b.limit_method = 'ANGLE'

def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc; e.rotation_euler = rot
    if parent: e.parent = parent
    return e

def drive(o, path, idx, expr):
    d = o.driver_add(path, idx).driver
    d.type = 'SCRIPTED'
    d.expression = expr.replace('T', f'(frame-1)/{FRAMES}')

def band_ring(name, r, w, mat, n=160, holes=True, parent=None, thick=0.03):
    """Flat band ring (like a short wide cylinder wall) with optional perforation row."""
    vs, fs = [], []
    for i in range(n):
        a = TAU * i / n
        c, s = math.cos(a), math.sin(a)
        vs += [(r * c, r * s, -w / 2), (r * c, r * s, w / 2)]
    for i in range(n):
        j = (i + 1) % n
        fs.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    o = mesh_obj(name, vs, fs, mat, parent)
    add_mod_solid(o, thick)
    if holes:
        rivets(o, r + thick * 0.6, n=int(r * 40), z=0, mat=M_DARK)
    return o

def flat_ring(name, r_in, r_out, mat, n=160, parent=None, thick=0.03):
    """Washer-shaped ring in the XY plane (the perforated hoops)."""
    vs, fs = [], []
    for i in range(n):
        a = TAU * i / n
        c, s = math.cos(a), math.sin(a)
        vs += [(r_in * c, r_in * s, 0), (r_out * c, r_out * s, 0)]
    for i in range(n):
        j = (i + 1) % n
        fs.append((2 * i, 2 * i + 1, 2 * j + 1, 2 * j))
    o = mesh_obj(name, vs, fs, mat, parent)
    add_mod_solid(o, thick)
    holes = empty(name + '_holes', o)
    rivets(holes, (r_in + r_out) / 2, n=int(r_out * 45), z=thick * 0.55, mat=M_DARK, axis='z')
    return o

_rivet_me = None
def rivets(parent, r, n, z, mat, axis='r'):
    global _rivet_me
    if _rivet_me is None:
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.012, radius2=0.012, depth=0.01)
        _rivet_me = bpy.data.meshes.new('rivet'); bm.to_mesh(_rivet_me); bm.free()
        _rivet_me.materials.append(mat)
    for i in range(n):
        a = TAU * i / n
        o = bpy.data.objects.new('rv', _rivet_me)
        bpy.context.collection.objects.link(o)
        o.parent = parent
        o.location = (r * math.cos(a), r * math.sin(a), z)
        if axis == 'r':
            o.rotation_euler = (0, math.pi / 2, a)

def blade(name, R, span, width, mat, parent=None, n=60, m=10):
    """Crescent of a sphere shell: lat/long patch whose width tapers to sharp points at both ends."""
    vs, fs = [], []
    for i in range(n + 1):
        u = i / n
        lon = (u - 0.5) * span
        half = width * (math.sin(math.pi * u) ** 0.8) * (0.7 + 0.3 * u)  # slightly asymmetric scythe
        for j in range(m + 1):
            v = j / m
            lat = (v - 0.2) * half  # offset so one edge is a straighter spine
            curl = 1 + 0.07 * (v ** 3)  # outer edge flares outward
            x = R * curl * math.cos(lat) * math.cos(lon)
            y = R * curl * math.cos(lat) * math.sin(lon)
            z = R * curl * math.sin(lat)
            vs.append((x, y, z))
    for i in range(n):
        for j in range(m):
            a = i * (m + 1) + j
            fs.append((a, a + m + 1, a + m + 2, a + 1))
    o = mesh_obj(name, vs, fs, mat, parent)
    add_mod_solid(o, 0.035)
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    # glowing copper lip along the outer (curled) edge and a fainter one on the spine
    tube(name + '_lip', [vs[i * (m + 1) + m] for i in range(n + 1)], 0.012, M_EDGE, o)
    tube(name + '_spine', [vs[i * (m + 1)] for i in range(n + 1)], 0.007, M_EDGE2, o)
    # a couple of rivet plates near the spine
    for u in (0.3, 0.55, 0.75):
        i = int(u * n); p = Vector(vs[i * (m + 1) + 2])
        c = cyl(name + '_plate', 0.03, 0.05, M_DARK, o, loc=p * 1.01)
        c.rotation_euler = p.to_track_quat('Z', 'Y').to_euler()
    return o

def tube(name, pts, radius, mat, parent=None):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, q in enumerate(pts):
        sp.points[i].co = (*q, 1)
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    cu.materials.append(mat)
    if parent: o.parent = parent
    return o

def cyl(name, r, depth, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), verts=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    me.materials.append(mat)
    o.location = loc; o.rotation_euler = rot
    if parent: o.parent = parent
    return o

def gear(name, r, teeth, depth, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    vs, fs = [], []
    n = teeth * 4
    for i in range(n):
        a = TAU * i / n
        rr = r * (1.12 if (i % 4) in (1, 2) else 1.0)
        for z in (-depth / 2, depth / 2):
            vs.append((rr * math.cos(a), rr * math.sin(a), z))
    for i in range(n):
        j = (i + 1) % n
        fs.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    fs.append(tuple(2 * i for i in range(n))[::-1])
    fs.append(tuple(2 * i + 1 for i in range(n)))
    o = mesh_obj(name, vs, fs, mat, parent, smooth=False)
    o.location = loc; o.rotation_euler = rot
    # spokes hole look: inner dark disc
    cyl(name + '_hub', r * 0.35, depth * 1.6, M_DARK, o)
    return o

def axle_pod(parent, direction, length, glow=M_HOT, size=1.0):
    """Shaft from the centre out along `direction`, ending in a glowing lens pod."""
    d = Vector(direction).normalized()
    rot = d.to_track_quat('Z', 'Y').to_euler()
    e = empty('axle', parent, rot=rot)
    cyl('shaft', 0.035 * size, length, M_DARK, e, loc=(0, 0, length / 2))
    for k in range(5):
        z = length * (0.45 + 0.1 * k)
        cyl('collar', (0.06 + 0.015 * (k % 2)) * size, 0.04, M_COPPER, e, loc=(0, 0, z), verts=16)
    pod = empty('pod', e, loc=(0, 0, length))
    cyl('pod_body', 0.16 * size, 0.12, M_COPPER, pod)
    cyl('pod_rim', 0.19 * size, 0.04, M_DARK, pod, loc=(0, 0, 0.05))
    cyl('pod_lens', 0.09 * size, 0.14, glow, pod, verts=20)
    gear('pod_gear', 0.13 * size, 14, 0.03, M_COPPER, pod, loc=(0, 0, -0.08))
    return e, pod

# ---------------- scene graph ----------------
root = empty('Orb')
# whole orb tilt to match mockup (axis running upper-right to lower-left)
tilt = empty('Tilt', root, rot=(math.radians(35), math.radians(-35), math.radians(-20)))
drive(root, 'rotation_euler', 2, '0.08*sin(T*tau)')
drive(root, 'rotation_euler', 0, '0.05*sin(T*tau*2+1)')
drive(root, 'location', 2, '0.04*sin(T*tau)')

# outer shell blades (slow sway, as one group)
shell = empty('Shell', root)
drive(shell, 'rotation_euler', 1, '0.12*sin(T*tau)')
drive(shell, 'rotation_euler', 2, '0.25*sin(T*tau+0.6)')
blade_specs = [  # (angle around view axis in degrees, depth lean, span, width)
    (140, 0.45, 1.7, 0.62), (62, -0.45, 1.1, 0.42), (-8, 0.5, 0.95, 0.36), (-75, -0.5, 1.4, 0.5), (-150, 0.45, 1.0, 0.4)]
for k, (phi, lean, span, w) in enumerate(blade_specs):
    holder = empty(f'bladeH{k}', shell, rot=(math.pi / 2 + lean, math.radians(-phi), 0))
    blade(f'blade{k}', 2.0, span, w, M_STEEL, holder)

# rings: nested, each spinning on its own axis
rings = empty('Rings', tilt)
ring_specs = [  # radius, width, euler, turns per loop, flat?
    (1.55, 0.16, (1.2, 0.3, 0), 1, False),
    (1.4, 0.13, (0.2, 1.3, 0.4), -1, True),
    (1.25, 0.12, (0.9, -0.6, 1.0), 2, False),
    (1.1, 0.14, (-0.4, 0.5, 0.2), -2, True),
    (0.95, 0.10, (1.5, 0.9, 0.7), 1, False),
    (0.8, 0.09, (0.6, 0.2, 1.7), -1, True),
]
for k, (r, w, eul, turns, flat) in enumerate(ring_specs):
    h = empty(f'ringH{k}', rings, rot=eul)
    if flat:
        o = flat_ring(f'ring{k}', r - w, r, M_RING, parent=h)
    else:
        o = band_ring(f'ring{k}', r, w, M_RING, parent=h)
    drive(o, 'rotation_euler', 2, f'T*tau*{turns}')

# core
core = empty('Core', tilt)
heart = bpy.data.meshes.new('heart')
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=0.16); bm.to_mesh(heart); bm.free()
ho = bpy.data.objects.new('heart', heart); bpy.context.collection.objects.link(ho); ho.parent = core
heart.materials.append(M_HOT); heart.shade_smooth()
for k, (r, teeth, rot, turns) in enumerate([(0.42, 36, (0, 0, 0), 1), (0.33, 28, (1.57, 0, 0), -2),
                                            (0.28, 24, (0, 1.57, 0), 3), (0.5, 44, (0.6, 0.6, 0), -1)]):
    h = empty(f'gearH{k}', core, rot=rot)
    g = gear(f'gear{k}', r, teeth, 0.04, M_COPPER, h)
    drive(g, 'rotation_euler', 2, f'T*tau*{turns}')
for k in range(8):
    a = TAU * k / 8
    h = empty(f'sgH{k}', core, rot=(0.7 * k, 0.4 * k, a))
    g = gear(f'sg{k}', 0.09 + 0.03 * (k % 3), 12 + 2 * (k % 3), 0.03, M_COPPER, h, loc=(0.34, 0, 0))
    drive(g, 'rotation_euler', 2, f'T*tau*{(-1) ** k * 4}')
for k in range(3):
    h = empty(f'cageH{k}', core, rot=(k * 1.05, k * 0.7, 0))
    c = flat_ring(f'cage{k}', 0.56, 0.62, M_COPPER, n=96, parent=h, thick=0.02)
    drive(c, 'rotation_euler', 2, f'T*tau*{(-1) ** k * 2}')
glow_me = bpy.data.meshes.new('glow')
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=0.24); bm.to_mesh(glow_me); bm.free()
M_GLOW, E_GLOW = emissive('Glow', (1.0, 0.3, 0.03), 2)
glow_me.materials.append(M_GLOW); glow_me.shade_smooth()
go = bpy.data.objects.new('glow', glow_me); bpy.context.collection.objects.link(go); go.parent = core
light = bpy.data.lights.new('coreLight', 'POINT'); light.color = (1, 0.5, 0.15); light.energy = 250
light.shadow_soft_size = 0.2
lo = bpy.data.objects.new('coreLight', light); bpy.context.collection.objects.link(lo); lo.parent = core
drive(light, 'energy', -1, '250+80*sin(T*tau*4)')
drive(E_HOT.inputs['Strength'], 'default_value', -1, '40+15*sin(T*tau*4)')

# axles and pods
axles = empty('Axles', tilt)
drive(axles, 'rotation_euler', 2, '-T*tau')
for d, L, s, glow in [((0.3, 0.2, 1), 2.25, 1.0, M_HOT), ((-0.3, -0.2, -1), 2.1, 1.1, M_HOT),
                      ((1, -0.3, 0.1), 1.9, 0.9, M_CYAN), ((-1, 0.4, 0.2), 1.95, 1.0, M_HOT),
                      ((0.2, -1, -0.4), 1.8, 0.8, M_HOT)]:
    e, pod = axle_pod(axles, d, L, glow, s)
    drive(pod, 'rotation_euler', 2, 'T*tau*6')

# cyan filaments: thin curves with beads that run along them
fil = empty('Filaments', tilt)
bead_me = bpy.data.meshes.new('bead')
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.009); bm.to_mesh(bead_me); bm.free()
bead_me.materials.append(M_CYAN)
for k in range(7):
    r = 1.2 + 0.12 * k
    h = empty(f'filH{k}', fil, rot=(0.4 + 0.7 * k, 0.9 * k, 0.3 * k))
    cu = bpy.data.curves.new(f'fil{k}', 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = 0.003
    sp = cu.splines.new('POLY'); n = 96; arc = 0.65 + 0.07 * k
    sp.points.add(n - 1)
    for i in range(n):
        a = TAU * arc * i / (n - 1)
        wob = 0.03 * math.sin(a * 5 + k)
        sp.points[i].co = ((r + wob) * math.cos(a), (r + wob) * math.sin(a), 0.04 * math.sin(a * 3), 1)
    co = bpy.data.objects.new(f'fil{k}', cu); bpy.context.collection.objects.link(co); co.parent = h
    cu.materials.append(M_CYANLINE)
    beads = empty(f'beads{k}', h)
    drive(beads, 'rotation_euler', 2, f'T*tau*{(-1) ** k * (2 + k % 3)}')
    nb = 40
    for i in range(nb):
        a = TAU * arc * i / nb
        b = bpy.data.objects.new('bead', bead_me); bpy.context.collection.objects.link(b); b.parent = beads
        b.location = (r * math.cos(a), r * math.sin(a), 0)
        s = 0.6 + 0.9 * ((i * 7919) % 13) / 13
        b.scale = (s, s, s)

# denim band: wide ribbon looping around the front, with a drifting wave
def denim_band():
    n, m = 200, 16
    vs, fs, uvs = [], [], []
    R, W = 1.62, 0.66
    for i in range(n + 1):
        u = i / n
        a = (u - 0.5) * TAU * 0.95 - math.pi / 2
        twist = 0.35 * math.sin(a * 1.3) + 0.2
        rr = R + 0.08 * math.sin(a * 2.0)
        for j in range(m + 1):
            v = j / m - 0.5
            fold = (0.1 * math.sin(v * math.pi * 3 + a * 2.5) + 0.05 * math.sin(v * math.pi * 7 - a * 4)) * (0.6 + 0.4 * math.cos(a))
            if abs(v) > 0.44: fold += 0.06 * (abs(v) - 0.44) / 0.06  # hems roll outward
            z = v * W * math.cos(twist)
            rad = rr + v * W * math.sin(twist) + fold
            vs.append((rad * math.cos(a), rad * math.sin(a), z))
            uvs.append((u * 6, j / m))
    for i in range(n):
        for j in range(m):
            k = i * (m + 1) + j
            fs.append((k, k + m + 1, k + m + 2, k + 1))
    o = mesh_obj('Denim', vs, fs, M_DENIM, root)
    uv = o.data.uv_layers.new(name='UV')
    for poly in o.data.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uv.data[li].uv = uvs[vi]
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = 0.05; s.offset = 0
    # rolled hem bump: subsurf for softness
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    tex = bpy.data.textures.new('denimWave', 'CLOUDS'); tex.noise_scale = 0.9
    drv = empty('denimWaveCtl', None)
    drive(drv, 'location', 0, 'sin(T*tau)*0.8')
    drive(drv, 'location', 1, 'cos(T*tau)*0.8')
    dp = o.modifiers.new('wave', 'DISPLACE'); dp.texture = tex; dp.strength = 0.12; dp.mid_level = 0.5
    dp.texture_coords = 'OBJECT'; dp.texture_coords_object = drv
    o.rotation_euler = (math.radians(-32), math.radians(18), 0)
    return o
band = denim_band()
drive(band, 'rotation_euler', 2, '0.2*sin(T*tau)')

# ---------------- camera, lights, world ----------------
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 70
cam = bpy.data.objects.new('cam', cam_d); bpy.context.collection.objects.link(cam)
cam.location = (0, -9.5, 0); cam.rotation_euler = (math.pi / 2, 0, 0)
sc.camera = cam

def area(name, loc, color, energy, size):
    l = bpy.data.lights.new(name, 'AREA'); l.color = color; l.energy = energy; l.size = size
    o = bpy.data.objects.new(name, l); bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area('key', (-5, -5, 5), (1, 0.92, 0.85), 1500, 3)
area('rimO', (5, 4, -1), (1, 0.5, 0.15), 2200, 4)
area('rimL', (-1, 4, -5), (1, 0.45, 0.1), 900, 3)
area('fillC', (-5, 2, 0), (0.6, 0.75, 1), 300, 3)

w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.012, 0.0, 0.009, 1)
bg.inputs['Strength'].default_value = 1

# ---------------- render settings ----------------
r = sc.render
r.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
r.resolution_x = r.resolution_y = RES
r.film_transparent = False
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Punchy' if 'AgX - Punchy' in [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items_static] else 'None'
ee = sc.eevee
for attr, val in [('taa_render_samples', 32), ('use_raytracing', True), ('use_shadows', True)]:
    if hasattr(ee, attr): setattr(ee, attr, val)

# bloom via compositor glare (API differs between versions; best effort)
try:
    if hasattr(sc, 'compositing_node_group'):
        ng = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
        sc.compositing_node_group = ng
        rl = ng.nodes.new('CompositorNodeRLayers')
        gl = ng.nodes.new('CompositorNodeGlare')
        outn = ng.nodes.new('NodeGroupOutput')
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        for key, v in [('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 1.0), ('Strength', 0.35), ('Size', 0.6)]:
            if key in gl.inputs: gl.inputs[key].default_value = v
        if hasattr(gl, 'glare_type'): gl.glare_type = 'BLOOM'
        ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
        ng.links.new(gl.outputs['Image'], outn.inputs[0])
    else:
        sc.use_nodes = True
        nt = sc.node_tree
        rl = nt.nodes['Render Layers']; comp = nt.nodes['Composite']
        gl = nt.nodes.new('CompositorNodeGlare'); gl.glare_type = 'BLOOM'
        nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
        nt.links.new(gl.outputs['Image'], comp.inputs['Image'])
except Exception as ex:
    print('bloom setup skipped:', ex)

os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)
if '--save' in argv:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'orb.blend'))
if STILL >= 0:
    sc.frame_set(STILL)
    r.filepath = os.path.join(OUT, f'still_{STILL:03d}.png')
    bpy.ops.render.render(write_still=True)
else:
    r.filepath = os.path.join(OUT, 'frames', 'f_')
    r.image_settings.file_format = 'PNG'
    bpy.ops.render.render(animation=True)
