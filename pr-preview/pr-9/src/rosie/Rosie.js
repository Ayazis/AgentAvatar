// Rosie: the avatar. Owns the WebGL context, the clocks and the frame loop.
// Public API: Rosie.create(canvas, options), setState('off'|'idle'|'working'|'knot'|'scarf'), setIntensity(0…1), pause(), resume(), destroy().
import { loadAssets } from './assets.js';
import { createTexture, UNITS } from './gl.js';
import { LightBuffer } from './LightBuffer.js';
import { ScenePass } from './ScenePass.js';
import { ParticleLayer } from './particles/ParticleLayer.js';
import { StateGlide } from './StateGlide.js';
import { Breath } from './Breath.js';
import { Input } from './Input.js';
import { Knot } from './Knot.js';

const isKnotState = s => s === 'knot' || s === 'scarf';

export class Rosie {
  static async create(canvas, options = {}) {
    const [assets, knot] = await Promise.all([loadAssets(), Knot.load()]);
    return new Rosie(canvas, { ...assets, knot }, options);
  }

  constructor(canvas, assets, options = {}) {
    this.canvas = canvas;
    const g = canvas.getContext('webgl', { alpha: false, depth: false, antialias: false });
    if (!g) throw Error('Rosie needs WebGL.');
    this.gl = g;
    this.maxDpr = Math.min(2, Math.max(.5, options.maxDpr ?? 2));
    const detail = Math.max(0, Math.min(2, options.density ?? 1));

    this.glide = new StateGlide();
    this.breath = new Breath();
    this.input = new Input(canvas);
    this.state = 'idle'; this.wanted = 'idle'; this.alive = 1; this.intensityTarget = 0; this.intensity = 0;
    this.t = 0; this.travel = 0; this.silkT = 0; this.jacketT = 0;
    this.last = -1; this.id = 0; this.paused = false; this.dead = false;

    this.quad = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, this.quad);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    this.textures = [
      createTexture(g, UNITS.atlas, assets.atlas),
      createTexture(g, UNITS.depthA, assets.depth),
      createTexture(g, UNITS.bounds, { data: assets.bounds, width: 640, height: 6 }),
      createTexture(g, UNITS.knotArt, assets.knot.variants.knot.art),
      createTexture(g, UNITS.knotDep, assets.knot.variants.knot.depth),
    ];
    // the scarf's textures wait unbound; showVariant() puts the right pair on the knot units
    this.variantTex = { knot: this.textures.slice(3, 5), scarf: [
      createTexture(g, UNITS.knotArt, assets.knot.variants.scarf.art),
      createTexture(g, UNITS.knotDep, assets.knot.variants.scarf.depth)] };
    this.textures.push(...this.variantTex.scarf);
    this.showVariant('knot');
    this.light = new LightBuffer(g, UNITS.light);
    this.back = new ScenePass(g, assets.spans, false, detail);
    this.particles = new ParticleLayer(g, assets.spans);
    this.front = new ScenePass(g, assets.spans, true, detail);
    this.knot = assets.knot;

    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas); this.resize();
    document.addEventListener('visibilitychange', this.schedule);
    this.schedule();
  }

  // the live slider values, presets and transition time (edited by the Tune panel)
  get tune() { return this.glide.tune; }
  get presets() { return this.glide.presets; }
  get transition() { return this.glide.transition; }
  set transition(v) { this.glide.transition = v; }
  get gliding() { return this.glide.gliding; }
  get pose() { return this.glide.pose; }

  showVariant(v) {
    const g = this.gl, [art, dep] = this.variantTex[v];
    g.activeTexture(g.TEXTURE0 + UNITS.knotArt); g.bindTexture(g.TEXTURE_2D, art);
    g.activeTexture(g.TEXTURE0 + UNITS.knotDep); g.bindTexture(g.TEXTURE_2D, dep);
  }

  // 'knot' and 'scarf' glide to the idle pose, then turn into the knotted look; leaving (or switching look) turns back first
  // 'knot' glides to the idle pose, then turns into the knotted jacket; leaving it turns back first
  setState(s) {
    this.wanted = s;
    if (isKnotState(s)) this.state = s;
    else this.knot.knotted = false;
  }
  // how intense Rosie is (0 calm … 1 most lively): she speeds up, swells and brightens; the value is eased in
  setIntensity(v) { this.intensityTarget = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }
  setLevel(v) { this.setIntensity(v); }   // the old name, kept for host apps that still call it
  pause() { this.paused = true; this.schedule(); }
  resume() { this.paused = false; this.schedule(); }

  resize = () => {
    const c = this.canvas, d = this.dpr();
    c.width = Math.max(1, Math.round(c.clientWidth*d)); c.height = Math.max(1, Math.round(c.clientHeight*d));
    this.gl.viewport(0, 0, c.width, c.height);
    this.light?.resize(c.width, c.height);
  };
  dpr() { return Math.min(devicePixelRatio || 1, this.maxDpr); }

  schedule = () => {
    cancelAnimationFrame(this.id); this.last = -1;
    if (!this.dead && !this.paused && !document.hidden) this.id = requestAnimationFrame(this.frame);
  };

  frame = (now) => {
    const dt = this.last < 0 ? 0 : Math.min(.1, (now - this.last)/1000); this.last = now;
    this.step(dt, now);
    this.render(dt);
    this.id = requestAnimationFrame(this.frame);
  };

  // advance every clock by dt seconds
  step(dt, now) {
    this.alive += ((this.state === 'off' ? 0 : 1) - this.alive)*(1 - Math.exp(-3*dt));
    const k = this.knot, want = this.wanted;
    if (isKnotState(want) && k.variant !== want && k.knotted) k.knotted = false;      // other look: turn back first
    if (isKnotState(want) && k.variant !== want && k.setVariant(want)) this.showVariant(want);
    if (isKnotState(want) && k.variant === want && !k.knotted && Math.abs(this.pose - 1) < .02) k.knotted = true;
    if (!isKnotState(want) && !k.active) this.state = want;
    this.knot.update(dt, this.tune.knotSpeed);
    this.glide.update(dt, this.state);
    const T = this.tune, pace = dt*(.04 + .96*this.alive);
    this.intensity += (this.intensityTarget - this.intensity)*(1 - Math.exp(-12*dt));
    this.input.update(dt, now, { amount: T.tilt, ease: 1 - Math.exp(-6*dt) });
    this.t += pace;
    this.breath.update(dt, this.alive, T.breathRate);
    this.travel += dt*(1.3*T.sparkSpeed + 1.6*this.intensity)*this.alive;
    this.jacketT += pace*T.jacketSpeed;
    this.silkT += pace*T.silkSpeed;   // the silk never hurries
  }

  render(dt) {
    const c = this.canvas, inp = this.input, aspect = c.width/c.height;
    const scale = Math.min(.95, aspect*1.42)*(.9 + .1*this.alive)*(1 + .006*this.breath.value*this.alive);
    const T = this.tune, a = this.alive, live = this.intensity*a, breath = this.breath.value;
    const f = {
      T, t: this.t, alive: a, intensity: this.intensity, breath, pulse: inp.pulse,
      aspect, scale, width: c.width, height: c.height, x: inp.x, y: inp.y, age: inp.age, tapX: inp.tapX, tapY: inp.tapY,
      travel: this.travel, silkT: this.silkT, pose: this.pose, tilt: [inp.x, -inp.y],
      // the jacket's cloth motion, shared by every pass that draws or masks with it (clothed() in jacket.glsl.js)
      cloth: [this.jacketT, a*(1 + .6*live)*T.jacketMotion, breath, live],
      clothB: [inp.x, -inp.y, this.t, a*T.jacketMotion],
      dpr: this.dpr()*(c.height/(740*this.dpr()))**.5, knot: this.knot.uniforms(T.knotBlur),
    };
    this.particles.update(dt, f);
    if (T.denimLight > .001) {                       // the particles' light first, so the jacket can be lit by it
      this.light.begin();
      this.particles.draw(f, [1, 10*T.lightSpread/this.light.div]);
      this.light.end(c.width, c.height);
    } else this.light.clear(c.width, c.height);
    this.back.draw(f, this.quad);
    this.particles.draw(f);
    if (T.silkOn > .001) {
      const g = this.gl;
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      this.front.draw(f, this.quad);
      g.disable(g.BLEND);
    }
  }

  destroy() {
    this.dead = true; this.schedule(); this.observer.disconnect(); this.input.destroy();
    document.removeEventListener('visibilitychange', this.schedule);
    const g = this.gl;
    g.deleteBuffer(this.quad); this.textures.forEach(t => g.deleteTexture(t));
    this.back.destroy(); this.front.destroy(); this.particles.destroy(); this.light.destroy();
  }
}
