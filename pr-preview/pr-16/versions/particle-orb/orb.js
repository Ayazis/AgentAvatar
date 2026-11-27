// Rosie particle orb spike: a shell of stippled denim plates with glowing stitched hems around a
// burning particle core, floating over the scarf base. Everything except the scarf is particles.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const V3 = THREE.Vector3;
const canvas = document.getElementById('c');

// ---------------------------------------------------------------- layout
const ORB_Y = .315;      // orb centre, fraction of stage height from the top
const ORB_R = .24;      // shell radius, fraction of stage height
const FOV = 30;
const DIST = 1 / (Math.tan(FOV * Math.PI / 360) * 2 * ORB_R);   // camera distance that gives that radius

// ---------------------------------------------------------------- states
const STATES = {
  off:     { open: 0,   power: .16, core: .05, spin: .03, energy: 0,   lit: 0,   halo: .12, swirl: 0 },
  idle:    { open: .32, power: 1,   core: 1,   spin: .12, energy: .25, lit: 1,   halo: .7,  swirl: .45 },
  working: { open: 1,   power: 1.1, core: 1.55, spin: .38, energy: 1,  lit: 1.75, halo: 1.15, swirl: 1 },
};
const live = { ...STATES.idle };
let target = STATES.idle;

const tune = { open: 1, spin: 1, core: 1, size: 1, bloom: 1, rays: 1, rayLength: .85, hemRays: 1, swirls: 1, swirlSpeed: 1, scarfMode: 1, scarfLight: 1, layout: 6, gap: .03, density: 1 };

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1.5, .1, 100);
camera.position.set(0, 0, DIST);

// the orb is drawn alone on black and bloomed, then added over the scarf, so the scarf itself never blooms
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .45, .3, .25);
composer.addPass(bloom);

