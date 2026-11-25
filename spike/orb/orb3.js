// Armillary orb v3: laid out to match assets/source/armillary-reference-v2/active-orb-mockup.png.
// Brushed-silver scythe blades with glowing copper edges around the silhouette, perforated steel
// hoops, a copper gear core with a hot orange heart, axles ending in glowing lens pods, beaded cyan
// filaments, and a wide denim band across the front.
// The parts are placed in camera space (x right, y up, z toward the viewer) so the default view
// matches the mockup. The outer shell only sways; rings, gears, pods and filaments turn in place.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createDenimBand } from './cloth3.js?v=6';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.has('clean')) $('hud').style.display = 'none';
const ORANGE = new THREE.Color('#ff8a1f');
const CYAN = new THREE.Color('#38c8ff');
const TEX = './tex/';
const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
{
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 380);
  g.addColorStop(0, '#1d0619'); g.addColorStop(0.6, '#120010'); g.addColorStop(1, '#08000a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}

// Studio environment: a dark room with bright cards. The big warm-white card at the upper left is
// what puts the silver highlight on the top-left blade; the orange card behind-right gives the warm rims.
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: '#2c2629', side: THREE.BackSide })));
  const card = (color, w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  card('#fff0e4', 2.2, 9, [-6, 6, 6], 2.6);
  card('#fff0e4', 9, 2, [-5, 7, 4], 1.6);
  card('#d8d4e0', 14, 6, [6, 4, 5], 1.0);
  card('#ffffff', 10, 1.4, [0, 9, 1], 4);
  card('#ff9440', 3, 10, [8, -1, -4], 4);
  card('#ff8030', 8, 3, [-2, -8, -1], 1.6);
  card('#a8c4ff', 2, 7, [-8, 0, -5], 1.2);
  card('#f6f2ff', 5, 5, [3, 1, 9], 2.2);
  scene.environment = pmrem.fromScene(env, 0.02).texture;
}

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
camera.position.set(0, 0, 8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 14;

const coreLight = new THREE.PointLight(ORANGE, 4, 2.2, 2);
scene.add(coreLight);
const key = new THREE.DirectionalLight('#fff2e6', 1.6);
key.position.set(-3, 3, 3);
const rimWarm = new THREE.DirectionalLight('#ff9a50', 1.4);
rimWarm.position.set(3, -1, -2);
scene.add(key, rimWarm);

// ---------- textures and materials ----------
const loader = new THREE.TextureLoader();
function tex(name, srgb = false, ru = 1, rv = ru) {
  const t = loader.load(TEX + name + '.webp');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ru, rv);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function steelMat(ru = 1, rv = ru, extra = {}) {
  return new THREE.MeshStandardMaterial({
    // the colour map is mid-grey; lift it above 1 so the metal reflects like bright brushed silver
    color: new THREE.Color(1.5, 1.47, 1.48), metalness: 1, roughness: 0.6, envMapIntensity: 1.5,
    map: tex('steel-color', true, ru, rv), normalMap: tex('steel-normal', false, ru, rv), roughnessMap: tex('steel-rough', false, ru, rv),
    normalScale: new THREE.Vector2(1.0, 1.0), ...extra,
  });
}
const steel = steelMat();
// Copper: the fittings in the mockup are warm orange-brown, lit from the core.
const copper = new THREE.MeshStandardMaterial({
  color: '#a8683a', metalness: 1, roughness: 0.55, envMapIntensity: 1.0,
  normalMap: tex('bronze-normal', false, 2), roughnessMap: tex('bronze-rough', false, 2),
  normalScale: new THREE.Vector2(0.8, 0.8),
});
const darkCopper = copper.clone();
darkCopper.color = new THREE.Color('#5a3a26');
const glow = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(2.4), toneMapped: false });
const glowHot = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.1, 1.0), toneMapped: false });
const glowCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.6, 3.0), toneMapped: false });

