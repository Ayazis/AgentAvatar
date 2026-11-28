// The last pass: the dark background and the scarf under the orb, with the bloomed orb and the rays added on top.
// The scarf is either painted (ChatGPT's unlit / lit / bright images, blended by light level) or lit in code by
// everything the orb draws.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FULLSCREEN_VERT } from './rays.js';

const SCARF_FRAG = `
  varying vec2 vUv; uniform sampler2D tDiffuse, tLit, tUnlit, tBright, tRays, tOcc, tNormal, tReach, tLight, tGlow;
  uniform float uLit, uRays, uLightGain, uCode, uBloomK, uShellOpacity; uniform vec2 uLightUV;
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
      // everything that glows at this spot, as it is on screen: the particles (weighted), the bloom and the shafts
      vec3 c = textureLod(tLight, q, 2.6).rgb + texture2D(tGlow, q).rgb * uBloomK * 9. + texture2D(tRays, q).rgb * uRays * 1.4;
      vec2 d = (q - p) * vec2(1.5, 1.);
      vec3 L = normalize(vec3(d, .2));
      float wrap = max((dot(N, L) + .3) / 1.3, 0.);
      float att = 1. / (1. + dot(d, d) * 14.);                // close light counts most: a wisp dipping low lights the folds under it
      light += c * wrap * att;
      spec += pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 20.) * att * dot(c, vec3(.33));
    }
    light = light * uLightGain + texture2D(tRays, p).rgb * uRays * 1.3 * max((dot(N, normalize(vec3((uLightUV - p) * vec2(1.5, 1.), .22))) + .3) / 1.3, 0.);
    light *= mix(.12, 1.25, reach);
    spec *= uLightGain * mix(.2, 1., reach);
    vec3 albedo = mix(u.rgb, vec3(dot(u.rgb, vec3(.3, .59, .11))), .55) * 3. + .03;   // denim takes the light's colour, as in the painted bright version
    vec4 code = vec4(u.rgb + albedo * light + light * spec * .12, u.a);
    vec4 s = mix(painted, code, uCode);
    gl_FragColor = vec4(mix(bg, s.rgb, s.a) + texture2D(tDiffuse, p).rgb + texture2D(tRays, p).rgb * uRays * (1. - mix(.8, 1., uShellOpacity) * texture2D(tOcc, p).a), 1.);
  }`;

const loader = new THREE.TextureLoader();
const scarfTexture = (name, srgb = true) => {
  const t = loader.load(new URL(`../../assets/base/scarf-${name}.webp`, import.meta.url).href);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/**
 * @param rays       the Rays (their result, the ray mask and where the core is on screen)
 * @param lightTex   the light buffer: the orb drawn small, with mipmaps (see LightBuffer)
 * @param glowTex    the bloom's blurred glow, before its strength is applied
 */
export function createScarfPass(rays, lightTex, glowTex) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tUnlit: { value: scarfTexture('unlit') }, tLit: { value: scarfTexture('lit') }, tBright: { value: scarfTexture('bright') },
      tNormal: { value: scarfTexture('normal', false) }, tReach: { value: scarfTexture('reach', false) },
      tLight: { value: null }, tGlow: { value: null }, tRays: { value: null }, tOcc: { value: null }, uLightUV: { value: null },
      uLit: { value: 0 }, uLightGain: { value: 1 }, uCode: { value: 1 }, uBloomK: { value: 1 }, uShellOpacity: { value: 0 }, uRays: { value: 1 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: SCARF_FRAG,
  });
  // ShaderPass clones its uniforms (render target textures would come out null), so these are wired in afterwards
  const u = pass.material.uniforms;
  u.tLight.value = lightTex; u.tGlow.value = glowTex;
  u.tRays.value = rays.raysRT.texture; u.tOcc.value = rays.occRT.texture;
  u.uLightUV.value = rays.lightUV;              // shared: follows the core every frame
  return pass;
}
