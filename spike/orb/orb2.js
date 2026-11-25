// Armillary orb v2: built from the ChatGPT references (steel perforated rings, bronze mechanism,
// pods with glowing lenses, notched steel blades, beaded cyan filaments).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createDenimBand } from './cloth.js?v=7';

const $ = (id) => document.getElementById(id);
const ORANGE = new THREE.Color('#ff8a1f');
const CYAN = new THREE.Color('#38c8ff');
const TEX = './tex/';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
{
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 360);
  g.addColorStop(0, '#1c0c26'); g.addColorStop(0.55, '#0f0615'); g.addColorStop(1, '#030107');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}

// Studio environment: dark room with a few bright coloured cards (these make the highlight streaks).
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: '#07040a', side: THREE.BackSide })));
  const card = (color, w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  card('#ffb070', 3, 10, [-8, 1, 3], 3);
  card('#e8eeff', 8, 1.4, [0, 9, 2], 7);
  card('#9fd8ff', 1.8, 7, [8, 0, -4], 1.6);
  card('#cfd8ff', 6, 2, [-2, -8, -3], 3);
  card('#f4f6ff', 5, 5, [3, 2, 9], 4.5);
  scene.environment = pmrem.fromScene(env, 0.02).texture;
}

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
camera.position.set(0.3, 0.6, 7.7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 13;

const coreLight = new THREE.PointLight(ORANGE, 3.2, 3.6, 2);
scene.add(coreLight);
const rimCyan = new THREE.DirectionalLight('#9fc4ff', 0.6);
rimCyan.position.set(-3, 2, -2);
const rimWarm = new THREE.DirectionalLight('#ffe0c8', 1.8);
rimWarm.position.set(3, 1.5, 2.5);
scene.add(rimCyan, rimWarm);

// ---------- textures and materials (maps from ChatGPT, 1024px copies) ----------
const loader = new THREE.TextureLoader();
function tex(name, srgb = false, rep = 1) {
  const t = loader.load(TEX + name + '.webp');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Steel: the colour map is very light, so tint it down toward the dark brushed steel of the references.
const steel = new THREE.MeshStandardMaterial({
  color: '#86888f', metalness: 1, roughness: 1, envMapIntensity: 1.1,
  map: tex('steel-color', true), normalMap: tex('steel-normal'), roughnessMap: tex('steel-rough'),
  normalScale: new THREE.Vector2(0.8, 0.8),
});
// Bronze: the supplied colour map reads as dirt, so use a flat dark bronze and keep only its surface wear
// (normal + roughness), which gives the pitted look without the camouflage colouring.
const bronze = new THREE.MeshStandardMaterial({
  color: '#5d4a38', metalness: 1, roughness: 1, envMapIntensity: 1.0,
  normalMap: tex('bronze-normal', false, 2), roughnessMap: tex('bronze-rough', false, 2),
  normalScale: new THREE.Vector2(1.0, 1.0),
});
const glow = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(2.2), toneMapped: false });
const glowCyan = new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(2.0), toneMapped: false });
const edgeGlow = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.5), toneMapped: false });

// Blade steel: same steel, double sided, with a soft orange fresnel rim.
const bladeSteel = steel.clone();
bladeSteel.side = THREE.DoubleSide;
bladeSteel.color = new THREE.Color('#7a7c83');
bladeSteel.onBeforeCompile = (sh) => {
  sh.uniforms.rimColor = { value: ORANGE.clone().multiplyScalar(0.45) };
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
    .replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 5.0);
       totalEmissiveRadiance += rimColor * rimF;`);
};

// Semi-solid material: noise erodes the surface (more toward the tips / around the ring),
// leaving a glowing orange seam where it breaks up, like metal turning to particles.
const semiTime = { value: 0 };
function semiSolid(mat, thrExpr, seed = 0) {
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  const prev = mat.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSemiT = semiTime;
    sh.uniforms.uSeed = { value: seed };
    sh.uniforms.uGlow = { value: ORANGE.clone().multiplyScalar(1.7) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec2 vUvS;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vUvS = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uSemiT; uniform float uSeed; uniform vec3 uGlow;
        varying vec3 vObj; varying vec2 vUvS;
        float h3(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float semiEdge;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float n = vn(vObj * 12.0 + uSeed) * 0.6 + vn(vObj * 34.0 + uSeed * 2.0) * 0.4;
          float thr = (${thrExpr}) + 0.06 * sin(uSemiT * 0.6 + uSeed * 3.0);
          float d = n - thr;
          if (d < 0.0) discard;
          semiEdge = 1.0 - smoothstep(0.0, 0.05, d);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * semiEdge;`);
  };
  return m;
}
const RING_THR = '0.3 + 0.17 * sin(atan(vObj.y, vObj.x) * 2.0 + uSeed * 5.0)';
const BLADE_THR = '0.05 + 0.5 * pow(abs(vUvS.y - 0.5) * 2.0, 2.0) + 0.3 * pow(clamp(vUvS.x / 2.2, 0.0, 1.0), 1.5)';
const bladeSemi = semiSolid(bladeSteel, BLADE_THR, 9);

