// The burning core: a three-armed spiral of particles in a tilted disc and a sphere of sparks streaming out of it,
// with a white-hot heart and its starburst on a camera-facing quad.
import * as THREE from 'three';
import { commonUniforms, pointsMaterial, shaderPointsGeometry, points, mulberry32 } from '../sprites.js';

const CORE_VERT = `
  attribute float aR, aAng, aSeed, aY, aMode;
  uniform float uTime, uPower, uCore, uEnergy, uSize, uPx, uDist;
  varying vec3 vCol; varying float vHot;
  void main(){
    vec3 p; float r, b;
    if (aMode < .5) {
      r = aR * .5 * (.55 + .3 * min(uCore, 2.5));               // the spiral grows with the glow
      float ang = aAng + uTime * (.18 + .7 * uEnergy) / (aR * 2.5 + .3);
      p = vec3(cos(ang) * r, aY, sin(ang) * r);
      b = pow(1. - aR, 1.3);
    } else {
      float life = fract(aSeed * 7.31 + uTime * (.07 + .16 * uEnergy) * (.6 + aR));
      r = (.03 + life * .52) * (.55 + .3 * min(uCore, 2.5));
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
  }`;

const HEART_FRAG = `
  varying vec2 vUv; uniform float uTime, uCore, uPower, uEnergy, uLightMul;
  void main(){
    vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x);
    float c = max(min(uCore, 3.), .05);                             // the heart widens as well as brightens
    float hot = exp(-r * r * 400. / c) * 2.5;
    float glow = exp(-r * r * 30. / c) * .45 + exp(-r * 6. / sqrt(c)) * .08;
    float rays = pow(abs(cos(a * 4. + uTime * .12)), 90.) * exp(-r * 6.) * 1.1
               + pow(abs(cos(a * 3. - uTime * .08 + 1.)), 160.) * exp(-r * 3.8) * .55 * (.5 + uEnergy);
    vec3 col = vec3(1., .93, .8) * hot + vec3(1., .34, .05) * glow + vec3(1., .62, .28) * rays;
    float flicker = .92 + .08 * sin(uTime * 6.7) * sin(uTime * 2.3 + 1.);
    gl_FragColor = vec4(col * uCore * uPower * flicker * smoothstep(1., .55, r) * uLightMul, 1.);
  }`;

function coreGeometry() {
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
  return shaderPointsGeometry(N, a);
}

export class Core {
  constructor() {
    this.uniforms = commonUniforms();
    this.group = new THREE.Group();              // the spiral's tilt and turn
    this.group.rotation.set(.5, 0, -.35);
    this.group.add(points(coreGeometry(), pointsMaterial(this.uniforms, CORE_VERT)));
    this.heart = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, transparent: true,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: HEART_FRAG,
    }));
  }
  get objects() { return [this.group, this.heart]; }
}
