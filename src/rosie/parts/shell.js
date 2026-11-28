// The shell: stippled denim plates with hot rolled hems and orange double topstitching, each plate opening like a
// petal on a hinge along one of its edges.
import * as THREE from 'three';
import { commonUniforms, pointsMaterial, mulberry32 } from '../sprites.js';
import { PlateLayout } from '../plates.js';

const V3 = THREE.Vector3;
const KIND = { cloth: 0, inner: 1, hem: 2, stitch: 3 };

// How far from the plate's centre, along `pointAt(dist)`, the margin drops to `level` (bisection).
function reach(pointAt, inside) {
  let lo = 0, hi = 1.6;
  for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (inside(pointAt(mid))) lo = mid; else hi = mid; }
  return lo;
}

function buildPlate(layout, i, gap, density, rnd) {
  const c = layout.centres[i], U = layout.U[i], W = layout.W[i];
  const margin = p => layout.marginAt(p, i, gap);
  const pos = [], kind = [], seed = [], bri = [], edge = [], phase = [];
  const push = (p, r, k, b, e, ph) => { pos.push(p.x * r, p.y * r, p.z * r); kind.push(k); seed.push(rnd()); bri.push(b); edge.push(e); phase.push(ph); };
  const at = (x, y) => new V3().copy(c).addScaledVector(U, x).addScaledVector(W, y).normalize();

  // cloth: points laid along diagonal twill lines, with the weave's raised ribs brighter
  const dw = .026 / Math.sqrt(density), da = .0105 / Math.sqrt(density), ext = layout.ext[i];
  let line = 0;
  for (let w = -ext; w <= ext; w += dw, line++) {
    let step = 0;
    for (let a = -ext; a <= ext; a += da, step++) {
      const x = (a - w) * .7071 + (rnd() - .5) * da * .7, y = (a + w) * .7071 + (rnd() - .5) * dw * .35;
      const p = at(x, y), m = margin(p);
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
    const pts = [], N = Math.round(Math.max(180, 720 * ext / 1.5));   // smaller plates need fewer steps round
    for (let s = 0; s < N; s++) {
      const ang = s / N * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
      const d = reach(r => at(dx * r, dy * r), p => margin(p) > level);
      pts.push(at(dx * d, dy * d));
    }
    pts.push(pts[0]);
    return pts;
  };
  // call fn every ds along a closed contour, with the distance travelled
  const along = (pts, ds, fn) => {
    let L = 0, next = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], seg = a.distanceTo(b);
      while (next <= L + seg) { const t = (next - L) / seg; fn(new V3().lerpVectors(a, b, t).normalize(), next); next += ds; }
      L += seg;
    }
  };

  // hem: a hot rolled edge that wraps from the outer face down to the inner one, so the plate has thickness
  const hem = contour(0);
  const hemDs = .0042 / Math.sqrt(density);
  [[1.016, 1], [1.004, .85], [.99, .6], [.976, .4]].forEach(([r, b]) =>
    along(hem, hemDs, (p, L) => push(p, r + (rnd() - .5) * .004, KIND.hem, b, 0, L)));

  // stitches: two rows of dashes, like the orange double topstitch on the jeans
  for (const level of [.04, .066]) along(contour(level), .0036 / Math.sqrt(density), (p, L) => {
    if ((L / .034) % 1 < .58) push(p, 1.009, KIND.stitch, 1, 0, L);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const [k, v] of [['aKind', kind], ['aSeed', seed], ['aB', bri], ['aEdge', edge], ['aPhase', phase]])
    g.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  return { g, c, U, W };
}

const PLATE_VERT = `
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
  }`;

// Shell opacity: a dark backing just inside each plate writes depth, so whatever is behind the plate (the core,
// the inner wisps, the far side of the shell, ribbons passing behind) is hidden. It covers only a share of the
// pixels, set by the opacity, like a screen door: 0 is see-through, 1 is a solid shell. Drawn before everything else.
const backingMaterial = plateUniforms => new THREE.ShaderMaterial({
  uniforms: { ...plateUniforms, uOpacity: { value: 0 }, uBackSize: { value: 8 } },
  depthTest: true, depthWrite: true, transparent: false,
  vertexShader: `
    attribute float aKind;
    uniform float uPx, uDist, uOpacity, uBackSize;
    void main(){
      vec4 mv = modelViewMatrix * vec4(normalize(position) * .955, 1.);
      gl_Position = projectionMatrix * mv;
      // every point of the plate, drawn big enough to overlap its neighbours, so a solid plate has no pinholes
      gl_PointSize = uOpacity > .001 ? uBackSize * uPx * (uDist / -mv.z) : 0.;
    }`,
  fragmentShader: `
    uniform float uOpacity;
    void main(){
      vec2 c = gl_PointCoord * 2. - 1.; if (dot(c, c) > 1.) discard;
      if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > uOpacity) discard;
      gl_FragColor = vec4(0., 0., 0., 1.);
    }`,
});

const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), m3 = new THREE.Matrix4();

