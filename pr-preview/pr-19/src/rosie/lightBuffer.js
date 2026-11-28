// The light buffer: the whole orb drawn at a quarter size, with mipmaps, so the scarf can read it blurred and be lit
// by everything the orb draws (see scarf.js).
import * as THREE from 'three';

export class LightBuffer {
  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false,
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  }
  get texture() { return this.target.texture; }
  setSize(w, h) { this.target.setSize(Math.ceil(w / 4), Math.ceil(h / 4)); }

  /**
   * @param layers  [{ uniforms, weight }]: every particle layer, with how much it lights the scarf. The plates are big
   *                and steady, so they count less; the moving parts count more.
   * @param px      the layers' pixel scale on screen
   * @param size    the Particle size slider
   */
  render(renderer, scene, camera, layers, px, size) {
    // At a quarter of the pixels the sprites are about a pixel already, so their size can't change there. Draw them at
    // size 1 and scale their light by how much light the visible sprites give at the slider's size instead: area
    // grows with size², and above 1 the sprites dim by size^-1.4 (see sprites.js), so bigger always means more light.
    const sizeLight = size < 1 ? size * size : Math.pow(size, .6);
    for (const { uniforms: u, weight } of layers) { u.uPx.value = px / 4; u.uSize.value = 1; u.uLightMul.value = weight * sizeLight; }
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    for (const { uniforms: u } of layers) { u.uPx.value = px; u.uSize.value = size; u.uLightMul.value = 1; }
  }
}
