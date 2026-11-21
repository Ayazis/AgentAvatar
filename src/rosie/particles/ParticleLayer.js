// Collects the orb, ribbons and dust into one point buffer and draws it as additive light.
import { ORB } from '../config.js';
import { createProgram, bindJacketSamplers } from '../gl.js';
import { PARTICLE_VERT, particleFrag } from '../shaders/particles.glsl.js';
import { Orb } from './orb.js';
import { Dust } from './dust.js';
import { Ribbons } from './ribbons.js';

const STRIDE = 6;   // x, y, depth, size, brightness, colour

export class ParticleLayer {
  constructor(g, spans) {
    this.g = g;
    this.program = createProgram(g, PARTICLE_VERT, particleFrag(spans));
    bindJacketSamplers(g, this.program);
    this.loc = { pos: g.getAttribLocation(this.program, 'aPos'), meta: g.getAttribLocation(this.program, 'aMeta'),
      view: g.getUniformLocation(this.program, 'view'), pose: g.getUniformLocation(this.program, 'pose'), light: g.getUniformLocation(this.program, 'light') };
    this.buffer = g.createBuffer();
    this.sources = [new Orb(), new Dust(), new Ribbons()];
    this.data = new Float32Array((Orb.capacity() + Dust.capacity() + Ribbons.capacity())*STRIDE);
  }

  // f: frame values (t, alive, audio, breath, pulse, tilt, T, dpr)
  update(dt, f) {
    const D = this.data, [tx, ty] = f.tilt; let o = 0;
    // place a point given relative to the orb: depth → perspective and parallax like the lapels
    const put = (x, y, z, size, a, c) => {
      const dz = .18 + z;
      const persp = 1.6/(1.6 + dz);
      const d = Math.max(0, Math.min(1, .55 - dz*1.6));
      D[o++] = ORB.x + x*persp/.6667 - tx*.013*(d - .3);
      D[o++] = ORB.y + y*persp - ty*.013*(d - .3);
      D[o++] = dz;
      D[o++] = size*persp*f.dpr; D[o++] = a; D[o++] = c;
    };
    for (const s of this.sources) s.update(dt, f, put);
    this.count = o/STRIDE;
  }

  // light: [0, 1] draws the particles themselves; [1, size factor] draws their light into the light buffer
  draw(aspect, scale, pose, light = [0, 1]) {
    const g = this.g, L = this.loc;
    g.useProgram(this.program);
    g.bindBuffer(g.ARRAY_BUFFER, this.buffer);
    g.bufferData(g.ARRAY_BUFFER, this.data, g.DYNAMIC_DRAW);
    g.enableVertexAttribArray(L.pos); g.vertexAttribPointer(L.pos, 3, g.FLOAT, false, STRIDE*4, 0);
    g.enableVertexAttribArray(L.meta); g.vertexAttribPointer(L.meta, 3, g.FLOAT, false, STRIDE*4, 12);
    g.uniform2f(L.view, aspect, scale);
    g.uniform1f(L.pose, pose);
    g.uniform2f(L.light, light[0], light[1]);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
    g.drawArrays(g.POINTS, 0, this.count);
    g.disable(g.BLEND);
    g.disableVertexAttribArray(L.meta); g.disableVertexAttribArray(L.pos);
  }

  destroy() { this.g.deleteProgram(this.program); this.g.deleteBuffer(this.buffer); }
}
