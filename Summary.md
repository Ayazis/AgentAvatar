## What we made

**Rosie, a presence console:** a single HTML file, live as the Rosie console artifact. The latest file is rosie_v10.html.

- **The jacket:** painted denim lapels, made with ChatGPT's image model and brought to life in the browser. They hang and sway like cloth, breathe, and shift slightly as you move or tilt.
- **The orb:** a sphere of about 1,400 glowing points, sitting inside the jacket between the lapels.
- **The ribbons:** three bands of particles from our very first version, circling her and passing in front of and behind the lapels.
- **The swirl dust:** loose particles drifting around everything.
- **The silk ring:** one ribbon of rose silk around the orb. The near half lies over the lapels and orb, and the far half tucks behind them.
- **The states (Off, Idle, Working):** Idle and Working are each just a set of slider values, and switching glides every slider to the other set. Off dims everything.
- **The Tune panel:** about 35 switches and sliders. Settings are saved in your browser and can be copied, and Rosie stays pinned on screen while you tune.
- **For use in an app:** it can be controlled from code to set the state and intensity, and to pause, resume or remove it.

## How we got here

1. **Muse, the first version.** An abstract particle avatar: a glowing core with ribbons of light. You asked for:
   - a Marvel-AI feel instead of a human figure
   - a plain dark background
   - smooth motion
   - Off, Idle and Working states
   - no tap fireworks
   - less blur
2. **Trying to make it feminine.**
   - A face, then hair ("creepy", then "fibre cables"): both dropped.
   - Then an hourglass of silk in the orb, a star-like core, and glasses on the orb.
   - It swung from too glamorous ("James Bond woman") to "just an orb with glasses".
3. **Rosie gets a persona.** A geek in a denim jacket with a bow: cute, but fierce.
   - A rose: too fragile and cute.
   - You shared concepts of a glass orb with denim and silk, and we experimented in the ribbon lab.
   - A rendered denim jacket with a high collar: "please no".
4. **The turning point.** You showed ChatGPT's version and asked why I hadn't done the same. Honest answer: the painted look needed an image model, and I should have said so earlier. We switched to its approach: generated artwork, brought to life in code, in one HTML file. Then we made the denim move.
5. **Today.**
   - Put the orb inside the jacket.
   - Brought back the original Muse ribbons, after loose dust didn't feel like the swirls.
   - Made the silk calm at all times, so the particles do the fast work.
   - Added the Tune panel.
   - Turned the states into glides between slider settings.
   - Tried coiling the silk around the orb ("not what I meant"), then landed on the single masked ring.

## What you didn't like

- Green
- Anything literal: a face, hair, glasses or sunglasses, a rose, an hourglass figure, a jacket rendered as real clothing
- Too glamorous, or too fragile and cute (the aim is nerdy and tough)
- Blur, lag, a busy background, static lines, tap fireworks
- Loose dust instead of real swirls
- Silk that speeds up when she's working
- The coiled silk

## What worked

- Your AI-generated artwork as the base, with code doing all the movement.
- One self-contained file.
- Sliders, so you can tune her yourself instead of describing each change to me.

## Still open

- It hasn't been tested on a real phone yet. The ring and particles are the heaviest parts.
- Off has no settings of its own.
- Idle may still be a bit busy.
- Each time I changed the settings, your saved slider values were reset. Once you're happy, use "Copy settings" and send them to me, and I'll make them the defaults.

Earlier pieces are still in your artifacts if you want to compare: the first Muse page and the ribbon lab.