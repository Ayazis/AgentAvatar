// What moves her besides the presets: breathing, the tap pulse and random boosts.
import { FLARE_TARGETS, aliveOf } from './config.js';

const smooth = v => v * v * (3 - 2 * v);

// Breathing, from the presence console (versions/presence-console/src/rosie/Breath.js): a slower in, a longer softer
// out, running -1 .. 1. It nearly stops when she's off. Everything takes part: the shell swells and its plates part
// a little on the in-breath, the core, dust, rays and bloom brighten, the ribbons widen, and through the light the
// scarf follows.
export class Breath {
  phase = 0;
  value = 0;
  update(dt, live) {
    this.phase = (this.phase + dt * (.04 + .96 * aliveOf(live.power)) * live.breathRate / 5.2) % 1;
    const p = this.phase;
    this.value = ((p < .42 ? smooth(p / .42) : 1 - smooth((p - .42) / .58)) * 2 - 1) * live.breathDepth;
    return this.value;
  }
}

// Tap: 0 -> 1 -> 0 over about 1.5 s, the same curve as the presence console. The orb swells, the plates part, the
// core, rays, bloom, dust and ribbons flare, and the dust is pushed outward.
const PULSE = { core: .7, rays: .7, hemRays: .6, bloom: .35, halo: .6, energy: .5, ribBright: .6, dustBright: .6 };

// Random boosts: now and then one of the ticked values rises for a moment and falls back, like a breath held or a
// thought sparking. Every: average seconds between boosts (0 = never); Length: how long one lasts; Strength: how
// far it rises (0.8 = up to 80 % more).
export class Boosts {
  tapAge = 5;
  pulse = 0;          // the tap pulse, 0 .. Tap pulse
  openBoost = 1;      // how much further the plates open than the preset says
  #flares = [];
  #nextFlare = 3;
  #saved = {};
  #applied = {};

  /** @param flareOn which values random boosts may raise ({ key: bool }, from the build settings) */
  constructor(flareOn) { this.flareOn = flareOn; }

  tap() { this.tapAge = 0; }

  /** Start a boost on one of the ticked values now. */
  flare(now, live) {
    const keys = FLARE_TARGETS.filter(k => this.flareOn[k]);
    if (!keys.length) return;
    const key = keys[(Math.random() * keys.length) | 0];
    this.#flares.push({ key, start: now, len: live.flareLen * (.7 + .6 * Math.random()), amp: live.flareAmount * (.6 + .4 * Math.random()) });
  }

  /** Raise the live values by the pulse and the running boosts, for this frame only: call restore() after drawing. */
  apply(dt, t, live) {
    this.tapAge = Math.min(5, this.tapAge + dt);
    this.pulse = Math.min(1, this.tapAge / .18) * (1 - Math.min(1, Math.max(0, (this.tapAge - .35) / 1.15))) * live.pulse;
    if (live.flareEvery > 0 && t >= this.#nextFlare) {
      this.flare(t, live);
      this.#nextFlare = t + Math.max(.6, live.flareEvery * -Math.log(1 - Math.random() * .98));
    }
    if (live.flareEvery <= 0) this.#nextFlare = t + 1;

    const B = {};
    for (const k in PULSE) B[k] = PULSE[k] * this.pulse;
    for (let i = this.#flares.length - 1; i >= 0; i--) {
      const f = this.#flares[i], x = (t - f.start) / f.len;
      if (x >= 1) { this.#flares.splice(i, 1); continue; }
      const env = x < .25 ? smooth(x / .25) : 1 - smooth((x - .25) / .75);   // quick rise, slower fall
      B[f.key] = (B[f.key] || 0) + f.amp * env;
    }
    this.openBoost = 1 + (B.open || 0) + .35 * this.pulse;   // opening is applied per plate, not to live.open
    delete B.open;
    for (const k in B) { this.#saved[k] = live[k]; live[k] *= 1 + B[k]; }
    this.#applied = B;
  }

  /** Put the live values back as they were before apply(). */
  restore(live) { for (const k in this.#applied) live[k] = this.#saved[k]; }
}