// ---------- geometry helpers ----------
const TAU = Math.PI * 2;

// Flat band with a row of round perforations along its middle.
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
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
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

// Blade: a tapered patch on a sphere with real thickness, angular notches cut into its outline.
function bladeGeo(R, len, width, thick, notches = []) {
  const NU = 110, NV = 14;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hw = (u) => {
    let w = width * Math.pow(1 - u, 0.7) * (0.45 + 0.55 * Math.sin(Math.min(1, u * 2.4) * Math.PI / 2));
    for (const [u0, u1, f] of notches) w *= 1 - (1 - f) * ss(u0 - 0.04, u0 + 0.04, u) * (1 - ss(u1 - 0.04, u1 + 0.04, u));
    return w;
  };
  const P = [], UV = [], idx = [];
  const point = (u, v, side) => {
    const a = u * len, b = v * hw(u), t = thick * (1 - 0.5 * u);
    const r = side > 0 ? R + t * (0.5 + 0.5 * v * v) : R - t * 0.5;
    return [r * Math.cos(b) * Math.cos(a), r * Math.sin(b), r * Math.cos(b) * Math.sin(a)];
  };
  const grid = (side) => {
    const base = P.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = -1 + (2 * j) / NV;
      P.push(...point(u, v, side)); UV.push(u * 2.2, (v + 1) * 0.5);
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = base + i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  grid(1); grid(-1);
  const innerB = (NU + 1) * (NV + 1);
  const wall = (os, is, flip) => {
    for (let k = 0; k < os.length - 1; k++) {
      const o0 = os[k], i0 = is[k], o1 = os[k + 1], i1 = is[k + 1];
      if (flip) idx.push(o0, o1, i0, o1, i1, i0); else idx.push(o0, i0, o1, o1, i0, i1);
    }
  };
  const e0o = [], e0i = [], e1o = [], e1i = [], bo = [], bi = [];
  for (let i = 0; i <= NU; i++) {
    e0o.push(i * (NV + 1)); e0i.push(innerB + i * (NV + 1));
    e1o.push(i * (NV + 1) + NV); e1i.push(innerB + i * (NV + 1) + NV);
  }
  for (let j = 0; j <= NV; j++) { bo.push(j); bi.push(innerB + j); }
  wall(e0o, e0i, true); wall(e1o, e1i, false); wall(bo, bi, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData = { point };
  return g;
}

// ---------- orb assembly ----------
const orb = new THREE.Group();
scene.add(orb);
const spinners = [];
const spin = (obj, axis, speed) => spinners.push({ obj, axis: new THREE.Vector3(...axis).normalize(), speed });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 1);
const domeGeo = new THREE.SphereGeometry(0.03, 12, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2);

function ring({ rIn, rOut, depth, tilt, speed, holes = 0, domes = 0, axis = [0, 0, 1], mat = steel }) {
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  const rotor = new THREE.Group();
  holder.add(rotor);
  rotor.add(new THREE.Mesh(ringBand(rIn, rOut, depth, { holes, holeR: (rOut - rIn) * 0.2 }), mat));
  if (domes) {
    const mid = (rIn + rOut) / 2, z = depth / 2 + depth * 0.2;
    for (const sgn of [1, -1]) {
      const im = new THREE.InstancedMesh(domeGeo, bronze, domes);
      for (let i = 0; i < domes; i++) {
        const a = ((i + 0.5) / domes) * TAU;
        _q.setFromAxisAngle(_z, a);
        im.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * mid, Math.sin(a) * mid, sgn * z), _q, new THREE.Vector3(1, 1, sgn)));
      }
      rotor.add(im);
    }
  }
  orb.add(holder);
  spin(rotor, axis, speed);
}

