// Armillary orb spike: procedural geometry + emissive materials + bloom.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
scene.background = new THREE.Color('#0a0610');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

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
  color: '#8a6a48', metalness: 1, roughness: 0.34, envMapIntensity: 0.55,
});
const darkBronze = new THREE.MeshStandardMaterial({
  color: '#4a3a30', metalness: 1, roughness: 0.42, envMapIntensity: 0.5, side: THREE.DoubleSide,
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
function annulus(rIn, rOut, depth, bevel = depth * 0.25, seg = 128) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg,
  });
  g.translate(0, 0, -depth / 2);
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
function ringGroup({ rIn, rOut, depth, tilt, axis, speed, ticks = 0, tiltAxis = [1, 0, 0] }) {
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  const rotor = new THREE.Group();
  holder.add(rotor);
  rotor.add(new THREE.Mesh(annulus(rIn, rOut, depth), brass));
  if (ticks) {
    const tick = new THREE.BoxGeometry(0.012, 0.04, depth * 1.6);
    const im = new THREE.InstancedMesh(tick, brass, ticks);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      p.set(Math.cos(a) * (rOut + 0.012), Math.sin(a) * (rOut + 0.012), 0);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      im.setMatrixAt(i, m.compose(p, q, one));
    }
    rotor.add(im);
  }
  orb.add(holder);
  spin(rotor, axis, speed);
  return { holder, rotor };
}

ringGroup({ rIn: 0.62, rOut: 0.72, depth: 0.05, tilt: [0.9, 0.2, 0], axis: [0, 0, 1], speed: 0.5, ticks: 90 });
ringGroup({ rIn: 0.82, rOut: 0.92, depth: 0.07, tilt: [1.4, 0, 0.6], axis: [0, 0, 1], speed: -0.35 });
ringGroup({ rIn: 1.02, rOut: 1.1, depth: 0.04, tilt: [0.3, 1.0, 0.2], axis: [0, 0, 1], speed: 0.22, ticks: 120 });
ringGroup({ rIn: 1.2, rOut: 1.27, depth: 0.03, tilt: [1.9, 0.4, 0.9], axis: [0, 0, 1], speed: -0.15 });

// Axles inside the rings (a few directions), each with own slow tumble
[[1, 0.2, 0], [0, 1, 0.3], [0.4, 0.2, 1]].forEach((d, i) => {
  const a = axle(d, 1.7 + i * 0.12);
  orb.add(a);
  spin(a, [0.2, 1, 0.1], 0.18 * (i % 2 ? -1 : 1));
});

// Blades: partial spherical shells with a glowing fresnel rim
function blade(radius, phi, theta, tilt, speed, axis) {
  const g = new THREE.SphereGeometry(radius, 64, 28, 0, phi, 0.0, theta);
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  const m = new THREE.Mesh(g, darkBronze);
  holder.add(m);
  orb.add(holder);
  spin(holder, axis, speed);
}
blade(1.34, 1.3, 1.1, [0.4, 0.2, 2.4], 0.16, [0.3, 1, 0.2]);
blade(1.4, 1.1, 1.0, [2.6, 0.5, 0.2], -0.12, [1, 0.2, 0.3]);
blade(1.3, 1.5, 0.9, [1.2, 2.4, 1.0], 0.1, [0.2, 0.4, 1]);
blade(1.46, 1.0, 1.2, [3.4, 1.0, 1.9], -0.14, [0.5, 1, 0.5]);
blade(1.38, 1.2, 0.95, [0.8, 4.0, 0.5], 0.12, [1, 0.5, 0.1]);

// ---------- sparks: glowing particles streaming on tilted orbits ----------
function spriteTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#fff8'); g.addColorStop(1, '#0000');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const sprite = spriteTex();

function stream({ radius, count, arc, color, tilt, speed, size }) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.pow(Math.random(), 1.6);               // density piles up at the head
    const a = u * arc;
    const j = (Math.random() - 0.5) * 0.06 * (1 + u * 2); // tail spreads out
    const r = radius + j;
    pos.set([Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.05], i * 3);
    const fade = 1 - u * 0.85;
    col.set([color.r * fade, color.g * fade, color.b * fade], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    size, map: sprite, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  const holder = new THREE.Group();
  holder.rotation.set(...tilt);
  holder.add(pts);
  orb.add(holder);
  spin(pts, [0, 0, 1], speed);
}
stream({ radius: 0.95, count: 420, arc: 3.4, color: CYAN, tilt: [1.0, 0.3, 0.4], speed: 1.1, size: 0.05 });
stream({ radius: 1.15, count: 380, arc: 3.0, color: CYAN, tilt: [0.4, 1.2, 1.9], speed: -0.8, size: 0.045 });
stream({ radius: 0.7, count: 300, arc: 2.8, color: CYAN, tilt: [2.0, 0.2, 0.9], speed: 1.5, size: 0.04 });
stream({ radius: 1.05, count: 260, arc: 2.2, color: ORANGE, tilt: [0.2, 0.8, 1.2], speed: -1.2, size: 0.05 });

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
  const pulse = 1 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.03;
  core.scale.setScalar(pulse);
  coreLight.intensity = 4 * pulse;
  orb.rotation.y += dt * 0.08 * k;
  controls.update();
  composer.render();

  frames++; acc += dt;
  if (acc > 0.5) { $('fps').textContent = Math.round(frames / acc); frames = 0; acc = 0; }
});
