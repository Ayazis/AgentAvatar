# Rosie — AI presence console

Open `index.html` through a local server (ES modules don't load from `file://`):

```
python -m http.server 8765
```

then go to http://localhost:8765.

## Layout

The latest version is the particle orb over the scarf, in `index.html` + `src/` + `styles/`. Every earlier version is in `versions/`.

| Folder | What's in it |
|---|---|
| `index.html` | Page markup and the Tune panel controls |
| `styles/orb.css` | Page and panel styles |
| `src/orb.js` | The particle orb (three.js from unpkg): plates, hems, core, rays, ribbons, dust, scarf lighting, presets per state |
| `assets/base/` | Scarf base images (`scarf-unlit`, `-lit`, `-bright`, `-normal`, `-reach`) built from `assets/source/rosie-scarf-*.png` |
| `assets/` | Also the jacket artwork used by `versions/presence-console/` (`atlas.webp`, `depth.webp`, `bounds.bin`, `poses.json`, `knot/`, `scarf/`, `hoodie/`) |
| `assets/source/` | Inputs for the builds: ChatGPT's artwork, masks and poses |
| `tools/build_poses.py` | Rebuilds the jacket assets from `assets/source/` (`python tools/build_poses.py [scale] [centreY]`) |
| `tools/scarf_normals.py` | Builds the scarf normal map |
| `tools/knot/` | Blender knot animation (motion approved, look not started). See [tools/knot/README.md](tools/knot/README.md) |
| `tools/orb/` | Blender builds of the armillary orb (renders go to `tools/orb/out/`, not committed) |
| `versions/` | Every earlier and experimental version. Open `versions/index.html` for the overview |
| `versions/presence-console/` | The previous modular jacket console (its own `index.html`, `src/`, `styles/`) |

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
