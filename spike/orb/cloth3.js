// Denim for orb v3 (matches assets/source/armillary-reference-v2/active-orb-mockup.png):
// a wide indigo band that crosses the front of the orb on a diagonal, rising to the right, with
// its right end running round the back. At the left a second layer (the folded-under end) hangs
// below the band and flares out past the orb's edge. Coarse diagonal twill, rolled pale hems,
// double orange topstitch.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Procedural twill: diagonal ribs about 40 per unit at uv scale 1/1.6 (the supplied map is a fine
// herringbone that blurs to flat colour at this size). Returns colour and normal canvases.
function twillTextures(size = 512, period = 8) {
  const col = document.createElement('canvas'), nrm = document.createElement('canvas');
  col.width = col.height = nrm.width = nrm.height = size;
  const cx = col.getContext('2d'), nx = nrm.getContext('2d');
  const ci = cx.createImageData(size, size), ni = nx.createImageData(size, size);
  // per-rib random tone and slubs, tiled
  const ribs = size / period * 2;
  const tone = Array.from({ length: ribs }, () => Math.random());
  const H = new Float32Array(size * size);
  const noise = (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = (x + y) % size;                       // diagonal coordinate
    const rib = Math.floor(((x + 2 * y) / period)) % ribs;
    const f = ((x + 2 * y) % period) / period;       // position across one rib
    const ridge = Math.sin(f * Math.PI);             // rounded rib
    // short weft dashes along the rib (the little stepped look of a twill)
    const dash = 0.9 + 0.1 * Math.sin(((x - y + size) / period) * Math.PI * 0.5);
    const h = ridge * dash * (0.8 + 0.2 * tone[rib]) + (noise(x, y) - 0.5) * 0.08;
    H[y * size + x] = h;
    void d;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, h = H[i];
    // indigo: dark in the grooves, faded blue on the ridges, slight mottling
    const mott = 0.85 + 0.15 * Math.sin(x * 0.031 + Math.sin(y * 0.023) * 3) * Math.sin(y * 0.017);
    const k = Math.max(0, Math.min(1, h)) * mott;
    ci.data[i * 4] = 44 + 40 * k;
    ci.data[i * 4 + 1] = 66 + 56 * k;
    ci.data[i * 4 + 2] = 112 + 62 * k;
    ci.data[i * 4 + 3] = 255;
    const hx = H[y * size + ((x + 1) % size)] - H[y * size + ((x - 1 + size) % size)];
    const hy = H[((y + 1) % size) * size + x] - H[((y - 1 + size) % size) * size + x];
    const n = new THREE.Vector3(-hx * 1.6, hy * 1.6, 1).normalize();
    ni.data[i * 4] = (n.x * 0.5 + 0.5) * 255;
    ni.data[i * 4 + 1] = (n.y * 0.5 + 0.5) * 255;
    ni.data[i * 4 + 2] = (n.z * 0.5 + 0.5) * 255;
    ni.data[i * 4 + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(col), normalMap = new THREE.CanvasTexture(nrm);
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normalMap };
}

export function createDenimBand({
  texPath = './tex/', radius = 1.9, halfWidth = 0.43,
  slope = 0.47,           // screen angle of the band (radians, rising to the right)
  drop = 0.17,            // how far below centre the band crosses the front
  th0 = -1.62, th1 = 2.75, // from the left edge round the front to behind the right side
} = {}) {
  const loader = new THREE.TextureLoader();
  const stitchTex = loader.load(texPath + 'stitch-double.webp');
  stitchTex.wrapS = THREE.RepeatWrapping;
  stitchTex.wrapT = THREE.ClampToEdgeWrapping;
  stitchTex.colorSpace = THREE.SRGBColorSpace;
  stitchTex.anisotropy = 8;

  const tw = twillTextures();
  const denim = new THREE.MeshStandardMaterial({
    map: tw.map, normalMap: tw.normalMap, color: '#d8ecff', normalScale: new THREE.Vector2(0.9, 0.9),
    metalness: 0, roughness: 0.92, envMapIntensity: 0.7, side: THREE.DoubleSide,
  });
  const hemMat = denim.clone();
  hemMat.color = new THREE.Color('#dde8ff');
  const stitch = new THREE.MeshStandardMaterial({
    map: stitchTex, color: '#ffc080', transparent: true, alphaTest: 0.35, roughness: 0.7, metalness: 0,
    emissive: new THREE.Color('#ff8a1f'), emissiveIntensity: 0.7, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // ---- main band ----
  const F = new THREE.Vector3(0, -drop, 1).normalize();
  const D = new THREE.Vector3(Math.cos(slope), Math.sin(slope), 0);
  D.sub(F.clone().multiplyScalar(D.dot(F))).normalize();
  const FxD = new THREE.Vector3().crossVectors(F, D);
  const bandCenter = (s, out) => {
    const th = th0 + (th1 - th0) * s;
    const sag = 0.06 * Math.sin(th * 1.5 + 0.4);
    return out.copy(F).multiplyScalar(Math.cos(th)).addScaledVector(D, Math.sin(th)).addScaledVector(FxD, sag).normalize();
  };
  const band = {
    len: (th1 - th0) * radius,
    center: bandCenter,
    shape(s, v, t) {
      const lip = smooth(0.12, 0, s);        // 1 at the left end, where the top hem rolls outward
      const tail = smooth(0.82, 1, s);
      return {
        phi: -0.35 * lip * (v > 0 ? 1 : 0.4) + tail * 0.5 + lip * 0.06 * Math.sin(t * 1.3 + s * 7),
        w: halfWidth * (1 + 0.1 * Math.sin(s * 6 + 1) + 0.15 * lip) * (1 - 0.25 * tail),
        R: radius + 0.12 * lip * lip + 0.05 * tail
          + 0.012 * Math.sin(s * 47 + v * 2.0) + 0.012 * Math.sin(s * 21 - v * 3.2 + 1.1)
          + 0.045 * Math.sin(v * 2.2 + s * 8 + 0.6)
          + 0.035 * Math.sin(s * 15 + v * 4.0 + 0.3) * (0.6 + 0.4 * Math.sin(s * 5))
          // the top half of the band bellies out at the front, like cloth pulled over the cage
          + 0.06 * Math.exp(-((s - 0.38) ** 2) / 0.02) * (0.5 + 0.5 * v)
          + 0.015 * smooth(0.75, 1, Math.abs(v))
          // thick cloth: the middle of the band puffs out and the top hem rolls toward the viewer
          + 0.07 * (1 - v * v) + 0.05 * smooth(0.55, 1, v),
      };
    },
  };

  // ---- folded-under end: hangs below the band at the left and flares past the edge ----
  const P0 = new THREE.Vector3(-0.4, -0.38, 0.83).normalize();
  const P1 = new THREE.Vector3(-0.78, -0.62, 0.1).normalize();
  const flapCenter = (s, out) => {
    // slerp from P0 to P1, overshooting a little downward at the end
    const a = P0.angleTo(P1) * s;
    const ax = new THREE.Vector3().crossVectors(P0, P1).normalize();
    out.copy(P0).applyAxisAngle(ax, a);
    out.y -= 0.12 * s * s;
    return out.normalize();
  };
  const flap = {
    len: P0.angleTo(P1) * 2.0,
    center: flapCenter,
    shape(s, v, t) {
      const end = smooth(0.55, 1, s);
      return {
        // the free end turns over so its underside and hem face the viewer
        phi: -0.2 - 0.9 * end + 0.1 * end * Math.sin(t * 1.1 + s * 5),
        w: 0.3 * (1 + 0.35 * s),
        R: 1.86 + 0.34 * s * s + 0.03 * end * Math.sin(t * 1.5 + s * 9)
          + 0.03 * Math.sin(v * 2.5 + s * 9) + 0.012 * Math.sin(s * 31 + v * 2)
          + 0.04 * smooth(0.5, 1, -v) * end,
      };
    },
  };

  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3(), W = new THREE.Vector3();
  // position on a cloth strip at (s along, v across in [-1,1]) at time t
  function surface(cloth, s, v, t, out) {
    cloth.center(s, N);
    cloth.center(Math.min(1, s + 1e-3), A);
    cloth.center(Math.max(0, s - 1e-3), Bv);
    T.copy(A).sub(Bv).normalize();
    W.crossVectors(N, T).normalize();
    const { phi, w, R } = cloth.shape(s, v, t);
    const c = Math.cos(phi), sn = Math.sin(phi);
    return out.set(
      N.x * R + (W.x * c + N.x * sn) * v * w,
      N.y * R + (W.y * c + N.y * sn) * v * w,
      N.z * R + (W.z * c + N.z * sn) * v * w);
  }

  function makeStrip(cloth, NS, vA, vB, material, uvScale, lift) {
    const NV = 14, count = (NS + 1) * (NV + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NV; j++) {
      const k = i * (NV + 1) + j;
      uv[k * 2] = (i / NS) * cloth.len * uvScale.u;
      uv[k * 2 + 1] = (j / NV) * uvScale.v;
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    const p = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3(), nn = new THREE.Vector3();
    const update = (t) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i <= NS; i++) for (let j = 0; j <= NV; j++) {
        const k = (i * (NV + 1) + j) * 3, s = i / NS, v = vA + ((vB - vA) * j) / NV;
        surface(cloth, s, v, t, p);
        if (lift) {
          // push along the cloth's own normal so the stitching stays on its face
          surface(cloth, Math.min(1, s + 0.004), v, t, p2).sub(p);
          surface(cloth, s, Math.min(1, v + 0.02), t, p3).sub(p);
          nn.crossVectors(p2, p3).normalize();
          p.addScaledVector(nn, lift);
        }
        pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };
    return { mesh, update };
  }

  // Rolled hem: a fat, slightly flattened tube along an edge.
  function makeHem(cloth, NS, sign, r = 0.045) {
    const NA = 10, count = (NS + 1) * (NA + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i <= NS; i++) for (let k = 0; k <= NA; k++) {
      const n = i * (NA + 1) + k;
      uv[n * 2] = (i / NS) * cloth.len / 1.6;
      uv[n * 2 + 1] = (k / NA) * 0.12;
    }
    for (let i = 0; i < NS; i++) for (let k = 0; k < NA; k++) {
      const a = i * (NA + 1) + k, b = a + 1, c = a + NA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, hemMat);
    mesh.frustumCulled = false;
    const E = new THREE.Vector3(), I = new THREE.Vector3(), S = new THREE.Vector3(), across = new THREE.Vector3(), up = new THREE.Vector3();
    const update = (t) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i <= NS; i++) {
        const s = i / NS;
        surface(cloth, s, sign, t, E);
        surface(cloth, s, sign * 0.85, t, I);
        surface(cloth, Math.min(1, s + 0.004), sign, t, S).sub(E);
        across.copy(E).sub(I).normalize();
        up.crossVectors(S, across).normalize().multiplyScalar(sign);
        for (let k = 0; k <= NA; k++) {
          const ang = (k / NA) * Math.PI * 2, n = (i * (NA + 1) + k) * 3;
          const a = Math.cos(ang) * r - r * 0.5, b = Math.sin(ang) * r * 0.75;
          pos[n] = E.x + across.x * a + up.x * b;
          pos[n + 1] = E.y + across.y * a + up.y * b;
          pos[n + 2] = E.z + across.z * a + up.z * b;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };
    return { mesh, update };
  }

  const parts = [];
  const group = new THREE.Group();
  for (const [cloth, NS, wv] of [[band, 150, halfWidth * 2], [flap, 60, 0.7]]) {
    const uvs = { u: 1 / 1.6, v: wv / 1.6 };
    parts.push(
      makeStrip(cloth, NS, -1, 1, denim, uvs, 0),
      makeStrip(cloth, NS, -0.92, -0.66, stitch, { u: 1 / 0.45, v: 1 }, 0.007),
      makeStrip(cloth, NS, 0.66, 0.92, stitch, { u: 1 / 0.45, v: 1 }, 0.007),
      makeHem(cloth, NS, -1), makeHem(cloth, NS, 1));
  }
  for (const p of parts) group.add(p.mesh);
  const update = (t) => { for (const p of parts) p.update(t); };
  update(0);
  return { group, update };
}
