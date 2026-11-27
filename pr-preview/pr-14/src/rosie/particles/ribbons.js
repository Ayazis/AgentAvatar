// Ribbons from the first Muse: comets of particles on fluid, tilted orbits, wrapping in front of and behind the jacket.
import { MAX } from '../config.js';

const TRAIL = 3, TAU = 6.2832;

export class Ribbons {
  constructor() {
    const R = Math.random;
    this.bands = [
      { tx: 1.15, tz: .35, speed: .5, phase: 0, head: 0, col: [0, 1] },
      { tx: 1.9, tz: -.6, speed: -.38, phase: 2.1, head: 2, col: [4, 5] },
      { tx: .55, tz: 1.3, speed: .32, phase: 4.2, head: 4, col: [6, 2] },
    ];
    this.points = [];
    for (let j = 0; j < MAX.rib*3; j++) {
      const i = j % 3, rb = this.bands[i];
      this.points.push({ i, s0: R()*TAU, v: (R() < .5 ? -1 : 1)*Math.pow(R(), .55),
        c: R() < .6 ? rb.col[0] : rb.col[1], s: 1.3 + R()*1.8, a: .6 + .4*R(), k: R()*6.28, d: R() });
    }
    this.yaw = 0;
  }
  static capacity() { return MAX.rib*3*TRAIL; }

  update(dt, f, put) {
    const { t, alive, intensity, breath, pulse, T } = f;
    this.yaw += dt*.22*(.15 + .85*alive)*T.ribSpeed;
    const S = .19*T.ribOrbit;                                   // ribbon units → picture height
    const pace = .12 + .88*alive, gy = this.yaw*.45, cgy = Math.cos(gy), sgy = Math.sin(gy);
    const ribA = alive**1.5*(.85 + .5*intensity)*T.ribBright*T.ribOn;
    for (const rb of this.bands) {
      rb.head += dt*rb.speed*(1 + .3*Math.sin(t*.37 + rb.phase))*(T.ribSpeed + .6*intensity)*pace;
      const ax = rb.tx + .16*Math.sin(t*.13 + rb.phase), az = rb.tz + .22*Math.sin(t*.11 + rb.phase*1.3);
      rb.cx = Math.cos(ax); rb.sx = Math.sin(ax); rb.cz = Math.cos(az); rb.sz = Math.sin(az);
    }
    const frac = T.ribOn > .002 ? T.ribAmount/MAX.rib : 0;
    for (const p of this.points) {
      const vis = Math.min(1, Math.max(0, T.ribCount - p.i));   // a ribbon fades in/out as the count glides
      if (p.d >= frac || vis <= 0) continue;
      const rb = this.bands[p.i];
      const sPos = p.s0 + rb.head*.85;                           // particles slip back through the comet
      let rel = (((rb.head - sPos) % TAU) + TAU) % TAU/TAU;
      if (rb.speed < 0) rel = 1 - rel;
      const arc = Math.pow(1 - rel, 1.1)*Math.min(1, rel/.03)*1.5;
      if (arc*ribA < .01) continue;
      const tw = .88 + .12*Math.sin(t*1.3 + p.k*20);
      for (let k = 0; k < TRAIL; k++) {
        const s = sPos - k*Math.sign(rb.speed)*.022*(.4 + .6*T.ribSpeed);   // short streak behind each point
        const r = 1.55 + .14*Math.sin(3*s + t*.5 + rb.phase) + .07*Math.sin(5*s - t*.35) + .12*intensity + .04*breath + .1*pulse;
        const cs = Math.cos(s), ss = Math.sin(s);
        let x = r*cs, y = r*ss;
        let z = .26*Math.sin(2*s + t*.4 + rb.phase) + .07*Math.sin(5*s - t*1.4 + rb.phase);
        const width = 1.8*T.ribWidth*(.11 + .07*Math.sin(s*2 + t*.7))*(.9 + .15*breath)*(1 + .8*intensity);
        const twa = s*1.2 + t*.55 + rb.phase, ct = Math.cos(twa)*width*p.v;
        x += cs*ct; y += ss*ct; z += Math.sin(twa)*width*p.v;
        const y1 = y*rb.cx - z*rb.sx, z1 = y*rb.sx + z*rb.cx;
        const X = x*rb.cz - y1*rb.sz, Y = x*rb.sz + y1*rb.cz;
        const XX = X*cgy + z1*sgy, ZZ = -X*sgy + z1*cgy;          // the whole system turns slowly
        const depthFade = 1 - .55*Math.max(0, Math.min(1, (ZZ + 1.6)/3.2));
        put(XX*S, -Y*S, ZZ*S - .14, p.s*1.9*T.pSize*(1 - k*.18), 1.5*vis*arc*ribA*p.a*tw*depthFade*(k ? .5/k : 1), p.c);
      }
    }
  }
}
