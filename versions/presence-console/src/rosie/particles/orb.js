// The orb: a breathing sphere of points, brighter at the rim, turning slowly.
import { MAX } from '../config.js';

export class Orb {
  constructor() {
    const R = Math.random, n = MAX.orb, ga = Math.PI*(3 - Math.sqrt(5));
    this.points = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - 2*(i + .5)/n, r = Math.sqrt(1 - y*y), th = ga*i;
      const inner = R() < .28 ? .35 + .55*R() : 1;
      this.points.push({ x: Math.cos(th)*r*inner, y: y*inner, z: Math.sin(th)*r*inner,
        s: (1 + R()*1.6)*(inner < 1 ? .8 : 1), a: .45 + .55*R(), c: R() < .45 ? 2 : R() < .6 ? 0 : 1, k: R()*6.28, d: R() });
    }
    this.yaw = 0;
  }
  static capacity() { return MAX.orb; }

  update(dt, f, put) {
    const { t, alive, intensity, breath, pulse, T } = f;
    this.yaw += dt*.22*(.15 + .85*alive)*T.orbSpin;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), tp = .32, cp = Math.cos(tp), sp = Math.sin(tp);
    const orbR = .095*T.orbSize*(1 + .03*breath + .12*intensity + .25*pulse);
    const frac = T.orbOn > .002 ? T.orbCount/MAX.orb : 0;
    for (const p of this.points) {
      if (p.d >= frac) continue;
      const x1 = p.x*cy + p.z*sy, z1 = -p.x*sy + p.z*cy;
      const y2 = p.y*cp - z1*sp, z2 = p.y*sp + z1*cp;
      const rip = 1 + intensity*.08*Math.sin(p.y*12 - t*12);
      const tw = .75 + .25*Math.sin(t*2.2 + p.k);
      const rim = 1 - Math.abs(z2);
      put(x1*orbR*rip, y2*orbR*rip, z2*orbR, p.s*2.1*T.pSize,
        T.orbOn*T.orbBright*p.a*tw*(.15 + .85*alive)*(z2 > 0 ? .5 : 1)*(.65 + .9*rim*rim), p.c);
    }
  }
}
