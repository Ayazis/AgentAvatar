// Small WebGL helpers.

export function createProgram(g, vertSrc, fragSrc) {
  const compile = (type, src) => {
    const s = g.createShader(type);
    g.shaderSource(s, src); g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw Error(g.getShaderInfoLog(s));
    return s;
  };
  const p = g.createProgram();
  g.attachShader(p, compile(g.VERTEX_SHADER, vertSrc));
  g.attachShader(p, compile(g.FRAGMENT_SHADER, fragSrc));
  g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw Error(g.getProgramInfoLog(p));
  return p;
}

export function uniforms(g, program, names) {
  const u = {};
  for (const n of names) u[n] = g.getUniformLocation(program, n);
  return u;
}

// a linear, edge-clamped texture on the given unit, filled from an image or raw RGBA bytes
export function createTexture(g, unit, source) {
  const t = g.createTexture();
  g.activeTexture(g.TEXTURE0 + unit);
  g.bindTexture(g.TEXTURE_2D, t);
  for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR],
                        [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
  if (source.data) {
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, source.width, source.height, 0, g.RGBA, g.UNSIGNED_BYTE, source.data);
  } else {
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source);
  }
  return t;
}

// texture units: the jacket's samplers, and the particles' light buffer
export const UNITS = { atlas: 0, depthA: 1, bounds: 2, light: 3, knotArt: 4, knotDep: 5 };
const JACKET_SAMPLERS = ['atlas', 'depthA', 'bounds', 'knotArt', 'knotDep'];

// Binds a program's jacket samplers (shaders/jacket.glsl.js) and returns set(f), which sets the jacket's
// per-frame uniforms from the frame values: pose, the knot turn, the cloth motion and the view.
// Every pass that reads jacket() calls it with the same f, so they all see the same jacket.
export function jacketUniforms(g, program) {
  g.useProgram(program);
  for (const name of JACKET_SAMPLERS) g.uniform1i(g.getUniformLocation(program, name), UNITS[name]);
  const u = uniforms(g, program, ['pose', 'knotBox', 'knotSpin', 'cloth', 'clothB', 'view']);
  return f => {
    const b = f.knot.box, s = f.knot.spin;
    g.uniform1f(u.pose, f.pose);
    g.uniform4f(u.knotBox, b.x, b.y, b.w, b.h);
    g.uniform4f(u.knotSpin, s[0], s[1], s[2], s[3]);
    g.uniform4fv(u.cloth, f.cloth);
    g.uniform4fv(u.clothB, f.clothB);
    g.uniform3f(u.view, f.aspect, f.scale, f.height);
  };
}
