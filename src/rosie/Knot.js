// Idle ⇄ knot: no in-between frames. The jacket does a fast 720° turn about its vertical axis and comes
// out of it knotted (and back again). The swap happens while the jacket is edge-on, so it is never seen.
// Drawn on a 2D canvas laid over the WebGL one, from the first and last of ChatGPT's frames (assets/knot/).
// `blur` (0…1) smears each frame over the turn it covers, so the spin reads as motion, not a strobe.
// While the turn or the knotted jacket is on screen the shader's own jacket is hidden (see `cover`).
const base = new URL('../../assets/knot/', import.meta.url);

const TURN = 4*Math.PI;            // 720°
const SWAP = 2.5*Math.PI;          // edge-on after 1¼ turns: switch idle ⇄ knot here
const DURATION = 1.1;              // seconds at speed 1
const SAMPLES = 12;                // motion-blur samples per frame at full blur

const image = src => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(Error('Could not load ' + src));
  img.src = src;
});

// slow start, fast middle, a soft landing
const ease = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3)/2;

export class Knot {
  static async load() {
    const meta = await fetch(new URL('knot.json', base)).then(r => { if (!r.ok) throw Error('Could not load knot.json'); return r.json(); });
    const ends = [meta.frames[0], meta.frames[meta.frames.length - 1]];
    const [idle, knot] = await Promise.all(ends.map(f => image(new URL(f.file, base).href)));
    return new Knot(meta, idle, knot);
  }

  constructor(meta, idle, knot) {
    this.box = meta.box;                       // where the frames sit, in picture coords (st)
    this.idle = idle; this.knotImg = knot;
    this.p = 0; this.target = 0;               // turn progress 0 (idle) … 1 (knotted)
    this.prev = 0;                             // progress at the last drawn frame, for the blur
    this.canvas = null;
  }

  // put the overlay canvas over the WebGL canvas
  attach(glCanvas) {
    const c = this.canvas = document.createElement('canvas');
    c.className = 'knot-layer'; c.setAttribute('aria-hidden', 'true');
    glCanvas.after(c);
    this.ctx = c.getContext('2d');
  }

  set knotted(on) { this.target = on ? 1 : 0; }
  get knotted() { return this.target === 1; }
  get cover() { return this.p > 0 || this.target > 0; }   // turning or knotted: hide the shader jacket
  get busy() { return this.p !== this.target; }

  update(dt, speed = 1) {
    const step = dt*speed/DURATION;
    this.p = this.target > this.p ? Math.min(this.target, this.p + step) : Math.max(this.target, this.p - step);
  }

  // scale: the jacket's picture height as a fraction of the canvas height (same formula as the shader)
  draw(width, height, scale, blur = 1) {
    const c = this.canvas, ctx = this.ctx;
    if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const from = this.prev; this.prev = this.p;
    if (!this.cover) return;
    const P = scale*height, b = this.box, cx = width/2;   // the turn's axis: the jacket's centre line
    const x = cx + (b.x - .5)/1.5*P, y = height/2 - (.5 - b.y)*P, w = b.w/1.5*P, h = b.h*P;
    // blur: average the frame over the stretch of the turn since the last frame
    const n = blur > 0 && from !== this.p ? Math.max(1, Math.round(SAMPLES*blur)) : 1;
    for (let i = 0; i < n; i++) {
      const q = n === 1 ? this.p : this.p + (from - this.p)*blur*(i/(n - 1));
      const a = ease(q)*TURN;
      ctx.globalAlpha = 1/(i + 1);             // running average of the samples
      ctx.setTransform(Math.cos(a), 0, 0, 1, cx*(1 - Math.cos(a)), 0);
      ctx.drawImage(a < SWAP ? this.idle : this.knotImg, x, y, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  }

  destroy() { this.canvas?.remove(); }
}
