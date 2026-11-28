// The page: the orb on the canvas, the Tune panel beside it.
import { Settings } from './rosie/settings.js';
import { Orb } from './rosie/Orb.js';
import { bindInput } from './rosie/input.js';
import { Panel } from './ui/panel.js';

const canvas = document.getElementById('c');
const settings = new Settings();
const orb = new Orb(canvas, settings);
bindInput(canvas, orb);
const panel = new Panel(document.querySelector('.panel'), settings, orb);
orb.start();

// for capture and testing: step the animation by hand (a hidden tab gets no animation frames)
window.rosieOrb = {
  orb, settings,
  setState: s => panel.setState(s),
  tap: () => orb.tap(),
  boost: () => orb.boost(),
  step(seconds, fps = 30) { for (let i = 0; i < seconds * fps; i++) orb.frame(1 / fps); },
  debug: { bloom: orb.bloom, bgMat: orb.scarf.material, renderer: orb.renderer, raysRT: orb.rays.raysRT, raysMat: orb.rays.smear },
};