// Five thinner perforated bands; each one dissolves along part of its length.
const ringSemi = (i) => semiSolid(steel, RING_THR, i * 1.7);
ring({ rIn: 1.08, rOut: 1.2, depth: 0.035, tilt: [1.25, 0.2, 0.3], speed: 0.22, holes: 40, domes: 4, mat: ringSemi(1) });
ring({ rIn: 0.9, rOut: 1.0, depth: 0.035, tilt: [0.2, 1.1, 0.5], speed: -0.3, holes: 34, domes: 4, mat: ringSemi(2) });
ring({ rIn: 1.3, rOut: 1.42, depth: 0.03, tilt: [0.5, 0.3, 1.5], speed: 0.15, holes: 46, domes: 4, mat: ringSemi(3) });
ring({ rIn: 0.7, rOut: 0.8, depth: 0.03, tilt: [1.7, 0.9, 0.1], speed: -0.42, holes: 26, domes: 4, mat: ringSemi(4) });
ring({ rIn: 1.12, rOut: 1.26, depth: 0.03, tilt: [0.9, -0.8, 1.1], speed: 0.18, holes: 42, domes: 4, mat: ringSemi(5) });

// ----- pods and axle fittings (all built along +Y, pointing outward) -----
function podLens(cyan = false) {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 32), bronze);
  const flange = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 32).rotateX(Math.PI / 2), steel);
  flange.position.y = -0.04;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.014, 8, 28).rotateX(Math.PI / 2), steel);
  bezel.position.y = 0.062;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 28), cyan ? glowCyan : glow);
  lens.position.y = 0.062;
  g.add(housing, flange, bezel, lens);
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), steel, 10);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    bolts.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * 0.15, 0.062, Math.sin(a) * 0.15), _q.identity(), _one));
  }
  g.add(bolts);
  return g;
}
function podDish() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 20), bronze);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.09, 0.1, 40, 1, true), steel);
  dish.material = steel.clone(); dish.material.side = THREE.DoubleSide;
  dish.position.y = 0.11;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.014, 8, 40).rotateX(Math.PI / 2), bronze);
  rim.position.y = 0.16;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.07, 0.02, 32), glow);
  lamp.position.y = 0.105;
  g.add(stem, dish, rim, lamp);
  return g;
}
function podLantern() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 28), bronze);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.05, 28), bronze);
  cap.position.y = 0.26;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 24), glow);
  tube.position.y = 0.13;
  g.add(base, cap, tube);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.78;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), steel);
    bar.position.set(Math.cos(a) * 0.115, 0.13, Math.sin(a) * 0.115);
    g.add(bar);
  }
  return g;
}
function finial() {
  const g = new THREE.Group();
  [[0.1, 0.08, 0.04], [0.075, 0.06, 0.12], [0.055, 0.12, 0.22]].forEach(([r, h, y], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 20), i % 2 ? steel : bronze);
    c.position.y = y; g.add(c);
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), bronze);
  ball.position.y = 0.34;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), steel);
  eye.position.y = 0.43;
  g.add(ball, eye);
  return g;
}

function axle(dir, len, endA, endB, collars = [-0.72, -0.58, -0.44, -0.3, 0.3, 0.44, 0.58, 0.72]) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 14), bronze));
  collars.forEach((t, i) => {
    const y = t * len * 0.5 * 1.0;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), i % 2 ? steel : bronze);
    c.position.y = y;
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24), bronze);
    f.position.y = y + 0.032;
    g.add(c, f);
  });
  for (const [sgn, make] of [[1, endA], [-1, endB]]) {
    const pod = make();
    pod.position.y = sgn * (len / 2);
    if (sgn < 0) pod.rotation.x = Math.PI;
    g.add(pod);
    // thin wire arm with an eyelet at its end
    const s = sgn, h = len / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.1, s * (h - 0.02), 0), new THREE.Vector3(0.26, s * (h - 0.18), 0.1),
      new THREE.Vector3(0.36, s * (h - 0.42), 0.04), new THREE.Vector3(0.38, s * (h - 0.62), -0.04),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0055, 5), bronze));
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 14), steel);
    eye.position.copy(curve.getPoint(1)); eye.rotation.y = 0.8;
    g.add(eye);
  }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  const holder = new THREE.Group();
  holder.add(g);
  orb.add(holder);
  return holder;
}
const axles = [
  axle([0.5, 1, 0.15], 3.1, finial, podDish),
  axle([1, -0.12, 0.25], 2.6, () => podLens(false), () => podLens(true)),
  axle([0.15, 0.2, 1], 2.45, () => podLens(false), podLantern),
  axle([-0.8, 0.55, 0.45], 2.3, () => podLens(false), podDish),
];
axles.forEach((a, i) => spin(a, [0.2, 1, 0.1], 0.07 * (i % 2 ? -1 : 1)));

