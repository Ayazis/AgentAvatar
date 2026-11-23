// The full-screen pass: jacket, orb light, the far half of the silk ring, off-dimming and tap ring.
// With frontPass = true it draws only the near half of the ring, laid over the particles.
import { ORB } from '../config.js';
import { NOISE_GLSL } from './noise.glsl.js';
import { jacketGLSL } from './jacket.glsl.js';
import { SILK_RING_GLSL } from './silkRing.glsl.js';

const UNIFORMS = `
varying vec2 uv;
uniform vec2 scene;   // time, awake
uniform vec4 motion;  // tilt x, tilt y, intensity, tap age
uniform vec4 tap;     // tap position (screen space), breath, travel
uniform float silkT;  // the silk's own clock: always slow and calm
uniform vec4 tuneA;   // silk brightness, silk width, silk sway, jacket motion
uniform vec4 tuneB;   // orb glow, sparks, orb size, silk on
uniform vec4 tuneC;   // silk ring: radius (× orb), tilt, roll (radians), depth offset
uniform vec2 res;
uniform float detail;
uniform sampler2D lightTex;  // the particles' light, drawn soft at low resolution
uniform float lightAmt;      // how strongly that light falls on the denim`;

// near half of the ring: premultiplied, over the particles
const FRONT_BODY = `
  float rimF = exp(-pow((abs(vR)-1.35)/.6, 2.));
  float sF = motes(vec2(vR*.05, thR*.16), 70., 3., .18, travel*1.2) * rimF * smoothstep(.5,.7,h21(floor(vec2(vR*.05, thR*.16)*70. + vec2(3., travel*1.2)) + 3.));
  vec3 lightF = rose*glow*(.16 + .2*bandR + .35*intensity + .3*pulse) + awake*detail*tuneB.y*tuneB.w*vec3(1.,.6,.68)*sF*(1.1 + .8*intensity);
  float aF = ring.a*front;
  gl_FragColor = vec4(ring.rgb*aF + lightF*front*(1. - aF), aF);`;

const BACK_BODY = `
  // ── denim: the hanging cloth (sway, tilt, flutter: clothed() in jacket.glsl.js)
  vec3 m;
  vec4 jk = jacket(clothed(st), m);
  float den = m.r;
  vec3 col = mix(bgc, jk.rgb, den);
  // ── the particles' light on the denim: raised folds and lighter fabric catch more of it
  vec3 pl = texture2D(lightTex, uv).rgb;
  float catchL = .3 + 1.4*dot(jk.rgb, vec3(.3,.5,.2)) + .5*m.g;
  col += (1. - exp(-pl*3.))*den*catchL*lightAmt*.35;   // soft-clipped so dense swirls glow, not burn

  // ── the orb's light: a warm core glowing from inside the jacket
  vec2 dOrb = (st - vec2(ORB_X, ORB_Y))*vec2(.6667, 1.);
  float orbR = .095*tuneB.z*(1. + .03*breath + .12*intensity);
  float core = exp(-dot(dOrb,dOrb)/(orbR*orbR*1.6));
  col += rose*core*(.22 + .25*intensity + .3*pulse)*awake*(1. - den)*tuneB.x;   // behind the lapels: cut by the jacket
  col += vec3(1.,.8,.85)*exp(-dot(dOrb,dOrb)/(orbR*orbR*.08))*.18*awake*(1. - den)*tuneB.x;

  // ── silk ring, far half: behind the lapels and seen through the orb's light
  float back = 1. - front;
  float orbDisc = 1. - smoothstep(.095*tuneB.z*.8, .095*tuneB.z*1.05, length(vec2((ss.x - ORB_X)/1.5, ss.y - ORB_Y)));
  float occl = back * (1. - den) * (1. - .55*orbDisc);
  col += rose * den * exp(-abs(dR)/.07) * (.10 + .12*bandR + .2*intensity) * glow;     // the ring lights the denim near it
  col = mix(col, ring.rgb, ring.a*occl);
  col += rose * glow * (.16 + .2*bandR + .35*intensity + .3*pulse) * back * (1. - den);
  float rim = exp(-pow((abs(vR)-1.35)/.6, 2.));
  float s1 = motes(vec2(vR*.05, thR*.16), 70., 3., .18, travel*1.2) * rim * occl * smoothstep(.5,.7,h21(floor(vec2(vR*.05, thR*.16)*70. + vec2(3., travel*1.2)) + 3.));
  vec3 sparkTint = mix(vec3(1.,.55,.62), vec3(1.,.82,.86), clamp(tuneB.y - 1., 0., 1.));
  col += awake*detail*tuneB.y*tuneB.w*sparkTint*s1*(1.1 + .8*intensity);

  // ── off: the light goes dark, the jacket stays fully visible
  col = mix(mix(bgc, jk.rgb, den), col, awake);

  // tap: a soft ring from where you touched
  float age = motion.w;
  col += rose*.8*exp(-abs(length(screen - tap.xy) - age*.55)*260.)*(1.-smoothstep(0.,1.3,age))*.35;

  col *= .78 + .22*exp(-2.2*dot(screen,screen));
  col += (h21(uv*res + fract(t)*97.) - .5)*.018;
  gl_FragColor = vec4(col, 1.);`;

export function sceneFrag(spans, frontPass) {
  return `
precision highp float;
#define ORB_X ${ORB.x.toFixed(3)}
#define ORB_Y ${ORB.y.toFixed(3)}
${UNIFORMS}
${NOISE_GLSL}
${jacketGLSL(spans)}
${SILK_RING_GLSL}
void main(){
  float t = scene.x, awake = scene.y, intensity = motion.z*awake, breath = tap.z, travel = tap.w;
  vec2 screen = vec2((uv.x-.5)*view.x, uv.y-.5);
  vec2 st = pictureAt(uv);
  vec2 tilt = vec2(motion.x, -motion.y);
  float pulse = smoothstep(0.,.18,motion.w)*(1.-smoothstep(.35,1.5,motion.w));
  vec3 rose = vec3(1.,.34,.5);
  vec3 bgc = mix(vec3(.03,.005,.035), vec3(.086,.004,.078), exp(-3.*dot(screen,screen)));
  vec2 ss = st + tilt*.013*(.18-.3);               // the ring sits around the orb, inside the jacket
  float glow, front, dR, vR, thR, bandR, Rr;
  vec4 ring = silkRing(ss, awake, intensity, pulse, glow, front, dR, vR, thR, bandR, Rr);
${frontPass ? FRONT_BODY : BACK_BODY}
}`;
}