// Blade faces: brushed steel with a soft orange fresnel rim. Blade edges: hot copper.
const bladeSteel = steelMat(1.4, 1, { side: THREE.DoubleSide, color: new THREE.Color(1.6, 1.56, 1.56), roughness: 0.5 });
bladeSteel.onBeforeCompile = (sh) => {
  sh.uniforms.rimColor = { value: ORANGE.clone().multiplyScalar(0.15) };
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
    .replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 6.0);
       totalEmissiveRadiance += rimColor * rimF;`);
};
const bladeEdge = new THREE.MeshStandardMaterial({
  color: '#c07a45', metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide,
  emissive: ORANGE, emissiveIntensity: 0.45,
});
const edgeLine = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.1), toneMapped: false });

// ---------- geometry helpers ----------
// Flat annulus with round perforations along its middle.
function ringBand(rIn, rOut, depth, { holes = 0, holeR = 0, bevel = depth * 0.2 } = {}) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, TAU, false);
  const inner = new THREE.Path();
  inner.absarc(0, 0, rIn, 0, TAU, true);
  s.holes.push(inner);
  const mid = (rIn + rOut) / 2;
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * TAU;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * mid, Math.sin(a) * mid, holeR, 0, TAU, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Hoop: a belt-like band (wide along its axis, thin radially), perforated by an alpha mask.
function hoopMaterial(r, w, holes) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000';
  // lathe profile: 4 faces, outer face is v in [0.25,0.5], inner face [0.75,1]
  const hr = Math.min(0.022, w * 0.18);
  const rx = (hr * c.width) / (TAU * r), ry = (hr * c.height * 0.25) / w;
  for (const vc of [0.375, 0.875]) for (let i = 0; i < holes; i++) {
    x.beginPath();
    x.ellipse(((i + 0.5) / holes) * c.width, (1 - vc) * c.height, rx, ry, 0, 0, TAU);
    x.fill();
  }
  const alpha = new THREE.CanvasTexture(c);
  alpha.anisotropy = 8;
  const m = steelMat((TAU * r) / 1.2, 0.4, { alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide });
  return m;
}
function hoopGeo(r, w, t) {
  const pts = [V(r - t, -w / 2, 0), V(r, -w / 2, 0), V(r, w / 2, 0), V(r - t, w / 2, 0), V(r - t, -w / 2, 0)]
    .map((p) => new THREE.Vector2(p.x, p.y));
  const g = new THREE.LatheGeometry(pts, 128);
  g.rotateX(Math.PI / 2); // axis along z
  return g;
}

// Spoked, toothed gear.
function spokedGear(r, teeth, depth, spokes = 6) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = (i % 4 === 1 || i % 4 === 2) ? r : r * 0.9;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hub = new THREE.Path();
  hub.absarc(0, 0, r * 0.12, 0, TAU, true);
  s.holes.push(hub);
  const gap = 0.14, ro = r * 0.76, ri = r * 0.3;
  for (let k = 0; k < spokes; k++) {
    const a0 = (k / spokes) * TAU + gap, a1 = ((k + 1) / spokes) * TAU - gap;
    const p = new THREE.Path();
    for (let j = 0; j <= 8; j++) { const a = a0 + ((a1 - a0) * j) / 8; j ? p.lineTo(Math.cos(a) * ro, Math.sin(a) * ro) : p.moveTo(Math.cos(a) * ro, Math.sin(a) * ro); }
    for (let j = 8; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / 8; p.lineTo(Math.cos(a) * ri, Math.sin(a) * ri); }
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.2, bevelSize: depth * 0.2, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Scythe blade: a curved plate on a sphere of radius R, following the great circle in the local
// xz-plane from angle 0 (the base) to `sweep` (the tip). One edge runs along the arc; the plate
// widens across it (local +y) and tapers to a point. `crescent` points both ends instead.
// Faces use material 0, the thickness walls material 1 (the glowing edge).
function scytheGeo({ R, sweep, width, thick, tipLift = 0.12, hook = 0.15, crescent = false, notch = null, baseW = 0.6, cone = 0.55 }) {
  const NU = 120, NV = 12;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wid = (u) => {
    let w = crescent
      ? width * Math.pow(Math.sin(Math.PI * u), 0.75)
      : width * Math.pow(1 - u, 0.8) * (baseW + (1 - baseW) * Math.sin(Math.min(1, u * 3.2) * Math.PI / 2));
    if (notch) { const [u0, u1, f] = notch; w *= 1 - (1 - f) * ss(u0 - 0.012, u0 + 0.012, u) * (1 - ss(u1 - 0.012, u1 + 0.012, u)); }
    return w;
  };
  // the arc edge bows a little toward the tip, so the blade curls like a scythe
  const edge = (u) => (crescent ? hook * width * Math.sin(Math.PI * u) : hook * width * u * u);
  const lift = (u) => (crescent ? tipLift * Math.pow(Math.abs(2 * u - 1), 3) : tipLift * u * u * u);
  const point = (u, s, side) => {
    const a = u * sweep, b = edge(u) + s * wid(u);
    const t = thick * (1 - 0.55 * (crescent ? Math.abs(2 * u - 1) : u));
    // `cone` pulls the wide edge inward so the plate tilts its face toward the viewer
    const r = R + lift(u) - cone * R * s * wid(u) + (side > 0 ? t * 0.5 : -t * 0.5);
    return [r * Math.cos(b) * Math.cos(a), r * Math.sin(b), r * Math.cos(b) * Math.sin(a)];
  };
  const P = [], UV = [], idx = [];
  const grid = (side) => {
    const base = P.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, s = j / NV;
      P.push(...point(u, s, side)); UV.push(u * sweep * R * 0.9, s * width * R * 0.9);
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = base + i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  grid(1); grid(-1);
  const faceCount = idx.length;
  const innerB = (NU + 1) * (NV + 1);
  const wall = (os, is, flip) => {
    for (let k = 0; k < os.length - 1; k++) {
      const o0 = os[k], i0 = is[k], o1 = os[k + 1], i1 = is[k + 1];
      if (flip) idx.push(o0, o1, i0, o1, i1, i0); else idx.push(o0, i0, o1, o1, i0, i1);
    }
  };
  const e0o = [], e0i = [], e1o = [], e1i = [], bo = [], bi = [], to = [], ti = [];
  for (let i = 0; i <= NU; i++) {
    e0o.push(i * (NV + 1)); e0i.push(innerB + i * (NV + 1));
    e1o.push(i * (NV + 1) + NV); e1i.push(innerB + i * (NV + 1) + NV);
  }
  for (let j = 0; j <= NV; j++) { bo.push(j); bi.push(innerB + j); to.push(NU * (NV + 1) + j); ti.push(innerB + NU * (NV + 1) + j); }
  wall(e0o, e0i, true); wall(e1o, e1i, false); wall(bo, bi, false); wall(to, ti, true);
  const g = new THREE.BufferGeometry();
  // walls get their own vertices so their normals don't smear into the faces
  const wallIdx = idx.slice(faceCount);
  const P2 = P.slice(), UV2 = UV.slice(), remap = new Map(), wallNew = [];
  for (const k of wallIdx) {
    if (!remap.has(k)) { remap.set(k, P2.length / 3); P2.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]); UV2.push(UV[k * 2], UV[k * 2 + 1]); }
    wallNew.push(remap.get(k));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV2, 2));
  g.setIndex(idx.slice(0, faceCount).concat(wallNew));
  g.addGroup(0, faceCount, 0);
  g.addGroup(faceCount, wallNew.length, 1);
  g.computeVertexNormals();
  g.userData = { point };
  return g;
}

// ---------- orb assembly ----------
const orb = new THREE.Group();   // sways as a whole
scene.add(orb);
const spinners = [];
const spin = (obj, axis, speed) => spinners.push({ obj, axis: new THREE.Vector3(...axis).normalize(), speed });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 1);
const _y = new THREE.Vector3(0, 1, 0);
// orient a holder so its local +z is `normal`
const faceAlong = (obj, normal) => obj.quaternion.setFromUnitVectors(_z, normal.clone().normalize());

// Blade placed by camera-space directions: base, tip, and which way it widens.
function blade({ base, tip, toward = [0, 0, 1], R, edgeGlow = 'inner', ...shape }) {
  const e1 = V(...base).normalize();
  const p1 = V(...tip).normalize();
  const e2 = p1.clone().sub(e1.clone().multiplyScalar(e1.dot(p1))).normalize();
  const sweep = Math.acos(THREE.MathUtils.clamp(e1.dot(p1), -1, 1));
  let n = new THREE.Vector3().crossVectors(e2, e1);
  if (n.dot(V(...toward)) < 0) n.negate();
  const g = scytheGeo({ R, sweep, ...shape });
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.matrix.makeBasis(e1, n, e2);
  holder.add(new THREE.Mesh(g, [bladeSteel, bladeEdge]));
  // a thin hot line along the inner (wide) edge, like the glowing rims in the mockup
  if (edgeGlow) {
    const { point } = g.userData, pts = [];
    const s = edgeGlow === 'inner' ? 1 : 0;
    for (let i = 2; i <= 118; i++) pts.push(new THREE.Vector3(...point(i / 120, s, 1)).multiplyScalar(1.002));
    holder.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.0035, 4), edgeLine));
  }
  orb.add(holder);
  return holder;
}
// top-left: big shell, square-cut top with a stepped notch, tapering down to a point at the left
blade({ base: [-0.26, 0.95, 0.25], tip: [-0.97, 0.0, 0.25], R: 2.02, width: 0.4, thick: 0.07, baseW: 0.85, cone: 0.45,
  notch: [0.06, 0.16, 0.7], tipLift: 0.06, hook: 0.05, toward: [0.4, -0.3, 1] });
// top: crescent that the main axle's finial passes through
blade({ base: [0.0, 0.95, 0.3], tip: [0.62, 0.74, 0.25], R: 2.12, width: 0.24, thick: 0.06, crescent: true, cone: 0.3,
  tipLift: 0.18, hook: 0.25, toward: [0, -0.5, 1] });
// right: short horn that flicks outward and down
blade({ base: [0.66, 0.64, 0.4], tip: [0.99, 0.22, 0.05], R: 2.0, width: 0.2, thick: 0.05, tipLift: 0.3, cone: 0.35,
  hook: 0.3, toward: [-0.2, -0.4, 1] });
// bottom-right: the big scythe, blunt at the pod, sharp tip at the bottom
blade({ base: [0.86, -0.42, 0.3], tip: [0.06, -0.99, 0.15], R: 2.08, width: 0.36, thick: 0.07, baseW: 0.75,
  tipLift: 0.12, hook: 0.12, toward: [-0.4, 0.4, 1] });
// bottom-centre: a smaller blade in front, half under the denim
blade({ base: [-0.42, -0.42, 0.8], tip: [0.32, -0.78, 0.55], R: 1.78, width: 0.26, thick: 0.05, baseW: 0.7,
  tipLift: 0.08, hook: 0.1, toward: [0, -1, 0.2] });
// back-left: fills the silhouette behind the denim's flared end
blade({ base: [-0.9, -0.2, -0.4], tip: [-0.5, -0.8, -0.3], R: 2.0, width: 0.3, thick: 0.05, tipLift: 0.1,
  toward: [0, 0, -1], edgeGlow: null });

// ----- rings: perforated steel hoops and flat bands, each turning about its own axis -----
function hoop({ r, w = 0.12, t = 0.022, normal, speed, holes }) {
  const holder = new THREE.Group();
  faceAlong(holder, normal);
  const m = new THREE.Mesh(hoopGeo(r, w, t), hoopMaterial(r, w, holes ?? Math.round(r * 30)));
  holder.add(m);
  orb.add(holder);
  spin(m, [0, 0, 1], speed);
}
function flatRing({ rIn, rOut, depth = 0.04, normal, speed, holes }) {
  const holder = new THREE.Group();
  faceAlong(holder, normal);
  const m = new THREE.Mesh(ringBand(rIn, rOut, depth, { holes, holeR: (rOut - rIn) * 0.18 }), steel);
  holder.add(m);
  orb.add(holder);
  spin(m, [0, 0, 1], speed);
}
// the band crossing the centre on a rising diagonal, nearly edge-on
hoop({ r: 1.0, w: 0.16, normal: V(-0.4, 0.88, 0.27), speed: 0.22 });
hoop({ r: 1.42, w: 0.14, normal: V(0.25, 0.35, 0.9), speed: -0.12 });
hoop({ r: 1.22, w: 0.13, normal: V(0.85, 0.2, 0.45), speed: 0.16 });
hoop({ r: 0.78, w: 0.12, normal: V(0.5, -0.4, 0.75), speed: -0.3 });
flatRing({ rIn: 1.26, rOut: 1.42, normal: V(-0.55, 0.6, 0.6), speed: 0.1, holes: 44 });
flatRing({ rIn: 0.86, rOut: 1.0, normal: V(0.7, 0.65, -0.2), speed: -0.2, holes: 32 });
flatRing({ rIn: 1.55, rOut: 1.66, depth: 0.035, normal: V(0.1, 0.95, 0.3), speed: 0.08, holes: 52 });
for (const [r, n, sp] of [[0.92, V(0.3, 0.2, 0.93), 0.3], [1.15, V(0.9, 0.4, 0.1), -0.22], [1.33, V(0.1, 0.9, -0.4), 0.16],
  [0.66, V(-0.6, 0.3, 0.7), -0.35], [1.5, V(0.6, -0.5, 0.6), 0.12]]) {
  const holder = new THREE.Group();
  faceAlong(holder, n);
  const wire = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 6, 96), steel);
  holder.add(wire);
  orb.add(holder);
  spin(wire, [0, 0, 1], sp);
}

// ----- pods and axle fittings (all built along +Y, pointing outward) -----
const podGear = spokedGear(0.25, 22, 0.035, 8).rotateX(-Math.PI / 2);
function podLens({ cyan = false, big = false } = {}) {
  const k = big ? 1.25 : 1;
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * k, 0.2 * k, 0.13 * k, 32), copper);
  const gear = new THREE.Mesh(podGear, darkCopper);
  gear.scale.setScalar(k); gear.position.y = -0.03;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.13 * k, 0.022 * k, 10, 32).rotateX(Math.PI / 2), steel);
  bezel.position.y = 0.068 * k;
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.115 * k, 28, 14, 0, TAU, 0, Math.PI / 2).scale(1, 0.45, 1), cyan ? glowCyan : glow);
  lens.position.y = 0.06 * k;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08 * k, 0.012 * k, 8, 24).rotateX(Math.PI / 2), cyan ? glow : glowHot);
  ring.position.y = 0.09 * k;
  g.add(housing, gear, bezel, lens, ring);
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), steel, 12);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    bolts.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * 0.17 * k, 0.06 * k, Math.sin(a) * 0.17 * k), _q.identity(), _one));
  }
  g.add(bolts);
  spin(gear, [0, 1, 0], 0.6 * (cyan ? -1 : 1));
  return g;
}
function finial() {
  const g = new THREE.Group();
  [[0.1, 0.08, 0.04], [0.075, 0.06, 0.12], [0.055, 0.12, 0.22]].forEach(([r, h, y], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 20), i % 2 ? steel : copper);
    c.position.y = y; g.add(c);
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), copper);
  ball.position.y = 0.34;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), steel);
  eye.position.y = 0.43;
  g.add(ball, eye);
  return g;
}
const nothing = () => new THREE.Group();

function axle(dir, len, endA, endB, { collars = [-0.7, -0.56, -0.42, -0.3, 0.3, 0.42, 0.56, 0.7], wires = true, mid = null } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, len, 14), darkCopper));
  collars.forEach((t, i) => {
    const y = t * len * 0.5;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 20), i % 2 ? steel : copper);
    c.position.y = y;
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.014, 24), copper);
    f.position.y = y + 0.036;
    g.add(c, f);
  });
  if (mid) { const p = mid(); p.position.y = mid.at * len * 0.5; g.add(p); }
  for (const [sgn, make] of [[1, endA], [-1, endB]]) {
    const pod = make();
    pod.position.y = sgn * (len / 2);
    if (sgn < 0) pod.rotation.x = Math.PI;
    g.add(pod);
    if (!wires) continue;
    const s = sgn, h = len / 2;
    const curve = new THREE.CatmullRomCurve3([
      V(0.1, s * (h - 0.02), 0), V(0.26, s * (h - 0.18), 0.1), V(0.36, s * (h - 0.42), 0.04), V(0.38, s * (h - 0.62), -0.04),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0055, 5), copper));
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 14), steel);
    eye.position.copy(curve.getPoint(1)); eye.rotation.y = 0.8;
    g.add(eye);
  }
  g.quaternion.setFromUnitVectors(_y, V(...dir).normalize());
  orb.add(g);
  return g;
}
// main shaft: finial up in the top crescent, big lens at the bottom-left
axle([0.38, 0.92, 0.1], 4.25, finial, () => podLens({ big: true }));
// upper-right lens to lower-left (hidden under the denim)
axle([0.8, 0.52, 0.3], 3.5, () => podLens(), nothing, { wires: false });
// left lens across to the right cyan lens
axle([1, -0.18, -0.05], 3.3, () => podLens({ cyan: true }), () => podLens());
// down to the bottom right: one pod on the shaft, one at its end
const midPod = () => { const p = podLens(); p.scale.setScalar(0.85); return p; };
midPod.at = 0.55;
axle([0.66, -0.68, 0.35], 3.5, () => podLens(), nothing, { mid: midPod, wires: false });

// ----- core: hot orange lens inside gimballed copper rings, in a drum of stacked spoked gears -----
const core = new THREE.Group();
core.position.set(-0.05, 0.3, 0.25);
orb.add(core);
const lensGlass = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 24),
  new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.25), toneMapped: false }));
const lensHot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), glowHot);
core.add(lensGlass, lensHot);
for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]]) {
  const r = new THREE.Mesh(ringBand(0.17, 0.23, 0.05), copper);
  r.rotation.set(...rot);
  core.add(r);
}
[[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]].forEach((rot, a) => {
  [[0.5, 20], [0.42, 17], [0.35, 14], [0.58, 22]].forEach(([r, teeth], i) => {
    const holder = new THREE.Group();
    holder.rotation.set(...rot);
    const m = new THREE.Mesh(spokedGear(r * (1 - a * 0.06), teeth, 0.034), i % 2 ? steel : copper);
    m.position.z = (i - 1.5) * 0.065;
    holder.add(m);
    core.add(holder);
    spin(m, [0, 0, 1], (0.45 + i * 0.12) * (i % 2 ? -1 : 1) * (a % 2 ? -1 : 1));
  });
});
[[0.34, 12, [1.1, 0.5, 0.2], -0.7], [0.3, 11, [0.2, 1.1, 0.9], 0.8]].forEach(([r, t, rot, sp]) => {
  const holder = new THREE.Group();
  holder.rotation.set(...rot);
  const m = new THREE.Mesh(spokedGear(r, t, 0.03), copper);
  holder.add(m);
  core.add(holder);
  spin(m, [0, 0, 1], sp);
});
// tilt the whole core so the gear faces catch the light like the mockup's
core.rotation.set(0.35, -0.5, 0.2);

// ---------- cyan filaments: strings of evenly spaced beads ----------
const sparkUniforms = { uTime: { value: 0 }, uPx: { value: 1 } };
const sparkMat = new THREE.ShaderMaterial({
  uniforms: sparkUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPx;
    varying vec3 vColor; varying float vTw;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      float tw = 0.65 + 0.35 * sin(uTime * (2.0 + aPhase * 4.0) + aPhase * 40.0);
      vTw = tw; vColor = aColor;
      gl_PointSize = aSize * uPx * (0.75 + 0.45 * tw) * (38.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vTw;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float core = smoothstep(1.0, 0.0, d);
      float a = core * core * (0.5 + 0.9 * pow(core, 4.0));
      gl_FragColor = vec4(vColor * (0.7 + 1.5 * vTw) * a, a);
    }`,
});