// ----- core: small amber lens in gimballed bronze rings, buried in a drum of stacked spoked gears -----
const core = new THREE.Group();
orb.add(core);
const lensGlass = new THREE.Mesh(new THREE.SphereGeometry(0.115, 32, 24),
  new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.1), toneMapped: false }));
const lensHot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.2), toneMapped: false }));
core.add(lensGlass, lensHot);
coreLight.position.set(0, 0, 0);
for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]]) {
  const r = new THREE.Mesh(ringBand(0.15, 0.21, 0.05), bronze);
  r.rotation.set(...rot);
  core.add(r);
}
// three stacks of gears, one per axis, so the core reads as a dense drum
const drumRot = [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]];
drumRot.forEach((rot, a) => {
  [[0.5, 20], [0.4, 16]].forEach(([r, teeth], i) => {
    const holder = new THREE.Group();
    holder.rotation.set(...rot);
    const m = new THREE.Mesh(spokedGear(r * (1 - a * 0.06), teeth, 0.034), i % 2 ? steel : bronze);
    m.position.z = (i - 0.5) * 0.08;
    holder.add(m);
    core.add(holder);
    spin(m, [0, 0, 1], (0.45 + i * 0.12) * (i % 2 ? -1 : 1) * (a % 2 ? -1 : 1));
  });
});
[[0.34, 12, [1.1, 0.5, 0.2], -0.7], [0.3, 11, [0.2, 1.1, 0.9], 0.8]].forEach(([r, t, rot, sp]) => {
  const holder = new THREE.Group();
  holder.rotation.set(...rot);
  const m = new THREE.Mesh(spokedGear(r, t, 0.03), bronze);
  holder.add(m);
  core.add(holder);
  spin(m, [0, 0, 1], sp);
});

// ----- blades: notched steel plates with a glowing orange edge -----
function blade(R, len, width, thick, notches, tilt, speed, axis) {
  const g = bladeGeo(R, len, width, thick, notches);
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  holder.add(new THREE.Mesh(g, bladeSemi));
  const { point } = g.userData;
  const pts = [];
  for (let i = 3; i <= 106; i++) pts.push(new THREE.Vector3(...point(i / 110, 1, 1)).multiplyScalar(1.003));
  holder.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.0032, 4), edgeGlow));
  orb.add(holder);
  spin(holder, axis, speed);
}
blade(1.74, 1.4, 0.3, 0.024, [[0.4, 0.5, 0.8], [0.66, 0.74, 0.86]], [0.4, 0.2, 2.4], 0.14, [0.3, 1, 0.2]);
blade(1.8, 1.25, 0.28, 0.024, [[0.34, 0.44, 0.82], [0.6, 0.68, 0.88]], [2.6, 0.5, 0.2], -0.11, [1, 0.2, 0.3]);
blade(1.72, 1.5, 0.26, 0.024, [[0.46, 0.56, 0.8]], [1.2, 2.4, 1.0], 0.09, [0.2, 0.4, 1]);
blade(1.84, 1.15, 0.32, 0.026, [[0.32, 0.42, 0.82], [0.62, 0.7, 0.88]], [3.4, 1.0, 1.9], -0.13, [0.5, 1, 0.5]);
blade(1.77, 1.35, 0.27, 0.024, [[0.4, 0.5, 0.8]], [0.8, 4.0, 0.5], 0.11, [1, 0.5, 0.1]);