// ---------------------------------------------------------------- background + scarf
const loader = new THREE.TextureLoader();
const tex = (n, srgb = true) => { const t = loader.load(`../../assets/base/scarf-${n}.webp`); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const bgPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tLit: { value: tex('lit') }, tUnlit: { value: tex('unlit') }, tBright: { value: tex('bright') }, uLit: { value: 0 },
              tNormal: { value: tex('normal', false) }, tReach: { value: tex('reach', false) }, tLight: { value: null },
              uLightUV: { value: new THREE.Vector2(.5, .7) }, uLightGain: { value: 1 }, uCode: { value: 1 }, tRays: { value: null }, tOcc: { value: null }, uRays: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tDiffuse, tLit, tUnlit, tBright, tRays, tOcc, tNormal, tReach, tLight;
    uniform float uLit, uRays, uLightGain, uCode; uniform vec2 uLightUV;
    void main(){
      vec2 p = vUv;
      float r = length((p - vec2(.5, .66)) * vec2(1.35, 1.));
      vec3 bg = mix(vec3(.016, .004, .013), vec3(.002, .001, .003), smoothstep(.05, .95, r));
      bg += vec3(.04, .012, .006) * exp(-pow(length((p - vec2(.5, .14)) * vec2(1., 2.6)), 2.) * 3.) * min(uLit, 1.5);   // warm floor
      vec4 u = texture2D(tUnlit, p), l = texture2D(tLit, p), b = texture2D(tBright, p);
      vec4 painted = uLit < 1. ? mix(u, l, uLit) : mix(l, b, smoothstep(0., 1., uLit - 1.));   // more light: lit, then bright

      // code light: the unlit scarf lit by everything the orb draws, in its own colours. The whole orb is rendered
      // small into a light buffer; a grid of spots over the orb's lower half is read from a blurred level of it
      // and each lights the scarf from its own direction, so blue plates and cool swirls throw blue light and the
      // core and warm wisps throw orange. The normals shape the folds; the reach mask (where ChatGPT's bright
      // version has light) keeps the light out of places the painting leaves dark.
      vec3 N = normalize(texture2D(tNormal, p).rgb * 2. - 1.);
      float reach = texture2D(tReach, p).r;
      vec3 light = vec3(0.); float spec = 0.;
      for (int i = 0; i < 20; i++) {                           // a 5 x 4 grid over the orb's lower half and just below it
        vec2 o = vec2(float(i - (i / 5) * 5) - 2., -float(i / 5)) * vec2(.075, .095);
        vec2 q = uLightUV + o;
        vec3 c = textureLod(tLight, q, 2.6).rgb;
        vec2 d = (q - p) * vec2(1.5, 1.);
        vec3 L = normalize(vec3(d, .2));
        float wrap = max((dot(N, L) + .3) / 1.3, 0.);
        float att = 1. / (1. + dot(d, d) * 14.);                // close light counts most: a wisp dipping low lights the folds under it
        light += c * wrap * att;
        spec += pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 20.) * att * dot(c, vec3(.33));
      }
      light = light * uLightGain + texture2D(tRays, p).rgb * uRays * .6 * max((dot(N, normalize(vec3((uLightUV - p) * vec2(1.5, 1.), .22))) + .3) / 1.3, 0.);
      light *= mix(.12, 1.25, reach);
      spec *= uLightGain * mix(.2, 1., reach);
      vec3 albedo = mix(u.rgb, vec3(dot(u.rgb, vec3(.3, .59, .11))), .55) * 3. + .03;   // denim takes the light's colour, as in the painted bright version
      vec4 code = vec4(u.rgb + albedo * light + light * spec * .12, u.a);
      vec4 s = mix(painted, code, uCode);
      gl_FragColor = vec4(mix(bg, s.rgb, s.a) + texture2D(tDiffuse, p).rgb + texture2D(tRays, p).rgb * uRays * (1. - .8 * texture2D(tOcc, p).a), 1.);
    }`,
});
const bgMat = bgPass.material;
composer.addPass(bgPass);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- shared point sprite
// A soft gaussian with a hot pinpoint centre: reads as a light, not a flat dot.
const SPRITE_FRAG = `
  uniform float uSize, uLightMul;
  varying vec3 vCol; varying float vHot;
  void main(){
    vec2 c = gl_PointCoord * 2. - 1.; float d = dot(c, c);
    if (d > 1.) discard;
    float a = exp(-d * 5.) * (1. - d) + vHot * exp(-d * 40.);
    gl_FragColor = vec4(vCol * a * min(1., pow(uSize, -1.4)) * uLightMul, 1.);   // big sprites dim so they don't flood the bloom; small ones just shrink
  }`;
const common = () => ({
  uTime: { value: 0 }, uPower: { value: 1 }, uCore: { value: 1 }, uEnergy: { value: 0 },
  uSize: { value: 1 }, uPx: { value: 1 }, uDist: { value: DIST }, uHalo: { value: 1 }, uGain: { value: 1 }, uLightMul: { value: 1 },
});
const pointsMat = (uniforms, vertexShader) => new THREE.ShaderMaterial({
  uniforms, vertexShader, fragmentShader: SPRITE_FRAG,
  blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
});

// ---------------------------------------------------------------- shell plates
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function plateCentres(n) {
  if (n === 6) return [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(a => new V3(...a));
  const p = (1 + Math.sqrt(5)) / 2, out = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) out.push(new V3(0, s, t * p), new V3(s, t * p, 0), new V3(t * p, 0, s));
  return out.map(v => v.normalize());
}

// Which plate a point belongs to, as a signed margin: > 0 inside plate i. A soft max over the other
// plates rounds the corners, which leaves small holes where three plates meet (the core peeks through).
function margin(p, centres, i, gap) {
  const K = .022; let s = 0;
  for (let j = 0; j < centres.length; j++) if (j !== i) s += Math.exp((p.dot(centres[j]) - 1) / K);
  return p.dot(centres[i]) - (1 + K * Math.log(s)) - gap;
}

const KIND = { cloth: 0, inner: 1, hem: 2, stitch: 3 };

function buildPlate(centres, i, gap, density, rnd) {
  const c = centres[i];
  const U = new V3().crossVectors(Math.abs(c.y) > .9 ? new V3(1, 0, 0) : new V3(0, 1, 0), c).normalize();
  const W = new V3().crossVectors(c, U);
  const pos = [], kind = [], seed = [], bri = [], edge = [], phase = [];
  const push = (p, r, k, b, e, ph) => { pos.push(p.x * r, p.y * r, p.z * r); kind.push(k); seed.push(rnd()); bri.push(b); edge.push(e); phase.push(ph); };
  const at = (x, y) => new V3().copy(c).addScaledVector(U, x).addScaledVector(W, y).normalize();

  // cloth: points laid along diagonal twill lines, with the weave's raised ribs brighter
  const dw = .026 / Math.sqrt(density), da = .0105 / Math.sqrt(density), ext = 1.5;
  let line = 0;
  for (let w = -ext; w <= ext; w += dw, line++) {
    let step = 0;
    for (let a = -ext; a <= ext; a += da, step++) {
      const x = (a - w) * .7071 + (rnd() - .5) * da * .7, y = (a + w) * .7071 + (rnd() - .5) * dw * .35;
      const p = at(x, y), m = margin(p, centres, i, gap);
      if (m <= 0) continue;
      const rib = ((step >> 1) + line) % 4 < 2 ? 1 : .32;        // 2/2 twill: ribs run diagonally
      const b = Math.min(1, rib * (.8 + rnd() * .4));
      const e = Math.min(1, m / .12);
      const lift = 1 + .016 * Math.max(0, 1 - m / .035);        // raised hem along the edge
      push(p, lift, KIND.cloth, b, e, 0);
      if ((step & 1) === 0 && (line & 1) === 0) push(p, .962, KIND.inner, b, e, 0);
    }
  }

  // contours: march out from the centre to where the margin hits `level`
  const contour = level => {
    const pts = [];
    for (let s = 0; s < 720; s++) {
      const ang = s / 720 * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
      let lo = 0, hi = 1.6;
      for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (margin(at(dx * mid, dy * mid), centres, i, gap) > level) lo = mid; else hi = mid; }
      pts.push(at(dx * lo, dy * lo));
    }
    pts.push(pts[0]);
    return pts;
  };
  const along = (pts, ds, fn) => {
    let L = 0, next = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], seg = a.distanceTo(b);
      while (next <= L + seg) { const t = (next - L) / seg; fn(new V3().lerpVectors(a, b, t).normalize(), next); next += ds; }
      L += seg;
    }
  };

  // hem: a hot rolled edge that wraps from the outer face down to the inner one, so the plate has thickness
  const hem = contour(.0);
  const hemDs = .0042 / Math.sqrt(density);
  [[1.016, 1], [1.004, .85], [.99, .6], [.976, .4]].forEach(([r, b]) =>
    along(hem, hemDs, (p, L) => push(p, r + (rnd() - .5) * .004, KIND.hem, b, 0, L)));

  // stitches: two rows of dashes, like the orange double topstitch on the jeans
  for (const level of [.04, .066]) along(contour(level), .0036 / Math.sqrt(density), (p, L) => {
    if ((L / .034) % 1 < .58) push(p, 1.009, KIND.stitch, 1, 0, L);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(bri, 1));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  return { g, c, U, W };
}

const plateUniforms = common();
const plateMat = pointsMat(plateUniforms, `
  attribute float aKind, aSeed, aB, aEdge, aPhase;
  uniform float uTime, uPower, uCore, uEnergy, uSize, uPx, uDist, uGain;
  varying vec3 vCol; varying float vHot;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    vec3 n = normalize(normalMatrix * normalize(position));
    vec3 v = normalize(-mv.xyz);
    float f = dot(n, v);
    float fres = pow(1. - abs(f), 2.2);
    float near = clamp(.5 - (-mv.z - uDist) * .55, 0., 1.);         // 1 at the front of the orb, 0 at the back
    float tw = .72 + .28 * sin(uTime * (1.1 + aSeed * 3.3) + aSeed * 61.);
    float glint = pow(max(0., sin(uTime * (.3 + aSeed * .5) + aSeed * 137.)), 70.) * 3.;
    vec3 wn = normalize(mat3(modelMatrix) * normalize(position));
    float sheen = pow(.5 + .5 * sin(dot(wn, normalize(vec3(.55, .8, .25))) * 6. - uTime * (.5 + uEnergy * 1.5)), 7.);
    vec3 col; float size = 1.; vHot = 0.;
    if (aKind < .5) {                                   // cloth stipple
      vec3 deep = vec3(.012, .045, .19), mid = vec3(.04, .24, .9), hi = vec3(.42, .86, 1.7);
      col = mix(deep, mid, aB) * .75;
      col = mix(col, hi, fres * .75);
      col *= .35 + 1.6 * fres + .5 * (1. - smoothstep(0., .3, aEdge));
      col += hi * sheen * .2 * aB;
      col *= f > 0. ? 1. : .3;                          // the shell's far side, seen through, stays faint
      col *= tw;
      col += vec3(.8, .95, 1.4) * glint * aB * .6;
      vHot = .35 * aB + glint;
      size = 1.35 + .7 * aB;
    } else if (aKind < 1.5) {                           // inner face, lit by the core
      col = vec3(1., .3, .05) * .1 * uCore * (.6 + .4 * tw) + vec3(.01, .03, .1);
      size = 1.3;
    } else if (aKind < 2.5) {                           // hot hem
      col = mix(vec3(1.1, .26, .03), vec3(1.9, .75, .22), aB * aB) * (.7 + .6 * fres) * (.85 + .15 * tw) * .32;
      col *= f > 0. ? 1. : .3;
      vHot = aB;
      size = 1.5 + 1.1 * aB;
    } else {                                            // stitches, with light running along them
      float run = pow(.5 + .5 * sin(aPhase * 9. - uTime * (1.2 + 3.5 * uEnergy)), 10.);
      col = (vec3(1.25, .4, .06) * (.55 + .5 * fres) + vec3(2.2, 1.1, .4) * run * (.4 + uEnergy)) * .6;
      col *= f > 0. ? 1. : .2;
      vHot = .5 + run;
      size = 1.7;
    }
    col *= uGain * uPower * mix(.38, 1., near);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uSize * uPx * (uDist / -mv.z) * mix(1.25, 1., near);
    vCol = col;
  }`);

const shell = new THREE.Group();          // tilt
const spin = new THREE.Group();           // turn
const orb = new THREE.Group();            // float
spin.add(shell); orb.add(spin); scene.add(orb);
shell.rotation.set(.42, 0, .28);
let plates = [];

function buildShell() {
  for (const p of plates) { shell.remove(p.obj, p.occ); p.obj.geometry.dispose(); }
  const centres = plateCentres(tune.layout), rnd = mulberry32(11);
  plates = centres.map((_, i) => {
    const { g, c, U, W } = buildPlate(centres, i, tune.gap, tune.density, rnd);
    const obj = new THREE.Points(g, plateMat);
    obj.matrixAutoUpdate = false; obj.frustumCulled = false;
    const occ = new THREE.Points(g, occMat);                 // the same plate, drawn into the ray mask
    occ.matrixAutoUpdate = false; occ.frustumCulled = false; occ.layers.set(1);
    shell.add(obj, occ);
    // each plate opens like a petal: it swings out about a hinge on one of its edges
    const ang = rnd() * Math.PI * 2;
    const dir = new V3().addScaledVector(U, Math.cos(ang)).addScaledVector(W, Math.sin(ang));
    let lo = 0, hi = 1.6;
    for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (margin(new V3().copy(c).addScaledVector(dir, mid).normalize(), centres, i, tune.gap) > 0) lo = mid; else hi = mid; }
    const pivot = new V3().copy(c).addScaledVector(dir, lo).normalize();
    return { obj, occ, c, pivot, hinge: new V3().crossVectors(c, dir).normalize(),
             k: rnd(), k2: rnd(), lag: .9 + rnd() * 1.4, open: live.open, phase: rnd() * 6.28 };
  });
}

const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), m3 = new THREE.Matrix4();
function placePlate(p, t) {
  const o = p.open * tune.open;
  const pushOut = o * (.03 + .1 * p.k) + .006 * Math.sin(t * .9 + p.phase) * live.power;
  const flap = o * (.26 + .38 * p.k) + .02 * Math.sin(t * .7 + p.phase) * o;
  const twirl = o * .3 * (p.k2 - .5);
  const M = p.obj.matrix, P = p.pivot;
  M.makeRotationAxis(p.c, twirl);                                                    // turn a little in place
  m1.makeTranslation(-P.x, -P.y, -P.z);
  m2.makeRotationAxis(p.hinge, flap);
  m3.makeTranslation(P.x + p.c.x * pushOut, P.y + p.c.y * pushOut, P.z + p.c.z * pushOut);
  M.premultiply(m1).premultiply(m2).premultiply(m3);                                 // swing out on the hinge, lift off
}

// ---------------------------------------------------------------- core
const coreUniforms = common();
function buildCore() {
  const N = 9000, rnd = mulberry32(5);
  const a = { aR: [], aAng: [], aSeed: [], aY: [], aMode: [] };
  for (let i = 0; i < N; i++) {
    const spiral = i < N * .55;
    a.aMode.push(spiral ? 0 : 1);
    a.aSeed.push(rnd());
    if (spiral) {                                // three spiral arms in a tilted disc
      const r = Math.pow(rnd(), 1.4);
      a.aR.push(r);
      a.aAng.push((i % 3) * 2.094 + Math.log(r + .05) * 2.2 + (rnd() - .5) * .55 * (1 - r * .5));
      a.aY.push((rnd() - .5) * .12 * (1 - r));
    } else {                                     // a sphere of sparks streaming outward from the centre
      a.aR.push(rnd());
      a.aAng.push(rnd() * Math.PI * 2);
      a.aY.push(rnd() * 2 - 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  for (const [k, v] of Object.entries(a)) g.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  const obj = new THREE.Points(g, pointsMat(coreUniforms, `
    attribute float aR, aAng, aSeed, aY, aMode;
    uniform float uTime, uPower, uCore, uEnergy, uSize, uPx, uDist;
    varying vec3 vCol; varying float vHot;
    void main(){
      vec3 p; float r, b;
      if (aMode < .5) {
        r = aR * .5;
        float ang = aAng + uTime * (.18 + .7 * uEnergy) / (aR * 2.5 + .3);
        p = vec3(cos(ang) * r, aY, sin(ang) * r);
        b = pow(1. - aR, 1.3);
      } else {
        float life = fract(aSeed * 7.31 + uTime * (.07 + .16 * uEnergy) * (.6 + aR));
        r = .03 + life * .52;
        float th = aAng + life * 1.4, y = aY;
        float s = sqrt(1. - y * y);
        p = vec3(cos(th) * s, y, sin(th) * s) * r;
        b = sin(life * 3.1416) * (1. - life) * 1.6;
      }
      float rr = length(p) / .5;
      vec3 col = mix(vec3(2.4, 1.9, 1.3), vec3(1.6, .5, .08), smoothstep(0., .35, rr));
      col = mix(col, vec3(.6, .08, .02), smoothstep(.45, 1., rr));
      float tw = .7 + .3 * sin(uTime * (3. + aSeed * 9.) + aSeed * 50.);
      col *= b * tw * uCore * uPower * .13;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1. + 1.6 * b) * uSize * uPx * (uDist / -mv.z);
      vHot = b;
      vCol = col;
    }`));
  obj.frustumCulled = false;
  return obj;
}
const coreGroup = new THREE.Group();
coreGroup.rotation.set(.5, 0, -.35);
coreGroup.add(buildCore());
orb.add(coreGroup);

// the white-hot heart and its starburst, on a camera-facing quad
const heartMat = new THREE.ShaderMaterial({
  uniforms: coreUniforms,
  blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime, uCore, uPower, uEnergy, uLightMul;
    void main(){
      vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x);
      float hot = exp(-r * r * 400.) * 2.5;
      float glow = exp(-r * r * 30.) * .45 + exp(-r * 6.) * .08;
      float rays = pow(abs(cos(a * 4. + uTime * .12)), 90.) * exp(-r * 6.) * 1.1
                 + pow(abs(cos(a * 3. - uTime * .08 + 1.)), 160.) * exp(-r * 3.8) * .55 * (.5 + uEnergy);
      vec3 col = vec3(1., .93, .8) * hot + vec3(1., .34, .05) * glow + vec3(1., .62, .28) * rays;
      float flicker = .92 + .08 * sin(uTime * 6.7) * sin(uTime * 2.3 + 1.);
      gl_FragColor = vec4(col * uCore * uPower * flicker * smoothstep(1., .55, r) * uLightMul, 1.);
    }`,
});
const heart = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), heartMat);
orb.add(heart);

