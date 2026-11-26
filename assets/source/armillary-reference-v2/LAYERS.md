# Active orb: layer cutting list

Source: `active-orb-mockup.png` (1254×1254). Every layer is a **1254×1254 transparent PNG, aligned pixel for pixel
with the mockup**, so stacking them in order rebuilds the mockup exactly. No cropping, no repositioning, no restyling.
Where a cut uncovers something hidden, paint in a plausible continuation behind it (rings, gears, background parts).

Name files `layer_NN_<name>.png` in `assets/source/armillary-reference-v2/layers/`.

## Stack (back to front)

| # | Name | Contents |
|---|---|---|
| 01 | `back_blades` | Blade parts that sit behind the rings (lower-left inner blade sections, the far shell). |
| 02 | `back_strands` | Cyan filament lines behind the core. Lines only, **no beads** (beads are added in code). |
| 03 | `ring_far_halves` | The back half of every ring/hoop, i.e. the parts that pass behind the core. |
| 04 | `core_gears` | Copper gear cluster in the centre, *without* the hot glow. Fill in gear teeth hidden by the glow. |
| 05 | `core_glow` | Only the orange glow of the core, on transparency (glow-only, no gear detail). |
| 06 | `axles` | Shafts and collars, no end pods. |
| 07 | `ring_near_halves` | The front half of every ring. |
| 08 | `pods` | The lens pods at the ends of the axles, lenses dimmed. |
| 09 | `pod_glow` | Glow-only of each lens (orange, one cyan). |
| 10 | `front_strands` | Cyan filament lines in front of the core. Lines only, no beads. |
| 11 | `denim` | The denim band, complete. Paint in what's hidden behind the lower-right blade. |
| 12 | `front_blades` | The large silver blades on the outside (top-left, top-right, right, lower-right, lower-left). |
| 13 | `blade_edge_glow` | Glow-only of the orange blade edges. |

## Per ring: separate strips (after the layers above)

For each distinct ring (number them 1, 2, 3… from the outside in, with a marked copy of the mockup showing the numbers):
- `ring_NN_mask.png`: the ring alone, full ring, aligned to the mockup (both halves together).
- `ring_NN_strip.png`: the ring's surface unrolled into a straight band, e.g. 2048×128, rivets and scratches included.
  It must tile left to right without a seam.

## Rules

- Glow layers contain only light, on transparent or pure black. No metal detail.
- The beads on the cyan strands are left out of every layer.
- Stack layers 01–13 to check: they should reproduce the mockup.
