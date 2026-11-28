// The presets for each state, the build settings, and the live values that glide between presets.
// Presets and build settings are saved in this browser.
import { DEFAULTS, TUNE_DEFAULTS, STORE } from './config.js';

export class Settings {
  constructor() {
    const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })();
    this.presets = {};
    for (const st in DEFAULTS) this.presets[st] = { ...DEFAULTS[st], ...(saved.presets?.[st] || {}) };
    this.tune = { ...TUNE_DEFAULTS, flareOn: { ...TUNE_DEFAULTS.flareOn }, ...(saved.tune || {}) };
    this.editing = 'idle';                     // the state on screen, which the panel edits
    this.live = { ...this.presets.idle };      // the values drawn this frame
  }

  /** The preset the live values glide towards. */
  get target() { return this.presets[this.editing]; }

  save() { try { localStorage.setItem(STORE, JSON.stringify(this.toJSON())); } catch {} }
  toJSON() { return { presets: this.presets, tune: this.tune }; }

  /** Change a value of the state on screen right away, with no glide. */
  set(key, value) { this.presets[this.editing][key] = value; this.live[key] = value; }

  resetState() { this.presets[this.editing] = { ...DEFAULTS[this.editing] }; this.#snap(); }
  resetAll() { for (const st in DEFAULTS) this.presets[st] = { ...DEFAULTS[st] }; this.#snap(); }
  #snap() { Object.assign(this.live, this.target); this.save(); }
}
