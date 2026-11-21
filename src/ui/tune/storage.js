// Saves the tuned presets in this browser, and exports them for "Copy settings".
const KEY = 'rosie-tune-v4';

export const exportTune = rosie => ({ transition: rosie.transition, idle: rosie.presets.idle, working: rosie.presets.working });

export function save(rosie) {
  try { localStorage.setItem(KEY, JSON.stringify(exportTune(rosie))); } catch {}
}

export function restore(rosie) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved) return;
    Object.assign(rosie.presets.idle, saved.idle);
    Object.assign(rosie.presets.working, saved.working);
    if (Number.isFinite(saved.transition)) rosie.transition = saved.transition;
  } catch {}
}
