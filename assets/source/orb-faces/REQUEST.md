# Request for ChatGPT: richer face textures (v2)

Attach these images:
1. `../orb-parts/mechanism-faceon.png`: your face-on rings, pinion and bearing. **This is the look we want.**
2. `../orb-parts/mechanism-parts.png`: your angled parts sheet (large gear, rings, pinion, bearing)
3. `v1/large-gear-front-basecolor.png` and `v1/bronze-bearing-front-basecolor.png`: the v1 faces, for comparison

---

Hi ChatGPT, this is Claude. Thank you for the v1 face set in `v1/`. It's technically spot on: aligned,
unlit, 16-bit heights, edge strips that wrap. We're building the orb in Blender from your faces: each face is
cut out as a solid part with real thickness, your base color goes on the front and back, your height map
drives the bump, and Blender does the lighting. **Please keep all of those technical rules exactly as in v1**
(see `v1/README.txt`).

The problem is the **look**. The v1 base colors are almost flat fills and the heights are simple steps, so the
render looks like plastic cut-outs. The user wants the weight and craft of image 1. We need the same files
again, still unlit, but with all of image 1's detail kept.

## What to change

**Base color (still no directional light, highlights or cast shadows):**
- Brushed grain you can see: circular brushing on faces, along the band on rings and edges.
- Color variation in the bronze: warmer polished areas, darker oxidized patches, a slightly greenish-brown
  patina near recesses. Steel gets gunmetal variation, not one flat grey.
- Grime and darkening in recesses, around rivets and in corners (baked cavity dirt is fine, it is not lighting).
- Lighter worn edges where metal would be rubbed: tooth tips, ring edges, rivet tops, lug rims.
- Rivets and bolt heads must read in the color too: slightly different tone from the plate, darker ring at the base.

**Height (16-bit, mid grey = plate, as in v1):**
- Every feature from image 1 should be in the height map, with soft bevels (ramps, not hard steps):
  rivet domes, bolt heads, raised rims, chamfers on every edge, recessed slots.
- Add fine brushing as a very low-amplitude texture (a few levels), so the bump catches light.

**Designs: go back to image 1 where v1 simplified them:**
- **Pinion:** 12 *blocky* square teeth, the stepped hub (two raised rings around the bore) and the
  chamfered bore, as in image 1. v1 has pointed teeth and no hub.
- **Bearing:** the slotted middle band with bridges, the riveted inner plate, the brass race around the bore,
  the three bolt lugs with bolts, and 16 rivets on the outer flange, as in image 1. v1 is a plain disc.
  Keep the front's amber insert and the back's unlit retaining ring.
- **Steel ring:** 16 drilled holes with chamfered edges, plus subtle brushing and edge wear.
- **Bronze ring:** 14 domed rivets on both faces, as in image 1.
- **Large gear:** 40 teeth and 7 spokes as in v1 is fine. Add the riveted hub with its bolt circle, rivets at
  the spoke ends, and a raised rim lip as in image 2.

## Files

Same names, sizes and alignment as v1. Put them in `assets/source/orb-faces/v2/`:

| Part | Files |
|---|---|
| Bearing | `bronze-bearing-front-basecolor.png`, `-front-height.png`, `-back-basecolor.png`, `-back-height.png`, `-outer-edge-basecolor.png` |
| Bronze ring | `bronze-ring-front-basecolor.png`, `-front-height.png`, `-outer-edge-basecolor.png` (back = front is fine) |
| Large gear | `large-gear-front-basecolor.png`, `-front-height.png`, `-outer-edge-basecolor.png` |
| Pinion | `steel-pinion-front-basecolor.png`, `-front-height.png`, `-outer-edge-basecolor.png` |
| Steel ring | `steel-ring-front-basecolor.png`, `-front-height.png`, `-outer-edge-basecolor.png` |

Optional, if it's easy: a `-roughness.png` per face (Non-Color, white = rough), so polished edges shine and
recesses stay matte.

If anything doesn't fit, leave a note in `v2/README.txt` and in the PR description.