// ---------------------------------------------------------------- halo: fine dust orbiting the shell, plus a few soft out-of-focus motes
const haloUniforms = common();
function buildHalo() {
  const N = 4200, rnd = mulberry32(23);
  const a = { aR: [], aAng: [], aY: [], aSeed: [], aWarm: [], aBig: [] };
  for (let i = 0; i < N; i++) {
    const big = i < 70;
    a.aBig.push(big ? 1 : 0);
    a.aR.push(big ? 1.15 + rnd() * .9 : 1.04 + Math.pow(rnd(), 2.2) * .55);
    a.aAng.push(rnd() * Math.PI * 2);
    a.aY.push((rnd() * 2 - 1) * (big ? .9 : .97));
    a.aSeed.push(rnd());
    a.aWarm.push(rnd() < .3 ? 1 : 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  for (const [k, v] of Object.entries(a)) g.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  const obj = new THREE.Points(g, pointsMat(haloUniforms, `
    attribute float aR, aAng, aY, aSeed, aWarm, aBig;
    uniform float uTime, uPower, uEnergy, uSize, uPx, uDist, uHalo;
    varying vec3 vCol; varying float vHot;
    void main(){
      float ang = aAng + uTime * (.04 + .12 * aSeed) * (1. + 2. * uEnergy) / aR;
      float s = sqrt(1. - aY * aY);
      vec3 p = vec3(cos(ang) * s, aY, sin(ang) * s) * aR;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      float near = clamp(.5 - (-mv.z - uDist) * .4, 0., 1.);
      float tw = pow(.5 + .5 * sin(uTime * (1.5 + aSeed * 4.) + aSeed * 90.), 3.);
      vec3 col = aWarm > .5 ? vec3(1.5, .48, .08) : vec3(.3, .72, 1.6);
      float fall = 1. - smoothstep(1.04, 1.6, aR);
      col *= (.15 + .85 * tw) * (.3 + .7 * fall) * mix(.3, 1., near) * uHalo * uPower * .55;
      float size = 1. + 1.4 * aSeed;
      vHot = tw * .6;
      if (aBig > .5) { col *= .07; size = 9. + 14. * aSeed; vHot = 0.; }
      gl_Position = projectionMatrix * mv;
      gl_PointSize = size * uSize * uPx * (uDist / -mv.z);
      vCol = col;
    }`));
  obj.frustumCulled = false;
  return obj;
}
const halo = new THREE.Group();
halo.rotation.set(.35, 0, .2);
halo.add(buildHalo());
orb.add(halo);

// ---------------------------------------------------------------- sparks escaping through the gaps
const sparkUniforms = common();
function buildSparks() {
  const N = 1100, rnd = mulberry32(31);
  const a = { aDir: [], aAxis: [], aSeed: [], aSpd: [] };
  for (let i = 0; i < N; i++) {
    const d = new V3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const ax = new V3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).cross(d).normalize();
    a.aDir.push(d.x, d.y, d.z); a.aAxis.push(ax.x, ax.y, ax.z);
    a.aSeed.push(rnd()); a.aSpd.push(rnd());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(a.aDir, 3));
  g.setAttribute('aAxis', new THREE.Float32BufferAttribute(a.aAxis, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(a.aSeed, 1));
  g.setAttribute('aSpd', new THREE.Float32BufferAttribute(a.aSpd, 1));
  const obj = new THREE.Points(g, pointsMat(sparkUniforms, `
    attribute vec3 aDir, aAxis; attribute float aSeed, aSpd;
    uniform float uTime, uPower, uEnergy, uCore, uSize, uPx, uDist;
    varying vec3 vCol; varying float vHot;
    void main(){
      float life = fract(aSeed * 13.7 + uTime * (.12 + .25 * aSpd) * (.6 + uEnergy));
      float th = life * (1.2 + aSpd);
      vec3 d = aDir * cos(th) + cross(aAxis, aDir) * sin(th);
      vec3 p = d * (.12 + life * (1.1 + .7 * aSpd));
      float on = step(aSeed, .12 + .88 * uEnergy);        // more of them when working
      float b = pow(sin(life * 3.1416), 1.5) * on;
      vec3 col = aSeed < .2 ? vec3(.4, .9, 1.8) : mix(vec3(2.2, 1.4, .6), vec3(1.4, .35, .05), life);
      col *= b * uPower * min(1., uCore) * .7;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.4 + 1.6 * (1. - life)) * uSize * uPx * (uDist / -mv.z);
      vHot = b;
      vCol = col;
    }`));
  obj.frustumCulled = false;
  return obj;
}
orb.add(buildSparks());

// ---------------------------------------------------------------- swirls: wisps of light curling round the core
// Each wisp is a bundle of fine strands following a looping path through and around the shell. The strands sit
// close together at the bright head and fan out towards the tail, like smoke or a flame licking round.
const swirlUniforms = { ...common(), uSwirl: { value: 1 }, uSwirlT: { value: 0 } };
function buildSwirls() {
  const STREAMS = 7, STRANDS = 9, PER = 460, rnd = mulberry32(41);
  const a = { aT: [], aStrand: [], aSeed: [], aStream: [], aE1: [], aE2: [], aN: [], aParams: [] };
  for (let s = 0; s < STREAMS; s++) {
    const n = new V3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const e1 = new V3(rnd() - .5, rnd() - .5, rnd() - .5).cross(n).normalize(), e2 = new V3().crossVectors(n, e1);
    const warm = s % 3 !== 2 ? 1 : 0;                 // two warm wisps for every cool one
    const params = [rnd() * 6.28, .7 + rnd() * .6, warm, rnd()];   // phase, speed, warm, shape
    for (let k = 0; k < STRANDS; k++) for (let i = 0; i < PER; i++) {
      a.aT.push(Math.pow(i / PER, 1.25) + rnd() * .004);
      a.aStrand.push((k - (STRANDS - 1) / 2) / STRANDS + (rnd() - .5) * .05);
      a.aSeed.push(rnd()); a.aStream.push(s / STREAMS);
      a.aE1.push(e1.x, e1.y, e1.z); a.aE2.push(e2.x, e2.y, e2.z); a.aN.push(n.x, n.y, n.z);
      a.aParams.push(...params);
    }
  }
  const g = new THREE.BufferGeometry();
  const count = a.aT.length;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  for (const k of ['aT', 'aStrand', 'aSeed', 'aStream']) g.setAttribute(k, new THREE.Float32BufferAttribute(a[k], 1));
  for (const k of ['aE1', 'aE2', 'aN']) g.setAttribute(k, new THREE.Float32BufferAttribute(a[k], 3));
  g.setAttribute('aParams', new THREE.Float32BufferAttribute(a.aParams, 4));
  const obj = new THREE.Points(g, pointsMat(swirlUniforms, `
    attribute float aT, aStrand, aSeed, aStream; attribute vec3 aE1, aE2, aN; attribute vec4 aParams;
    uniform float uTime, uPower, uEnergy, uSize, uPx, uDist, uSwirl, uSwirlT;
    varying vec3 vCol; varying float vHot;
    vec3 path(float u, float shape){
      float r = mix(.36, 1.34, .5 + .5 * sin(u * .63 + shape * 6.28));     // dips inside the shell and back out
      float h = .38 * sin(u * 1.37 + shape * 9.) + .12 * sin(u * 3.1);
      return (aE1 * cos(u) + aE2 * sin(u)) * r + aN * h;
    }
    void main(){
      float T = clamp(aT, 0., 1.);                                         // pow() of a negative is NaN, and bloom spreads NaN
      float head = uSwirlT * aParams.y + aParams.x;
      float len = 3.2 + 1.6 * aParams.w;                                   // radians of trail behind the head
      float u = head - T * len;
      vec3 p = path(u, aParams.w);
      vec3 tang = normalize(path(u + .01, aParams.w) - p);
      vec3 side = normalize(cross(tang, normalize(p) + aN * .3) + vec3(1e-4));
      vec3 lift = cross(side, tang);
      float spread = .02 + .3 * pow(T, 1.4);                                 // tight at the head, fanning out at the tail
      float curl = sin(u * 5. + aStrand * 14. + uTime * 1.3) * .5 + .5;
      p += side * aStrand * spread * 2. + lift * (curl - .5) * spread * 1.2;
      p += (vec3(fract(aSeed * 71.3), fract(aSeed * 13.7), fract(aSeed * 37.1)) - .5) * spread * .35;
      float b = pow(1. - T, 1.3) * smoothstep(0., .03, T + .01);
      float on = smoothstep(aStream + .01, aStream + .11, uSwirl);        // wisps come in one by one as uSwirl grows
      float tw = .75 + .25 * sin(uTime * (2. + aSeed * 6.) + aSeed * 40.);
      vec3 warm = mix(vec3(2.2, 1.3, .55), vec3(1.4, .32, .04), smoothstep(0., .5, T));
      vec3 cool = mix(vec3(.9, 1.6, 2.2), vec3(.12, .5, 1.5), smoothstep(0., .5, T));
      vec3 col = (aParams.z > .5 ? warm : cool) * b * tw * on * uPower * .6;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      float near = clamp(.5 - (-mv.z - uDist) * .5, 0., 1.);
      col *= mix(.45, 1., near);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.3 + 1.5 * (1. - T)) * uSize * uPx * (uDist / -mv.z);
      vHot = b * .8;
      vCol = col;
    }`));
  obj.frustumCulled = false;
  return obj;
}
const swirls = new THREE.Group();
swirls.add(buildSwirls());
orb.add(swirls);

// ---------------------------------------------------------------- light shafts
// The core's light is drawn into a small mask, with the front plates as black silhouettes over it and their hems
// as thin bright lines. Smearing that mask outward from the core gives shafts that only escape through the gaps
// between the plates, and streaks that run on from the glowing hems.
const rayUniforms = { ...common(), uHemRays: { value: 1 } };
const occMat = new THREE.ShaderMaterial({
  uniforms: rayUniforms, depthTest: false, depthWrite: false,
  vertexShader: `
    attribute float aKind;
    uniform float uSize, uPx, uDist, uPower, uHemRays;
    varying vec3 vCol;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      gl_Position = projectionMatrix * mv;
      vec3 n = normalize(normalMatrix * normalize(position));
      float f = dot(n, normalize(-mv.xyz));
      vCol = vec3(0.);
      float size = 3.4;                                         // big enough that the stipple closes into a solid plate
      if (aKind > 1.5 && aKind < 2.5) { vCol = vec3(1., .38, .07) * 1.1 * uHemRays * uPower * step(0., f); size = 2.; }
      if (-mv.z > uDist + .12) size = 0.;                        // the far half of the shell is behind the core
      gl_PointSize = size * uSize * uPx * .5 * (uDist / -mv.z);
    }`,
  fragmentShader: `varying vec3 vCol; void main(){ vec2 c = gl_PointCoord * 2. - 1.; if (dot(c, c) > 1.) discard; gl_FragColor = vec4(vCol, step(dot(vCol, vec3(1.)), 0.)); }`,
});
// the light behind the plates: a hot centre and a wide glow, broken into slowly turning beams
const rayLight = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.ShaderMaterial({
  uniforms: rayUniforms, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime, uCore, uPower, uEnergy;
    void main(){
      vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x);
      float beams = .5 + .5 * sin(a * 7. + uTime * .3) * sin(a * 11. - uTime * (.2 + .4 * uEnergy) + 1.3);
      beams = .08 + pow(beams, 4.) * 1.6;                       // separate shafts, not a fog
      float light = exp(-r * r * 16.) * .35 + exp(-r * r * 2.6) * .7 * beams;
      vec3 col = mix(vec3(1., .4, .09), vec3(1., .78, .5), exp(-r * r * 30.)) * light;
      gl_FragColor = vec4(col * uCore * uPower * smoothstep(1., .75, r), 0.);
    }`,
}));
rayLight.layers.set(1);
rayLight.renderOrder = -1;                 // the light first, then the plates black it out
orb.add(rayLight);

const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
const occRT = new THREE.WebGLRenderTarget(1, 1, rtOpts), raysRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const raysMat = new THREE.ShaderMaterial({
  uniforms: { tOcc: { value: occRT.texture }, uLight: { value: new THREE.Vector2(.5, .7) }, uLen: { value: .85 }, uGain: { value: 1 } },
  depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tOcc; uniform vec2 uLight; uniform float uLen, uGain;
    void main(){
      const int N = 72;
      vec2 d = (vUv - uLight) * uLen / float(N);
      vec2 uv = vUv - d * fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);   // jittered start: no banding
      vec3 acc = vec3(0.); float w = 1.;
      for (int i = 0; i < N; i++) { acc += texture2D(tOcc, uv).rgb * w; w *= .962; uv -= d; }
      gl_FragColor = vec4(acc * uGain * 3. / float(N), 1.);
    }`,
});
const raysScene = new THREE.Scene();
raysScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), raysMat));
bgMat.uniforms.tRays.value = raysRT.texture;
bgMat.uniforms.tOcc.value = occRT.texture;
// the light buffer: the whole orb drawn at a quarter size, with mipmaps so the scarf can read it blurred
const lightRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false,
  generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
