**Rosie is an interactive, abstract AI avatar made from two floating indigo denim jacket panels, a glowing silk strand, and particles.** The denim and stitched pocket give her a recognizable identity. The way the jacket opens, the silk moves, and the light changes tells you whether she’s Off, Idle, or Working.

### How we got here

We started with a cinematic hologram concept: a breathing sphere of particles, orbiting ribbons, and a subtle HUD. You wanted a presence that felt feminine, warm, and confident without giving it a face or a body. Gaia from *Horizon Forbidden West* was a reference for the feeling. The first orb designs still felt too generic.

The turning point was your description of Rosie herself: **a geek in a denim jacket, cute but fierce**. We explored a bow, a pocket, and an orb made of denim. You liked the actual fabric and stitching, but wrapping the jacket around a sphere looked strange. We dropped the bow and settled on two free-floating jacket panels with a pocket on the right. Getting that silhouette right took several passes, particularly around the extra upper-left flap.

Then we worked on the silk. You wanted it to travel like a snake, with the head moving forward and the tail tracing the same path. We moved from a shimmer effect to a code-driven strand that could weave through the middle and pass in front of or behind each denim panel independently. After trying two strands, you preferred one broader strand whose movement was easier to follow.

### The three states

| State | Rosie’s pose |
|---|---|
| **Off** | The panels fold diagonally across one another, pocket facing outward. This grew out of a closed rosebud design whose silhouette felt too suggestive. |
| **Idle** | The upper panels part while the lower tips cross. It’s the halfway-open pose, with space for the silk to move. |
| **Working** | Rosie returns to the established open jacket design, with faster movement and a shift toward cyan. |

The first transition experiment was an MP4 that repositioned one jacket image. It missed two things you cared about: the distinct artwork for each state and the ability to switch states live. The final version uses a **WebGL morph driven by the three pose designs**. Each panel changes shape independently, and its moving outline also determines when it hides the silk. You can switch states midway through a transition.

The result is a dependency-free TypeScript avatar and a self-contained HTML demo that runs offline. The bundle includes the source, all three pose designs, and layered PSD and transparent PNG files for Idle and Off. [Open Rosie live](https://muse-presence-field.chalkyagate7.chatgpt.site) · [Download the complete project](https://muse-presence-field.chalkyagate7.chatgpt.site/rosie-complete.zip)