function filament({ radius, arc, normal, speed, beads = 90, color = CYAN, wobble = 0.03, phase = 0 }) {
  const pos = new Float32Array(beads * 3), col = new Float32Array(beads * 3), sz = new Float32Array(beads), ph = new Float32Array(beads);
  for (let i = 0; i < beads; i++) {
    const u = (i + 0.3 * Math.random()) / beads, a = phase + u * arc;
    const r = radius + Math.sin(u * 11 + phase) * wobble;
    pos.set([Math.cos(a) * r, Math.sin(a) * r, Math.sin(u * 7) * wobble], i * 3);
    const f = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * u), 0.6), hot = Math.random() < 0.07;
    const c = hot ? new THREE.Color('#effcff') : color;
    col.set([c.r * f, c.g * f, c.b * f], i * 3);
    sz[i] = (hot ? 2.2 : 0.9 + Math.random() * 0.5) * (0.6 + f * 0.5);
    ph[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(g, sparkMat);
  const N = 160, lp = new Float32Array(N * 3), lc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), a = phase + u * arc, f = 0.6 * Math.pow(Math.sin(Math.PI * u), 0.8);
    const r = radius + Math.sin(u * 11 + phase) * wobble;
    lp.set([Math.cos(a) * r, Math.sin(a) * r, Math.sin(u * 7) * wobble], i * 3);
    lc.set([color.r * f, color.g * f, color.b * f], i * 3);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rotor = new THREE.Group();
  rotor.add(pts, line);
  const holder = new THREE.Group();
  faceAlong(holder, normal);
  holder.add(rotor);
  orb.add(holder);
  spin(rotor, [0, 0, 1], speed);
}
// the mockup's cyan strings sit mostly upper-left and wrap down the lower right
filament({ radius: 1.55, arc: 2.2, normal: V(0.15, 0.2, 1), speed: 0.25, phase: 1.3 });
filament({ radius: 1.3, arc: 2.6, normal: V(-0.3, 0.5, 0.8), speed: -0.3, phase: 0.9 });
filament({ radius: 1.05, arc: 3.0, normal: V(0.5, -0.2, 0.85), speed: 0.4, phase: 2.0 });
filament({ radius: 1.6, arc: 2.0, normal: V(0.2, -0.3, 0.95), speed: -0.2, phase: 4.2 });
filament({ radius: 1.2, arc: 2.4, normal: V(-0.6, -0.3, 0.75), speed: 0.35, phase: 4.6 });
filament({ radius: 0.9, arc: 2.6, normal: V(0.8, 0.5, 0.3), speed: -0.5, phase: 0.2, beads: 70 });
filament({ radius: 1.4, arc: 1.8, normal: V(0.6, 0.7, 0.4), speed: 0.3, phase: 2.6, beads: 60 });

