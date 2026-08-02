# World Plan Engine — Rules

This is the rule set that turns a declared design into a determined plan: a graph
of complexes placed on real geography, each built once and complete. The rules are
stated only as **objectives** and **constraints** over abstract quantities. They
never name a recipe or a resource. Every specific choice — which recipe, which
ore, what gets made where, what ships and what stays local, how fast a machine
runs — is an **output the engine determines** by optimizing the whole design
against these rules, not an answer written into them.

The test for what belongs here: a **constraint** (something the plan must not
violate) or an **objective** (something the plan minimizes or maximizes) belongs. A
**specific answer** — a named recipe, a resource pairing, a fixed site, a chosen
number — does not; that is the engine's to decide, and writing it down as a rule
would freeze a decision that should stay free to change as the rest of the design
moves.

## What the designer declares

- **Goals** — the end products the world must deliver, each at a target rate per
  minute. Rates only, never lifetime totals: the world's supply is effectively
  infinite and only throughput matters.
- **Invariants** — the hard properties the plan must hold (listed below).
- Nothing else. The designer does not pick recipes, sites, clocks, or routing. If
  the designer finds themselves specifying one of those, either it is really a
  constraint (and belongs in the constraint list) or the engine should be deciding
  it.

## Levers the engine controls

Everything the engine is free to choose in service of the objective: which recipe
makes each item, which sites to claim and what each produces, how the production
graph is wired, which carrier moves each stream, how fast each machine runs
(clock is free of any shard cost but raises power draw — a trade the engine
balances), and the order complexes are phased in. None of these are fixed by rule.

## Constraints — the engine must never violate these

- **Extraction-rate caps.** Each raw resource has a maximum sustainable extraction
  rate set by its nodes. Total draw across the whole plan may not exceed it.
- **Carrier limits.** Each transport carrier has a maximum throughput and a set of
  item classes it can move. No stream may exceed its carrier's throughput, and an
  item may travel only on a carrier able to move its class — some item classes
  cannot use some carriers at all.
- **Buildability.** A complex sits on a real site — an actual cluster of nodes. Any
  production needing a resource must reach it by on-site extraction or by an edge
  from somewhere that has it. Nothing is produced from thin air.
- **The invariants**, below.

## Objective — what the engine minimizes

Across the whole design, minimize total **transport + build + power cost**: prefer
the plan that moves the least, builds the least, and powers the least while meeting
every goal and honoring every constraint. This is a whole-design objective, not a
per-stage one — a choice that costs more at one step but less overall wins.

In practice it pulls toward local production over shipping, denser shipments over
bulky ones, fewer and more self-contained complexes, and recipe and clock choices
that lower the total. When two approaches both satisfy the constraints, the
lower-cost one wins — and the rules never prescribe which that is.

## The model

**One node type: the complex.** A complex is a production grouping on a site — a
real cluster of nodes of any size, holding whatever resources are there. There is
no separate "sub-complex" type; whether a complex supplies others or distributes to
the world is read off its output edges, not stamped on it as a name.

**Edges are outputs.** Every stream a complex produces leaves on an edge to a named
complex, to the depot, or to general distribution. Each edge is either a dedicated
feed (a line reserved for one destination) or a distribution drop. That flag feeds
the localize-vs-ship decision and the transport view.

**The graph.** Edges form a directed graph of any depth and any fan-out: a complex
can feed several others, be fed by several, and chains converge on the complexes
that make the final goals. "Supplier" and "distributor" are just directions edges
point; a complex can be both at once.

**Not complexes.** A freight-consolidation point — many streams bundled onto shared
transport — is a logistics node, not a complex, and carries no production label.

**No pass-through.** If a complex would take a stream in and pass it out unchanged,
it should not exist; that is the upstream complex shipping onward, and the middle
hop is deleted.

**Physical realization is a note.** Whether a complex is its own building, a floor,
or a division inside a larger one is a build-time property recorded on the plan, not
a structural distinction in it.

## How the engine determines the plan

1. **Cluster** the map's nodes into buildable sites by real geography — group nodes
   that a single facility could physically draw together.
2. **Claim** sites to satisfy demand, taking the sites that cover the most unmet
   demand first, until every goal's requirement is met. Co-located resources are
   credited together, so a site serving several needs at once is preferred.
3. **Combine** onto one complex all the production a claimed site can support.
4. **Choose recipes** across the whole design to minimize the objective. This is
   where "which recipe" is answered — globally, as a cost decision, never as a rule.
5. **Localize or ship** each stream by comparing its cost produced locally (or fed
   in on an edge) against shipped in, weighting each item by its transport cost.
   Keep producing locally while local-plus-feed is cheaper; ship only when the
   finished item is cheaper to move than everything feeding it.
6. **Size** each complex to its whole cluster: claim every node, process the
   cluster's throughput, bank the surplus. Built complete on first touch.
7. **Phase** complexes in as demand crosses capacity — sequence between complexes,
   never grow one after it is finished.

## Invariants — hard properties of any valid plan

- **Full utilization.** Claimed resources are driven toward 100% of their extraction
  cap; surplus is banked, not wasted. 100% is the budget, not a warning.
- **No stranded output.** Every stream reconciles to a named consumer or a declared
  sink. Nothing is produced with nowhere to go.
- **Build complete, never return.** A complex is finished the first time it is
  built, sized to its cluster. More demand is met by phasing in more complexes, not
  by revisiting a finished one.
- **Phase between, not within.** Geography sets a complex's size; demand sets when
  the next complex is built.
- **Power leads demand.** Only the complexes demand has reached are lit; generation
  is sized to the live load, never to the whole endgame at once. Power complexes
  follow the same rules as any other.
- **Zero-waste nuclear.** Nuclear byproducts are fully reprocessed, and the
  reprocessing chain is live before the reactors it serves.

## Lifecycle — a per-complex property

- **Permanent** (default) — built once, never deleted; its recipe may be upgraded in
  place as a better option becomes worthwhile, without rebuilding or moving it.
- **Retire / reclaim** — removed only if the resources it holds are needed elsewhere;
  otherwise left standing. A purely conditional flag.
- **One-shot** — a low-volume output of negligible cost, produced entirely in one
  convenient place, neither split nor phased.

## Build order

Ordering is not gated by tech — everything is unlocked — but by dependency and
power. No complex is built before the producers of its inputs exist, and generation
is stood up before the load it must carry. The bootstrap (a self-starting power
source, then the foundation it enables, then successively higher production as each
stage's inputs come online, endgame last) is a consequence of that dependency
ordering, not a fixed script.

## What the deliverable is

A graph of site-anchored complexes connected by typed edges, produced mechanically
from goals plus geography under these rules. The node map, the utilization
accounting, and the per-complex views all speak that graph. A flat list of
complexes is only ever a staging point on the way to it.
