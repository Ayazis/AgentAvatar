// The jacket, morphing between three poses (0 off, 1 idle, 2 working), plus the knotted jacket.
// Each panel is stored rectified per row in the atlas; its outline (top/bottom + per-row edges) blends between poses.
// Idle ⇄ knot is a 720° turn about the jacket's centre line (see Knot.js): the posed jacket turns, and while it is
// edge-on it is swapped for the knotted one (knotArt/knotDep, laid over knotBox).
//
// This is the one mask. The scene pass draws jacket(clothed(st)) and hides the far half of the ring, the orb glow
// and the sparks behind its coverage; the particle pass hides points behind the lapels with the very same call,
// per pixel. So whatever the jacket is doing (morphing, swaying, tilting, turning, motion-blurred), everything
// behind it is cut by exactly the jacket that is on screen.
// spans: [[top, bottom] for stage 0 left, stage 0 right, 1 left, 1 right, 2 left, 2 right] (assets/poses.json)
const v2 = ([a, b]) => `vec2(${a.toFixed(5)},${b.toFixed(5)})`;

export function jacketGLSL(spans) {
  const rows = [0, 1, 2].map(i =>
    `  ${i ? 'else if' : 'if'}(stage<${i}.5) return side<.5 ? ${v2(spans[2*i])} : ${v2(spans[2*i + 1])};`).join('\n');
  return `
uniform sampler2D atlas, depthA, bounds, knotArt, knotDep;
uniform float pose;
uniform vec4 knotBox;   // where the knotted jacket sits (st): x, y, w, h
uniform vec4 knotSpin;  // turn angle now, angle at the far end of the motion blur, blur samples, swap angle
uniform vec4 cloth;     // jacket clock, sway energy, breath, intensity
uniform vec4 clothB;    // tilt x, tilt y, time, flutter
uniform vec3 view;      // canvas aspect, picture scale (picture height / canvas height), canvas height in pixels

// canvas uv (0…1, y up) → picture coords st (x 0…1, y 0 top … 1 bottom, 2:3 frame)
vec2 pictureAt(vec2 uv){
  vec2 q = vec2((uv.x - .5)*view.x, uv.y - .5)/view.y;
  return vec2(q.x*1.5 + .5, .5 - q.y);
}
float pxW = .001;       // one canvas pixel in panel x (set per turn angle by turned()), for the edge antialiasing

vec2 vspan(float stage, float side){
${rows}
  return vec2(0.,1.);
}
vec2 pEdges(float stage, float side, float v){
  vec4 k = texture2D(bounds, vec2((.5 + 639.*v)/640., (stage*2. + side + .5)/6.));
  return (k.rb*256. + k.ga)/257.;
}
// colour + coverage of one panel; depth out
vec4 panel(vec2 st, float side, out float dep){
  dep = 0.;
  float a = min(floor(pose), 1.), b = a + 1., f = pose - a;
  vec2 span = mix(vspan(a, side), vspan(b, side), f);
  float h = span.y - span.x, v = (st.y - span.x)/h;
  if (v < 0. || v > 1.) return vec4(0.);
  vec2 ext = mix(pEdges(a, side, v), pEdges(b, side, v), f);
  float w = max(ext.y - ext.x, .00001), u = (st.x - ext.x)/w;
  if (u < 0. || u > 1.) return vec4(0.);
  vec2 at = vec2((side*512. + .5 + 511.*u)/1024., (.5 + 639.*v)/1920.);
  vec2 oa = vec2(0., a/3.), ob = vec2(0., b/3.);
  dep = mix(texture2D(depthA, at + oa).r, texture2D(depthA, at + ob).r, f);
  vec4 c = mix(texture2D(atlas, at + oa), texture2D(atlas, at + ob), f);
  // mid-morph, where only one pose has cloth, a plain cross-fade leaves see-through ghosts: instead the edge
  // travels from one pose's outline to the other's (threshold the blended alpha, fully at the halfway point)
  c.a = mix(c.a, smoothstep(.3, .7, c.a), 4.*f*(1. - f));
  // the outline is cut analytically: fade over the last pixel, so it stays clean as it morphs and moves
  float px = 1./(view.z*view.y);
  c.a *= clamp(min(min(u, 1. - u)*w/pxW, min(v, 1. - v)*h/px), 0., 1.);
  return c;
}
// the right panel lies over the left where they cross. m = (coverage, depth, 0)
vec4 posed(vec2 st, out vec3 m){
  float dl, dr;
  vec4 L = panel(st, 0., dl), R = panel(st, 1., dr);
  float cov = R.a + L.a*(1. - R.a);
  m = vec3(cov, mix(dl, dr, R.a), 0.);
  return vec4(mix(L.rgb, R.rgb, R.a), cov);
}
vec4 knotted(vec2 st, out vec3 m){
  vec2 k = (st - knotBox.xy)/knotBox.zw;
  if (k.x < 0. || k.x > 1. || k.y < 0. || k.y > 1.) { m = vec3(0.); return vec4(0.); }
  vec4 c = texture2D(knotArt, k);
  m = vec3(c.a, texture2D(knotDep, k).r, 0.);
  return c;
}
// the jacket turned by angle a about its centre line (x = .5): idle before the swap, knotted after
vec4 turned(vec2 st, float a, out vec3 m){
  float c = cos(a);
  if (abs(c) < .01) { m = vec3(0.); return vec4(0.); }
  pxW = 1.5/(view.z*view.y*abs(c));
  vec2 p = vec2(.5 + (st.x - .5)/c, st.y);
  return a < knotSpin.w ? posed(p, m) : knotted(p, m);
}
// colour + coverage, motion-blurred across the turn since the last frame; depth from the current angle
vec4 jacket(vec2 st, out vec3 m){
  vec4 now = turned(st, knotSpin.x, m);
  if (knotSpin.z < 1.5) return now;
  vec3 acc = now.rgb*now.a, mi; float cov = now.a;
  for (int i = 1; i < 12; i++) {
    if (float(i) >= knotSpin.z) break;
    vec4 c = turned(st, mix(knotSpin.x, knotSpin.y, float(i)/(knotSpin.z - 1.)), mi);
    acc += c.rgb*c.a; cov += c.a;
  }
  m.r = cov/knotSpin.z;
  return vec4(acc/max(cov, 1e-4), m.r);
}
vec3 M(vec2 st){ vec3 m; turned(st, knotSpin.x, m); return m; }

// where to sample the jacket for picture point st: each lapel hangs from its top and sways, a wave rolls down it,
// they open and close with the breath, lean with the tilt (nearer parts shift more) and their thin edges flutter.
vec2 clothed(vec2 st){
  float jt = cloth.x, breath = cloth.z, intensity = cloth.w;
  vec2 tilt = clothB.xy;
  float wl = 1. - smoothstep(.36, .52, st.x);        // left lapel weight (right = 1 - wl)
  float hang = clamp((st.y - .28)/.64, 0., 1.);       // 0 at the top of the lapels … 1 at the tips
  float phase = mix(1.9, 0., wl);                     // the two sides move out of step
  vec2 c = vec2(0.);
  c.x += .022*sin(jt*.72 + phase)*pow(hang, 1.5);                              // sway from the top
  c.x += .009*sin(st.y*6.5 - jt*1.5 + phase)*hang;                              // wave rolling down
  c.y += .006*sin(jt*.9 + phase + st.x*3.)*hang;                                // a little lift
  c.x += mix(.007, -.007, wl)*(.5*breath + .5)*(.6 + hang) + mix(.01, -.01, wl)*intensity*hang;  // open with the breath
  float collar = 1. - smoothstep(.27, .42, st.y);                               // top collar points
  c += collar*vec2(.007*sin(jt*1.6 + phase*1.3), .004*cos(jt*1.3 + phase));
  c.x += .012*tilt.x*hang;                                                      // lean with the tilt
  vec2 s = st - c*cloth.y;
  s += tilt*.013*(M(s).g - .3);
  vec3 m = M(s);
  float thin = (1. - smoothstep(.12, .65, m.g))*m.r;
  float t = clothB.z;
  return s + clothB.w*thin*vec2(.003*sin(t*1.25 + s.y*7.), .002*cos(t*1.05 + s.x*6.));
}
`;
}
