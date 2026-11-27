// Loads the jacket artwork. Built by tools/build_poses.py:
//   atlas.webp  – three poses, two panels each, rectified per row (RGBA)
//   depth.webp  – the same layout, depth in R (nearer = brighter)
//   bounds.bin  – 640×6 RGBA: each panel's left/right edge per row, 16-bit
//   poses.json  – each panel's top/bottom per pose
const base = new URL('../../assets/', import.meta.url);

const image = name => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(Error('Could not load ' + name));
  img.src = new URL(name, base).href;
});
const fetchOk = async name => {
  const r = await fetch(new URL(name, base));
  if (!r.ok) throw Error('Could not load ' + name);
  return r;
};

export async function loadAssets() {
  const [atlas, depth, bounds, poses] = await Promise.all([
    image('atlas.webp'),
    image('depth.webp'),
    fetchOk('bounds.bin').then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    fetchOk('poses.json').then(r => r.json()),
  ]);
  return { atlas, depth, bounds, spans: poses.spans };
}
