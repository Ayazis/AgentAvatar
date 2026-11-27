// Armillary orb spike: procedural geometry + emissive materials + bloom.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const ORANGE = new THREE.Color('#ff8a1f');
const CYAN = new THREE.Color('#38c8ff');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
// Purple-tinted backdrop: radial gradient, drawn behind everything.
{
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 360);
  g.addColorStop(0, '#22102a'); g.addColorStop(0.55, '#120818'); g.addColorStop(1, '#040208');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}

// Studio environment: a dark room with a few bright coloured light cards.
// These are what show up as long highlight streaks on the metal.
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: '#07040a', side: THREE.BackSide })));
  const card = (color, w, h, pos, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  card('#ff8a30', 4, 10, [-8, 1, 3], 11);   // warm strip, left
  card('#ffb060', 8, 1.2, [0, 9, 2], 7);  // warm top bar
  card('#38c8ff', 1.5, 7, [8, 0, -4], 2.2); // cyan strip, back right
  card('#38c8ff', 6, 1, [-2, -8, -3], 1); // faint cyan floor bounce
  card('#ffd8a0', 5, 5, [3, 2, 9], 3.5);  // soft fill behind the camera
  scene.environment = pmrem.fromScene(env, 0.02).texture;
}

// Procedural wear: tarnish blotches + fine scratches, used as colour, roughness and bump.
function wearTexture(seed) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#b0b0b0'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) { // soft dark tarnish patches
    const px = r() * S, py = r() * S, rad = 20 + r() * 80;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(40,30,25,${0.12 + r() * 0.25})`); g.addColorStop(1, 'rgba(40,30,25,0)');
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 420; i++) { // thin bright scratches
    x.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.35})`;
    x.lineWidth = 0.4 + r() * 0.9;
    const px = r() * S, py = r() * S, a = r() * Math.PI, len = 8 + r() * 70;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
  }
  for (let i = 0; i < 5000; i++) { // grain
    x.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
    x.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = 4;
  return t;
}
const wearA = wearTexture(11), wearB = wearTexture(97);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
camera.position.set(0.2, 0.35, 5.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 9;

// ---------- lights ----------
const coreLight = new THREE.PointLight(ORANGE, 4, 6, 1.8);
scene.add(coreLight);
const rimCyan = new THREE.DirectionalLight(CYAN, 1.4);
rimCyan.position.set(-3, 2, -2);
const rimWarm = new THREE.DirectionalLight('#ffb070', 1.8);
rimWarm.position.set(3, 1.5, 2.5);
scene.add(rimCyan, rimWarm);

// ---------- materials ----------
const brass = new THREE.MeshStandardMaterial({
  color: '#c8a070', metalness: 1, roughness: 0.62, envMapIntensity: 1.0,
  map: wearA, roughnessMap: wearA, bumpMap: wearA, bumpScale: 1.2,
});
const darkBronze = new THREE.MeshStandardMaterial({
  color: '#8a6a58', metalness: 1, roughness: 0.7, envMapIntensity: 0.9, side: THREE.DoubleSide,
  map: wearB, roughnessMap: wearB, bumpMap: wearB, bumpScale: 1.5,
});
const glow = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(2.0), toneMapped: false });

