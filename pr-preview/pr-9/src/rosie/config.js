// Fixed layout numbers and the default slider values for each state.

// the orb sits at chest height, inside the jacket (picture coords: x 0…1, y 0 top … 1 bottom, 2:3 frame)
export const ORB = { x: .5, y: .565 };

// particle budgets: the sliders choose how many of these are shown
export const MAX = { orb: 6000, rib: 9000, dust: 5000 };

export const TRANSITION_DEFAULT = 2.5;   // seconds

// the jacket pose for each state (0 off, 1 idle, 2 working); fractions are a blend between poses
export const POSE = { off: 0, idle: 1, working: 2, knot: 1 };   // knot: idle pose, then the knot flipbook

// One preset per state. Switching state glides every value from one preset to the other.
// Off and Knot start as copies of Idle; Off also dims the light on its own.
const IDLE = {
  silkOn: 1, silkBright: 1, silkWidth: 1, silkSway: 1, silkSpeed: 1, sparks: 1, sparkSpeed: 1,
  ringSize: 1.55, ringTilt: 18, ringRoll: -20, ringDepth: 0,
  orbOn: 1, orbCount: 1400, orbSize: 1, orbBright: 1, orbSpin: 1, orbGlow: 1,
  ribOn: 1, ribCount: 3, ribAmount: 1500, ribSpeed: 1, ribBright: 1, ribWidth: 1, ribOrbit: 1,
  dustOn: 1, dustAmount: 700, dustSpeed: 1, dustBright: 1,
  jacketMotion: 1, jacketSpeed: 1, breathRate: 1, pSize: 1, tilt: 1,
  denimLight: 1, lightSpread: 1, denimShade: 1,   // how much the particles light the denim, and how far their light reaches
  knotBlur: 1, knotSpeed: 1,    // idle ⇄ knot turn: motion blur (0 = sharp), turn speed
};

export const STATES = ['off', 'idle', 'working', 'knot'];

export const TUNE_DEFAULTS = {
  off: IDLE,
  idle: IDLE,
  knot: IDLE,
  working: { ...IDLE, silkBright: 1.15, silkWidth: 1.05, sparks: 1.5, sparkSpeed: 3.1,
    orbSpin: 4.2, orbGlow: 1.45, ribSpeed: 2.6, ribWidth: 1.25, dustSpeed: 2.6, dustBright: 1.6,
    denimLight: 1.25, denimShade: 1.3, jacketMotion: 1.8, jacketSpeed: 1.7, breathRate: 1.37 },
};

export const presetFor = state => state in TUNE_DEFAULTS ? state : 'idle';
