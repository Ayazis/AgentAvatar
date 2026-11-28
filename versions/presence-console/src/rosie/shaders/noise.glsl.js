// Hash noise and drifting sparkle points, shared by the scene and silk passes.
export const NOISE_GLSL = `
float h21(vec2 c){ vec3 h = fract(vec3(c.xyx)*vec3(.1031,.11369,.13787)); h += dot(h, h.yzx+19.19); return fract((h.x+h.y)*h.z); }
float motes(vec2 path, float cells, float off, float size, float drift){
  vec2 g = path*cells + vec2(off, drift); vec2 c = floor(g); float k = h21(c);
  vec2 ctr = .22 + .56*vec2(k, h21(c+31.5));
  return (1. - smoothstep(.015, size, length(fract(g)-ctr))) * (.3+.7*k) * smoothstep(.3,.6,k);
}`;
