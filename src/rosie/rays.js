// Light shafts. Two kinds of rays, each from its own small mask:
//  - core rays: the core's light with the front plates as black silhouettes over it. Smeared outward from the core,
//    it gives shafts that only escape through the gaps between the plates.
//  - hem rays: just the glowing hems of the front plates, as thin bright lines. Smeared outward, they give streaks
//    that run on from the plate edges.
// Each has its own amount, intensity and length, and fades out over a distance tied to its length.
// The masks are drawn from camera layer 1: the plates' ray-mask copies (see Shell) and the light behind them.
import * as THREE from 'three';
import { commonUniforms } from './sprites.js';

const FULLSCREEN_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const OCC_VERT = `
  attribute float aKind, aPhase;
  uniform float uSize, uPx, uDist, uPower, uHemPass, uHemAmount;
  varying vec3 vCol;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * mv;
    vec3 n = normalize(normalMatrix * normalize(position));
    float f = dot(n, normalize(-mv.xyz));
    vCol = vec3(0.);
    float size = 3.4;                                         // big enough that the stipple closes into a solid plate
    bool hem = aKind > 1.5 && aKind < 2.5;
    if (uHemPass > .5) {
      // hem pass: only the hems, and only the stretches that Amount lets through (all of it at 1, short bits near 0)
      float g = .5 + .5 * sin(aPhase * 7.3 + sin(aPhase * 2.1) * 2.);
      float on = smoothstep(1. - uHemAmount - .08, 1. - uHemAmount + .08, g);
      vCol = hem ? vec3(1., .38, .07) * 1.1 * uPower * step(0., f) * on : vec3(0.);
      size = hem ? 2. : 0.;
    } else if (hem) size = 2.;                                 // core pass: the hems are part of the plate, black
    if (-mv.z > uDist + .12) size = 0.;                        // the far half of the shell is behind the core
    gl_PointSize = size * uSize * uPx * .5 * (uDist / -mv.z);
  }`;

// the light behind the plates: a hot centre and a wide glow, broken into slowly turning beams
const LIGHT_FRAG = `
  varying vec2 vUv; uniform float uTime, uCore, uPower, uEnergy, uRayAmount;
  void main(){
    vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x);
    float k1 = floor(uRayAmount + .5), k2 = floor(uRayAmount * 1.6 + .5);    // shafts: a few broad ones .. many thin ones
    float beams = .5 + .5 * sin(a * k1 + uTime * .3) * sin(a * k2 - uTime * (.2 + .4 * uEnergy) + 1.3);
    beams = .08 + pow(beams, 4.) * 1.6;                       // separate shafts, not a fog
    float light = exp(-r * r * 16.) * .35 + exp(-r * r * 2.6) * .7 * beams;
    vec3 col = mix(vec3(1., .4, .09), vec3(1., .78, .5), exp(-r * r * 30.)) * light;
    gl_FragColor = vec4(col * uCore * uPower * smoothstep(1., .75, r), 0.);
  }`;

const SMEAR_FRAG = `
  varying vec2 vUv; uniform sampler2D tOcc, tHem; uniform vec2 uLight; uniform float uLen, uGain, uHemLen, uHemGain;
  const int N = 64;
  // smear one mask outward from the core, over len of the way to it, then fade with distance from the shell:
  // the shorter the rays, the sooner they fade, so they end softly instead of at a hard edge
  vec3 smear(sampler2D t, float len, float jit){
    vec2 d = (vUv - uLight) * len / float(N);
    vec2 uv = vUv - d * jit;
    vec3 acc = vec3(0.); float w = 1.;
    for (int i = 0; i < N; i++) { acc += texture2D(t, uv).rgb * w; w *= .962; uv -= d; }
    float out_ = max(0., length((vUv - uLight) * vec2(1.5, 1.)) - .2);   // distance past the shell, in stage heights
    return acc * 3. / float(N) * exp(-out_ / (len * .55 + .02));
  }
  void main(){
    float jit = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);   // jittered start: no banding
    gl_FragColor = vec4(smear(tOcc, uLen, jit) * uGain + smear(tHem, uHemLen, jit) * uHemGain, 1.);
  }`;

export class Rays {
  constructor() {
    this.uniforms = { ...commonUniforms(), uHemPass: { value: 0 }, uHemAmount: { value: 1 }, uRayAmount: { value: 1 } };
    // the plates are drawn into the masks with this (black silhouettes, or just the hems)
    this.occMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false, vertexShader: OCC_VERT,
      fragmentShader: `varying vec3 vCol; void main(){ vec2 c = gl_PointCoord * 2. - 1.; if (dot(c, c) > 1.) discard; gl_FragColor = vec4(vCol, step(dot(vCol, vec3(1.)), 0.)); }`,
    });
    this.light = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: LIGHT_FRAG,
    }));
    this.light.layers.set(1);
    this.light.renderOrder = -1;                 // the light first, then the plates black it out

    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.occRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.hemRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.raysRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.smear = new THREE.ShaderMaterial({
      uniforms: { tOcc: { value: this.occRT.texture }, tHem: { value: this.hemRT.texture }, uLight: { value: new THREE.Vector2(.5, .7) },
                  uLen: { value: .85 }, uGain: { value: 1 }, uHemLen: { value: .85 }, uHemGain: { value: 1 } },
      depthTest: false, depthWrite: false, vertexShader: FULLSCREEN_VERT, fragmentShader: SMEAR_FRAG,
    });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.smear));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._lightPos = new THREE.Vector3();
  }

  /** The masks and the rays are drawn at half the drawing buffer. */
  setSize(w, h) { for (const rt of [this.occRT, this.hemRT, this.raysRT]) rt.setSize(Math.ceil(w / 2), Math.ceil(h / 2)); }

  /** Where the core is on screen, 0..1: the rays smear outward from it, and the scarf is lit from it. */
  get lightUV() { return this.smear.uniforms.uLight.value; }

  update({ live, breath }) {
    const u = this.smear.uniforms;
    u.uLen.value = live.rayLength;
    u.uHemLen.value = live.hemLength;
    u.uGain.value = live.rays * (1 + .18 * breath);
    u.uHemGain.value = live.hemRays * (1 + .18 * breath);
    this.uniforms.uHemAmount.value = live.hemAmount;
    this.uniforms.uRayAmount.value = live.rayAmount;
    this.uniforms.uCore.value = 1;              // the Intensity slider alone sets how strong the shafts are
  }

  render(renderer, scene, camera, coreY) {
    this.light.quaternion.copy(camera.quaternion);
    this._lightPos.set(0, coreY, 0).project(camera);
    this.lightUV.set(this._lightPos.x * .5 + .5, this._lightPos.y * .5 + .5);
    camera.layers.set(1);
    renderer.setRenderTarget(this.occRT); renderer.setClearColor(0x000000, 0); renderer.clear();
    this.uniforms.uHemPass.value = 0; this.light.visible = true;
    renderer.render(scene, camera);
    renderer.setRenderTarget(this.hemRT); renderer.clear();
    this.uniforms.uHemPass.value = 1; this.light.visible = false;
    renderer.render(scene, camera);
    this.light.visible = true;
    renderer.setRenderTarget(this.raysRT);
    renderer.render(this.quadScene, this.quadCam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    camera.layers.set(0);
  }
}

export { FULLSCREEN_VERT };