// Bright orange rim on blade edges (fresnel) injected into the standard shader.
darkBronze.onBeforeCompile = (sh) => {
  sh.uniforms.rimColor = { value: ORANGE.clone().multiplyScalar(1.1) };
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
    .replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 6.0);
       totalEmissiveRadiance += rimColor * rimF;`);
};

// ---------- geometry helpers ----------
function annulus(rIn, rOut, depth, bevel = depth * 0.25, seg = 128, slots = 0, slotFill = 0.5) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(h);
  // elongated cut-outs along the band
  const mid = (rIn + rOut) / 2, hw = (rOut - rIn) * 0.26;
  for (let i = 0; i < slots; i++) {
    const c = (i / slots) * Math.PI * 2, half = (Math.PI / slots) * slotFill;
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push([c - half + (2 * half * k) / 10, mid + hw]);
    for (let k = 10; k >= 0; k--) pts.push([c - half + (2 * half * k) / 10, mid - hw]);
    const p = new THREE.Path();
    pts.forEach(([a, r], k) => (k ? p.lineTo(Math.cos(a) * r, Math.sin(a) * r) : p.moveTo(Math.cos(a) * r, Math.sin(a) * r)));
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Sculpted blade: a tapered patch on a sphere, with real thickness, a crowned face and walls.
function bladeGeo(R, len, width, thick) {
  const NU = 56, NV = 16;
  const hw = (u) => width * Math.pow(1 - u, 0.8) * (0.4 + 0.6 * Math.sin(Math.min(1, u * 2.6) * Math.PI / 2));
  const P = [], UV = [], idx = [];
  const point = (u, v, side) => {
    const a = u * len, b = v * hw(u);
    const t = thick * (1 - 0.6 * u);
    const r = side > 0 ? R + t * (0.5 + 0.7 * v * v) : R - t * 0.5;
    return [r * Math.cos(b) * Math.cos(a), r * Math.sin(b), r * Math.cos(b) * Math.sin(a)];
  };
  const grid = (side) => {
    const base = P.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = -1 + (2 * j) / NV;
      P.push(...point(u, v, side)); UV.push(u * 2, (v + 1) * 0.5);
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

function gearGeo(r, teeth, depth) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = (i % 4 === 1 || i % 4 === 2) ? r * 1.0 : r * 0.84;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.2, bevelSize: depth * 0.2, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function rand(seed) { // small deterministic RNG so the orb looks the same each load
  let t = seed >>> 0;
  return () => ((t = (t + 0x6d2b79f5) >>> 0), ((t ^ (t >>> 15)) * (1 | t)) >>> 0) / 4294967296 + 0.5 - 0.5;
}
const rng = rand(7);

// ---------- orb assembly ----------
const orb = new THREE.Group();
scene.add(orb);
const spinners = []; // { obj, axis, speed }
const spin = (obj, axis, speed) => spinners.push({ obj, axis: new THREE.Vector3(...axis).normalize(), speed });

// Core
const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), glow);
orb.add(core);
coreLight.position.set(0, 0, 0);

// Gears around the core
[[0.42, 16, 0.07, [1, 0, 0], 0.6], [0.34, 12, 0.06, [0, 1, 0], -0.9], [0.5, 20, 0.05, [0.3, 0, 1], 0.4]]
  .forEach(([r, t, d, axis, sp], i) => {
    const gp = new THREE.Group();
    const m = new THREE.Mesh(gearGeo(r, t, d), brass);
    gp.add(m);
    gp.rotation.set(i * 1.1, i * 0.7, 0);
    orb.add(gp);
    spin(m, [0, 0, 1], sp);
  });

// Axles with glowing pods at the ends
function axle(dir, len = 1.9) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 12), brass);
  g.add(shaft);
  for (const sgn of [-1, 1]) {
    const pod = new THREE.Group();
    pod.position.y = sgn * (len / 2);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.14, 24), brass);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), glow);
    cap.position.y = sgn * 0.08;
    pod.add(body, cap);
    g.add(pod);
  }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  return g;
}

// Nested gimbal rings: each ring sits inside a rotating group
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 1);
function ringGroup({ rIn, rOut, depth, tilt, axis, speed, ticks = 0, slots = 0, bolts = 0, markers = 0, double = false }) {
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  const rotor = new THREE.Group();
  holder.add(rotor);
  rotor.add(new THREE.Mesh(annulus(rIn, rOut, depth, depth * 0.25, 128, slots), brass));
  const mid = (rIn + rOut) / 2;
  if (double) { // a second, thinner band just inside and proud of the main one, tied back with spokes
    const inner = new THREE.Mesh(annulus(rIn - 0.05, rIn - 0.012, depth * 0.6), darkBronze);
    inner.position.z = depth * 0.45;
    rotor.add(inner);
    const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.012, depth * 0.5), brass, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, r = rIn - 0.02;
      _q.setFromAxisAngle(_z, a);
      spokes.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * r, Math.sin(a) * r, depth * 0.2), _q, _one));
    }
    rotor.add(spokes);
  }
  const place = (geo, n, radius, z) => {
    const im = new THREE.InstancedMesh(geo, brass, n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      _q.setFromAxisAngle(_z, a);
      im.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * radius, Math.sin(a) * radius, z), _q, _one));
    }
    rotor.add(im);
  };
  if (ticks) place(new THREE.BoxGeometry(0.012, 0.04, depth * 1.6), ticks, rOut + 0.012, 0);
  if (markers) place(new THREE.BoxGeometry(0.03, 0.07, depth * 1.9), markers, rOut + 0.02, 0);
  if (bolts) { // hex bolt heads on both faces
    const bg = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6).rotateX(Math.PI / 2);
    place(bg, bolts, mid, depth / 2 + 0.012);
    place(bg, bolts, mid, -depth / 2 - 0.012);
  }
  orb.add(holder);
  spin(rotor, axis, speed);
  return { holder, rotor };
}

ringGroup({ rIn: 0.62, rOut: 0.72, depth: 0.05, tilt: [0.9, 0.2, 0], axis: [0, 0, 1], speed: 0.5, ticks: 90, markers: 12, double: true });
ringGroup({ rIn: 0.82, rOut: 0.94, depth: 0.07, tilt: [1.4, 0, 0.6], axis: [0, 0, 1], speed: -0.35, slots: 16, bolts: 16 });
ringGroup({ rIn: 1.02, rOut: 1.12, depth: 0.04, tilt: [0.3, 1.0, 0.2], axis: [0, 0, 1], speed: 0.22, ticks: 120, markers: 24, bolts: 24 });
ringGroup({ rIn: 1.2, rOut: 1.3, depth: 0.035, tilt: [1.9, 0.4, 0.9], axis: [0, 0, 1], speed: -0.15, slots: 24, double: true, markers: 8 });

// Axles inside the rings (a few directions), each with own slow tumble
[[1, 0.2, 0], [0, 1, 0.3], [0.4, 0.2, 1]].forEach((d, i) => {
  const a = axle(d, 1.7 + i * 0.12);
  orb.add(a);
  spin(a, [0.2, 1, 0.1], 0.18 * (i % 2 ? -1 : 1));
});

// Blades: tapered, thick, crowned plates with glowing rim and engraved ribs
const ribMat = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(0.9), toneMapped: false });
function blade(radius, len, width, thick, tilt, speed, axis, ribs = [-0.4, 0.4]) {
  const g = bladeGeo(radius, len, width, thick);
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  holder.add(new THREE.Mesh(g, darkBronze));
  const { point } = g.userData;
  for (const v of ribs) { // thin glowing line following the blade, lifted just above the face
    const pts = [];
    for (let i = 4; i <= 46; i++) pts.push(new THREE.Vector3(...point(i / 56, v, 1)).multiplyScalar(1.004));
    holder.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0045, 4), ribMat));
  }
  orb.add(holder);
  spin(holder, axis, speed);
}
blade(1.52, 0.95, 0.40, 0.045, [0.4, 0.2, 2.4], 0.16, [0.3, 1, 0.2]);
blade(1.58, 0.85, 0.36, 0.045, [2.6, 0.5, 0.2], -0.12, [1, 0.2, 0.3]);
blade(1.50, 1.05, 0.34, 0.045, [1.2, 2.4, 1.0], 0.1, [0.2, 0.4, 1]);
blade(1.62, 0.80, 0.44, 0.05, [3.4, 1.0, 1.9], -0.14, [0.5, 1, 0.5]);
blade(1.55, 0.95, 0.36, 0.045, [0.8, 4.0, 0.5], 0.12, [1, 0.5, 0.1]);

// ---------- sparks: shader particles with per-point size, twinkle and motion tails ----------
const sparkUniforms = { uTime: { value: 0 }, uPx: { value: 1 } };
const sparkMat = new THREE.ShaderMaterial({
  uniforms: sparkUniforms,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPx;
    varying vec3 vColor; varying float vTw;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      float tw = 0.55 + 0.45 * sin(uTime * (2.0 + aPhase * 5.0) + aPhase * 40.0);
      vTw = tw; vColor = aColor;
      gl_PointSize = aSize * uPx * (0.6 + 0.6 * tw) * (31.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vTw;
    void main(){
      vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;
      float core = smoothstep(1.0, 0.0, d);
      float a = core * core * (0.5 + 0.9 * pow(core, 4.0));
      gl_FragColor = vec4(vColor * (0.6 + 1.6 * vTw) * a, a);
    }`,
});