// ---------- cyan filaments: thin beaded arcs ----------
const sparkUniforms = { uTime: { value: 0 }, uPx: { value: 1 } };
const sparkMat = new THREE.ShaderMaterial({
  uniforms: sparkUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPx;
    varying vec3 vColor; varying float vTw;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      float tw = 0.6 + 0.4 * sin(uTime * (2.0 + aPhase * 5.0) + aPhase * 40.0);
      vTw = tw; vColor = aColor;
      gl_PointSize = aSize * uPx * (0.7 + 0.5 * tw) * (38.0 / -mv.z);
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

function filament({ radius, arc, color, tilt, speed, beads = 120, wobble = 0.06 }) {
  const pos = new Float32Array(beads * 3), col = new Float32Array(beads * 3), sz = new Float32Array(beads), ph = new Float32Array(beads);
  for (let i = 0; i < beads; i++) {
    const u = Math.pow(Math.random(), 1.3), a = u * arc, r = radius + (Math.random() - 0.5) * wobble * (0.4 + u);
    pos.set([Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * wobble], i * 3);
    const f = Math.pow(1 - u, 1.1), hot = Math.random() < 0.08;
    const c = hot ? new THREE.Color('#e8fbff') : color;
    col.set([c.r * (0.2 + f * 0.8), c.g * (0.2 + f * 0.8), c.b * (0.2 + f * 0.8)], i * 3);
    sz[i] = (hot ? 2.4 : 1.0 + Math.random() * 0.8) * (0.5 + f * 0.7);
    ph[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(g, sparkMat);
  const N = 120, lp = new Float32Array(N * 3), lc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), a = u * arc, f = Math.pow(1 - u, 1.2) * 1.5, w = Math.sin(u * 9) * wobble * 0.3;
    lp.set([Math.cos(a) * (radius + w), Math.sin(a) * (radius + w), 0], i * 3);
    lc.set([color.r * f, color.g * f, color.b * f], i * 3);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rotor = new THREE.Group();
  rotor.add(pts, line);
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  holder.add(rotor);
  orb.add(holder);
  spin(rotor, [0, 0, 1], speed);
}
filament({ radius: 1.0, arc: 3.6, color: CYAN, tilt: [1.0, 0.3, 0.4], speed: 1.0 });
filament({ radius: 1.2, arc: 3.2, color: CYAN, tilt: [0.4, 1.2, 1.9], speed: -0.8 });
filament({ radius: 0.8, arc: 3.0, color: CYAN, tilt: [2.0, 0.2, 0.9], speed: 1.3 });
filament({ radius: 1.1, arc: 2.4, color: ORANGE, tilt: [0.2, 0.8, 1.2], speed: -1.1, beads: 70 });
filament({ radius: 1.5, arc: 2.4, color: CYAN, tilt: [1.6, 0.9, 0.3], speed: 0.7 });
filament({ radius: 0.9, arc: 2.6, color: CYAN, tilt: [0.7, 2.1, 0.2], speed: -1.2 });
filament({ radius: 1.35, arc: 2.2, color: CYAN, tilt: [2.4, 0.2, 1.4], speed: 0.9 });
filament({ radius: 1.05, arc: 1.8, color: ORANGE, tilt: [1.1, 1.6, 0.6], speed: 1.0, beads: 60 });

// Embers: warm motes concentrated around the blades, as if the dissolving metal were shedding them.
{
  const n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = 1.5 + Math.random() * 0.6, th = Math.random() * TAU, z = Math.random() * 2 - 1, k = Math.sqrt(1 - z * z);
    pos.set([Math.cos(th) * k * r, z * r, Math.sin(th) * k * r], i * 3);
    const c = Math.random() < 0.2 ? CYAN : ORANGE;
    col.set([c.r * 0.7, c.g * 0.7, c.b * 0.7], i * 3);
    sz[i] = 0.35 + Math.random() * 0.9;
    ph[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const embers = new THREE.Points(g, sparkMat);
  orb.add(embers);
  spin(embers, [0.1, 1, 0.05], 0.06);
}

// ---------- denim band ----------
const band = createDenimBand();
orb.add(band.group);
spin(band.group, [0.2, 1, 0.3], 0.09);

// ---------- postprocessing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

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
let frames = 0, acc = 0;
const q = new THREE.Quaternion();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), k = +$('spin').value;
  for (const s of spinners) { q.setFromAxisAngle(s.axis, s.speed * dt * k); s.obj.quaternion.multiply(q); }
  const t = clock.elapsedTime;
  sparkUniforms.uTime.value = t;
  semiTime.value = t;
  const pulse = 1 + Math.sin(t * 2.1) * 0.06 + Math.sin(t * 5.3) * 0.025;
  lensGlass.scale.setScalar(pulse);
  coreLight.intensity = 3.2 * pulse;
  orb.rotation.y += dt * 0.07 * k;
  band.update(t);
  controls.update();
  composer.render();
  frames++; acc += dt;
  if (acc > 0.5) { $('fps').textContent = Math.round(frames / acc); frames = 0; acc = 0; }
});


