// Idle ⇄ knot: no in-between frames. The jacket does a fast 720° turn about its vertical axis and comes
// out of it knotted (and back again). The swap happens while the jacket is edge-on, so it is never seen.
// The turn and the knotted jacket are drawn by the jacket shader (shaders/jacket.glsl.js), so the knotted
// jacket gets the same cloth motion, tilt, lighting and occlusion as the other poses. This class only keeps
// time and loads the knotted jacket's textures (built by tools/build_knot.py from ChatGPT's last frame).
// `blur` (0…1) smears each frame over the turn it covers, so the spin reads as motion, not a strobe.
const base = new URL('../../assets/knot/', import.meta.url);

const TURN = 4*Math.PI;            // 720°
const SWAP = 2.5*Math.PI;          // edge-on after 1¼ turns: switch idle ⇄ knot here
const DURATION = 1.1;              // seconds at speed 1
const SAMPLES = 12;                // motion-blur samples per frame at full blur (the shader's loop limit)

// the knotted looks: name → [colour, depth], built by tools/build_knot.py and tools/build_variant.py
const LOOKS = {
  knot: ['knot.webp', 'knot-depth.webp'],
  scarf: ['../scarf/scarf.webp', '../scarf/scarf-depth.webp'],
  hoodie: ['../hoodie/hoodie.webp', '../hoodie/hoodie-depth.webp'],
};

const image = src => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(Error('Could not load ' + src));
  img.src = new URL(src, base).href;
});

// slow start, fast middle, a soft landing
const ease = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3)/2;

export class Knot {
  static async load() {
    const looks = Object.entries(LOOKS);
    const [meta, ...pairs] = await Promise.all([
      fetch(new URL('knot.json', base)).then(r => { if (!r.ok) throw Error('Could not load knot.json'); return r.json(); }),
      ...looks.map(([, [a, d]]) => Promise.all([image(a), image(d)])),
    ]);
    // the looks share the same turn and box
    return new Knot(meta.box, Object.fromEntries(looks.map(([k], i) => [k, { art: pairs[i][0], depth: pairs[i][1] }])));
  }

  constructor(box, variants) {
    this.box = box;                            // where the knotted jacket sits, in picture coords (st)
    this.variants = variants; this.variant = 'knot';
    this.p = 0; this.target = 0;               // turn progress 0 (idle) … 1 (knotted)
    this.prev = 0;                             // progress at the last drawn frame, for the blur
  }

  set knotted(on) { this.target = on ? 1 : 0; }
  get knotted() { return this.target === 1; }
  get active() { return this.p > 0 || this.target > 0; }   // turning or knotted
  get busy() { return this.p !== this.target; }

  update(dt, speed = 1) {
    this.prev = this.p;
    const step = dt*speed/DURATION;
    this.p = this.target > this.p ? Math.min(this.target, this.p + step) : Math.max(this.target, this.p - step);
  }

    // which knotted look the turn ends in; only changed while idle (not knotted, not turning)
  setVariant(v) { if (!this.active && v in this.variants) { this.variant = v; return true; } return false; }

  // for the shader: knotBox, and knotSpin = (angle now, angle at the blur's far end, samples, swap angle)
  uniforms(blur = 1) {
    const now = ease(this.p)*TURN, from = ease(this.prev)*TURN;
    const n = blur > 0 && from !== now ? Math.max(1, Math.round(SAMPLES*blur)) : 1;
    return { box: this.box, spin: [now, now + (from - now)*blur, n, SWAP] };
  }
}