// ---------- denim band ----------
const band = createDenimBand();
orb.add(band.group);

// ---------- postprocessing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.75);
composer.addPass(bloom);
composer.addPass(new OutputPass());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, +$('pr').value));
  sparkUniforms.uPx.value = renderer.getPixelRatio();
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? (35 / Math.min(1, w / h)) * 0.85 : 35;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
$('pr').addEventListener('change', resize);
$('bloom').addEventListener('input', (e) => (bloom.strength = +e.target.value));
$('radius').addEventListener('input', (e) => (bloom.radius = +e.target.value));
$('thresh').addEventListener('input', (e) => (bloom.threshold = +e.target.value));
resize();

let tris = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  const idx = o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
  tris += (idx / 3) * (o.isInstancedMesh ? o.count : 1);
});
$('tris').textContent = Math.round(tris / 1000) + 'k';

// ---------- loop ----------
const clock = new THREE.Clock();
let frames = 0, acc = 0, st = 0;
const q = new THREE.Quaternion();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), k = +$('spin').value;
  for (const s of spinners) { q.setFromAxisAngle(s.axis, s.speed * dt * k); s.obj.quaternion.multiply(q); }
  st += dt * k;
  const t = clock.elapsedTime;
  sparkUniforms.uTime.value = t;
  const pulse = 1 + Math.sin(t * 2.1) * 0.06 + Math.sin(t * 5.3) * 0.025;
  lensGlass.scale.setScalar(pulse);
  coreLight.intensity = 4 * pulse;
  coreLight.position.copy(core.position).applyEuler(orb.rotation);
  // the shell sways instead of tumbling, so the mockup's composition stays readable
  orb.rotation.set(0.05 * Math.sin(st * 0.17), 0.22 * Math.sin(st * 0.23), 0.03 * Math.sin(st * 0.13));
  band.update(t);
  controls.update();
  composer.render();
  frames++; acc += dt;
  if (acc > 0.5) { $('fps').textContent = Math.round(frames / acc); frames = 0; acc = 0; }
});
