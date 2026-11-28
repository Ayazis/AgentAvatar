// Ribbons and swirl dust, from the presence console (versions/presence-console/src/rosie/particles/ribbons.js and
// dust.js): the same motion, computed on the CPU each frame, then drawn as the orb's glowing sprites. The console
// works in picture-height units around the orb; here 1 unit is the shell radius, so positions are divided by ORB_R,
// y points up and z toward the camera. Colours are the orb's orange and blue instead of the jacket's rose.
import * as THREE from 'three';
import { ORB_R, aliveOf } from '../config.js';
import { commonUniforms, pointsMaterial, mulberry32 } from '../sprites.js';

export const MAX_RIBBON_PARTICLES = 9000;   // per ribbon
export const MAX_DUST_PARTICLES = 5000;
const RIB_TRAIL = 3, DUST_TRAIL = 2, TAU = 6.2832;

const EXTRAS_VERT = `
  attribute float aSize, aBright, aCol;
  uniform float uSize, uPx, uDist, uPower;
  varying vec3 vCol; varying float vHot;
  vec3 pal(float c){
    return c < .5 ? vec3(1., .45, .1) : c < 1.5 ? vec3(1., .72, .42) : c < 2.5 ? vec3(1., .92, .85) : c < 3.5 ? vec3(1., .3, .05)
         : c < 4.5 ? vec3(.35, .75, 1.25) : c < 5.5 ? vec3(.3, .5, 1.25) : vec3(.65, .92, 1.25);
  }
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    float near = clamp(.5 - (-mv.z - uDist) * .45, 0., 1.);
    vCol = pal(aCol) * aBright * uPower * mix(.4, 1., near) * .5;
    vHot = min(aBright, 1.) * .6;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uSize * uPx * (uDist / -mv.z);
  }`;

// col: two palette entries (see pal() above), the first for 60 % of the particles
const BANDS = [
  { tx: 1.15, tz: .35, speed: .5, phase: 0, head: 0, col: [0, 4] },
  { tx: 1.9, tz: -.6, speed: -.38, phase: 2.1, head: 2, col: [5, 1] },
  { tx: .55, tz: 1.3, speed: .32, phase: 4.2, head: 4, col: [6, 2] },
];

export class Ribbons {
  constructor() {
    const cap = MAX_RIBBON_PARTICLES * BANDS.length * RIB_TRAIL + MAX_DUST_PARTICLES * DUST_TRAIL;
    this.pos = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.bright = new Float32Array(cap); this.col = new Float32Array(cap);
    this.geometry = new THREE.BufferGeometry();
    for (const [k, arr, n] of [['position', this.pos, 3], ['aSize', this.size, 1], ['aBright', this.bright, 1], ['aCol', this.col, 1]])
      this.geometry.setAttribute(k, new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = commonUniforms();
    this.object = new THREE.Points(this.geometry, pointsMaterial(this.uniforms, EXTRAS_VERT));
    this.object.frustumCulled = false;

    this.bands = BANDS.map(b => ({ ...b }));
    this.ribPts = []; this.dustPts = [];
    const R = mulberry32(57);
    for (let j = 0; j < MAX_RIBBON_PARTICLES * 3; j++) {
      const i = j % 3, rb = this.bands[i];
      this.ribPts.push({ i, s0: R() * TAU, v: (R() < .5 ? -1 : 1) * Math.pow(R(), .55), c: R() < .6 ? rb.col[0] : rb.col[1],
                         s: 1.3 + R() * 1.8, a: .6 + .4 * R(), k: R() * 6.28, d: R() });
    }
    for (let i = 0; i < MAX_DUST_PARTICLES; i++) this.dustPts.push({
      r: .12 + Math.pow(R(), .9) * .3, incl: (R() - .5) * 1.1 + (R() < .5 ? .35 : -.35), node: R() * 6.28, ph: R() * 6.28,
      sp: (.35 + R() * .5) * (R() < .15 ? -1 : 1), lift: (R() - .5) * .08, breathe: R() < .3, bph: R() * 6.28,
      s: 1 + R() * 2, a: .35 + .45 * R(), c: [0, 0, 1, 2, 4, 5, 6][(R() * 7) | 0], k: R() * 6.28, d: R(),
    });
    this.yaw = 0; this.dustClock = 0;
  }

  /** Move every particle and upload the ones that show. Takes the frame (see Orb.frame). */
  update({ dt, t, live, tempo, breath, pulse }) {
    const alive = aliveOf(live.power);   // Off: none, Idle and Working: all
    this.n = 0;
    this.#ribbons(dt, t, live, tempo, breath, pulse, alive);
    this.#dust(dt, t, live, tempo, pulse, alive);
    const o = this.n;
    this.geometry.setDrawRange(0, o);
    for (const k of ['position', 'aSize', 'aBright', 'aCol']) {
      const at = this.geometry.attributes[k]; at.clearUpdateRanges?.(); at.addUpdateRange?.(0, o * at.itemSize); at.needsUpdate = true;
    }
  }

  // one sprite, in picture units (y down, z behind) → orb units
  #put(x, y, z, size, a, c) {
    const o = this.n++, u = 1 / ORB_R;
    this.pos[o * 3] = x * u; this.pos[o * 3 + 1] = -y * u; this.pos[o * 3 + 2] = -z * u;
    this.size[o] = size; this.bright[o] = a; this.col[o] = c;
  }

