# Knot animation (Blender)

A procedural animation of Rosie's two lapels tying into a knot, starting from the idle jacket
(`assets/source/idle-to-knot/frame_01.png`) and ending close to the knotted art (`frame_16.png`).
**Status: the motion is approved (21 Nov 2026). The look (denim, stitching, lighting, collars) is not started.**
Everything renders flat-shaded in Blender's Workbench engine, only for judging the motion.

```
python tools/knot/preview.py            # collision pass + Blender front/side renders + preview videos
$env:KNOT_COLOR=1; python tools/knot/preview.py   # orange = left lapel, blue = right lapel
```

Outputs go to `tools/knot/out/` (git-ignored): `frames.npz`, `front/`, `side/`, `preview.mp4`,
`closeup_quarter_speed.mp4`. Needs Blender 5.2 (`BLENDER` env var to override the path), ffmpeg, and Python
with numpy and scipy. A full run takes about a minute.

## The knot

The **left lapel ties** and the **right lapel stays straight**. The left lapel is chosen because it already
lies on top of the right one in the idle pose, so it can start the knot without passing through it.

| Step | Frames (of 48) | What the left lapel does |
|---|---|---|
| Lift | 0–8 | Both lower halves lift and gather into folds. The left lapel crosses **over** the right one. |
| Ring | 6–12 | It curls round into a ring on the right, facing the camera so the hole is visible. |
| Under | 12–16 | It goes **behind** the right lapel's tail and comes out on the far left. This part is quick, since it's hidden. |
| Behind itself | 16–18 | It climbs up **behind its own strand**. |
| Through the gap | 17–20 | It comes forward through the gap between the two lapels, above the crossing. |
| Over itself | 20–24 | It folds down **over the front**, over its own first crossing. |
| Through the ring | 22–30 | It goes **through the ring**, front to back, and out below. This part is slow, so it reads clearly. |
| Cinch | 30–41 | The whole route shrinks toward the knot centre, and the tails come out. |
| Settle | 41–47 | A small fading wobble. |

At 30fps that is 1.6s, plus whatever hold the app adds.

## How it works

### Files

| File | What it does |
|---|---|
| `knot_geom.py` | The whole motion, as pure numpy. `frame(t)` returns the vertices of both ribbons for `t` in 0…1. |
| `sim.py` | Collision pass. It steps `frame(t)` in substeps and writes `out/frames.npz`. |
| `render_blocking.py` | Blender script: flat-shaded renders of raw or baked frames, from any yaw angle. |
| `clipcheck.py` | Finds where the *raw* motion passes cloth through cloth, by frame, kind (L-R, L-L) and position. |
| `bakecheck.py` | The same check on the baked frames. It is coarser, because it only compares whole frames. |
| `preview.py` | Runs everything above and encodes the videos. |

### Geometry: two ribbons

- Each lapel is a ribbon of 260 × 25 vertices (`NS`, `NU`) built from its idle silhouette.
- `L_ROWS`, `L_TAIL` and `R_PAIRS` are left/right edge points traced from `frame_01.png`. Units are image pixels: x right, y down, z toward the camera.
- Each ribbon has a spine (the midpoints), a half-width and a width direction, resampled by arc length `s`.
- **Fixed lines:** everything above y=450 (left lapel) and y=600 (right lapel) stays put. The collars never move.
- **Building a frame:** the spine below the fixed line is placed along a *path*, with the cloth's arc length mapped onto the path's arc length.
  - The width direction follows the path: flat in the image plane, or on edge (`hoop`) for the ring, so the hole stays open.
  - **Gather:** where the cloth is bunched, the ribbon narrows (`gK`, `gC`) and gets sine pleats.
- **Tails:** below the knot, the tails get a scarf-tail width profile, about 60px half-width tapering to a point. The right lapel's tail is narrowed to 0.45 of its body width.

### The route

The tying lapel's path is a Catmull-Rom curve through `ROUTE`: 17 points relative to the knot centre `K`.
They are drawn for a strand coming from the upper right, and mirrored in x because the left lapel ties.
The comments in `ROUTE` name each segment (A = over, ring, under, behind itself, through the gap, over itself, through).
Next to it:
- `ROUTE_HOOP`: per point, how much the width turns to face the camera.
- `_density`: how much time the tip spends on each part of the route.

The core (right lapel) path is simpler: down through the crossing `X` and out to its tail tip `T2`. It sits 30px deeper than `K`, so the tying strand clears it.

### Threading: the tip leads

- `go` (0…1) is how far the tip has travelled along the route. The cloth fills the route up to there, plus a short `SLACK` of 30px.
- **Cloth length:** there isn't enough fabric for the whole route, so the cloth is let out as the tip travels (`stretch`).
  - While threading, the left lapel's lower part ends up about 2.9× its idle length.
  - Once tightened, it's about 2.6×.
  - It doesn't read as stretching because the fabric is gathered narrow.
- **No loose tail:** this method is deliberate. Earlier versions kept the fabric length fixed and let the extra hang off the tip as a straight "tail". That tail swept through the other lapel and through the ring, which was most of the clipping.
- **Tightening:** the route shrinks toward `K` (`TIGHT` = 0.6 in x/y, 1.0 in depth). The fabric needed comes from a fixed final tail length (`TAIL`, 230px), so the tail visibly pulls out as the knot cinches.
- **Timeline** (`params(t)`):

