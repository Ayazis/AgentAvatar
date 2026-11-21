// Glides the live slider values and the jacket pose toward the current state.
// Both restart from wherever they are when the target changes, so switching midway is smooth.
import { TUNE_DEFAULTS, TRANSITION_DEFAULT, POSE, STATES, presetFor } from './config.js';

const smoother = u => u*u*u*(u*(u*6 - 15) + 10);
const smooth = u => u*u*(3 - 2*u);

export class StateGlide {
  constructor() {
    this.presets = Object.fromEntries(STATES.map(s => [s, { ...TUNE_DEFAULTS[s] }]));
    this.tune = { ...this.presets.idle };   // the live values
    this.transition = TRANSITION_DEFAULT;
    this.from = { ...this.tune }; this.t = 1e9; this.lastTarget = {}; this.lastRef = null;
    this.pose = POSE.idle; this.poseFrom = this.pose; this.poseTo = this.pose; this.poseT = 1e9;
    this.gliding = false;
  }

  // jump straight to a state's values (e.g. after loading saved settings)
  snap(state) { Object.assign(this.tune, this.presets[presetFor(state)]); }

  update(dt, state) {
    const target = this.presets[presetFor(state)];
    let changed = target !== this.lastRef;
    if (!changed) for (const k in target) if (target[k] !== this.lastTarget[k]) { changed = true; break; }
    if (changed) { this.from = { ...this.tune }; this.t = 0; this.lastTarget = { ...target }; this.lastRef = target; }
    this.t += dt;
    const u = this.transition > 0 ? Math.min(1, this.t/this.transition) : 1, e = smoother(u);
    for (const k in target) this.tune[k] = this.from[k] + (target[k] - this.from[k])*e;
    this.gliding = u < 1;

    const poseTarget = POSE[state];
    if (poseTarget !== this.poseTo) { this.poseFrom = this.pose; this.poseTo = poseTarget; this.poseT = 0; }
    this.poseT += dt;
    const pu = this.transition > 0 ? Math.min(1, this.poseT/this.transition) : 1;
    this.pose = this.poseFrom + (this.poseTo - this.poseFrom)*smooth(pu);
  }
}