  // ribbons: comets of particles on tilted orbits, wrapping in front of and behind the shell
  #ribbons(dt, t, L, tempo, breath, pulse, alive) {
    this.yaw += dt * .22 * (.15 + .85 * alive) * L.ribSpeed * tempo;
    const S = .19 * L.ribOrbit, pace = .12 + .88 * alive, gy = this.yaw * .45, cgy = Math.cos(gy), sgy = Math.sin(gy);
    const ribA = alive ** 1.5 * .85 * L.ribBright;
    for (const rb of this.bands) {
      rb.head += dt * rb.speed * (1 + .3 * Math.sin(t * .37 + rb.phase)) * L.ribSpeed * pace * tempo;
      const ax = rb.tx + .16 * Math.sin(t * .13 + rb.phase), az = rb.tz + .22 * Math.sin(t * .11 + rb.phase * 1.3);
      rb.cx = Math.cos(ax); rb.sx = Math.sin(ax); rb.cz = Math.cos(az); rb.sz = Math.sin(az);
    }
    if (ribA <= .002) return;
    const frac = L.ribAmount / MAX_RIBBON_PARTICLES;
    for (const p of this.ribPts) {
      const vis = Math.min(1, Math.max(0, L.ribCount - p.i));
      if (p.d >= frac || vis <= 0) continue;
      const rb = this.bands[p.i];
      const sPos = p.s0 + rb.head * .85;
      let rel = (((rb.head - sPos) % TAU) + TAU) % TAU / TAU;
      if (rb.speed < 0) rel = 1 - rel;
      const arc = Math.pow(1 - rel, 1.1) * Math.min(1, rel / .03) * 1.5;
      if (arc * ribA < .01) continue;
      const tw = .88 + .12 * Math.sin(t * 1.3 + p.k * 20);
      for (let k = 0; k < RIB_TRAIL; k++) {
        const sk = sPos - k * Math.sign(rb.speed) * .022 * (.4 + .6 * L.ribSpeed);
        const r = 1.55 + .14 * Math.sin(3 * sk + t * .5 + rb.phase) + .07 * Math.sin(5 * sk - t * .35) + .04 * breath + .1 * pulse;
        const cs = Math.cos(sk), ss = Math.sin(sk);
        let x = r * cs, y = r * ss;
        let z = .26 * Math.sin(2 * sk + t * .4 + rb.phase) + .07 * Math.sin(5 * sk - t * 1.4 + rb.phase);
        const width = 1.8 * L.ribWidth * (.11 + .07 * Math.sin(sk * 2 + t * .7)) * (.9 + .15 * breath);
        const twa = sk * 1.2 + t * .55 + rb.phase, ct = Math.cos(twa) * width * p.v;
        x += cs * ct; y += ss * ct; z += Math.sin(twa) * width * p.v;
        const y1 = y * rb.cx - z * rb.sx, z1 = y * rb.sx + z * rb.cx;
        const X = x * rb.cz - y1 * rb.sz, Y = x * rb.sz + y1 * rb.cz;
        const XX = X * cgy + z1 * sgy, ZZ = -X * sgy + z1 * cgy;
        this.#put(XX * S, -Y * S, ZZ * S, p.s * 1.9 * (1 - k * .18), 1.5 * vis * arc * ribA * p.a * tw * (k ? .5 / k : 1), p.c);
      }
    }
  }

  // swirl dust: loose particles on tilted orbits, some breathing in and out of the orb, each with a short trail
  #dust(dt, t, L, tempo, pulse, alive) {
    this.dustClock += dt * L.dustSpeed * (.1 + .9 * alive) * tempo;
    if (alive <= .002) return;
    const dfrac = L.dustAmount / MAX_DUST_PARTICLES;
    for (const p of this.dustPts) {
      if (p.d >= dfrac) continue;
      let r = p.r;
      if (p.breathe) r *= .25 + .75 * (.5 + .5 * Math.cos(t * .45 + p.bph));
      r *= 1 + .5 * pulse;                                              // the tap pushes the dust out
      const a0 = p.ph + this.dustClock * p.sp * (.09 / r);
      const ci = Math.cos(p.incl), si = Math.sin(p.incl), cn = Math.cos(p.node + t * .05), sn = Math.sin(p.node + t * .05);
      const tw = .7 + .3 * Math.sin(t * 3 + p.k);
      const bright = L.dustBright * p.a * tw * Math.min(1, r / .06) * alive;
      for (let k = 0; k < DUST_TRAIL; k++) {
        const a = a0 - k * Math.sign(p.sp) * .035 * (.5 + .5 * L.dustSpeed) * (.09 / r) * 6;
        const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
        const y1 = -lz * si, z1 = lz * ci;
        const x = lx * cn + z1 * sn, z = -lx * sn + z1 * cn;
        this.#put(x, y1 + p.lift + .015 * Math.sin(t * .7 + p.k), z, p.s * 1.7 * (1 - k * .22), bright * (k ? .38 / k : 1), p.c);
      }
    }
  }
}
