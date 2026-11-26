# Prompt for ChatGPT: inner core layer

Attach these four images, in this order:
1. `01_mockup.png`: the original active orb mockup (1254×1254)
2. `02_core_closeup.png`: close-up of the core in the mockup (style reference)
3. `03_core_placement.png`: the mockup with a green circle where the core goes
4. `04_outer_shell_done.png`: the outer shell layer we already have

---

Hi ChatGPT, this is Claude, the orchestrator on AgentAvatar, working with the user. Before the request itself,
here is what we are building and where your image fits, because the last two attempts failed on exactly that.

## What we are building

Image 1 is the look we want for the avatar's **active state**: an armillary orb that is visibly working.
It will run in the browser (three.js / canvas) as a looping animation, at around 300–600px on screen.

We tried two ways to get there, and both failed:
- **Full 3D** (three.js and Blender): everything moves properly, but it looks like a generic 3D render, not like image 1.
- **Cutting image 1 into layers**: it looks exactly right, but the layers can't move. Wherever parts overlapped
  in the painting, pieces of one part stay baked into another, and the filled-in areas became a tangle
  of extra metalwork.

So the new plan **splits the work by what each method is good at**:

| Part | Made by | How it moves |
|---|---|---|
| Outer shell: the 5 silver blades | **Painted**, already done (image 4, cut from image 1, perfect) | Opens and closes around the orb, sways slightly |
| **Inner core**: the clockwork heart | **Painted, this request** | Breathes, its glow pulses, it turns slowly as a whole |
| Rings and hoops | Code (3D) | Spin on their own axes through and around the core |
| Axles, pods, cyan strands, beads | Code | Spin, glow, beads run along the strands |
| Denim band | Code / separate later | Ripples |
| Bloom, glow haze, background | Code | – |

The final frame is built from back to front: **background (code) → back halves of the rings (code) → your core →
front halves of the rings, axles, strands (code) → denim → blade shell (image 4)**.
Rings and shafts are drawn in code **in front of and behind** your core. If your core already contains any
ring, shaft or glowing line, it will clash with the moving ones drawn by code, which is why it must contain
only the core itself.

## What I need from you: `orb_inner_core.png`

**A single, simple, self-contained object: the clockwork heart of the orb, and nothing else.**

- **Content:** a compact cluster of concentric copper/bronze gears and filigree around a hot glowing orange centre,
  in the style, materials and lighting of image 2. Seen at a slight 3/4 tilt, like the mockup.
- **Keep it simple and readable.** It will be small on screen and has to read as "glowing clockwork heart" at a glance.
  Fewer, bolder gears beat dense detail. No long arms, spokes or parts reaching outward.
- **Complete and closed:** a roughly round object with a clean outer edge. Nothing cut off at the edge, nothing
  running out of it, nothing that looks like it continues behind something else. Imagine the core taken out of the
  orb and photographed on its own.
- **Not included:** rings or hoops, axles or shafts, pods, cyan lines or dots, denim, blades, background colour.
  We add all of those.
- **Glow:** the orange centre glows, but the light stays **inside** the object. No haze or bloom spreading past the
  core's edge (we add bloom in code, and baked-in haze makes a visible square or halo).
- **Canvas:** 1254×1254 PNG with a **fully transparent background** (alpha 0 outside the object, soft anti-aliased edge),
  so it drops straight into the same coordinate frame as image 1 and image 4.
- **Placement:** centred in the green circle of image 3, centre about x=610, y=520, diameter about 340px.

## Why these rules matter (please don't bend them)

- Transparent background and exact placement: your PNG is stacked directly under image 4 with no adjustment.
- Nothing but the core: anything extra gets in the way of the parts drawn in code and can't be removed afterwards.
- Simple, closed shape: the core turns slowly as a whole, so it has to look right at any angle of that turn,
  with no edge that looks cut.

## Check before sending

- Lay it over a dark plum background (#16010f): it reads as the mockup's core, taken out on its own.
- Lay image 4 on top: the core sits in the middle of the shell, clear of the blades.
- Alpha is 0 everywhere outside the object. No square, haze or leftover background.

Deliver it as a downloadable PNG. Don't push to git; the user will bring it over.
If anything in this plan seems wrong to you, or a different split would work better, say so before generating.
