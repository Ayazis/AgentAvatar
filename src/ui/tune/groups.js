// What the Tune panel shows: [title, on/off key or null, [[key, label, min, max, step], …]]
import { MAX } from '../../rosie/config.js';

export const GROUPS = [
  ['Silk ring', 'silkOn', [
    ['silkBright', 'Brightness', 0, 2, .05], ['silkWidth', 'Width', .3, 3, .05], ['ringSize', 'Size', 1, 2.6, .02],
    ['ringTilt', 'Tilt (°)', 0, 80, 1], ['ringRoll', 'Roll (°)', -60, 60, 1], ['ringDepth', 'Depth', -.15, .15, .005],
    ['silkSway', 'Wobble', 0, 3, .05], ['silkSpeed', 'Flow speed', 0, 3, .05], ['sparks', 'Sparks', 0, 2.5, .05],
    ['sparkSpeed', 'Spark speed', 0, 5, .05]]],
  ['Orb', 'orbOn', [
    ['orbCount', 'Particles', 100, MAX.orb, 50], ['orbSize', 'Size', .4, 2.2, .05], ['orbBright', 'Brightness', 0, 2.5, .05],
    ['orbSpin', 'Spin', 0, 7, .05], ['orbGlow', 'Inner glow', 0, 2.5, .05]]],
  ['Ribbons', 'ribOn', [
    ['ribCount', 'Ribbons', 1, 3, 1], ['ribAmount', 'Particles', 100, MAX.rib, 50], ['ribSpeed', 'Speed', 0, 5, .05],
    ['ribBright', 'Brightness', 0, 2.5, .05], ['ribWidth', 'Width', .2, 3, .05], ['ribOrbit', 'Orbit size', .5, 1.7, .02]]],
  ['Swirl dust', 'dustOn', [
    ['dustAmount', 'Particles', 0, MAX.dust, 50], ['dustSpeed', 'Speed', 0, 5, .05], ['dustBright', 'Brightness', 0, 2.5, .05]]],
  ['Scene', null, [
    ['jacketMotion', 'Jacket motion', 0, 2.5, .05], ['jacketSpeed', 'Jacket speed', 0, 3, .05], ['breathRate', 'Breathing', .3, 2.5, .05],
    ['pSize', 'Particle size', .3, 2.5, .05], ['tilt', 'Tilt follow', 0, 2, .05],
    ['denimLight', 'Light on denim', 0, 3, .05], ['lightSpread', 'Light spread', .3, 3, .05]]],
  ['Knot', null, [
    ['knotBlend', 'Blend', 0, 1, .05], ['knotSpeed', 'Speed', .25, 3, .05]]],
];
