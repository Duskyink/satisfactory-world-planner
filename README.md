# Satisfactory World Planner

A whole-map production planner. You set what you want to produce; it derives
every recipe, machine, and raw-resource draw beneath that, checks the total
against the real node data, and places complexes on the real map.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Build a shareable copy

```bash
npm run build     # static files land in dist/
npm run preview   # serve dist/ locally to check it
```

`dist/` is plain HTML/CSS/JS. Drop it on GitHub Pages, Netlify, or Vercel and
your friends can open it in a browser with no install.

## Layout

```
public/data/          data, edited by scripts rather than by hand
  recipes.json        284 machine recipes at per-minute rates
  nodes.json          594 resource nodes: [resource, purity, type, x, y, capacity]
  plan.json           your 46 complexes and their production steps
  goals.json          the end products you are aiming for
  mapbg.json          generated terrain/biome backdrop
  world.json          world bounds, used to georeference the map image
src/lib/model.jsx     all the maths: recipes, machines, power, the cross-complex
                      graph, the goal solver, placement scoring
src/lib/storage.js    persistence - localStorage today, swap for a server later
src/components/       one file per tab (Dashboard, Goals, Resources, MapView,
                      Transport, Complex, Ui)
src/styles.css        all styling
src/App.jsx           shell, navigation, state
```

Coordinates are in units of 10 m, matching the extracted game data.

## Conventions worth knowing

- Resource capacities assume Mk.3 miners at 250% overclock.
- Water is unlimited: extractors work on any lake, river, or ocean, so it never
  constrains placement.
- A step's **target** is the rate you want of the recipe's *primary* product.
  In `exact` mode the clock is trimmed so output lands exactly on target; in
  `full` mode every machine runs at your clock and output overshoots; in `max`
  mode the target is computed from nodes you assign.
- Map imagery comes from the Official Satisfactory Wiki (CC BY-NC-SA 4.0).
  If it fails to load, the host is blocking hotlinking - save the image, host
  your own copy, and paste that URL into the map panel.

## Making it multiplayer

`src/lib/storage.js` is the only file that touches persistence. Replace its
four methods with calls to a small API and every client shares one plan.

## Known open items (plan, not code)

- Uranium is sized above the map's hard cap in `plan.json` and needs resizing.
- Zero-waste nuclear tops out near 10-11 uranium rods/min (~135 GW).
- Roughly 30 complexes still have inputs with no assigned source.