| Parameter | Runs over (t) | What it does |
|---|---|---|
| `m` | 0–0.2 | Lift and gather |
| `go` | 0.06–0.66 | The tip travels the route |
| `tight` | 0.62–0.86 | Pull tight |
| `wob` | from 0.86 | Settle wobble |

### No clipping

There are two layers.

1. **The route is clean by design.** `clipcheck.py` steps the raw motion in 4 substeps per frame. It flags any vertex that is close to another piece of cloth and has switched sides of it since the last substep.
   - The route was adjusted until frames 0–31 report nothing.
   - **The rule that made this work:** to get from in front of a piece of cloth to behind it, the strand has to go round its edge (or through a hole) while not overlapping it on screen.
   - So every front-to-back change happens off to the side: the far-left rise, the gap above the crossing, the ring's hole.
2. **`sim.py` settles what's left.** That's mainly layers pressed together while tightening.
   - **The rule:** any two bits of cloth that overlap on screen keep the front/back order they had a moment ago, at least `GAP` (5px) apart.
   - **How it pushes:** only along z, with the push smoothed over the ribbon so it bends instead of denting.
   - **Why only z:** a first attempt that pushed along surface normals fought itself on the pleated, curved cloth and didn't converge. The screen-space rule is exactly what a viewer would notice, and the app only ever shows the front.
   - **Limit:** this pass cannot fix a route that genuinely goes through cloth. It will hold the cloth on the wrong side instead. Fix the route first.

## How we got here

Each round was a flat-shaded preview (front + side, plus a quarter-speed close-up) followed by your feedback.

| Version | What it was | Feedback | What changed |
|---|---|---|---|
| v1 | The right lapel wrapped round the left in a helix, then pulled tight | "Not really a knot. No part goes through a noose. It should do an over-under-through-the-loop thing." | Rebuilt as a real knot |
| v2 | The right lapel crosses over, tucks behind and comes up through the V. The loop was edge-on to the camera, so it was invisible, and only the thin tip went through | (my own check) | The loop now faces the camera: over, ring, under, through the ring |
| v2b | Over, ring, under, through, with the right lapel tying | "The wrong part starts at the top" | The right lapel had to pass *through* the left one at the start, because the left lies on top in idle. Mirrored so the left lapel ties |
| v3 | Left lapel ties | "After going behind, it should go over that part before going through the loop" | Added an over-pass after the under-pass |
| v4 | Over-pass across the right lapel only | "It should also go above and over itself" | The over-pass now rises above the first crossing, over both lapels |
| v5 | Above and over itself | "It's going through each other, it's clipping" | Wrote `clipcheck.py`. Found the swinging loose tail, and passes that changed depth while overlapping cloth |
| v6 | Tip-led threading, rerouted passes, depth pass | "Still minor clipping, and it no longer goes over itself" | The reroute had dropped the over-itself pass. In the tight knot the ring went flat and had no hole left |
| v7 | Over itself restored, ring stays on edge | Screenshot with the section to change marked in green: "the green part should go to the back" | The rise after the under-pass now goes behind the left lapel's own strand, through the gap above the crossing, then folds down over the front |
| v8 | **Approved** | "The animation is correct" | |

### What helped

- **Marked screenshots.** Marking the exact stretch of cloth on a frame, together with the change wanted ("this goes to the back"), was the clearest feedback by far. Over/under directions in words were easy to misread.
- **Contrasting colours.** Orange and blue made it obvious which strand was where. Two blues hid mistakes.
- **A side view** next to the front view. It showed where the cloth really was in depth, for example a tail hidden behind the other lapel versus missing.
- **Plotting the spine paths** in front and side projection, before rendering. It showed at once why the loop was invisible in v2.
- **Fixing the motion first** and leaving the look for later, as you asked. Each round took about a minute.

### What cost time

- Building a knot from vague over/under language. Asking for a marked sketch of each step up front would have been faster.
- Assuming that keeping the fabric length fixed was "more physical". It created the swinging loose tail, which caused most of the clipping. Letting the cloth out as the tip travels is a cheat, but it can't be seen.
- A general cloth-collision solver too early. The fix that worked was to make the route clean, then add a narrow, view-specific pass.

## Still open (next: the look)

- **Denim material:** indigo twill, worn pale rolled hems, orange double stitching, a pocket welt on the right lapel. UVs aren't set up yet.
  - The ribbon parameterisation gives u (across) and s (along) for free.
  - Because `stretch` changes during threading, texture mapped to `s` would slide along the cloth. Map it to `s*stretch` or freeze it at the end pose.
- **Collars:** the tops are blobby placeholders traced from rows of the idle art. They need the folded collar flaps.
- **Final knot:** it's taller and boxier than `frame_16.png`. Round off the route corners, and maybe shrink the climb through the gap in the tight pose.
- **Stretch:** up to 2.9×, which may show once there's a stitch pattern on the cloth.
- **Lighting and render:** Cycles or EEVEE with transparent film, at 1254px RGBA, to match `assets/knot/`.
- **Into the app:** export the frames as webp plus a timing json, like `assets/knot/knot.json`, and use them in `src/rosie/Knot.js`. That currently spins between the idle and knotted images.
- **ChatGPT could provide** seamless denim, hem and stitching textures in `assets/source/`. That fits its role in `AGENTS.md` better than painting each animation frame, which wouldn't stay consistent from frame to frame.
