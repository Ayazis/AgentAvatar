// The plates as solid walls. Nothing passes through a plate: swirls, sparks, ribbons, dust and the halo can only
// cross the shell through the gaps between the plates (and the wide openings when the plates swing open).
//
// A plate is a cap of the unit sphere in its own rest frame (see shell.js): the directions where its margin is
// > 0, with an outer face at R_OUT and an inner face at R_IN. Each plate moves rigidly (it turns, swings out on
// its hinge and lifts off), so a point is tested by taking it into the plate's rest frame.
//
// Two ways to obey the walls:
//  - CPU particles that keep their own position (sparks, ribbon and dust heads, swirl heads) step from where they
//    were to where they want to be. A step that would take them through a plate is stopped at the face they are
//    on, and they slide along it towards the nearest seam, where they slip through (see constrain and follow).
//  - Shader particles that have no memory (the halo, the strands of each swirl) are kept on the same side of each
//    plate as a reference point: the halo dust as it is, a swirl strand like the wisp's centre line (see keepSide).
// The plate's edge is soft (EDGE_LO .. EDGE_HI of margin), so the walls start and stop smoothly at the seams.
import * as THREE from 'three';

export const MAX_PLATES = 12;
const K = .022;                    // the soft max that rounds the plate corners (as shell.js margin)
const R_OUT = 1.045, R_IN = .925;  // the faces, with room for the sprites: cloth and hem reach 1.016, the inner face .955
const EDGE_LO = -.004, EDGE_HI = .03;
const FACING = .45;                // a plate is never more than ~63 degrees wide, so skip plates facing away

const f = v => v.toFixed(4);

/** GLSL for the shader particles: the plate uniforms and keepSide(p, ref). */
export const BARRIER_GLSL = `
  #define MAX_PLATES ${MAX_PLATES}
  uniform mat4 uPlateIn[MAX_PLATES], uPlateOut[MAX_PLATES];   // this layer's frame -> each plate's rest frame, and back
  uniform vec3 uCentres[MAX_PLATES];
  uniform int uPlateCount;
  uniform float uGap, uSolid;
  float plateMargin(vec3 n, int i){
    float s = 0.;
    for (int j = 0; j < MAX_PLATES; j++) { if (j >= uPlateCount) break; if (j != i) s += exp((dot(n, uCentres[j]) - 1.) / ${f(K)}); }
    return dot(n, uCentres[i]) - (1. + ${f(K)} * log(max(s, 1e-30))) - uGap;
  }
  // p, kept on the same side of every plate as ref: pushed out to the face where a plate covers it
  vec3 keepSide(vec3 p, vec3 ref){
    if (uSolid < .5) return p;
    for (int i = 0; i < MAX_PLATES; i++) {
      if (i >= uPlateCount) break;
      vec3 q = (uPlateIn[i] * vec4(p, 1.)).xyz;
      bool outside = length((uPlateIn[i] * vec4(ref, 1.)).xyz) >= 1.;
      float r = length(q), surf = outside ? ${f(R_OUT)} : ${f(R_IN)};
      if (outside ? r >= surf : r <= surf) continue;
      vec3 n = q / max(r, 1e-5);
      if (dot(n, uCentres[i]) < ${f(FACING)}) continue;
      float cov = smoothstep(${f(EDGE_LO)}, ${f(EDGE_HI)}, plateMargin(n, i));
      if (cov <= 0.) continue;
      p = (uPlateOut[i] * vec4(n * mix(r, surf, cov), 1.)).xyz;
    }
    return p;
  }`;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const identity = () => Array.from({ length: MAX_PLATES }, () => new THREE.Matrix4());

