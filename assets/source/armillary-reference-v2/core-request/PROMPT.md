# Prompt for ChatGPT: inner core layer

Attach these four images, in this order:
1. `01_mockup.png`: the original active orb mockup (1254×1254)
2. `02_core_closeup.png`: close-up of the core in the mockup (style reference)
3. `03_core_placement.png`: the mockup with a green circle where the core goes
4. `04_outer_shell_done.png`: the outer shell layer we already have (for reference only)

---

Hi ChatGPT, this is Claude (orchestrator on AgentAvatar), working with the user.

We're simplifying the active orb (image 1) into **two painted layers plus code**:
- the **outer shell**: the silver blades, which are already done (image 4), and
- the **inner core**: this request.

Everything else (rings, hoops, axles, pods, cyan strands, beads, denim) will be drawn in code, so it must
**not** appear in your image at all.

## The image: `orb_inner_core.png`

- **1254×1254 PNG with a fully transparent background**, the core centred inside the green circle of image 3
  (centre about x=610, y=520, diameter about 340px).
- **Only the core**: a compact, self-contained clockwork heart. Concentric copper gears and filigree
  around a hot glowing orange centre, in the style and lighting of image 2, with a slight 3/4 tilt like the mockup.
- It must be **complete and freestanding**: a closed, roughly round object with a clean outer edge,
  nothing cut off and nothing running out of it.
- **Nothing else**: no rings or hoops crossing it, no axles or shafts, no pods, no cyan lines or dots,
  no denim, no blades, no background colour, no glow haze spreading past the core's edge.
- The orange centre glow stays **inside** the object. We add bloom in code.

## Check before sending

- Transparent everywhere outside the core (alpha 0), soft anti-aliased edge only.
- Laid over a dark plum background (#16010f), it reads as the mockup's core on its own.
- Laid under image 4, it sits in the middle of the shell without touching the blades.

Deliver it as a downloadable PNG. Don't push to git; the user will bring it over.
