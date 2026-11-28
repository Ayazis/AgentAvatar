// The Tune panel's controls, group by group: what each slider is called, its range, and how its value reads.
// Keys are preset values (see config.js DEFAULTS) or build settings (TUNE_DEFAULTS); the panel tells them apart.

const pace = v => v < .05 ? 'still' : v < .45 ? 'very slow' : v < .8 ? 'slow' : v < 1.3 ? 'normal' : v < 2.2 ? 'fast' : 'very fast';
const paced = v => `${pace(v)} · ${v.toFixed(2)}`;
const length = v => `${v < .35 ? 'short' : v < .7 ? 'medium' : 'long'} · ${Math.round(v * 100)} %`;
const count = (one, many) => v => `${Math.round(v)} ${Math.round(v) === 1 ? one : many}`;
const particles = v => `${Math.round(v)} particles`;
const times = v => `× ${v.toFixed(2)}`;
export const num = v => v.toFixed(2);

// tempoOf is passed in so this file stays free of the renderer
export const controls = tempoOf => [
  { group: 'Shell', items: [
    { slider: 'shellOpacity', label: 'Opacity', min: 0, max: 1, step: .01, fmt: v => v < .01 ? 'see-through' : v > .99 ? 'solid' : `${Math.round(v * 100)} % solid` },
    { slider: 'open', label: 'Opening', min: 0, max: 1.6, step: .01, fmt: v => v < .01 ? 'sealed' : `${Math.round(v * 100)} % open` },
    { slider: 'spin', label: 'Turn speed', min: 0, max: 1.2, step: .005, fmt: v => `${pace(v / .12)} · ${v.toFixed(2)}` },
    { select: 'layout', label: 'Plates', options: [[6, '6 (curved squares)'], [12, '12 (pentagons)']] },
    { select: 'solidPlates', label: 'Plates are', options: [[1, 'Solid: through the gaps only'], [0, 'Ghosts: pass straight through']] },
    { slider: 'gap', label: 'Plate gap', min: .005, max: .12, step: .005, fmt: v => v.toFixed(3) },
    { slider: 'density', label: 'Density', min: .3, max: 2, step: .05, fmt: times },
  ] },
  { group: 'Core &amp; rays', items: [
    { slider: 'core', label: 'Core glow', min: 0, max: 2.5, step: .01 },
    { lockRays: 'Core rays follow core glow' },
    { sub: 'Core rays', hint: 'through the gaps' },
    { slider: 'rayAmount', label: 'Shafts', min: 2, max: 14, step: 1, fmt: v => `${Math.round(v)} · ${v < 4 ? 'broad' : v < 9 ? 'mixed' : 'fine'}` },
    { slider: 'rays', label: 'Intensity', min: 0, max: 3, step: .01 },
    { slider: 'rayLength', label: 'Length', min: .1, max: 1, step: .01, fmt: length },
    { sub: 'Hem rays', hint: 'from the plate edges' },
    { slider: 'hemAmount', label: 'Amount', min: 0, max: 1, step: .01, fmt: v => `${Math.round(v * 100)} % of the edge` },
    { slider: 'hemRays', label: 'Intensity', min: 0, max: 3, step: .01 },
    { slider: 'hemLength', label: 'Length', min: .1, max: 1, step: .01, fmt: length },
  ] },
  { group: 'Particles &amp; glow', items: [
    { slider: 'size', label: 'Particle size', min: .4, max: 2.5, step: .01, fmt: times },
    { slider: 'swirls', label: 'Swirls', min: 0, max: 7, step: 1, fmt: count('wisp', 'wisps') },
    { slider: 'swirlSpeed', label: 'Swirl speed', min: 0, max: 3, step: .01, fmt: paced },
    { slider: 'bloom', label: 'Bloom', min: 0, max: 1.6, step: .005 },
  ] },
  { group: 'Ribbons &amp; swirl dust', items: [
    { sub: 'Ribbons', hint: 'from the main console' },
    { slider: 'ribCount', label: 'Count', min: 0, max: 3, step: 1, fmt: count('ribbon', 'ribbons') },
    { slider: 'ribAmount', label: 'Amount', min: 0, max: 4000, step: 50, fmt: particles },
    { slider: 'ribBright', label: 'Brightness', min: 0, max: 3, step: .01 },
    { slider: 'ribSpeed', label: 'Speed', min: 0, max: 4, step: .01, fmt: paced },
    { slider: 'ribWidth', label: 'Width', min: 0, max: 3, step: .01 },
    { slider: 'ribOrbit', label: 'Orbit size', min: .5, max: 1.8, step: .01 },
    { sub: 'Swirl dust' },
    { slider: 'dustAmount', label: 'Amount', min: 0, max: 3000, step: 50, fmt: particles },
    { slider: 'dustBright', label: 'Brightness', min: 0, max: 3, step: .01 },
    { slider: 'dustSpeed', label: 'Speed', min: 0, max: 4, step: .01, fmt: paced },
  ] },
  { group: 'Mood', items: [
    { slider: 'power', label: 'Brightness', min: 0, max: 1.6, step: .01 },
    { slider: 'energy', label: 'Energy', min: 0, max: 1.5, step: .01,
      fmt: v => `${v < .1 ? 'asleep' : v < .4 ? 'calm' : v < .8 ? 'lively' : v < 1.2 ? 'busy' : 'frantic'} · tempo ×${tempoOf(v).toFixed(2)}` },
    { note: 'The tempo of everything that moves: the turning shell, swirls, ribbons, dust, core spiral, sparks, sheen and stitch light. Higher also brings more sparks. The other speed sliders are relative to it.' },
    { slider: 'halo', label: 'Dust', min: 0, max: 2, step: .01 },
    { slider: 'breathRate', label: 'Breathing rate', min: 0, max: 3, step: .01, fmt: v => v < .02 ? 'held' : `${(5.2 / v).toFixed(1)} s per breath` },
    { slider: 'breathDepth', label: 'Breathing depth', min: 0, max: 3, step: .01 },
    { note: 'One breath takes about 5 seconds at rate 1. Depth sets how much the shell, core, dust, rays, ribbons and scarf light swell with it.' },
  ] },
  { group: 'Pulse &amp; random boosts', items: [
    { slider: 'pulse', label: 'Tap pulse', min: 0, max: 3, step: .01 },
    { note: 'Tap the orb (without dragging) to greet her.' },
    { sub: 'Random boosts', hint: 'a value rises for a moment' },
    { slider: 'flareEvery', label: 'How often', min: 0, max: 30, step: .5, fmt: v => v <= 0 ? 'off' : `about every ${v} s` },
    { slider: 'flareLen', label: 'Length', min: .2, max: 4, step: .05, fmt: v => `${v.toFixed(1)} s` },
    { slider: 'flareAmount', label: 'Strength', min: 0, max: 3, step: .01, fmt: v => `up to +${Math.round(v * 100)} %` },
    { flares: { bloom: 'Bloom', core: 'Core glow', rays: 'Core rays', hemRays: 'Hem rays', open: 'Opening', swirls: 'Swirls',
                ribBright: 'Ribbons', dustBright: 'Swirl dust', energy: 'Energy' } },
    { button: 'boostNow', label: 'Boost now' },
  ] },
  { group: 'Scarf', items: [
    { select: 'scarfMode', label: 'Scarf light', options: [[1, 'Code: lit by the orb'], [0, 'Painted: lit / bright images']] },
    { slider: 'scarfLight', label: 'Scarf light strength', min: 0, max: 2.5, step: .01 },
    { slider: 'lit', label: 'Painted light level', min: 0, max: 2, step: .01 },
    { note: 'Painted mode only: 0 unlit, 1 lit, 2 bright.' },
  ] },
];