bgMat.uniforms.tLight.value = lightRT.texture;
let lightPx = 1;
function renderLightBuffer() {
  for (const u of allUniforms) u.uPx.value = lightPx / 4;     // same look at a quarter of the pixels
  // what throws light on the scarf: the plates are big and steady, so they count less; the moving parts count more
  plateUniforms.uLightMul.value = .3; coreUniforms.uLightMul.value = .7; haloUniforms.uLightMul.value = 1.8;
  sparkUniforms.uLightMul.value = 3; swirlUniforms.uLightMul.value = 3.5;
  renderer.setRenderTarget(lightRT); renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  for (const u of allUniforms) { u.uPx.value = lightPx; u.uLightMul.value = 1; }
}

const lightPos = new V3();
function renderRays() {
  rayLight.quaternion.copy(camera.quaternion);
  lightPos.set(0, orb.position.y, 0).project(camera);
  raysMat.uniforms.uLight.value.set(lightPos.x * .5 + .5, lightPos.y * .5 + .5);
  raysMat.uniforms.uLen.value = tune.rayLength;
  bgMat.uniforms.uLightUV.value.copy(raysMat.uniforms.uLight.value);
  camera.layers.set(1);
  renderer.setRenderTarget(occRT); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(raysRT);
  renderer.render(raysScene, quadCam);
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);
  camera.layers.set(0);
}

