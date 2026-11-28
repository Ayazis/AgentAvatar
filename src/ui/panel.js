// The Tune panel: the state buttons, the control groups (built from controls.js), and reset / copy.
// Sliders edit the preset of the state on screen; build settings are shared by every state.
import { STATES, REBUILDS_SHELL, tempoOf } from '../rosie/config.js';
import { controls, num } from './controls.js';

const title = s => s[0].toUpperCase() + s.slice(1);

function itemHTML(it) {
  if (it.slider) return `<label>${it.label} <output id="o-${it.slider}"></output><input id="${it.slider}" type="range" min="${it.min}" max="${it.max}" step="${it.step}"></label>`;
  if (it.select) return `<label>${it.label} <select id="${it.select}">${it.options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
  if (it.lockRays) return `<label class="check"><input id="lockRays" type="checkbox" checked> ${it.lockRays}</label>`;
  if (it.sub) return `<div class="sub">${it.sub}${it.hint ? ` <span>${it.hint}</span>` : ''}</div>`;
  if (it.note) return `<div class="note">${it.note}</div>`;
  if (it.flares) return `<div class="ticks">${Object.entries(it.flares).map(([k, t]) => `<label class="check"><input type="checkbox" data-flare="${k}"> ${t}</label>`).join('')}</div>`;
  if (it.button) return `<div class="actions inline"><button id="${it.button}" type="button">${it.label}</button></div>`;
  throw new Error(`Unknown control: ${JSON.stringify(it)}`);
}

export class Panel {
  #sliders = {};     // id → { el, show }
  #rayRatio = 1;

  /**
   * @param root      the .panel element: it holds .states buttons, #editing, #controls and the reset / copy buttons
   * @param settings  a Settings
   * @param orb       the Orb, rebuilt when a build setting changes and boosted by Boost now
   */
  constructor(root, settings, orb) {
    this.root = root; this.settings = settings; this.orb = orb;
    const groups = controls(tempoOf);
    root.querySelector('#controls').innerHTML = groups.map(g =>
      `<details class="group"><summary>${g.group}</summary>${g.items.map(itemHTML).join('')}</details>`).join('');
    const $ = id => root.querySelector('#' + id);

    for (const it of groups.flatMap(g => g.items)) {
      const id = it.slider || it.select;
      if (id) this.#bindValue(id, $(id), $('o-' + id), it.fmt || num);
    }

    // The core's light is what makes the rays, so by default the two sliders move together, keeping the ratio they
    // had when the lock was switched on (or when the state was picked). Unlocked, each works alone.
    this.lockRays = $('lockRays');
    this.lockRays.addEventListener('change', () => this.#keepRayRatio());

    // the boost targets: ticks, shared by all states
    for (const box of root.querySelectorAll('[data-flare]')) {
      box.checked = !!settings.tune.flareOn[box.dataset.flare];
      box.addEventListener('change', () => { settings.tune.flareOn[box.dataset.flare] = box.checked; settings.save(); });
    }
    $('boostNow').onclick = () => orb.boost();

    root.querySelectorAll('.states button').forEach(b => b.onclick = () => this.setState(b.dataset.state));
    addEventListener('keydown', e => { const s = STATES[['1', '2', '3'].indexOf(e.key)]; if (s) this.setState(s); });
    $('resetState').onclick = () => { settings.resetState(); this.#showPreset(); };
    $('resetAll').onclick = () => { settings.resetAll(); this.#showPreset(); };
    $('copySettings').onclick = async e => {
      const text = JSON.stringify(settings, null, 2);
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch { console.log(text); e.target.textContent = 'In console'; }
      setTimeout(() => e.target.textContent = 'Copy settings', 1500);
    };
    this.#showPreset();
  }

  /** Show and edit another state; the orb glides to its preset. */
  setState(s) {
    this.settings.editing = s;
    this.root.querySelectorAll('.states button').forEach(b => b.classList.toggle('on', b.dataset.state === s));
    this.root.querySelector('#editing').textContent = title(s);
    this.#showPreset();
  }

  #bindValue(id, el, out, fmt) {
    const { settings } = this;
    const show = () => { if (out) out.textContent = fmt(+el.value); };
    this.#sliders[id] = { el, show };
    let rebuild;
    el.addEventListener('input', () => {
      const v = +el.value; show();
      if (id in settings.tune) {                                   // build settings: the same for every state
        settings.tune[id] = v;
        if (REBUILDS_SHELL.includes(id)) { clearTimeout(rebuild); rebuild = setTimeout(() => this.orb.rebuildShell(), 120); }
      } else {                                                     // the state on screen: change it now, no glide
        settings.set(id, v);
        if (this.lockRays.checked && (id === 'core' || id === 'rays')) this.#linkRays(id);
      }
      settings.save();
    });
  }

  #set(id, v) { const s = this.#sliders[id]; s.el.value = v; s.show(); }

  #showPreset() {
    const { tune, target } = this.settings;
    for (const id in this.#sliders) this.#set(id, id in tune ? tune[id] : target[id]);
    this.#keepRayRatio();
  }

  #keepRayRatio() { const p = this.settings.target; this.#rayRatio = p.rays / Math.max(p.core, .01); }

  #linkRays(changed) {
    const p = this.settings.target, { live } = this.settings;
    const maxOf = id => +this.#sliders[id].el.max;
    if (changed === 'core') { p.rays = live.rays = Math.min(maxOf('rays'), p.core * this.#rayRatio); this.#set('rays', p.rays); }
    else { p.core = live.core = Math.min(maxOf('core'), p.rays / Math.max(this.#rayRatio, .01)); this.#set('core', p.core); }
  }
}
