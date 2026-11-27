Rosie | Blender metal textures v2

Face PNGs are 2048 x 2048, orthographic and centered on the v1 canvas.
Nominal outer diameter is 90% of the canvas. Base color is sRGB RGBA,
with material variation, cavity dirt and edge wear. Scene lighting and
reflections come from the Blender material. Use the alpha as a cutout
guide when modeling the solid parts, including bores and spoke openings.

Height PNGs are 16-bit grayscale. Set them to Non-Color and connect
to Bump Height. 32768 is the plate level, lighter features are raised,
and darker features are recessed. Transparent openings in base color
are black in height. Optional roughness is 8-bit grayscale, Non-Color,
with white as rough and black as smooth. Use the matching face stem.

Outer-edge base colors are 4096 x 256 sRGB RGB. U makes one repeat
around the full perimeter, including flanks and roots on both gears.
V spans the modeled thickness. The circumferential grain wraps in U.
Use repeating sampling at the U seam.

The bearing has separate front and rear base color, height and roughness.
Its six curved slots are blind recesses with bridges between them.
The front has the amber insert and the back has a retaining ring.
Both sides show three socket bolts, 16 flange rivets, and 10 inner rivets.
Use the bronze ring front on both sides for 14 domed rivets per face.
The steel ring, large gear and pinion can also reuse their front maps.

The steel ring has 16 drilled holes, so update meshes traced from v1.
The pinion has 12 block teeth with a revised perimeter and stepped hub.
The large gear retains the v1 alpha with 40 teeth and seven spokes.
The bearing and bronze ring also retain their v1 silhouette and bore.

PNG formats, silhouettes, feature counts, and U seams were checked.
Bump Distance and the assembled material still need a Blender render check.
