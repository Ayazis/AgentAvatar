// Layout, the per-state presets and the build settings. Every number here is something the panel can change.

// ---------------------------------------------------------------- layout
export const ORB_Y = .315;   // orb centre, fraction of stage height from the top
export const ORB_R = .24;    // shell radius, fraction of stage height
export const FOV = 30;
export const DIST = 1 / (Math.tan(FOV * Math.PI / 360) * 2 * ORB_R);   // camera distance that gives that radius

// ---------------------------------------------------------------- states
// Each state is a full preset: every value it has is on a slider, and the panel edits the state on screen.
// Switching state glides every value to the other preset. Presets are saved in this browser.
export const STATES = ['off', 'idle', 'working'];

const SHARED = {
  shellOpacity: 0, tilt: 0, size: 1, bloom: 1, rayLength: .85, rayAmount: 7, hemLength: .85, hemAmount: 1, swirlSpeed: 1, scarfLight: 1,
  breathRate: 1, breathDepth: 1, pulse: 1, flareEvery: 8, flareLen: 1, flareAmount: .8,
  ribCount: 3, ribAmount: 1500, ribSpeed: 1, ribBright: 1, ribWidth: 1, ribOrbit: 1, dustAmount: 700, dustSpeed: 1, dustBright: 1,
};
export const DEFAULTS = {
  off:     { ...SHARED, breathDepth: .6, pulse: .6, flareEvery: 0, open: 0, spin: .058, core: .05, rays: .02, hemRays: .45, swirls: 0,
             power: .16, halo: .12, energy: 0, lit: 0, bloom: .7 },
  idle:    { ...SHARED, open: .32, spin: .12, core: 1, rays: .66, hemRays: .66, swirls: 3, power: 1, halo: .7, energy: .25, lit: 1 },
  working: { ...SHARED, breathRate: 1.37, flareEvery: 4, ribSpeed: 1.07, ribWidth: 1.25, dustSpeed: 1.07, dustBright: 1.6,
             open: 1, spin: .156, core: 1.55, rays: 2, hemRays: 1.3, swirls: 7, power: 1.1, halo: 1.15, energy: 1, lit: 1.75 },
};

// ---------------------------------------------------------------- build settings
// These belong to the build, not to a state: the same in every state.
export const FLARE_TARGETS = ['bloom', 'core', 'rays', 'hemRays', 'open', 'swirls', 'ribBright', 'dustBright', 'energy'];
export const TUNE_DEFAULTS = {
  scarfMode: 1, layout: 6, gap: .03, density: 1, solidPlates: 1,
  flareOn: { bloom: true, core: true, rays: true, hemRays: true, open: false, swirls: true, ribBright: true, dustBright: true, energy: false },
};
export const REBUILDS_SHELL = ['gap', 'density', 'layout'];

export const STORE = 'rosie-particle-orb-presets-v3';   // v3: Energy sets the tempo of all motion

// Energy is the tempo of everything that moves: x1 at Idle's 0.25, about x0.5 asleep, about x2.4 at 1.
export const tempoOf = e => (.35 + 1.3 * e) / .675;

// How awake she is, from Brightness: 0 when off, 1 at Idle and above.
export const aliveOf = power => Math.min(1, Math.max(0, (power - .16) / .84));
