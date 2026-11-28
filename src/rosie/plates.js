// Where the plates sit on the sphere and what shape each one is. Shared by the shell (which lays its particles out
// inside each plate) and the barrier (which keeps the moving particles out of them).
//
// Each plate has a centre on the unit sphere. Its cell is the part of the sphere nearer to its centre than to any
// other (rounded at the corners), so cells always fit together, whatever the count. The plate is its cell, cut to
// a shape centred on it: a circle, a regular polygon or a petal, sized by the distance to its nearest neighbour.
// At "Cells" the plate is the whole cell.
//
// A plate's margin at a point is > 0 inside it, and roughly how far in, in the units of the 6-plate shell (where
// it is √2 x the angle to the nearest edge), so the gap, hems and stitches read the same at every count.
import * as THREE from 'three';

const V3 = THREE.Vector3;
export const MAX_PLATES = 40;
export const K = .022;                 // the soft max that rounds the cell corners
export const S = Math.SQRT2;           // margin units: as the 6-plate shell
export const SHAPES = [[0, 'Cells (fit together)'], [1, 'Round'], [2, 'Triangles'], [3, 'Squares'], [4, 'Diamonds'],
                       [5, 'Pentagons'], [6, 'Hexagons'], [7, 'Petals']];

/** The centres: the regular solids where a count has one, otherwise spread evenly (a Fibonacci spiral). */
export function plateCentres(n) {
  const v = list => list.map(a => new V3(...a).normalize());
  const p = (1 + Math.sqrt(5)) / 2, q = 1 / p, out = [];
  if (n === 4) return v([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
  if (n === 6) return v([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
  if (n === 8) { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([x, y, z]); return v(out); }
  if (n === 12) { for (const s of [-1, 1]) for (const t of [-1, 1]) out.push([0, s, t * p], [s, t * p, 0], [t * p, 0, s]); return v(out); }
  if (n === 20) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([x, y, z]);
    for (const s of [-1, 1]) for (const t of [-1, 1]) out.push([0, s * q, t * p], [s * q, t * p, 0], [t * p, 0, s * q]);
    return v(out);
  }
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return v(out);
}

/**
 * How far (x, y) is out from the centre of a shape, in the plate's tangent plane: the shape's edge is at 1. Every
 * shape reaches out to 1 at its farthest (a polygon's corners, a petal's tips), so at size 1 it fits in its cell.
 */
export function shapeDist(shape, x, y) {
  if (shape === 1) return Math.hypot(x, y);
  if (shape === 7) return Math.hypot(x, y * 2.1);                              // petal: long along the plate's U
  const k = [0, 0, 3, 4, 4, 5, 6][shape], seg = 2 * Math.PI / k;
  const a = Math.atan2(y, x) + (shape === 4 ? Math.PI / 4 : 0) + seg / 2;
  return Math.hypot(x, y) * Math.cos(a - Math.floor(a / seg) * seg - seg / 2) / Math.cos(Math.PI / k);
}

export class PlateLayout {
  /**
   * @param count  how many plates (2 .. MAX_PLATES)
   * @param shape  an entry of SHAPES (0: cells)
   * @param size   the shape's size: at 1 it just fits in its cell; bigger is cut off by the cell
   */
  constructor(count, shape, size) {
    const n = Math.max(2, Math.min(MAX_PLATES, Math.round(count)));
    this.count = n; this.shape = shape; this.size = size;
    this.centres = plateCentres(n);
    this.U = []; this.W = []; this.R = []; this.ext = []; this.near = []; this.L = [];
    this.centres.forEach((c, i) => {
      const U = new V3().crossVectors(Math.abs(c.y) > .9 ? new V3(1, 0, 0) : new V3(0, 1, 0), c).normalize();
      this.U.push(U); this.W.push(new V3().crossVectors(c, U));
      const ang = this.centres.map((d, j) => j === i ? 9 : Math.acos(Math.min(1, Math.max(-1, c.dot(d)))));
      const nn = Math.min(...ang);
      this.R.push(Math.tan(nn / 2) * size);                       // the shape's radius, in the tangent plane
      this.ext.push(Math.tan(Math.min(.983, nn * .95)));          // how far out to lay the cloth
      this.near.push(ang.map((a, j) => [a, j]).filter(([a]) => a < Math.max(nn * 2.4, 1.2)).map(([, j]) => j));   // neighbours that shape the cell
      this.L.push(this.centres.map(d => c.distanceTo(d)));
    });
  }

  /** The margin of plate i at the unit vector (x, y, z): > 0 inside the plate (see the top of this file). */
  margin(x, y, z, i, gap) {
    const c = this.centres[i], dc = x * c.x + y * c.y + z * c.z, L = this.L[i];
    let s = 0;
    for (const j of this.near[i]) { const cj = this.centres[j]; s += Math.exp(S * (x * cj.x + y * cj.y + z * cj.z - dc) / (L[j] * K)); }
    let m = -K * Math.log(Math.max(s, 1e-300));
    if (this.shape) {
      if (dc < .05) return -1;
      const U = this.U[i], W = this.W[i], k = 1 / (dc * this.R[i]);
      const d = shapeDist(this.shape, (x * U.x + y * U.y + z * U.z) * k, (x * W.x + y * W.y + z * W.z) * k);
      m = Math.min(m, S * this.R[i] * (1 - d));           // about S x the distance in from the shape's edge
    }
    return m - gap;
  }

  /** The same for a THREE.Vector3. */
  marginAt(p, i, gap) { return this.margin(p.x, p.y, p.z, i, gap); }
}

/** GLSL: the same margin, for the barrier. Needs uCentres, uPlateShape (U, R), uPlateCount and uShape. */
export const MARGIN_GLSL = `
  float shapeDist(int shape, vec2 p){
    if (shape == 1) return length(p);
    if (shape == 7) return length(p * vec2(1., 2.1));
    float k = shape == 2 ? 3. : shape == 5 ? 5. : shape == 6 ? 6. : 4., seg = 6.28318 / k;
    float a = atan(p.y, p.x) + (shape == 4 ? .785398 : 0.) + seg * .5;
    return length(p) * cos(a - floor(a / seg) * seg - seg * .5) / cos(3.14159 / k);
  }
  float plateMargin(vec3 n, int i){
    vec3 c = uCentres[i]; float dc = dot(n, c), s = 0.;
    for (int j = 0; j < MAX_PLATES; j++) {
      if (j >= uPlateCount) break;
      if (j != i) s += exp(${S.toFixed(5)} * (dot(n, uCentres[j]) - dc) / (length(uCentres[j] - c) * ${K.toFixed(4)}));
    }
    float m = -${K.toFixed(4)} * log(max(s, 1e-30));
    if (uShape > 0) {
      if (dc < .05) return -1.;
      vec3 U = uPlateShape[i].xyz, W = cross(c, U);
      float R = uPlateShape[i].w;
      m = min(m, ${S.toFixed(5)} * R * (1. - shapeDist(uShape, vec2(dot(n, U), dot(n, W)) / (dc * R))));
    }
    return m - uGap;
  }`;
