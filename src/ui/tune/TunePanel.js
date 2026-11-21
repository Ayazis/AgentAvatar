// The Tune panel: edits the preset of the current state; the sliders follow the live values as they glide.
import { TUNE_DEFAULTS, TRANSITION_DEFAULT, presetFor } from '../../rosie/config.js';
import { GROUPS } from './groups.js';
import { slider, groupSwitch } from './controls.js';
import { save, restore, exportTune } from './storage.js';

export class TunePanel {
  constructor(rosie, root = document) {
    this.rosie = rosie;
    this.syncs = [];
    this.editing = root.querySelector('#editing');
    restore(rosie);
    rosie.glide.snap(rosie.state);
    this.build(root.querySelector('#tune'));
    this.bindActions(root);
    this.lastName = '';
    requestAnimationFrame(this.loop);
  }

  get name() { return presetFor(this.rosie.state); }
  get preset() { return this.rosie.presets[this.name]; }
  save = () => save(this.rosie);

  build(container) {
    const rosie = this.rosie;
    for (const [title, onKey, items] of GROUPS) {
      const group = document.createElement('div'); group.className = 'group';
      const head = document.createElement('div'); head.className = 'ghead'; head.innerHTML = `<b>${title}</b>`;
      if (onKey) this.syncs.push(groupSwitch(head, group, title,
        () => this.preset[onKey] >= .5,
        on => { this.preset[onKey] = on ? 1 : 0; this.save(); }));   // fades over the transition time
      group.append(head);
      for (const [key, label, min, max, step] of items) {
        const { input, sync } = slider(group, key, label, min, max, step, () => rosie.tune[key],
          v => { this.preset[key] = v; rosie.tune[key] = v; }, this.save);   // dragging takes effect at once
        input.addEventListener('dblclick', () => { this.preset[key] = TUNE_DEFAULTS[this.name][key]; this.save(); });
        this.syncs.push(sync);
      }
      if (title === 'Scene') this.syncs.push(slider(group, 'transition', 'Transition (s)', 0, 8, .1,
        () => rosie.transition, v => { rosie.transition = v; }, this.save).sync);
      container.append(group);
    }
  }

  bindActions(root) {
    root.querySelector('#tuneReset').addEventListener('click', () => {
      Object.assign(this.preset, TUNE_DEFAULTS[this.name]); this.save(); });
    root.querySelector('#tuneResetAll').addEventListener('click', () => {
      const p = this.rosie.presets;
      Object.assign(p.idle, TUNE_DEFAULTS.idle); Object.assign(p.working, TUNE_DEFAULTS.working);
      this.rosie.transition = TRANSITION_DEFAULT; this.save(); });
    const copy = root.querySelector('#tuneCopy');
    copy.addEventListener('click', async () => {
      const text = JSON.stringify(exportTune(this.rosie), null, 2);
      try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; }
      catch { console.log(text); copy.textContent = 'Copy blocked – see console'; }
      setTimeout(() => copy.textContent = 'Copy settings', 1800);
    });
  }

  // keep the sliders showing the live values, so you can watch them glide during a state change
  loop = () => {
    const name = this.name;
    if (name !== this.lastName) {
      this.lastName = name; this.editing.textContent = name === 'working' ? 'Working' : 'Idle';
      this.syncs.forEach(f => f());
    } else if (this.rosie.gliding || !this.settled) {
      this.syncs.forEach(f => f()); this.settled = !this.rosie.gliding;
    }
    requestAnimationFrame(this.loop);
  };
}
