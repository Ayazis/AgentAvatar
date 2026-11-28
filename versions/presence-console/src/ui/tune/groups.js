// What the Tune panel shows: [title, on/off key or null, [[key, label, min, max, step], …]]
// The ranges run well past the defaults, so you can push every look further than it needs to go.
import { MAX } from '../../rosie/config.js';

export const GROUPS = [
  ['Silk ring', 'silkOn', [
    ['silkBright', 'Brightness', 0, 4, .05], ['silkWidth', 'Width', .1, 6, .05], ['ringSize', 'Size', .6, 4, .02],
    ['ringTilt', 'Tilt (°)', -89, 89, 1], ['ringRoll', 'Roll (°)', -180, 180, 1], ['ringDepth', 'Depth', -.4, .4, .005],
    ['silkSway', 'Wobble', 0, 6, .05], ['silkSpeed', 'Flow speed', 0, 6, .05], ['sparks', 'Sparks', 0, 5, .05],
    ['sparkSpeed', 'Spark speed', 0, 10, .05]]],
  ['Orb', 'orbOn', [
    ['orbCount', 'Particles', 0, MAX.orb, 50], ['orbSize', 'Size', .2, 4, .05], ['orbBright', 'Brightness', 0, 5, .05],
    ['orbSpin', 'Spin', 0, 14, .05], ['orbGlow', 'Inner glow', 0, 5, .05]]],
  ['Ribbons', 'ribOn', [
    ['ribCount', 'Ribbons', 1, 3, 1], ['ribAmount', 'Particles', 0, MAX.rib, 50], ['ribSpeed', 'Speed', 0, 10, .05],
    ['ribBright', 'Brightness', 0, 5, .05], ['ribWidth', 'Width', .1, 6, .05], ['ribOrbit', 'Orbit size', .3, 3, .02]]],
  ['Swirl dust', 'dustOn', [
    ['dustAmount', 'Particles', 0, MAX.dust, 50], ['dustSpeed', 'Speed', 0, 10, .05], ['dustBright', 'Brightness', 0, 5, .05]]],
  ['Scene', null, [
    ['jacketMotion', 'Jacket motion', 0, 5, .05], ['jacketSpeed', 'Jacket speed', 0, 6, .05], ['breathRate', 'Breathing', .1, 5, .05],
    ['pSize', 'Particle size', .1, 5, .05], ['tilt', 'Tilt follow', 0, 4, .05],
    ['denimLight', 'Light on denim', 0, 6, .05], ['lightSpread', 'Light spread', .1, 6, .05],
    ['denimShade', 'Orb relight', 0, 4, .05]]],
  ['Knot', null, [
    ['knotBlur', 'Motion blur', 0, 1, .05], ['knotSpeed', 'Speed', .1, 6, .05]]],
];
