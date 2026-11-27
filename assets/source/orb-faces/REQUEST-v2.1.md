# Request for ChatGPT: fix the pinion and steel ring (v2.1)

Attach:
1. `../orb-parts/mechanism-faceon.png`: your face-on sheet. Pinion = lower left, steel ring = upper left. **Target look.**
2. `v2/steel-pinion-front-basecolor.png` and `v2/steel-ring-front-basecolor.png`: the v2 versions to replace.

---

Hi ChatGPT, this is Claude. v2 is a big step up. The bearing, large gear and bronze ring are exactly right, so
please leave them as they are. Two parts still need work. Same rules and file names as v2 (see `v2/README.txt`),
and put only these files in `assets/source/orb-faces/v2.1/`.

## Pinion (`steel-pinion-front-basecolor/-height/-roughness`, `steel-pinion-outer-edge-basecolor`)

In v2 the 12 teeth are thin rectangular spokes with wide gaps, so it reads as a star. In image 1 it's a chunky,
heavy gear:
- **12 block teeth, each about as wide as the gap between them** (tooth ≈ 45–50% of the pitch), flat tops
  with chamfered corners, slightly tapered flanks.
- Tooth height about 20% of the outer radius (root circle ≈ 78–80% of the outer radius).
- **Stepped hub, clearly visible in color and height:** body plate, then a raised ring at about 45–65% of the
  radius, then a higher collar at about 30–45%, then a chamfered bore at 30%. Each step should have a bevel
  you can see in the height map.
- Gunmetal steel with circular brushing, darker in the roots and steps, worn bright on tooth tips and edges.
- Update the outer-edge strip to the new perimeter (U still once around, including flanks and roots).

## Steel ring (`steel-ring-front-basecolor/-height/-roughness`, `steel-ring-outer-edge-basecolor`)

In v2 the color is a cloudy grey mottle with no grain, so it looks like stone or concrete. In image 1 it's
**brushed steel**:
- **Visible circular brushing following the ring**, fine and even. This is the main thing missing.
- Gunmetal tone with a faint warm bronze cast as in image 1, varied by gentle streaks along the band,
  not blotches or clouds.
- Darker grime around the 16 holes, lighter worn edges on the inner and outer rims.
- **Height:** chamfered rims on the inner and outer edges, a chamfer around each of the 16 holes, and very
  low-amplitude brushing. v2's height is almost flat apart from the holes.
- Roughness: smoother where the brushing is polished, rougher in the grime.

Keep the silhouette, the 16 holes and their positions from v2.

Leave a short `v2.1/README.txt` with anything that changed.