const allUniforms = [plateUniforms, coreUniforms, haloUniforms, sparkUniforms, rayUniforms, swirlUniforms];

// ---------------------------------------------------------------- sizing
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  occRT.setSize(Math.ceil(db.x / 2), Math.ceil(db.y / 2));
  lightRT.setSize(Math.ceil(db.x / 4), Math.ceil(db.y / 4));
  raysRT.setSize(Math.ceil(db.x / 2), Math.ceil(db.y / 2));
  camera.aspect = w / h;
  camera.setViewOffset(w, h, 0, (.5 - ORB_Y) * h, w, h);   // put the orb above the scarf, not mid-frame
  camera.updateProjectionMatrix();
  const px = renderer.getPixelRatio() * h / 820;
  for (const u of allUniforms) u.uPx.value = px;
  lightPx = px;
}
new ResizeObserver(resize).observe(canvas);

// ---------------------------------------------------------------- input
let dragX = 0, dragY = 0, dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  dragX += (e.clientX - lastX) * .008; dragY += (e.clientY - lastY) * .008;
  dragY = Math.max(-1, Math.min(1, dragY)); lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => dragging = false);

function setState(s) {
  target = STATES[s];
  document.querySelectorAll('.states button').forEach(b => b.classList.toggle('on', b.dataset.state === s));
}
document.querySelectorAll('.states button').forEach(b => b.onclick = () => setState(b.dataset.state));
addEventListener('keydown', e => { const s = { 1: 'off', 2: 'idle', 3: 'working' }[e.key]; if (s) setState(s); });

