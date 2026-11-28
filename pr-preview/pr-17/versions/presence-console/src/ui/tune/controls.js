// Building blocks of the Tune panel: a labelled slider row and a group on/off switch.
const fmt = (v, step) => step >= 1 ? String(Math.round(v)) : v.toFixed(2);

// returns { input, sync } — sync() shows the current value from get()
export function slider(parent, key, label, min, max, step, get, set, onChange) {
  const row = document.createElement('div'); row.className = 'ctl';
  const id = 't-' + key;
  row.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"><output class="mono" for="${id}"></output>`;
  const input = row.querySelector('input'), out = row.querySelector('output');
  input.addEventListener('input', () => { set(input.valueAsNumber); out.value = fmt(input.valueAsNumber, step); onChange(); });
  parent.append(row);
  const sync = () => {
    const v = get();
    if (document.activeElement !== input || !input.matches(':active')) input.value = v;
    out.value = fmt(v, step);
  };
  return { input, sync };
}

// a switch in a group header; returns sync()
export function groupSwitch(head, group, title, get, set) {
  const sw = document.createElement('input');
  sw.type = 'checkbox'; sw.className = 'switch'; sw.setAttribute('aria-label', title + ' on');
  sw.addEventListener('change', () => set(sw.checked));
  head.append(sw);
  return () => { sw.checked = get(); group.classList.toggle('off', !sw.checked); };
}
