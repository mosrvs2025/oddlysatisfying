# Swirl Room

An oddly satisfying toy box that runs in the browser, with touch or mouse, on phone or desktop. Everything is one self-contained page with no libraries: all physics, rendering and sound are generated live.

Play it: https://mosrvs2025.github.io/oddlysatisfying/

| Tab | What it is |
| --- | --- |
| Fluid | Real-time Navier-Stokes fluid on the GPU (WebGL2). Swirl with any number of fingers, hold still to make a fountain. Tracer sparks ride the currents; kaleidoscope mirroring up to 6-fold; glow and gloss shading. |
| Lava | A lava lamp where wax rises only because the bulb heats it, cools at the cap and sinks. Touch to warm it. |
| Sand | Falling-sand automaton. Pour, carve, drain; the color drifts with how much you've poured, so layers record the pile's history. |
| Cymatics | A vibrating square plate. Slide the pitch; at a resonance the sand is shaken off the moving parts and settles on the still nodal lines. |
| Slime | Pressurised soft-body blobs to grab, stretch, fling and poke. |
| Domino | Draw lines of dominoes and knock them over. Branches and spirals work because every falling domino hits whatever is in front of it. |
| Swing | A 15-pendulum wave. Each ball plays a note as it passes the middle. |
| Pop | Endless bubble wrap. |

Keys 1–8 switch tabs.

## Files

- `swirl-room.html` is the whole app. It's written as a claude.ai artifact body (no `<html>`/`<head>` wrapper).
- `scripts/build.sh` wraps it into a standalone `_site/index.html`.
- `.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push to `main`.

Vercel uses `vercel.json`, which runs the same build and serves `_site/`.

To run locally: `./scripts/build.sh` then open `_site/index.html`.

## Terrarium (world simulator)

The Sand tab has a **Terrarium ✦** chip that opens a full world simulator: 31 materials with temperature,
phase changes, combustion, air pressure and wind, electricity, plants, fungus, bugs, fish and algae, 96 discoverable
phenomena, god tools (heat, freeze, wind, rain, lightning, blast, gravity, local time, **mutate**), undo, save slots,
share codes and debug views. Open it directly with `#terrarium`.

**Evolution.** Bugs, fish, plants and algae each carry two heritable genes (shown in their colour). Children copy them
with the odd mutation and the environment does the selecting: bugs bred in the cold grow thick coats, fish in warm water
tolerate heat, fish that gulp air at the surface grow lungs and eventually crawl onto land, plants in the cold harden to
frost, algae pushed into shade learn to live in the dark. The Mutate tool scrambles genes under your finger, and the DNA
button opens a live view of every species' gene pool.

**Phones.** On a phone held sideways the tools move to a left rail and the materials to a right rail, leaving the middle for
the world. Rotating the phone re-cuts the world to the new shape, the world autosaves (and is restored after a crash or a
browser-reclaimed graphics context), and a crash in the simulation rolls back to the last good moment instead of freezing.

Source lives in `world/` (TypeScript engine + WebGL2 renderer). To change it:

```sh
cd world && npm install && npm test && npm run build && cd .. && python3 scripts/inline-world.py
```

That inlines `world/dist/terrarium.js` into `swirl-room.html`, which stays one self-contained file.