for (const id of ['open', 'spin', 'core', 'size', 'bloom', 'rays', 'rayLength', 'hemRays', 'swirls', 'swirlSpeed', 'scarfMode', 'scarfLight', 'gap', 'density', 'layout']) {
  const el = document.getElementById(id), out = document.getElementById('o-' + id);
  const show = () => { if (out) out.textContent = (+el.value).toFixed(id === 'gap' ? 3 : 2); };
  el.value = tune[id]; show();
  el.addEventListener('input', () => {
    tune[id] = +el.value; show();
    if (id === 'gap' || id === 'density' || id === 'layout') { clearTimeout(el.t); el.t = setTimeout(buildShell, 120); }
  });
}

// ---------------------------------------------------------------- frame loop
buildShell();
resize();
const clock = new THREE.Clock();
let t = 0, turn = 0, swirlT = 0;
function frame(dt) {
  t += dt;
  const ease = rate => 1 - Math.exp(-dt * rate);
  for (const k in live) live[k] += (target[k] - live[k]) * ease(k === 'open' ? 1.6 : 1.3);
  for (const p of plates) { p.open += (target.open - p.open) * ease(p.lag * 1.3); placePlate(p, t); p.occ.matrix.copy(p.obj.matrix); }

  turn += dt * live.spin * tune.spin;
  if (!dragging) { dragY *= 1 - ease(1.5); }
  spin.rotation.set(dragY, turn + dragX, 0);
  coreGroup.rotation.y = -turn * .6 + dragX;
  halo.rotation.y = turn * .3 + dragX;
  orb.position.y = .025 * Math.sin(t * .8);
  heart.quaternion.copy(camera.quaternion);

  for (const u of allUniforms) {
    u.uTime.value = t; u.uPower.value = live.power; u.uCore.value = live.core * tune.core;
    u.uEnergy.value = live.energy; u.uSize.value = tune.size; u.uHalo.value = live.halo;
  }
  const flick = .96 + .04 * Math.sin(t * 6.7) * Math.sin(t * 2.3 + 1);
  bgMat.uniforms.uLit.value = Math.min(2, live.lit * tune.core) * flick;
  bgMat.uniforms.uLightGain.value = 1.1 * tune.scarfLight;
  bgMat.uniforms.uCode.value = tune.scarfMode;
  bloom.strength = .45 * Math.pow(tune.bloom, 1.6) * (.5 + .5 * live.power);   // gentle near 1, lower ceiling
  rayUniforms.uHemRays.value = tune.hemRays;
  swirlT += dt * (.25 + .75 * live.energy) * tune.swirlSpeed;
  swirlUniforms.uSwirlT.value = swirlT;
  swirlUniforms.uSwirl.value = live.swirl * tune.swirls;
  raysMat.uniforms.uGain.value = tune.rays * (.45 + .85 * live.energy);   // faint when idle, full when working
  renderRays();
  renderLightBuffer();
  composer.render();
}
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), .05)));
// for capture and testing: step the animation by hand (a hidden tab gets no animation frames)
window.rosieOrb = { setState, step(seconds, fps = 30) { for (let i = 0; i < seconds * fps; i++) frame(1 / fps); } };
