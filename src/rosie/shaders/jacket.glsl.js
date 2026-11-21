// The jacket, morphing between three poses (0 off, 1 idle, 2 working), plus the knotted jacket.
// Each panel is stored rectified per row in the atlas; its outline (top/bottom + per-row edges) blends between poses.
// Idle ⇄ knot is a 720° turn about the jacket's centre line (see Knot.js): the posed jacket turns, and while it is
// edge-on it is swapped for the knotted one (knotArt/knotDep, laid over knotBox). Everything that reads jacket() or
// M() — cloth motion, tilt, lighting, ring and particle occlusion — sees whichever jacket is showing, turned.
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
  float v = (st.y - span.x)/(span.y - span.x);
  if (v < 0. || v > 1.) return vec4(0.);
  vec2 ext = mix(pEdges(a, side, v), pEdges(b, side, v), f);
  float u = (st.x - ext.x)/max(ext.y - ext.x, .00001);
  if (u < 0. || u > 1.) return vec4(0.);
  vec2 at = vec2((side*512. + .5 + 511.*u)/1024., (.5 + 639.*v)/1920.);
  vec2 oa = vec2(0., a/3.), ob = vec2(0., b/3.);
  dep = mix(texture2D(depthA, at + oa).r, texture2D(depthA, at + ob).r, f);
  return mix(texture2D(atlas, at + oa), texture2D(atlas, at + ob), f);
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
`;
}
