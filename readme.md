# Rosie — AI presence console

Open `index.html` through a local server (ES modules don't load from `file://`):

```
python tools/serve.py
```

(`python -m http.server 8765` works too, but the browser may keep old copies of the modules after you change them.)

then go to http://localhost:8765.

## Layout

The latest version is the particle orb over the scarf, in `index.html` + `src/` + `styles/`. Every earlier version is in `versions/`.

| Folder | What's in it |
|---|---|
| `index.html` | Page markup: the canvas and the Tune panel's frame |
| `styles/` | `base.css` (page and stage), `panel.css` (Tune panel) |
| `src/main.js` | Entry point: wires the orb, its input and the panel together; exposes `window.rosieOrb` for capture and testing |
| `src/rosie/` | The particle orb (three.js from unpkg). See below |
| `src/ui/` | The Tune panel: `controls.js` lists every control (label, range, how its value reads), `panel.js` builds and wires them |
| `assets/base/` | Scarf base images (`scarf-unlit`, `-lit`, `-bright`, `-normal`, `-reach`) built from `assets/source/rosie-scarf-*.png` |
| `assets/` | Also the jacket artwork used by `versions/presence-console/` (`atlas.webp`, `depth.webp`, `bounds.bin`, `poses.json`, `knot/`, `scarf/`, `hoodie/`) |
| `assets/source/` | Inputs for the builds: ChatGPT's artwork, masks and poses |
| `tools/build_poses.py` | Rebuilds the jacket assets from `assets/source/` (`python tools/build_poses.py [scale] [centreY]`) |
| `tools/scarf_normals.py` | Builds the scarf normal map |
| `tools/knot/` | Blender knot animation (motion approved, look not started). See [tools/knot/README.md](tools/knot/README.md) |
| `tools/orb/` | Blender builds of the armillary orb (renders go to `tools/orb/out/`, not committed) |
| `versions/` | Every earlier and experimental version. Open `versions/index.html` for the overview |
| `versions/presence-console/` | The previous modular jacket console (its own `index.html`, `src/`, `styles/`) |

## The particle orb, file by file

| File | What it does |
|---|---|
| `src/rosie/config.js` | Layout, the presets for Off / Idle / Working, build settings, `tempoOf` |
| `src/rosie/settings.js` | `Settings`: presets, build settings and live values, saved in the browser |
| `src/rosie/Orb.js` | `Orb`: renderer, scene graph and the frame loop; the order of the render passes |
| `src/rosie/parts/` | The particle layers: `shell.js` (plates, hems, stitches), `core.js` (spiral and heart), `dust.js` (halo and sparks), `swirls.js`, `ribbons.js` (ribbons and swirl dust) |
| `src/rosie/sprites.js` | The shared glowing point sprite, common uniforms, geometry helpers, seeded random |
| `src/rosie/rays.js` | Light shafts through the gaps and off the hems |
| `src/rosie/lightBuffer.js` | The orb drawn small, so the scarf can be lit by it |
| `src/rosie/scarf.js` | The background and scarf pass (painted or lit in code) |
| `src/rosie/motion.js` | Breathing, the tap pulse and random boosts |
| `src/rosie/input.js` | Drag to turn, tap to greet |

To add a slider: add its default to `DEFAULTS` (per state) or `TUNE_DEFAULTS` (shared) in `config.js`, add a line to `src/ui/controls.js`, and read it from `live` (or `tune`) where it's used.

## Using the presence console in an app

The jacket console keeps its API in `versions/presence-console/src/rosie/`:

```js
import { Rosie } from './versions/presence-console/src/rosie/Rosie.js';
const rosie = await Rosie.create(canvas);
rosie.setState('working');   // 'off' | 'idle' | 'working'
rosie.setIntensity(.4);      // intensity 0…1 (setLevel still works)
rosie.pause(); rosie.resume(); rosie.destroy();
```

## Live version

Every push to `main` is published by `.github/workflows/pages.yml` to the `gh-pages` branch, which GitHub Pages serves at https://ayazis.github.io/AgentAvatar/. Only the runtime files go out (`index.html`, `src/`, `styles/`, `versions/`, `assets/` without `assets/source/`). Don't push to `gh-pages` by hand; it is overwritten on each deploy.
