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
