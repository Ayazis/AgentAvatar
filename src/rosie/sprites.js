// What every particle layer shares: the point sprite, the common uniforms, and helpers to build point geometry.
import * as THREE from 'three';
import { DIST } from './config.js';

/** Seeded random numbers, so every build lays the particles out the same way. */
export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** A random unit vector (from three draws in a cube, normalised). */
export const randomDir = rnd => new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();

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

/** The uniforms every layer has; the orb sets them each frame. Each layer gets its own set. */
export const commonUniforms = () => ({
  uTime: { value: 0 }, uPower: { value: 1 }, uCore: { value: 1 }, uEnergy: { value: 0 },
  uSize: { value: 1 }, uPx: { value: 1 }, uDist: { value: DIST }, uHalo: { value: 1 }, uGain: { value: 1 }, uLightMul: { value: 1 },
});

/** Additive glowing sprites. The vertex shader sets gl_PointSize, vCol and vHot. */
export const pointsMaterial = (uniforms, vertexShader) => new THREE.ShaderMaterial({
  uniforms, vertexShader, fragmentShader: SPRITE_FRAG,
  blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, transparent: true,
});

/**
 * Point geometry whose positions are computed in the shader: an empty position buffer for `count` points plus
 * one attribute per entry of `attrs` ({ name: [values] }); the item size is worked out from the count.
 */
export function shaderPointsGeometry(count, attrs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, new THREE.Float32BufferAttribute(v, v.length / count));
  return g;
}

/** Points that are always drawn: their real positions come from the shader, so three can't cull them. */
export function points(geometry, material) {
  const obj = new THREE.Points(geometry, material);
  obj.frustumCulled = false;
  return obj;
}
