# Rosie — AI presence console

Open `index.html` through a local server (ES modules don't load from `file://`):

```
python -m http.server 8765
```

then go to http://localhost:8765.

## Layout

| Folder | What's in it |
|---|---|
| `index.html` | Page markup only |
| `styles/` | `base`, `layout`, `stage`, `controls`, `tune`, `switch` CSS |
| `assets/` | Built jacket artwork: `atlas.webp`, `depth.webp`, `bounds.bin`, `poses.json` |
| `assets/source/` | Inputs for the build: our Working art + masks, ChatGPT's Off/Idle poses |
| `src/main.js` | Wires Rosie to the page |
| `src/rosie/` | The avatar: `Rosie` (frame loop, public API), `ScenePass`, `StateGlide`, `Breath`, `Input`, `assets`, `gl`, `config` (presets, budgets) |
| `src/rosie/shaders/` | GLSL as JS strings: `quad.vert`, `noise`, `jacket` (pose morph), `silkRing`, `scene.frag`, `particles` |
| `src/rosie/particles/` | `Orb`, `Dust`, `Ribbons`, and `ParticleLayer` that draws them |
| `src/ui/` | `StateBar`, `IntensitySlider`, and `tune/` (`TunePanel`, `controls`, `groups`, `storage`) |
| `tools/build_poses.py` | Rebuilds `assets/` from `assets/source/` (`python tools/build_poses.py [scale] [centreY]`) |
| `tools/knot/` | Blender knot animation (motion approved, look not started). See [tools/knot/README.md](tools/knot/README.md) |
| `versions/` | Every earlier and experimental version (jackets, procedural, three.js orbs, 2.5D orb, SVG fold). Open `versions/index.html` for the overview |
| `tools/orb/` | Blender builds of the armillary orb (renders go to `tools/orb/out/`, not committed) |

## Using Rosie in an app

```js
import { Rosie } from './src/rosie/Rosie.js';
const rosie = await Rosie.create(canvas);
rosie.setState('working');   // 'off' | 'idle' | 'working'
rosie.setIntensity(.4);      // intensity 0…1 (setLevel still works)
rosie.pause(); rosie.resume(); rosie.destroy();
```

## Live version

Every push to `main` is published by `.github/workflows/pages.yml` to the `gh-pages` branch, which GitHub Pages serves at https://ayazis.github.io/AgentAvatar/. Only the runtime files go out (`index.html`, `src/`, `styles/`, `assets/` without `assets/source/`). Don't push to `gh-pages` by hand; it is overwritten on each deploy.
