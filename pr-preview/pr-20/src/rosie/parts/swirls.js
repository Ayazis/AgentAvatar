// Swirls: wisps of light curling round the core. Each wisp is a bundle of fine strands behind a bright head. The
// strands sit close together at the head and fan out towards the tail, like smoke or a flame licking round.
//
// The plates are walls (see barrier.js). Each head follows a looping path through and around the shell, but where
// the path runs into a plate the head is held at its face, flows along it to a seam and slips through there. The
// wisp's centre line is where its head has really been: the last HIST points, one every DU of path, kept in a
// small texture in the shell's turning frame, so the smoke turns with the plates and stays on its side of them.
// In the shader each strand keeps to the same side of every plate as the centre line, and the bundle narrows where
// it crosses the shell, to squeeze through a seam.
import * as THREE from 'three';
import { commonUniforms, pointsMaterial, shaderPointsGeometry, points, mulberry32, randomDir } from '../sprites.js';
import { BARRIER_GLSL } from '../barrier.js';

export const MAX_SWIRLS = 7;
const HIST = 256, DU = .02;   // a trail is at most 4.8 radians of path long: 240 points

const SWIRL_VERT = `
  attribute float aT, aStrand, aSeed, aStream; attribute vec3 aN; attribute vec4 aParams;
  uniform float uTime, uPower, uEnergy, uSize, uPx, uDist, uSwirl;
  uniform sampler2D tHist;
  uniform float uHeadK[${MAX_SWIRLS}], uHeadFrac[${MAX_SWIRLS}], uHeadU[${MAX_SWIRLS}];
  varying vec3 vCol; varying float vHot;
  ${BARRIER_GLSL}
  vec3 slot(int s, float k){ return texelFetch(tHist, ivec2(int(mod(k, ${HIST}.)), s), 0).xyz; }
  // the centre line of wisp s, d radians of path behind its head. Slot k is the last point the head passed,
  // uHeadFrac of a step ago; slot k + 1 holds the head itself.
  vec3 line(int s, float d){
    float k = uHeadK[s], x = uHeadFrac[s] - d / ${DU};
    if (x >= 0.) return mix(slot(s, k), slot(s, k + 1.), x / max(uHeadFrac[s], 1e-4));
    float i = floor(x);
    return mix(slot(s, k + i), slot(s, k + i + 1.), x - i);
  }
  void main(){
    int s = int(aStream * ${MAX_SWIRLS}. + .5);
    float T = clamp(aT, 0., 1.);                                         // pow() of a negative is NaN, and bloom spreads NaN
    float len = 3.2 + 1.6 * aParams.w;                                   // radians of trail behind the head
    float d = T * len, u = uHeadU[s] - d;
    vec3 c = line(s, d);
    vec3 tang = c - line(s, d + .04);
    tang = dot(tang, tang) > 1e-10 ? normalize(tang) : normalize(cross(aN, c) + vec3(1e-4));
    vec3 side = normalize(cross(tang, normalize(c + vec3(1e-5)) + aN * .3) + vec3(1e-4));
    vec3 lift = cross(side, tang);
    float spread = (.02 + .3 * pow(T, 1.4))                                // tight at the head, fanning out at the tail,
                 * mix(.3, 1., smoothstep(.03, .25, abs(length(c) - 1.)));  // and narrow where it crosses the shell
    float curl = sin(u * 5. + aStrand * 14. + uTime * 1.3) * .5 + .5;
    vec3 p = c + side * aStrand * spread * 2. + lift * (curl - .5) * spread * 1.2;
    p += (vec3(fract(aSeed * 71.3), fract(aSeed * 13.7), fract(aSeed * 37.1)) - .5) * spread * .35;
    p = keepSide(p, c);
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
  }`;

const V3 = THREE.Vector3;

