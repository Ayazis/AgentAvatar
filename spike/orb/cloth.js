// Denim band that wraps diagonally around the orb, with rolled hems, ripples, double topstitch
// and two free ends that lift, curl and flutter. Procedural surface, recomputed every frame.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createDenimBand({ texPath = './tex/', radius = 1.52, halfWidth = 0.27, arc = 5.1, start = 0.4 } = {}) {
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
    normalScale: new THREE.Vector2(1.3, 1.3), metalness: 0, roughness: 1, envMapIntensity: 1.8, side: THREE.DoubleSide,
  });
  const stitch = new THREE.MeshStandardMaterial({
    map: stitchTex, transparent: true, alphaTest: 0.35, roughness: 0.8, metalness: 0,
    emissive: new THREE.Color('#ff8a1f'), emissiveIntensity: 0.3, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // centre line on the unit sphere: a tilted loop that rises and falls so the band wraps diagonally
  const lat = (th) => 0.38 * Math.sin(th + 0.9) + 0.12 * Math.sin(2 * th);
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3(), W = new THREE.Vector3();
  const center = (s, out) => {
    const th = start + arc * s, la = lat(th);
    return out.set(Math.cos(th) * Math.cos(la), Math.sin(la), Math.sin(th) * Math.cos(la));
  };

  // position on the band at (s along, v across in [-1,1]) at time t
  function surface(s, v, t, out) {
    center(s, N);
    center(Math.min(1, s + 1e-3), A);
    center(Math.max(0, s - 1e-3), Bv);
    T.copy(A).sub(Bv).normalize();
    W.crossVectors(N, T).normalize();
    const endK = Math.max(smooth(0.16, 0, s), smooth(0.84, 1, s));      // 1 at the free ends
    const side = s < 0.5 ? -1 : 1;
    const phi = side * endK * 1.1 + endK * 0.32 * Math.sin(t * 1.7 + s * 9);  // ends curl and sway
    const c = Math.cos(phi), sn = Math.sin(phi);
    const w = halfWidth * (1 - 0.15 * endK);
    let R = radius + 0.2 * endK * endK + endK * 0.045 * Math.sin(t * 2.0 + s * 14);
    R += 0.011 * Math.sin(s * 60 + v * 2.0) + 0.009 * Math.sin(s * 23 - v * 3.2 + 1.1)       // ripples
      + 0.012 * Math.sin(v * 2.4 + s * 9) * (0.4 + endK)                                     // soft folds
      + 0.013 * smooth(0.8, 1, Math.abs(v));                                                  // rolled hem
    return out.set(
      N.x * R + (W.x * c + N.x * sn) * v * w,
      N.y * R + (W.y * c + N.y * sn) * v * w,
      N.z * R + (W.z * c + N.z * sn) * v * w);
  }

  const NS = 130, NV = 14;
  function makeStrip(vA, vB, material, uvScale, lift, computeNormals = false) {
    const count = (NS + 1) * (NV + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NV; j++) {
      const k = i * (NV + 1) + j;
      uv[k * 2] = (i / NS) * arc * radius * uvScale.u;
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
    const p = new THREE.Vector3();
    const nrm = geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3)).attributes.normal.array;
    const update = (t) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i <= NS; i++) for (let j = 0; j <= NV; j++) {
        const k = (i * (NV + 1) + j) * 3;
        surface(i / NS, vA + ((vB - vA) * j) / NV, t, p);
        if (lift) p.multiplyScalar(1 + lift / p.length());
        pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
        if (!computeNormals) { const l = 1 / p.length(); nrm[k] = p.x * l; nrm[k + 1] = p.y * l; nrm[k + 2] = p.z * l; }
      }
      geo.attributes.position.needsUpdate = true;
      if (computeNormals) geo.computeVertexNormals(); else geo.attributes.normal.needsUpdate = true;
    };
    return { mesh, update };
  }

  const bandW = halfWidth * 2;
  const main = makeStrip(-1, 1, denim, { u: 1 / 0.55, v: bandW / 0.55 }, 0, true);
  const edgeL = makeStrip(-0.95, -0.68, stitch, { u: 1 / 0.5, v: 1 }, 0.004);
  const edgeR = makeStrip(0.68, 0.95, stitch, { u: 1 / 0.5, v: 1 }, 0.004);
  const group = new THREE.Group();
  group.add(main.mesh, edgeL.mesh, edgeR.mesh);
  group.rotation.set(0.45, 0.2, 0.25);

  const update = (t) => { main.update(t); edgeL.update(t); edgeR.update(t); };
  update(0);
  return { group, update };
}
