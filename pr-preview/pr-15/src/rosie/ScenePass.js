// The full-screen shader passes: the back pass (jacket, orb light, far half of the ring)
// and the front pass (near half of the ring, laid over the particles).
import { createProgram, uniforms, jacketUniforms, UNITS } from './gl.js';
import { QUAD_VERT } from './shaders/quad.vert.js';
import { sceneFrag } from './shaders/scene.frag.js';

const NAMES = ['scene', 'motion', 'tap', 'res', 'detail', 'silkT', 'tuneA', 'tuneB', 'tuneC', 'lightAmt', 'shadeAmt'];
const D2R = Math.PI/180;

export class ScenePass {
  constructor(g, spans, frontPass, detail) {
    this.g = g;
    this.program = createProgram(g, QUAD_VERT, sceneFrag(spans, frontPass));
    this.setJacket = jacketUniforms(g, this.program);
    this.u = uniforms(g, this.program, NAMES);
    this.loc = g.getAttribLocation(this.program, 'p');
    g.uniform1f(this.u.detail, detail);
    g.uniform1i(g.getUniformLocation(this.program, 'lightTex'), UNITS.light);
  }

  // f: frame values; quad: the shared full-screen triangle buffer
  draw(f, quad) {
    const g = this.g, u = this.u, T = f.T;
    g.useProgram(this.program);
    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.enableVertexAttribArray(this.loc); g.vertexAttribPointer(this.loc, 2, g.FLOAT, false, 0, 0);
    g.uniform2f(u.scene, f.t, f.alive);
    g.uniform4f(u.motion, f.x, f.y, f.intensity, f.age);
    g.uniform4f(u.tap, f.tapX, f.tapY, f.breath, f.travel);
    g.uniform2f(u.res, f.width, f.height);
    g.uniform1f(u.silkT, f.silkT);
    g.uniform4f(u.tuneA, T.silkBright, T.silkWidth, T.silkSway, T.jacketMotion);
    g.uniform4f(u.tuneB, T.orbOn*T.orbGlow, T.sparks, T.orbSize, T.silkOn);
    g.uniform4f(u.tuneC, T.ringSize, T.ringTilt*D2R, T.ringRoll*D2R, T.ringDepth);
    this.setJacket(f);
    g.uniform1f(u.lightAmt, T.denimLight);
    g.uniform1f(u.shadeAmt, T.denimShade);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  destroy() { this.g.deleteProgram(this.program); }
}
