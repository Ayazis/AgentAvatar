// The halo (fine dust orbiting the shell, plus a few soft out-of-focus motes) and the sparks escaping through the
// gaps. The halo is computed in its shader and flows over the plates where they lift into it; the sparks are moved
// on the CPU, so a spark that hits a plate from inside can slide along it and escape through a seam.
import * as THREE from 'three';
import { commonUniforms, pointsMaterial, shaderPointsGeometry, points, mulberry32, randomDir } from '../sprites.js';
import { BARRIER_GLSL } from '../barrier.js';

const HALO_VERT = `
  attribute float aR, aAng, aY, aSeed, aWarm, aBig;
  uniform float uTime, uPower, uEnergy, uSize, uPx, uDist, uHalo;
  varying vec3 vCol; varying float vHot;
  ${BARRIER_GLSL}
  void main(){
    float ang = aAng + uTime * (.04 + .12 * aSeed) * (1. + 2. * uEnergy) / aR;
    float s = sqrt(1. - aY * aY);
    vec3 p = vec3(cos(ang) * s, aY, sin(ang) * s) * aR;
    p = keepSide(p, p);                                  // a plate swinging out pushes the dust ahead of it
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
  }`;

const SPARK_VERT = `
  attribute float aSeed, aLife;
  uniform float uPower, uEnergy, uCore, uSize, uPx, uDist;
  varying vec3 vCol; varying float vHot;
  void main(){
    float life = aLife;
    float on = step(aSeed, .12 + .88 * uEnergy);        // more of them when working
    float b = pow(sin(life * 3.1416), 1.5) * on;
    vec3 col = aSeed < .2 ? vec3(.4, .9, 1.8) : mix(vec3(2.2, 1.4, .6), vec3(1.4, .35, .05), life);
    col *= b * uPower * min(1., uCore) * .7;
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.4 + 1.6 * (1. - life)) * uSize * uPx * (uDist / -mv.z);
    vHot = b;
    vCol = col;
  }`;

export class Halo {
  /** @param barrier the plates as walls (see barrier.js) */
  constructor(barrier) {
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
    this.group = new THREE.Group();
    this.group.rotation.set(.35, 0, .2);
    this.uniforms = { ...commonUniforms(), ...barrier.uniformsFor(this.group) };
    this.group.add(points(shaderPointsGeometry(N, a), pointsMaterial(this.uniforms, HALO_VERT)));
  }
}

// Each spark is born near the centre and streams outward, turning slowly about its own axis. A spark that meets a
// plate from inside runs along under it to the nearest seam and escapes there.
export class Sparks {
  /** @param barrier the plates as walls (see barrier.js) */
  constructor(barrier) {
    const N = this.count = 1100, rnd = mulberry32(31);
    this.barrier = barrier;
    this.sparks = [];
    this.pos = new Float32Array(N * 3); this.life = new Float32Array(N);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const d = randomDir(rnd), ax = randomDir(rnd).cross(d).normalize();
      const sp = { d, ax, seed: rnd(), spd: rnd(), b: randomDir(rnd) };
      seed[i] = sp.seed;
      this.life[i] = (sp.seed * 13.7) % 1;
      this.#start(i, sp);
      this.sparks.push(sp);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.geometry = g;
    this.uniforms = commonUniforms();
    this.object = points(g, pointsMaterial(this.uniforms, SPARK_VERT));
  }

  // where spark i is at its present life on its own path (no plates in the way)
  #start(i, sp) {
    const life = this.life[i], th = life * (1.2 + sp.spd), r = .12 + life * (1.1 + .7 * sp.spd);
    const d = new THREE.Vector3().crossVectors(sp.ax, sp.d).multiplyScalar(Math.sin(th)).addScaledVector(sp.d, Math.cos(th)).multiplyScalar(r);
    this.pos[i * 3] = d.x; this.pos[i * 3 + 1] = d.y; this.pos[i * 3 + 2] = d.z;
  }

  /** Move every spark one step. Takes the frame (see Orb.frame). */
  update({ dt, live }) {
    const B = this.barrier, P = this.pos, slide = dt * (.5 + .6 * live.energy);
    for (let i = 0; i < this.count; i++) {
      const sp = this.sparks[i];
      const dl = dt * (.12 + .25 * sp.spd) * (.6 + live.energy);
      this.life[i] += dl;
      if (this.life[i] >= 1) { this.life[i] %= 1; this.#start(i, sp); continue; }
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], r = Math.hypot(x, y, z) || 1;
      const out = dl * (1.1 + .7 * sp.spd) / r, turn = dl * (1.2 + sp.spd), a = sp.ax;   // outward, and round the axis
      B.constrain(x, y, z, x + x * out + turn * (a.y * z - a.z * y), y + y * out + turn * (a.z * x - a.x * z), z + z * out + turn * (a.x * y - a.y * x),
                  slide, sp.b.x, sp.b.y, sp.b.z);
      P[i * 3] = B.x; P[i * 3 + 1] = B.y; P[i * 3 + 2] = B.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
  }
}
