// Denim band for orb v3 (matches assets/source/armillary-reference-v2/active-orb-mockup.png):
// a wide indigo band that crosses the front of the orb on a diagonal, rising to the right.
// The right end runs round the back; the left end flares outward past the left edge and turns
// over so its underside and hem show. Rolled hems with double orange topstitch on both edges.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createDenimBand({
  texPath = './tex/', radius = 1.92, halfWidth = 0.36,
  slope = 0.42,          // screen angle of the band (radians, rising to the right)
  drop = 0.2,            // how far below centre the band crosses the front
  th0 = -1.95, th1 = 3.1, // from the left end (front-left) round the front to behind the right side
} = {}) {
  const loader = new THREE.TextureLoader();
  const load = (name, srgb = false) => {
    const t = loader.load(texPath + name + '.webp');
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const stitchTex = load('stitch-double', true);
  stitchTex.wrapT = THREE.ClampToEdgeWrapping;

  const denim = new THREE.MeshStandardMaterial({
    map: load('denim-color', true), normalMap: load('denim-normal'), roughnessMap: load('denim-rough'),
    color: '#5f9ee6', normalScale: new THREE.Vector2(2.0, 2.0), metalness: 0, roughness: 1, envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const hemMat = denim.clone();
  hemMat.color = new THREE.Color('#7db0e8');
  const stitch = new THREE.MeshStandardMaterial({
    map: stitchTex, color: '#ffb070', transparent: true, alphaTest: 0.35, roughness: 0.7, metalness: 0,
    emissive: new THREE.Color('#ff8a1f'), emissiveIntensity: 0.55, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // The band's plane: F points at the camera (dipped a little so the band crosses below centre),
  // D runs along the band on screen. th = 0 is the front, -pi/2 the left edge, +pi/2 the right edge.
  const F = new THREE.Vector3(0, -drop, 1).normalize();
  const D = new THREE.Vector3(Math.cos(slope), Math.sin(slope), 0);
  D.sub(F.clone().multiplyScalar(D.dot(F))).normalize();
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3(), W = new THREE.Vector3();
  const center = (s, out) => {
    const th = th0 + (th1 - th0) * s;
    // a soft sag so the band hangs instead of following a perfect circle
    const sag = 0.06 * Math.sin(th * 1.5 + 0.4);
    out.copy(F).multiplyScalar(Math.cos(th)).addScaledVector(D, Math.sin(th));
    out.addScaledVector(new THREE.Vector3().crossVectors(F, D), sag).normalize();
    return out;
  };

  // position on the band at (s along, v across in [-1,1]) at time t
  function surface(s, v, t, out) {
    center(s, N);
    center(Math.min(1, s + 1e-3), A);
    center(Math.max(0, s - 1e-3), Bv);
    T.copy(A).sub(Bv).normalize();
    W.crossVectors(N, T).normalize();
    const flap = smooth(0.2, 0, s);          // 1 at the left (front) end
    const tail = smooth(0.82, 1, s);         // 1 at the hidden right end
    // the left end turns over (shows its underside) and lifts away from the orb
    const phi = -flap * 0.8 + flap * 0.12 * Math.sin(t * 1.3 + s * 7) + tail * 0.5;
    const c = Math.cos(phi), sn = Math.sin(phi);
    const w = halfWidth * (1 + 0.12 * Math.sin(s * 6 + 1) + 0.18 * flap) * (1 - 0.25 * tail);
    let R = radius + 0.2 * flap * flap + 0.05 * tail + flap * 0.03 * Math.sin(t * 1.6 + s * 11);
    R += 0.02 * Math.sin(s * 47 + v * 2.0) + 0.018 * Math.sin(s * 21 - v * 3.2 + 1.1)          // ripples
      + 0.05 * Math.sin(v * 2.2 + s * 8 + 0.6) * (0.5 + flap)                                   // soft folds
      + 0.04 * Math.sin(s * 17 + v * 4.5 + 0.3) * (0.6 + 0.4 * Math.sin(s * 5))             // diagonal drape
      + 0.05 * Math.exp(-((s - 0.42) ** 2) / 0.004) * (0.5 + 0.5 * v)                          // crease at the front
      + 0.012 * smooth(0.8, 1, Math.abs(v));                                                    // hem lift
    return out.set(
      N.x * R + (W.x * c + N.x * sn) * v * w,
      N.y * R + (W.y * c + N.y * sn) * v * w,
      N.z * R + (W.z * c + N.z * sn) * v * w);
  }

  const NS = 140, NV = 14;
  const arcLen = (th1 - th0) * radius;
  function makeStrip(vA, vB, material, uvScale, lift) {
    const count = (NS + 1) * (NV + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NV; j++) {
      const k = i * (NV + 1) + j;
      uv[k * 2] = (i / NS) * arcLen * uvScale.u;
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
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    const update = (t) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i <= NS; i++) for (let j = 0; j <= NV; j++) {
        const k = (i * (NV + 1) + j) * 3;
        surface(i / NS, vA + ((vB - vA) * j) / NV, t, p);
        if (lift) {
          // push along the local surface normal, not radially, so the stitching stays on the cloth
          surface(i / NS, 0, t, q);
          p.addScaledVector(q.normalize(), lift);
        }
        pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };
    return { mesh, update };
  }

  // Rolled hem: a fat tube along each edge, the thick folded-over edge of the band.
  function makeHem(sign) {
    const NA = 8, r = 0.03, count = (NS + 1) * (NA + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i <= NS; i++) for (let k = 0; k <= NA; k++) {
      const n = i * (NA + 1) + k;
      uv[n * 2] = (i / NS) * arcLen / 0.55;
      uv[n * 2 + 1] = (k / NA) * 0.3;
    }
    for (let i = 0; i < NS; i++) for (let k = 0; k < NA; k++) {
      const a = i * (NA + 1) + k, b = a + 1, c = a + NA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, hemMat);
    mesh.frustumCulled = false;
    const E = new THREE.Vector3(), I = new THREE.Vector3(), across = new THREE.Vector3(), up = new THREE.Vector3();
    const C0 = new THREE.Vector3();
    const update = (t) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i <= NS; i++) {
        surface(i / NS, sign, t, E);
        surface(i / NS, sign * 0.85, t, I);
        surface(i / NS, 0, t, C0);
        across.copy(E).sub(I).normalize();
        up.copy(C0).normalize();
        up.sub(across.clone().multiplyScalar(up.dot(across))).normalize();
        for (let k = 0; k <= NA; k++) {
          const ang = (k / NA) * Math.PI * 2, n = (i * (NA + 1) + k) * 3;
          const a = Math.cos(ang) * r - r * 0.4, b = Math.sin(ang) * r * 0.8;
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

  const bandW = halfWidth * 2;
  const main = makeStrip(-1, 1, denim, { u: 1 / 0.5, v: bandW / 0.5 }, 0);
  const edgeL = makeStrip(-0.93, -0.66, stitch, { u: 1 / 0.45, v: 1 }, 0.006);
  const edgeR = makeStrip(0.66, 0.93, stitch, { u: 1 / 0.45, v: 1 }, 0.006);
  const hemL = makeHem(-1), hemR = makeHem(1);
  const group = new THREE.Group();
  group.add(main.mesh, edgeL.mesh, edgeR.mesh, hemL.mesh, hemR.mesh);

  const parts = [main, edgeL, edgeR, hemL, hemR];
  const update = (t) => { for (const p of parts) p.update(t); };
  update(0);
  return { group, update };
}
