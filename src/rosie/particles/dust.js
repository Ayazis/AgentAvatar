// Swirl dust: loose particles on tilted orbits, some breathing in and out of the orb, each with a short trail.
import { MAX } from '../config.js';

const TRAIL = 2;

export class Dust {
  constructor() {
    const R = Math.random;
    this.points = [];
    for (let i = 0; i < MAX.dust; i++) {
      this.points.push({
        r: .12 + Math.pow(R(), .9)*.3, incl: (R() - .5)*1.1 + (R() < .5 ? .35 : -.35), node: R()*6.28, ph: R()*6.28,
        sp: (.35 + R()*.5)*(R() < .15 ? -1 : 1), lift: (R() - .5)*.08, breathe: R() < .3, bph: R()*6.28,
        s: 1 + R()*2, a: .35 + .45*R(), c: [0, 0, 1, 2, 3, 4, 5][(R()*7) | 0], k: R()*6.28, d: R(),
      });
    }
    this.clock = 0;
  }
  static capacity() { return MAX.dust*TRAIL; }

  update(dt, f, put) {
    const { t, alive, audio, pulse, T } = f;
    this.clock += dt*(T.dustSpeed + .8*audio)*(.1 + .9*alive);
    const frac = T.dustOn > .002 ? T.dustAmount/MAX.dust : 0;
    for (const p of this.points) {
      if (p.d >= frac) continue;
      let r = p.r;
      if (p.breathe) r *= .25 + .75*(.5 + .5*Math.cos(t*.45 + p.bph));   // flowing into the orb and back out
      r *= 1 + .5*pulse;
      const a0 = p.ph + this.clock*p.sp*(.09/r);
      const ci = Math.cos(p.incl), si = Math.sin(p.incl), cn = Math.cos(p.node + t*.05), sn = Math.sin(p.node + t*.05);
      const tw = .7 + .3*Math.sin(t*3 + p.k);
      const bright = T.dustOn*T.dustBright*p.a*tw*Math.min(1, r/.06)*alive*(1 + .5*audio);
      for (let k = 0; k < TRAIL; k++) {
        const a = a0 - k*Math.sign(p.sp)*.035*(.5 + .5*T.dustSpeed)*(.09/r)*6;
        const lx = Math.cos(a)*r, lz = Math.sin(a)*r;
        const y1 = -lz*si, z1 = lz*ci;                                   // tilt the orbit plane …
        const x = lx*cn + z1*sn, z = -lx*sn + z1*cn;                     // … and turn it about the vertical
        put(x, y1 + p.lift + .015*Math.sin(t*.7 + p.k), z, p.s*1.7*T.pSize*(1 - k*.22), bright*(k ? .38/k : 1), p.c);
      }
    }
  }
}
