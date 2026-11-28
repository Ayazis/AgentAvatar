// A small offscreen texture the particles draw their light into, so the scene pass can light the denim with it.
// Drawn at a fraction of the canvas resolution with wide soft points; linear filtering does the rest of the blur.
export class LightBuffer {
  constructor(g, unit, div = 4) {
    this.g = g; this.unit = unit; this.div = div; this.w = 0; this.h = 0;
    this.tex = g.createTexture();
    g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, this.tex);
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR],
                          [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
    this.fbo = g.createFramebuffer();
    this.resize(4, 4);
  }

  resize(width, height) {
    const g = this.g, w = Math.max(1, Math.ceil(width/this.div)), h = Math.max(1, Math.ceil(height/this.div));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    g.activeTexture(g.TEXTURE0 + this.unit); g.bindTexture(g.TEXTURE_2D, this.tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.bindFramebuffer(g.FRAMEBUFFER, this.fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.tex, 0);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
  }

  begin() {
    const g = this.g;
    g.bindFramebuffer(g.FRAMEBUFFER, this.fbo);
    g.viewport(0, 0, this.w, this.h);
    g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT);
  }
  end(width, height) { const g = this.g; g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, width, height); }
  clear(width, height) { this.begin(); this.end(width, height); }

  destroy() { this.g.deleteFramebuffer(this.fbo); this.g.deleteTexture(this.tex); }
}