export class Barrier {
  solid = true;
  /** Where constrain() and follow() leave the particle. */
  x = 0; y = 0; z = 0;
  #frame = 0;
  /** Counts the frames, for follow(). */
  get frameNo() { return this.#frame; }

  constructor() {
    this.count = 0; this.gap = 0;
    this.centres = [];
    this.toOrb = []; this.fromOrb = [];       // per plate, as column-major arrays for the CPU
    this.bounds = [];                         // per plate: a sphere round it in orb space, { x, y, z, r2 }
    this.shared = { uCentres: { value: Array.from({ length: MAX_PLATES }, () => new THREE.Vector3()) },
                    uPlateCount: { value: 0 }, uGap: { value: 0 }, uSolid: { value: 1 } };
    this.layers = [];                         // { object, uniforms }: shader layers and the frame they draw in
    this.#m = new THREE.Matrix4(); this.#mi = new THREE.Matrix4();
  }
  #m; #mi;

  /**
   * Uniforms for a shader layer that calls keepSide(). `object` is the group the layer draws in (a child of the
   * orb), or null when it draws in the orb's own frame.
   */
  uniformsFor(object = null) {
    const uniforms = { uPlateIn: { value: identity() }, uPlateOut: { value: identity() }, ...this.shared };
    this.layers.push({ object, uniforms });
    return uniforms;
  }

  /** Take the plates from a freshly built shell (see Shell.build). */
  setShell(shell) {
    this.count = Math.min(MAX_PLATES, shell.plates.length);
    this.gap = shell.gap;
    this.centres = shell.plates.slice(0, this.count).map(p => p.c.clone());
    this.centres.forEach((c, i) => this.shared.uCentres.value[i].copy(c));
    this.shared.uPlateCount.value = this.count;
    this.shared.uGap.value = this.gap;
    // a sphere round each plate's slab, in its rest frame: centre on the plate's axis at `mid`, radius `rho`
    this.rest = shell.plates.slice(0, this.count).map(p => {
      const s = Math.sin(p.alpha), c = Math.cos(p.alpha), mid = (R_IN * c + R_OUT) / 2;
      const rho = Math.max(R_OUT - mid, mid - R_IN, Math.hypot(R_OUT * s, R_OUT * c - mid), Math.hypot(R_IN * s, R_IN * c - mid));
      return { c: p.c, mid, rho: rho + .06 };
    });
    this.toOrb = this.rest.map(() => new Float64Array(16));
    this.fromOrb = this.rest.map(() => new Float64Array(16));
    this.bounds = this.rest.map(() => ({ x: 0, y: 0, z: 0, r2: 0 }));
  }

  /** Where the plates are this frame. Call after the shell and the spin have moved. */
  update(shell, spin) {
    this.#frame++;
    this.shared.uSolid.value = this.solid ? 1 : 0;
    spin.updateMatrix(); shell.group.updateMatrix();
    const m = this.#m, mi = this.#mi, v = new THREE.Vector3();
    const toOrb = [];
    for (let i = 0; i < this.count; i++) {
      m.multiplyMatrices(spin.matrix, shell.group.matrix).multiply(shell.plates[i].obj.matrix);   // rest -> orb
      toOrb.push(m.clone());
      this.toOrb[i].set(m.elements);
      this.fromOrb[i].set(mi.copy(m).invert().elements);
      const r = this.rest[i];
      v.copy(r.c).multiplyScalar(r.mid).applyMatrix4(m);
      Object.assign(this.bounds[i], { x: v.x, y: v.y, z: v.z, r2: r.rho * r.rho });
    }
    for (const { object, uniforms } of this.layers) {
      if (object) { object.updateMatrix(); mi.copy(object.matrix).invert(); } else mi.identity();
      for (let i = 0; i < this.count; i++) {
        const out = uniforms.uPlateOut.value[i].multiplyMatrices(mi, toOrb[i]);   // rest -> the layer's frame
        uniforms.uPlateIn.value[i].copy(out).invert();
      }
    }
  }

  /**
   * One step of a particle from (px, py, pz) to (nx, ny, nz), in orb space. Where a plate covers the step it stops
   * at the face the particle is on and slides `slide` towards the nearest seam (b: the particle's own leaning, any
   * unit vector, so ones at a plate's very centre still pick a way). The result is left in x, y, z.
   * Returns true if a plate held it back.
   */
  constrain(px, py, pz, nx, ny, nz, slide, bx = 0, by = 0, bz = 0) {
    let held = false;
    if (this.solid) for (let i = 0; i < this.count; i++) {
      const b = this.bounds[i];
      if ((nx - b.x) ** 2 + (ny - b.y) ** 2 + (nz - b.z) ** 2 > b.r2 && (px - b.x) ** 2 + (py - b.y) ** 2 + (pz - b.z) ** 2 > b.r2) continue;
      const e = this.fromOrb[i];
      const r0 = Math.hypot(e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]);
      let qx = e[0] * nx + e[4] * ny + e[8] * nz + e[12], qy = e[1] * nx + e[5] * ny + e[9] * nz + e[13], qz = e[2] * nx + e[6] * ny + e[10] * nz + e[14];
      const r1 = Math.hypot(qx, qy, qz);
      const outside = r0 >= 1, surf = outside ? R_OUT : R_IN;
      if (outside ? r1 >= surf : r1 <= surf) continue;
      let ux = qx / r1, uy = qy / r1, uz = qz / r1;
      const c = this.centres[i], dc = ux * c.x + uy * c.y + uz * c.z;
      if (dc < FACING) continue;
      // the margin (as in shell.js), and the pull towards the nearest neighbour, which is towards the nearest seam
      let s = 0, gx = 0, gy = 0, gz = 0;
      for (let j = 0; j < this.count; j++) {
        if (j === i) continue;
        const cj = this.centres[j], w = Math.exp((ux * cj.x + uy * cj.y + uz * cj.z - 1) / K);
        s += w; gx += w * cj.x; gy += w * cj.y; gz += w * cj.z;
      }
      const cov = smooth(EDGE_LO, EDGE_HI, dc - (1 + K * Math.log(Math.max(s, 1e-300))) - this.gap);
      if (cov <= 0) continue;
      const r = r1 + (surf - r1) * cov;
      let tx = gx / s - c.x + bx * .35, ty = gy / s - c.y + by * .35, tz = gz / s - c.z + bz * .35;
      const d = tx * ux + ty * uy + tz * uz;
      tx -= ux * d; ty -= uy * d; tz -= uz * d;
      const tl = Math.hypot(tx, ty, tz);
      if (tl > 1e-6) {
        const k = slide * cov / tl;
        ux += tx * k; uy += ty * k; uz += tz * k;
        const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
      }
      qx = ux * r; qy = uy * r; qz = uz * r;
      const o = this.toOrb[i];
      nx = o[0] * qx + o[4] * qy + o[8] * qz + o[12]; ny = o[1] * qx + o[5] * qy + o[9] * qz + o[13]; nz = o[2] * qx + o[6] * qy + o[10] * qz + o[14];
      if (cov > .05) held = true;
    }
    this.x = nx; this.y = ny; this.z = nz;
    return held;
  }

