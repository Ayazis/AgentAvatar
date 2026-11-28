// Swirls: wisps of light curling round the core. Each wisp is a bundle of fine strands following a looping path
// through and around the shell. The strands sit close together at the bright head and fan out towards the tail,
// like smoke or a flame licking round.
import * as THREE from 'three';
import { commonUniforms, pointsMaterial, shaderPointsGeometry, points, mulberry32, randomDir } from '../sprites.js';

export const MAX_SWIRLS = 7;

const SWIRL_VERT = `
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
  }`;

export class Swirls {
  constructor() {
    const STREAMS = MAX_SWIRLS, STRANDS = 9, PER = 460, rnd = mulberry32(41);
    const a = { aT: [], aStrand: [], aSeed: [], aStream: [], aE1: [], aE2: [], aN: [], aParams: [] };
    for (let s = 0; s < STREAMS; s++) {
      const n = randomDir(rnd);
      const e1 = new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).cross(n).normalize(), e2 = new THREE.Vector3().crossVectors(n, e1);
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
    this.uniforms = { ...commonUniforms(), uSwirl: { value: 1 }, uSwirlT: { value: 0 } };
    this.object = points(shaderPointsGeometry(a.aT.length, a), pointsMaterial(this.uniforms, SWIRL_VERT));
    this.clock = 0;
  }

  /** Move the wisps along (Swirl speed, relative to the tempo) and show as many as the Swirls count. */
  update({ dt, live, tempo }) {
    this.clock += dt * .44 * tempo * live.swirlSpeed;
    this.uniforms.uSwirlT.value = this.clock;
    this.uniforms.uSwirl.value = live.swirls / MAX_SWIRLS;
  }
}
