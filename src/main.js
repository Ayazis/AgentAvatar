// The console page: Rosie on the canvas, plus the state bar, intensity slider and Tune panel.
import { Rosie } from './rosie/Rosie.js';
import { StateBar } from './ui/StateBar.js';
import { IntensitySlider } from './ui/IntensitySlider.js';
import { TunePanel } from './ui/tune/TunePanel.js';

const rosie = await Rosie.create(document.querySelector('#presence'));
window.rosie = rosie;   // for use from the console or a host app

new StateBar(rosie).select('idle');
new IntensitySlider(rosie);
new TunePanel(rosie);