  /**
   * Move a particle that follows a path (its raw position this frame: rx, ry, rz), keeping it out of the plates.
   * `p` keeps its state: ax, ay, az (where it is), rx, ry, rz (where the path was last frame), held, seen, and
   * bx, by, bz (its leaning, see constrain). While a plate holds it, it moves with the path's flow and slides
   * towards a seam; once free it catches up with the path (catchUp: the share of the way it closes per frame).
   * A particle not moved last frame starts again on its path. The result is left in x, y, z.
   */
  follow(p, rx, ry, rz, catchUp, slide) {
    if (p.seen !== this.#frame - 1) { p.ax = p.rx = rx; p.ay = p.ry = ry; p.az = p.rz = rz; p.held = false; }
    let tx = p.ax + rx - p.rx, ty = p.ay + ry - p.ry, tz = p.az + rz - p.rz;   // moved with the flow
    if (!p.held) { tx += (rx - tx) * catchUp; ty += (ry - ty) * catchUp; tz += (rz - tz) * catchUp; }
    p.held = this.constrain(p.ax, p.ay, p.az, tx, ty, tz, slide, p.bx, p.by, p.bz);
    p.ax = this.x; p.ay = this.y; p.az = this.z;
    p.rx = rx; p.ry = ry; p.rz = rz; p.seen = this.#frame;
    return p.held;
  }
}
