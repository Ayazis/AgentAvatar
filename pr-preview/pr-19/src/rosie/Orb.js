// Rosie's particle orb: a shell of stippled denim plates with glowing stitched hems around a burning particle core,
// floating over the scarf. Everything except the scarf is particles.
//
// Each frame: the live values glide towards the preset, breathing and boosts move them, the parts update, then
//   1. the ray masks and the shafts (rays.js)
//   2. the light buffer, so the scarf can be lit by the orb (lightBuffer.js)
//   3. the orb on black, bloomed, then the scarf and background under it and the shafts over it (scarf.js)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ORB_Y, FOV, DIST, tempoOf } from './config.js';
import { Shell } from './parts/shell.js';
import { Core } from './parts/core.js';
import { Halo, Sparks } from './parts/dust.js';
import { Swirls } from './parts/swirls.js';
import { Ribbons } from './parts/ribbons.js';
import { Rays } from './rays.js';
import { LightBuffer } from './lightBuffer.js';
import { createScarfPass } from './scarf.js';
import { Breath, Boosts } from './motion.js';
import { Barrier } from './barrier.js';

export class Orb {
  t = 0;
  tempo = 1;
  #turn = 0;

  /**
   * @param canvas    the canvas to draw into; the orb follows its size
   * @param settings  a Settings (presets, build settings and live values)
   */
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;

    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1.5, .1, 100);
    this.camera.position.set(0, 0, DIST);

    // the parts, and how much each lights the scarf (see LightBuffer). The plates are walls the moving parts
    // can't pass through (see barrier.js); the swirls are drawn in the shell's turning frame.
    this.spin = new THREE.Group();
    this.barrier = new Barrier();
    this.rays = new Rays();
    this.shell = new Shell(this.rays.occMaterial);
    this.core = new Core();
    this.halo = new Halo(this.barrier);
    this.sparks = new Sparks(this.barrier);
    this.swirls = new Swirls(this.barrier, this.spin);
    this.ribbons = new Ribbons(this.barrier);
    this.lightLayers = [
      { uniforms: this.shell.uniforms, weight: .3 }, { uniforms: this.core.uniforms, weight: .7 },
      { uniforms: this.halo.uniforms, weight: 1.8 }, { uniforms: this.sparks.uniforms, weight: 3 },
      { uniforms: this.swirls.uniforms, weight: 3.5 }, { uniforms: this.ribbons.uniforms, weight: 2.5 },
    ];
    this.allUniforms = [...this.lightLayers.map(l => l.uniforms), this.rays.uniforms];

    // the scene graph: orb (floats, breathes) > spin (turns, drags) > shell (tilt) > plates
    this.orb = new THREE.Group();
    this.spin.add(this.shell.group, this.swirls.object);
    this.orb.add(this.spin, ...this.core.objects, this.halo.group, this.sparks.object, this.ribbons.object, this.rays.light);
    this.scene.add(this.orb);

    // the orb is drawn alone on black and bloomed, then added over the scarf, so the scarf itself never blooms
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .45, .3, .25);
    this.composer.addPass(this.bloom);
    this.lightBuffer = new LightBuffer();
    this.scarf = createScarfPass(this.rays, this.lightBuffer.texture, this.bloom.renderTargetsVertical[2].texture);
    this.composer.addPass(this.scarf);
    this.composer.addPass(new OutputPass());

    this.breath = new Breath();
    this.boosts = new Boosts(settings.tune.flareOn);
    this.drag = { x: 0, y: 0, active: false };   // set by the input (see input.js)

    this.rebuildShell();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  /** Rebuild the plates after a change to the layout, gap or density. */
  rebuildShell() { this.shell.build(this.settings.tune, this.settings.live.open); this.barrier.setShell(this.shell); }

  /** Greet her: a pulse through everything. */
  tap() { this.boosts.tap(); }

  /** Start a random boost now. */
  boost() { this.boosts.flare(this.t, this.settings.live); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const db = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rays.setSize(db.x, db.y);
    this.lightBuffer.setSize(db.x, db.y);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, 0, (.5 - ORB_Y) * h, w, h);   // put the orb above the scarf, not mid-frame
    this.camera.updateProjectionMatrix();
    this.px = this.renderer.getPixelRatio() * h / 820;
    for (const u of this.allUniforms) u.uPx.value = this.px;
  }

  start() {
    const clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame(Math.min(clock.getDelta(), .05)));
  }
  stop() { this.renderer.setAnimationLoop(null); }

  /** Advance by dt seconds and draw. */
  frame(dt) {
    const { live, target, tune } = this.settings;
    const t = this.t += dt;
    const ease = rate => 1 - Math.exp(-dt * rate);

    // the values for this frame
    const breath = this.breath.update(dt, live);
    for (const k in live) live[k] += (target[k] - live[k]) * ease(k === 'open' ? 1.6 : 1.3);
    this.boosts.apply(dt, t, live);
    const { pulse, openBoost } = this.boosts;
    const tempo = this.tempo = tempoOf(live.energy);
    /** Everything a part needs to move this frame. */
    const f = { dt, t, live, target, tempo, breath, pulse, openBoost, ease };

    // the shell, and how it turns and floats
    const opacity = this.shell.update(f, tune.density);
    this.scarf.uniforms.uShellOpacity.value = opacity;
    this.#turn += dt * live.spin * tempo;
    const drag = this.drag;
    if (!drag.active) drag.y *= 1 - ease(1.5);
    this.spin.rotation.set(drag.y, this.#turn + drag.x, 0);
    this.core.group.rotation.y = -this.#turn * .6 + drag.x;
    this.halo.group.rotation.y = this.#turn * .3 + drag.x;
    this.orb.position.y = .025 * Math.sin(t * .8);
    this.orb.scale.setScalar(1 + .014 * breath + .05 * pulse);                 // the shell swells as she breathes in
    this.core.heart.quaternion.copy(this.camera.quaternion);
    this.barrier.solid = !!+tune.solidPlates;
    this.barrier.update(this.shell, this.spin);                                // where the plates are, as walls

    for (const u of this.allUniforms) {
      u.uTime.value = t; u.uPower.value = live.power; u.uCore.value = live.core * (1 + .14 * breath);
      u.uEnergy.value = live.energy; u.uSize.value = live.size; u.uHalo.value = live.halo * (1 + .2 * breath);
    }

    // the scarf and the glow
    const flick = .96 + .04 * Math.sin(t * 6.7) * Math.sin(t * 2.3 + 1);
    const su = this.scarf.uniforms;
    su.uLit.value = Math.min(2, live.lit) * flick;
    su.uLightGain.value = 1.1 * live.scarfLight;
    su.uBloomK.value = this.bloom.strength;                                    // last frame's strength
    su.uCode.value = tune.scarfMode;
    this.bloom.strength = .45 * Math.pow(live.bloom, 1.6) * (1 + .1 * breath);  // gentle near 1, lower ceiling

    this.sparks.update(f);
    this.swirls.update(f);
    this.ribbons.update(f);
    this.rays.update(f);

    this.rays.render(this.renderer, this.scene, this.camera, this.orb.position.y);
    this.lightBuffer.render(this.renderer, this.scene, this.camera, this.lightLayers, this.px, live.size);
    this.composer.render();
    this.boosts.restore(live);
  }
}