export class Swirls {
  /**
   * @param barrier the plates as walls (see barrier.js)
   * @param frame   the group the wisps are drawn in: the shell's turning frame (Orb's spin), a child of the orb
   */
  constructor(barrier, frame) {
    const STREAMS = MAX_SWIRLS, STRANDS = 9, PER = 460, rnd = mulberry32(41);
    this.barrier = barrier;
    this.frame = frame;
    this.streams = [];
    const a = { aT: [], aStrand: [], aSeed: [], aStream: [], aN: [], aParams: [] };
    for (let s = 0; s < STREAMS; s++) {
      const n = randomDir(rnd);
      const e1 = new V3(rnd() - .5, rnd() - .5, rnd() - .5).cross(n).normalize(), e2 = new V3().crossVectors(n, e1);
      const warm = s % 3 !== 2 ? 1 : 0;                 // two warm wisps for every cool one
      const params = [rnd() * 6.28, .7 + rnd() * .6, warm, rnd()];   // phase, speed, warm, shape
      for (let k = 0; k < STRANDS; k++) for (let i = 0; i < PER; i++) {
        a.aT.push(Math.pow(i / PER, 1.25) + rnd() * .004);
        a.aStrand.push((k - (STRANDS - 1) / 2) / STRANDS + (rnd() - .5) * .05);
        a.aSeed.push(rnd()); a.aStream.push(s / STREAMS);
        a.aN.push(n.x, n.y, n.z);
        a.aParams.push(...params);
      }
      this.streams.push({ e1, e2, n, phase: params[0], speed: params[1], shape: params[3], k: null, u: 0, h: new V3() });
    }
    const L = mulberry32(43);
    for (const st of this.streams) { const d = randomDir(L); Object.assign(st, { bx: d.x, by: d.y, bz: d.z, seen: -9 }); }

    this.hist = new Float32Array(HIST * STREAMS * 4);
    this.texture = new THREE.DataTexture(this.hist, HIST, STREAMS, THREE.RGBAFormat, THREE.FloatType);
    this.uniforms = { ...commonUniforms(), ...barrier.uniformsFor(frame), uSwirl: { value: 1 }, tHist: { value: this.texture },
                      uHeadK: { value: new Array(STREAMS).fill(0) }, uHeadFrac: { value: new Array(STREAMS).fill(0) },
                      uHeadU: { value: new Array(STREAMS).fill(0) } };
    this.object = points(shaderPointsGeometry(a.aT.length, a), pointsMaterial(this.uniforms, SWIRL_VERT));
    this.clock = 0;
    this.#toFrame = new THREE.Matrix4();
  }
  #toFrame;

  // the head's own path: a loop round the stream's axis, dipping inside the shell and back out (orb space)
  #path(st, u, out) {
    const r = .85 + .49 * Math.sin(u * .63 + st.shape * 6.28);
    const h = .38 * Math.sin(u * 1.37 + st.shape * 9) + .12 * Math.sin(u * 3.1);
    const c = Math.cos(u) * r, s = Math.sin(u) * r;
    return out.set(st.e1.x * c + st.e2.x * s + st.n.x * h, st.e1.y * c + st.e2.y * s + st.n.y * h, st.e1.z * c + st.e2.z * s + st.n.z * h);
  }

  #write(s, k, v) { const o = (s * HIST + (((k % HIST) + HIST) % HIST)) * 4; this.hist[o] = v.x; this.hist[o + 1] = v.y; this.hist[o + 2] = v.z; this.hist[o + 3] = 1; }

  /**
   * Move the wisps along (Swirl speed, relative to the tempo) and show as many as the Swirls count.
   * Call after the barrier has moved this frame.
   */
  update({ dt, live, tempo }) {
    this.clock += dt * .44 * tempo * live.swirlSpeed;
    this.uniforms.uSwirl.value = live.swirls / MAX_SWIRLS;
    const B = this.barrier, M = this.#toFrame.copy(this.frame.matrix).invert();   // orb -> the turning frame
    const catchUp = 1 - Math.exp(-dt * 3), slide = dt * .45 * Math.max(.3, tempo);
    const raw = new V3(), head = new V3(), v = new V3();
    this.streams.forEach((st, s) => {
      const u = this.clock * st.speed + st.phase, k = Math.floor(u / DU);
      this.#path(st, u, raw);
      if (st.k === null) this.#fill(st, s, k, M);
      B.follow(st, raw.x, raw.y, raw.z, catchUp, slide);
      head.set(B.x, B.y, B.z).applyMatrix4(M);
      // the points of path the head passed since last frame, on the line from where it was to where it is
      for (let kk = Math.max(st.k + 1, k - HIST + 2); kk <= k; kk++)
        this.#write(s, kk, v.lerpVectors(st.h, head, (kk * DU - st.u) / Math.max(u - st.u, 1e-9)));
      this.#write(s, k + 1, head);
      st.k = k; st.u = u; st.h.copy(head);
      this.uniforms.uHeadK.value[s] = ((k % HIST) + HIST) % HIST;
      this.uniforms.uHeadFrac.value[s] = u / DU - k;
      this.uniforms.uHeadU.value[s] = u;
    });
    this.texture.needsUpdate = true;
  }

  // the first time: walk the head along the last stretch of its path, held back by the plates as they are now
  #fill(st, s, k, M) {
    const B = this.barrier, p = this.#path(st, (k - HIST + 2) * DU, new V3()), raw = new V3(), v = new V3();
    let held = false;
    for (let kk = k - HIST + 2; kk <= k; kk++) {
      this.#path(st, kk * DU, raw);
      if (held) raw.lerp(p, .8);                         // held back: barely follow, mostly slide
      held = B.constrain(p.x, p.y, p.z, raw.x, raw.y, raw.z, .03, st.bx, st.by, st.bz);
      p.set(B.x, B.y, B.z);
      this.#write(s, kk, v.copy(p).applyMatrix4(M));
    }
    st.ax = p.x; st.ay = p.y; st.az = p.z;
    this.#path(st, k * DU, raw);
    st.rx = raw.x; st.ry = raw.y; st.rz = raw.z; st.held = held;
    st.k = k; st.u = k * DU; st.h.copy(p).applyMatrix4(M);
    st.seen = B.frameNo - 1;                             // so follow() carries on from here
  }
}