function stream({ radius, count, arc, color, tilt, speed, size }) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const sz = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.pow(Math.random(), 1.5);                  // density piles up at the head
    const a = u * arc;
    const spread = 0.015 + u * 0.09;                          // tail fans out
    const r = radius + (Math.random() - 0.5) * spread * 2;
    pos.set([Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * spread * 1.5], i * 3);
    const fade = Math.pow(1 - u, 1.3);
    const hot = Math.random() < 0.08;                          // a few bright white-hot sparks
    const c = hot ? new THREE.Color('#ffffff') : color;
    col.set([c.r * (0.25 + fade), c.g * (0.25 + fade), c.b * (0.25 + fade)], i * 3);
    sz[i] = (hot ? 2.2 : 0.5 + Math.random() * 1.1) * size * (0.5 + fade * 0.8);
    ph[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(g, sparkMat);

  // faint filament the sparks ride on: thin arc with a fading tail
  const N = 96, lp = new Float32Array(N * 3), lc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), a = u * arc, f = Math.pow(1 - u, 1.6) * 0.55;
    lp.set([Math.cos(a) * radius, Math.sin(a) * radius, 0], i * 3);
    lc.set([color.r * f, color.g * f, color.b * f], i * 3);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));

  const rotor = new THREE.Group();
  rotor.add(pts, line);
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  holder.add(rotor);
  orb.add(holder);
  spin(rotor, [0, 0, 1], speed);
}
stream({ radius: 0.95, count: 520, arc: 3.6, color: CYAN, tilt: [1.0, 0.3, 0.4], speed: 1.1, size: 1 });
stream({ radius: 1.15, count: 460, arc: 3.2, color: CYAN, tilt: [0.4, 1.2, 1.9], speed: -0.8, size: 1 });
stream({ radius: 0.7, count: 360, arc: 3.0, color: CYAN, tilt: [2.0, 0.2, 0.9], speed: 1.5, size: 0.9 });
stream({ radius: 1.05, count: 320, arc: 2.4, color: ORANGE, tilt: [0.2, 0.8, 1.2], speed: -1.2, size: 1 });
stream({ radius: 1.3, count: 240, arc: 2.0, color: ORANGE, tilt: [1.6, 0.9, 0.3], speed: 0.9, size: 0.9 });

