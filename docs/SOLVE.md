# How the world plan was solved

The plan is solved top-down: pick the end products, size the nuclear plant to
use the uranium with zero stored waste, subtract consumables and power, and
spend what is left on space elevator parts.

## Priority order

1. **Consumables and buildables** - ammo, rebar, filters, equipment feedstock,
   and the full depot stock of frames, beams, plates, computers and so on.
2. **Space elevator parts** - a chosen rate for all 12 parts.
3. **Nuclear** - maximised with whatever remains.
4. **Power staging** - coal carries the consumables base, fuel carries
   everything until nuclear ignites, nuclear carries the endgame.

## Corrections worth remembering

**Uranium waste is 50 per rod, not 250.** A Nuclear Power Plant burns
0.2 Uranium Fuel Rods/min and produces 10 Uranium Waste/min, so one rod yields
50 waste. Waste output was halved in patch 0.4.0.11. Using the old figure makes
waste disposal five times more expensive and falsely caps uranium.

**Zero waste does not require burning everything.** Uranium waste can be
absorbed by making Plutonium Pellets and sinking them, which costs no SAM. Only
plutonium waste needs the SAM-hungry Ficsonium loop. Routing waste this way is
what lets uranium reach 100% utilisation.

**Alt recipes are worth 2.4x on the uranium front end.** Infused Uranium Cell +
Uranium Fuel Unit needs 41.67 ore per rod; the base recipes need 100.

**Pick recipes globally, not per step.** The best recipe for one item in
isolation is often wrong for the system. A global sweep found six swaps worth
+31% nuclear output, all of which move load off a strained resource onto an idle
one - for example Alclad Casing trades bauxite for copper, and Distilled Silica
trades quartz for limestone.

## Known limitation

The solver expands recipes recursively and bails out on cycles, so it **cannot
evaluate the recycled plastic/rubber loop** (Recycled Plastic consumes rubber,
Recycled Rubber consumes plastic). That loop is the standard endgame approach
and cuts crude oil use by roughly 78%. Until the solver handles cycles as a
linear system, oil figures are pessimistic and the fuel plant looks transitional
when it should be able to run permanently alongside nuclear.
