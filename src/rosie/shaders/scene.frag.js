// The full-screen pass: jacket, orb light, the far half of the silk ring, off-dimming and tap ring.
// With frontPass = true it draws only the near half of the ring, laid over the particles.
import { ORB } from '../config.js';
import { NOISE_GLSL } from './noise.glsl.js';
import { jacketGLSL } from './jacket.glsl.js';
import { SILK_RING_GLSL } from './silkRing.glsl.js';

const UNIFORMS = `
varying vec2 uv;
uniform vec4 scene;   // aspect, time, awake, jacket clock
uniform vec4 motion;  // tilt x, tilt y, audio, tap age
uniform vec4 tap;     // tap position (screen space), breath, travel
uniform float silkT;  // the silk's own clock: always slow and calm
uniform vec4 tuneA;   // silk brightness, silk width, silk sway, jacket motion
uniform vec4 tuneB;   // orb glow, sparks, orb size, silk on
uniform vec4 tuneC;   // silk ring: radius (× orb), tilt, roll (radians), depth offset
uniform vec2 res;
uniform float detail;`;

// near half of the ring: premultiplied, over the particles
const FRONT_BODY = `
  float rimF = exp(-pow((abs(vR)-1.35)/.6, 2.));
  float sF = motes(vec2(vR*.05, thR*.16), 70., 3., .18, travel*1.2) * rimF * smoothstep(.5,.7,h21(floor(vec2(vR*.05, thR*.16)*70. + vec2(3., travel*1.2)) + 3.));
  vec3 lightF = rose*glow*(.16 + .2*bandR + .35*audio + .3*pulse) + awake*detail*tuneB.y*tuneB.w*vec3(1.,.6,.68)*sF*(1.1 + .8*audio);
  float aF = ring.a*front;
  gl_FragColor = vec4(ring.rgb*aF + lightF*front*(1. - aF), aF);`;

const BACK_BODY = `
  // ── denim: hanging cloth. Each lapel sways from its top, a wave rolls down it,
  //    they open and close with the breath; tips and collar points move the most.
  float wl = 1. - smoothstep(.36, .52, st.x);        // left lapel weight (right = 1 - wl)
  float hang = clamp((st.y - .28)/.64, 0., 1.);       // 0 at the top of the lapels … 1 at the tips
  float energy = awake * (1. + .6*audio) * tuneA.w;
  float phase = mix(1.9, 0., wl);                     // the two sides move out of step
  vec2 cloth = vec2(0.);
  cloth.x += .022*sin(jt*.72 + phase) * pow(hang, 1.5);                        // sway from the top
  cloth.x += .009*sin(st.y*6.5 - jt*1.5 + phase) * hang;                        // wave rolling down
  cloth.y += .006*sin(jt*.9 + phase + st.x*3.) * hang;                          // a little lift
  cloth.x += mix(.007, -.007, wl) * (.5*breath + .5) * (.6 + hang) + mix(.01,-.01,wl)*audio*hang;  // open with the breath
  float collar = (1. - smoothstep(.27, .42, st.y));                             // top collar points
  cloth += collar * vec2(.007*sin(jt*1.6 + phase*1.3), .004*cos(jt*1.3 + phase));
  cloth.x += .012*motion.x*hang;                                                // lean with the tilt
  vec2 s2 = st - cloth*energy;
  s2 += tilt*.013*(M(s2).g-.3);
  vec3 m = M(s2);
  float thin = (1.-smoothstep(.12,.65,m.g)) * m.r;
  s2 += awake*tuneA.w*thin*vec2(.003*sin(t*1.25+s2.y*7.), .002*cos(t*1.05+s2.x*6.));
  vec4 jk = jacket(s2, m);
  float den = m.r;
  vec3 col = mix(bgc, jk.rgb, den);

  // ── the orb's light: a warm core glowing from inside the jacket
  vec2 dOrb = (st - vec2(ORB_X, ORB_Y))*vec2(.6667, 1.);
  float orbR = .095*tuneB.z*(1. + .03*breath + .12*audio);
  float core = exp(-dot(dOrb,dOrb)/(orbR*orbR*1.6));
  col += rose*core*(.22 + .25*audio + .3*pulse)*awake*(1. - .85*den)*tuneB.x;
  col += vec3(1.,.8,.85)*exp(-dot(dOrb,dOrb)/(orbR*orbR*.08))*.18*awake*(1. - .9*den)*tuneB.x;

  // ── silk ring, far half: behind the lapels and seen through the orb's light
  float back = 1. - front;
  float orbDisc = 1. - smoothstep(.095*tuneB.z*.8, .095*tuneB.z*1.05, length(vec2((ss.x - ORB_X)/1.5, ss.y - ORB_Y)));
  float occl = back * (1. - den) * (1. - .55*orbDisc);
  col += rose * den * exp(-abs(dR)/.07) * (.10 + .12*bandR + .2*audio) * glow;     // the ring lights the denim near it
  col = mix(col, ring.rgb, ring.a*occl);
  col += rose * glow * (.16 + .2*bandR + .35*audio + .3*pulse) * back * (1. - .7*den);
  float rim = exp(-pow((abs(vR)-1.35)/.6, 2.));
  float s1 = motes(vec2(vR*.05, thR*.16), 70., 3., .18, travel*1.2) * rim * occl * smoothstep(.5,.7,h21(floor(vec2(vR*.05, thR*.16)*70. + vec2(3., travel*1.2)) + 3.));
  vec3 sparkTint = mix(vec3(1.,.55,.62), vec3(1.,.82,.86), clamp(tuneB.y - 1., 0., 1.));
  col += awake*detail*tuneB.y*tuneB.w*sparkTint*s1*(1.1 + .8*audio);

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
  float t = scene.y, awake = scene.z, jt = scene.w, audio = motion.z*awake, breath = tap.z, travel = tap.w;
  vec2 screen = vec2((uv.x-.5)*scene.x, uv.y-.5);
  float scale = min(.95, scene.x*1.42) * (.9+.1*awake) * (1. + .006*breath*awake);
  vec2 q = screen/scale;
  vec2 st = vec2(q.x*1.5+.5, .5-q.y);
  vec2 tilt = vec2(motion.x, -motion.y);
  float pulse = smoothstep(0.,.18,motion.w)*(1.-smoothstep(.35,1.5,motion.w));
  vec3 rose = vec3(1.,.34,.5);
  vec3 bgc = mix(vec3(.03,.005,.035), vec3(.086,.004,.078), exp(-3.*dot(screen,screen)));
  vec2 ss = st + tilt*.013*(.18-.3);               // the ring sits around the orb, inside the jacket
  float glow, front, dR, vR, thR, bandR, Rr;
  vec4 ring = silkRing(ss, awake, audio, pulse, glow, front, dR, vR, thR, bandR, Rr);
${frontPass ? FRONT_BODY : BACK_BODY}
}`;
}
