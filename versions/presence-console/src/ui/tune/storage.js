// Saves the tuned presets (one per state) in this browser, and exports them for "Copy settings".
import { STATES } from '../../rosie/config.js';
const KEY = 'rosie-tune-v4';

export const exportTune = rosie => ({ transition: rosie.transition, ...rosie.presets });

export function save(rosie) {
  try { localStorage.setItem(KEY, JSON.stringify(exportTune(rosie))); } catch {}
}

export function restore(rosie) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved) return;
    // saves from before Off and Knot had their own presets: they shared Idle's, so start them from it
    for (const s of STATES) Object.assign(rosie.presets[s], saved[s] ?? (s === 'working' ? null : saved.idle));
    if (Number.isFinite(saved.transition)) rosie.transition = saved.transition;
  } catch {}
}
