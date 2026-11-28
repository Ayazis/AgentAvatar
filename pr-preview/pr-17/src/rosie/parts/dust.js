// The halo (fine dust orbiting the shell, plus a few soft out-of-focus motes) and the sparks escaping through the
// gaps. Both are computed entirely in their shaders.
import * as THREE from 'three';
import { commonUniforms, pointsMaterial, shaderPointsGeometry, points, mulberry32, randomDir } from '../sprites.js';

const HALO_VERT = `
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
  }`;

const SPARK_VERT = `
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
  }`;

export class Halo {
  constructor() {
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
    this.uniforms = commonUniforms();
    this.group = new THREE.Group();
    this.group.rotation.set(.35, 0, .2);
    this.group.add(points(shaderPointsGeometry(N, a), pointsMaterial(this.uniforms, HALO_VERT)));
  }
}

export class Sparks {
  constructor() {
    const N = 1100, rnd = mulberry32(31);
    const a = { aDir: [], aAxis: [], aSeed: [], aSpd: [] };
    for (let i = 0; i < N; i++) {
      const d = randomDir(rnd);
      const ax = randomDir(rnd).cross(d).normalize();
      a.aDir.push(d.x, d.y, d.z); a.aAxis.push(ax.x, ax.y, ax.z);
      a.aSeed.push(rnd()); a.aSpd.push(rnd());
    }
    this.uniforms = commonUniforms();
    this.object = points(shaderPointsGeometry(N, a), pointsMaterial(this.uniforms, SPARK_VERT));
  }
}
