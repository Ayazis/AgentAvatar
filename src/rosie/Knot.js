// The idle ⇄ knot flipbook: ChatGPT's hand-drawn frames (assets/knot/, built by tools/build_knot.py),
// played on a 2D canvas laid over the WebGL one. Hard cuts by default; `blend` (0…1) cross-fades
// into the next frame over that last share of each hold.
// While a frame is on screen the shader's own jacket is hidden (see `cover`).
const base = new URL('../../assets/knot/', import.meta.url);

const image = src => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(Error('Could not load ' + src));
  img.src = src;
});

export class Knot {
  static async load() {
    const meta = await fetch(new URL('knot.json', base)).then(r => { if (!r.ok) throw Error('Could not load knot.json'); return r.json(); });
    const images = await Promise.all(meta.frames.map(f => image(new URL(f.file, base).href)));
    return new Knot(meta, images);
  }

  constructor(meta, images) {
    this.box = meta.box;                       // where the frames sit, in picture coords (st)
    this.holds = meta.frames.map(f => f.ms/1000);
    this.images = images;
    this.last = images.length - 1;
    this.frame = -1;                           // -1: not shown, the shader jacket is visible
    this.target = -1; this.wait = 0;
    this.canvas = null;
  }

  // put the overlay canvas over the WebGL canvas
  attach(glCanvas) {
    const c = this.canvas = document.createElement('canvas');
    c.className = 'knot-layer'; c.setAttribute('aria-hidden', 'true');
    glCanvas.after(c);
    this.ctx = c.getContext('2d');
  }

  // knotted: play towards the last frame; otherwise play back to idle and hide
  set knotted(on) { this.target = on ? this.last : -1; if (on && this.frame < 0) { this.frame = 0; this.wait = this.holds[0]; } }
  get knotted() { return this.target === this.last; }
  get cover() { return this.frame >= 0; }     // a frame is showing: hide the shader jacket
  get busy() { return this.frame !== this.target && !(this.target < 0 && this.frame < 0); }

  update(dt, speed = 1) {
    if (this.frame === this.target) return;
    this.wait -= dt*speed;
    while (this.wait <= 0 && this.frame !== this.target) {
      this.frame += this.target > this.frame ? 1 : -1;
      this.wait += this.frame >= 0 ? this.holds[this.frame] : 0;
    }
  }

  // scale: the jacket's picture height as a fraction of the canvas height (same formula as the shader)
  draw(width, height, scale, blend = 0) {
    const c = this.canvas, ctx = this.ctx;
    if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
    ctx.clearRect(0, 0, width, height);
    if (this.frame < 0) return;
    const P = scale*height, b = this.box;
    const x = width/2 + (b.x - .5)/1.5*P, y = height/2 - (.5 - b.y)*P;
    const w = b.w/1.5*P, h = b.h*P;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.images[this.frame], x, y, w, h);
    const next = this.frame + (this.target > this.frame ? 1 : -1);
    if (blend > 0 && this.frame !== this.target && next >= 0) {
      const p = 1 - Math.max(0, this.wait)/this.holds[this.frame];   // how far through this hold
      const a = Math.min(1, Math.max(0, (p - (1 - blend))/blend));
      if (a > 0) { ctx.globalAlpha = a; ctx.drawImage(this.images[next], x, y, w, h); ctx.globalAlpha = 1; }
    }
  }

  destroy() { this.canvas?.remove(); }
}
