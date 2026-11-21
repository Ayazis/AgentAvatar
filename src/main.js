// The console page: Rosie on the canvas, plus the state bar, audio level and Tune panel.
import { Rosie } from './rosie/Rosie.js';
import { StateBar } from './ui/StateBar.js';
import { AudioLevel } from './ui/AudioLevel.js';
import { TunePanel } from './ui/tune/TunePanel.js';

const rosie = await Rosie.create(document.querySelector('#presence'));
window.rosie = rosie;   // for use from the console or a host app

new StateBar(rosie).select('idle');
new AudioLevel(rosie);
new TunePanel(rosie);
