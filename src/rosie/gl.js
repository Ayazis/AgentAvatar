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

// the texture units the jacket shaders sample from
export const UNITS = { atlas: 0, depthA: 1, bounds: 2 };
export function bindJacketSamplers(g, program) {
  g.useProgram(program);
  for (const [name, unit] of Object.entries(UNITS)) g.uniform1i(g.getUniformLocation(program, name), unit);
}
