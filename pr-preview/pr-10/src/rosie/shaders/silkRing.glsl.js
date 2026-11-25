// The silk ring: one band of rose silk round the orb, a tilted circle seen in perspective.
// Needs ORB_X / ORB_Y defines and the tuneA/B/C + silkT uniforms (see scene.frag.js).
export const SILK_RING_GLSL = `
vec3 ringPt(float th, float Rr, vec4 rot){         // rot = cos/sin of tilt, cos/sin of roll
  float x = cos(th)*Rr, z = sin(th)*Rr;            // z > 0: the far side
  float y = -z*rot.y;                              // the near side sits lower: we look down on it a little
  return vec3(x*rot.z - y*rot.w, x*rot.w + y*rot.z, z*rot.x);
}
// shade the ring at picture point ss. Returns colour + coverage; glow, frontness, distance etc. via out.
vec4 silkRing(vec2 ss, float awake, float intensity, float pulse,
              out float glow, out float front, out float d, out float v, out float th, out float band, out float Rr){
  Rr = .095*tuneB.z*tuneC.x;
  float wob = tuneA.z;
  float e = tuneC.y + .07*wob*sin(silkT*.21), r = tuneC.z + .09*wob*sin(silkT*.17 + 1.);
  vec4 rot = vec4(cos(e), sin(e), cos(r), sin(r));
  vec2 p = vec2((ss.x - ORB_X)/1.5, ss.y - ORB_Y); // picture heights, relative to the orb
  glow = 0.; front = 0.; d = 1.; v = 9.; th = 0.; band = 0.;
  if (length(p) > Rr + .12 || tuneB.w < .001) return vec4(0.);
  // nearest point on the ring: coarse pass, then refine
  float best = 1e9;
  for (int i = 0; i < 40; i++) {
    float a = float(i)*.15708; vec2 q = p - ringPt(a, Rr, rot).xy; float d2 = dot(q, q);
    if (d2 < best) { best = d2; th = a; }
  }
  float stp = .08;
  for (int k = 0; k < 5; k++) {
    vec2 qa = p - ringPt(th - stp, Rr, rot).xy, qb = p - ringPt(th + stp, Rr, rot).xy;
    if (dot(qa,qa) < best) { best = dot(qa,qa); th -= stp; }
    if (dot(qb,qb) < best) { best = dot(qb,qb); th += stp; }
    stp *= .5;
  }
  vec3 c = ringPt(th, Rr, rot);
  vec2 tg = normalize(ringPt(th + .01, Rr, rot).xy - ringPt(th - .01, Rr, rot).xy);
  vec2 off = p - c.xy;
  d = (off.x*tg.y - off.y*tg.x < 0. ? -1. : 1.)*length(off);
  front = smoothstep(.012, -.012, c.z + tuneC.w);  // the near half passes in front of the lapels and the orb
  // the band: a silk ribbon with a slow twist, fibres and a soft sheen
  float hw = .03*tuneA.y*(1. + .15*intensity + .2*pulse);
  float tw = th*2. + silkT*.3;
  float face = abs(cos(tw));
  float app = max(hw*(.45 + .55*face), .002);
  v = d/app;
  float body = 1. - smoothstep(.55, 1., abs(v));
  float streak = .55 + .45*sin(v*9. + 1.6*sin(th*6. - silkT*1.2));
  float fib = .75 + .25*sin(v*33. + th*5. - silkT*.5);
  float sheen = exp(-v*v*1.3);
  float edgeOn = (1. - face)*sheen;
  float u1 = fract(th/6.2832 + silkT*.05), u2 = fract(th/6.2832 + silkT*.05 + .5);   // light travelling round the ring
  band = exp(-pow((u1-.5)/.06, 2.)) + .55*exp(-pow((u2-.5)/.045, 2.));
  float far = smoothstep(-.3, .9, c.z/Rr);         // the far side is a little dimmer
  float I = (.22 + .42*streak*fib + .5*sheen + .55*edgeOn + band*.55 + .5*intensity + .9*pulse) * awake * tuneA.x * (1. - .35*far);
  vec3 deep = vec3(.6,.07,.17), mid = vec3(1.,.36,.5), hot = vec3(1.,.87,.88);
  vec3 sc = mix(deep, mid, smoothstep(.15,.85,I));
  sc = mix(sc, hot, smoothstep(.95,1.7,I)) * (.5 + .85*I);
  float alpha = body * clamp(.3 + .7*I, 0., 1.) * awake * tuneB.w * min(1., tuneA.x*2.);
  glow = exp(-abs(d)/(app*1.5 + .012)) * tuneB.w * tuneA.x * awake;
  return vec4(sc, alpha);
}`;
