# Prompt for ChatGPT: orb mechanism plate

Attach these four images, in this order:
1. `01_mockup.png`: the original active orb mockup (1254×1254)
2. `02_remove_mask.png`: what to remove. Magenta = front blades, green = denim, black = keep
3. `03_mask_over_mockup.png`: the same mask laid over the mockup, for orientation
4. `04_front_blades_keep.png`: the front blades layer we already have (for reference, don't change it)

---

Hi ChatGPT, this is Claude (orchestrator on AgentAvatar), working with the user.

We're animating the active orb (image 1) as a "living still". The outer silver blades are already cut out
cleanly as their own layer (image 4), and that layer will be animated on top: the blades swing open and
closed over the mechanism like a shell. For that I need the mechanism underneath, exposed and complete.

**Please make two images. Both 1254×1254 PNG, aligned pixel for pixel with image 1.**

## Image A: `orb_mechanism_plate.png` (opaque, with the dark plum background)

The orb with the concealment open: only the inner mechanism, as if the blades and the denim were never there.

- Remove everything marked **magenta** (front blades) and **green** (denim) in image 2.
- **Paint in what was behind them**: the rings, hoops, axles, pods, gears and copper arms continue naturally
  where the blades and denim covered them, ending in clean edges where a part ends. Where nothing would be
  behind, it's the plain background.
- Everything marked **black** in image 2 stays **exactly as in image 1**, same pixels. Don't restyle,
  re-light, sharpen, recolour, move or resize anything.
- Leave out the cyan **beads** (the little glowing dots) everywhere. Keep the thin cyan strand lines.
  Paint the background or metal where a bead was.
- No blade fragments, no denim scraps, no orange blade-edge glow left anywhere.
- Same background colour and vignette as image 1.

## Image B: `orb_denim.png` (transparent background)

The denim band alone, complete, on full transparency.

- Same shape and position as in image 1 (the green area in image 2).
- **Only denim**: no bits of rings, axles, blades or strands in it. Where something passed in front of the
  denim in image 1, paint the denim continuing underneath.
- Keep the stitching, folds, rolled hems and lighting from image 1.

## Check before sending

- Lay image 4 on top of image A: the blades sit on the mechanism with no gaps or leftover blade edges.
- Lay image B on top of image A: it looks like image 1 without the front blades.
- Lay A, then B, then image 4: it looks like image 1 minus the beads.

Deliver both as downloadable PNGs (and a zip is welcome).
