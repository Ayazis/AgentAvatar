// Pointer, device tilt and taps on the canvas. x/y follow the pointer (or the phone's tilt) smoothly.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0; this.y = 0; this.aimX = 0; this.aimY = 0; this.gyroX = 0; this.gyroY = 0;
    this.lastPointer = -1e9;
    this.age = 5; this.tapX = 0; this.tapY = 0;   // seconds since the last tap, and where (screen space)
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.leave);
    canvas.addEventListener('pointerdown', this.tap);
    window.addEventListener('deviceorientation', this.orient);
  }
  move = (e) => {
    const r = this.canvas.getBoundingClientRect();
    this.aimX = 2*(e.clientX - r.left)/r.width - 1; this.aimY = 1 - 2*(e.clientY - r.top)/r.height;
    this.lastPointer = performance.now();
  };
  leave = () => { this.aimX = this.aimY = 0; };
  tap = (e) => {
    this.move(e);
    const r = this.canvas.getBoundingClientRect();
    this.tapX = ((e.clientX - r.left)/r.width - .5)*(r.width/r.height); this.tapY = .5 - (e.clientY - r.top)/r.height;
    this.age = 0;
  };
  orient = (e) => {
    if (e.gamma == null) return;
    this.gyroX = Math.max(-1, Math.min(1, e.gamma/28));
    this.gyroY = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45)/28));
  };
  update(dt, now, follow) {
    const usePointer = now - this.lastPointer < 2500;
    const ax = (usePointer ? this.aimX : this.gyroX)*follow.amount, ay = (usePointer ? this.aimY : -this.gyroY)*follow.amount;
    this.x += (ax - this.x)*follow.ease; this.y += (ay - this.y)*follow.ease;
    this.age = Math.min(5, this.age + dt);
  }
  // 0 → 1 → 0 shortly after a tap
  get pulse() { return Math.min(1, this.age/.18)*(1 - Math.min(1, Math.max(0, (this.age - .35)/1.15))); }
  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointermove', this.move); c.removeEventListener('pointerleave', this.leave);
    c.removeEventListener('pointerdown', this.tap); window.removeEventListener('deviceorientation', this.orient);
  }
}