export class Shell {
  /** @param occMaterial the ray mask material (see Rays): each plate is also drawn into the ray mask with it */
  constructor(occMaterial) {
    this.uniforms = commonUniforms();
    this.material = pointsMaterial(this.uniforms, PLATE_VERT);
    this.backing = backingMaterial(this.uniforms);
    this.occMaterial = occMaterial;
    this.group = new THREE.Group();             // the shell's tilt; the orb turns and floats it
    this.group.rotation.set(.42, 0, .28);
    this.plates = [];
  }

  /** (Re)build the plates from the build settings: count, shape, shape size, gap and density. */
  build({ count, shape, shapeSize, gap, density }, open) {
    for (const p of this.plates) { this.group.remove(p.obj, p.occ, p.back); p.obj.geometry.dispose(); }
    const layout = this.layout = new PlateLayout(count, +shape, shapeSize), rnd = mulberry32(11), tiltRnd = mulberry32(17);
    const inside = i => p => layout.marginAt(p, i, gap) > 0;
    this.gap = gap;
    this.plates = layout.centres.map((_, i) => {
      const { g, c, U, W } = buildPlate(layout, i, gap, density, rnd);
      // how wide the plate is: the angle from its centre to its farthest corner (for the barrier, see barrier.js)
      let alpha = 0;
      for (let s = 0; s < 48; s++) {
        const a = s / 48 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        alpha = Math.max(alpha, Math.atan(reach(r => new V3().copy(c).addScaledVector(U, dx * r).addScaledVector(W, dy * r).normalize(),
                                                 inside(i))));
      }
      const obj = this.#plateObject(g, this.material);
      const occ = this.#plateObject(g, this.occMaterial);    // the same plate, drawn into the ray mask
      occ.layers.set(1);
      const back = this.#plateObject(g, this.backing);       // the same plate as a solid backing
      back.renderOrder = -10;
      this.group.add(obj, occ, back);
      // each plate opens like a petal: it swings out about a hinge on one of its edges
      const ang = rnd() * Math.PI * 2;
      const dir = new V3().addScaledVector(U, Math.cos(ang)).addScaledVector(W, Math.sin(ang));
      const d = reach(r => new V3().copy(c).addScaledVector(dir, r).normalize(), inside(i));
      const pivot = new V3().copy(c).addScaledVector(dir, d).normalize();
      // its own lean, for Angle deviation: a random axis across the plate and how much of the slider it takes
      const ta = tiltRnd() * Math.PI * 2;
      const tiltAxis = new V3().addScaledVector(U, Math.cos(ta)).addScaledVector(W, Math.sin(ta));
      return { obj, occ, back, c, alpha, pivot, tiltAxis, tiltK: .35 + .65 * tiltRnd(), hinge: new V3().crossVectors(c, dir).normalize(),
               k: rnd(), k2: rnd(), lag: .9 + rnd() * 1.4, open: open, phase: rnd() * 6.28 };
    });
  }

  #plateObject(g, material) {
    const o = new THREE.Points(g, material);
    o.matrixAutoUpdate = false; o.frustumCulled = false;
    return o;
  }

  /**
   * Open the plates towards the target's `open`, each at its own pace, place them, and set the backing.
   * Takes the frame (see Orb.frame) and the build's density; returns the shell opacity drawn.
   */
  update({ t, live, target, breath, openBoost, ease }, density) {
    for (const p of this.plates) {
      p.open += (target.open - p.open) * ease(p.lag * 1.3);
      this.#place(p, t, live.power, breath, openBoost, live.tilt * Math.PI / 180);
      p.occ.matrix.copy(p.obj.matrix); p.back.matrix.copy(p.obj.matrix);
    }
    const opacity = Math.min(1, Math.max(0, live.shellOpacity));
    this.backing.uniforms.uOpacity.value = opacity;
    this.backing.uniforms.uBackSize.value = 8 / Math.sqrt(density);   // the stipple lines spread out at low density
    return opacity;
  }

  #place(p, t, power, breath, openBoost, tilt) {
    const o = p.open * openBoost;
    const pushOut = o * (.03 + .1 * p.k) + .006 * Math.sin(t * .9 + p.phase) * power + .012 * breath;   // plates part on the in-breath
    const flap = o * (.26 + .38 * p.k) + .02 * Math.sin(t * .7 + p.phase) * o;
    const twirl = o * .3 * (p.k2 - .5);
    const M = p.obj.matrix, P = p.pivot;
    M.makeRotationAxis(p.c, twirl);                                                    // turn a little in place
    if (tilt) {                                                                        // lean askew, about its centre
      const c = p.c;
      m2.makeRotationAxis(p.tiltAxis, tilt * p.tiltK);
      m1.makeTranslation(-c.x, -c.y, -c.z); m3.makeTranslation(c.x, c.y, c.z);
      M.premultiply(m1).premultiply(m2).premultiply(m3);
    }
    m1.makeTranslation(-P.x, -P.y, -P.z);
    m2.makeRotationAxis(p.hinge, flap);
    m3.makeTranslation(P.x + p.c.x * pushOut, P.y + p.c.y * pushOut, P.z + p.c.z * pushOut);
    M.premultiply(m1).premultiply(m2).premultiply(m3);                                 // swing out on the hinge, lift off
  }
}
