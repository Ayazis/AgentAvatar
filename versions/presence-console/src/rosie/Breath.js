// Breathing: a slower in, a longer softer out. value runs −1 … 1.
export class Breath {
  constructor() { this.phase = 0; this.value = 0; }
  update(dt, alive, rate) {
    this.phase = (this.phase + dt*(.04 + .96*alive)*rate/5.2) % 1;
    const p = this.phase, sm = v => v*v*(3 - 2*v);
    this.value = (p < .42 ? sm(p/.42) : 1 - sm((p - .42)/.58))*2 - 1;
  }
}