// Embers: sparse warm motes drifting in a shell around the orb (outside the orb group, so they stay put)
{
  const n = 160, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const sz = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = 1.0 + Math.random() * 1.6, th = Math.random() * Math.PI * 2, z = Math.random() * 2 - 1;
    const s = Math.sqrt(1 - z * z);
    pos.set([Math.cos(th) * s * r, z * r, Math.sin(th) * s * r], i * 3);
    const c = Math.random() < 0.25 ? CYAN : ORANGE;
    col.set([c.r * 0.5, c.g * 0.5, c.b * 0.5], i * 3);
    sz[i] = 0.3 + Math.random() * 0.7;
    ph[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const embers = new THREE.Points(g, sparkMat);
  scene.add(embers);
  spin(embers, [0.1, 1, 0.05], 0.05);
}

// ---------- postprocessing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, +$('pr').value));
  sparkUniforms.uPx.value = renderer.getPixelRatio();
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  // keep the whole orb in view on narrow (portrait) screens
  camera.fov = w / h < 1 ? 35 / Math.min(1, w / h) * 0.85 : 35;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
$('pr').addEventListener('change', resize);
$('bloom').addEventListener('input', (e) => (bloom.strength = +e.target.value));
$('radius').addEventListener('input', (e) => (bloom.radius = +e.target.value));
$('thresh').addEventListener('input', (e) => (bloom.threshold = +e.target.value));
resize();

// triangle count for the HUD
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
  const dt = Math.min(clock.getDelta(), 0.05);
  const k = +$('spin').value;
  for (const s of spinners) {
    q.setFromAxisAngle(s.axis, s.speed * dt * k);
    s.obj.quaternion.multiply(q);
  }
  const t = clock.elapsedTime;
  sparkUniforms.uTime.value = t;
  const pulse = 1 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.03;
  core.scale.setScalar(pulse);
  coreLight.intensity = 4 * pulse;
  orb.rotation.y += dt * 0.08 * k;
  controls.update();
  composer.render();

  frames++; acc += dt;
  if (acc > 0.5) { $('fps').textContent = Math.round(frames / acc); frames = 0; acc = 0; }
});
