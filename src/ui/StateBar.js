// The Off / Idle / Working / Knot / Scarf buttons, keys 1–5, and the status label.
import { STATES } from '../rosie/config.js';

const LABEL = { off: 'Standby', idle: 'Idle', working: 'Working', knot: 'Knotted', scarf: 'Scarf' };

export class StateBar {
  constructor(rosie, root = document) {
    this.rosie = rosie;
    this.buttons = root.querySelectorAll('[data-state]');
    this.status = root.querySelector('#status');
    this.buttons.forEach(b => b.addEventListener('click', () => this.select(b.dataset.state)));
    window.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input')) return;
      const s = STATES[Number(e.key) - 1];
      if (s) this.select(s);
    });
  }
  select(state) {
    this.rosie.setState(state);
    this.status.textContent = LABEL[state];
    document.body.dataset.state = state;
    this.buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === state)));
  }
}
