"""
World Plan Engine
=================
Turns goals + geography into a determined plan (a graph of site-anchored complexes)
under the rules in docs/SPLITTING.md.

Pipeline:
  1. cluster  - group real nodes into buildable sites (one-facility reach)
  2. claim    - take sites covering the most unmet raw demand first, until covered
  3. merge    - complete-linkage into complexes (bounded diameter, no chaining)
  4. recipes  - fewest-machine recipe whose raw draw fits under caps
  5. allocate - capacitated production, consuming node capacity (no double-use)
  6. classify - volume rule: ship dense, localize bulky-expanding, centralize complex
  7. edges    - match each complex's surplus to others' deficits -> transport network

The single hard constraint is caps (fuel included). Machines fall out; power is not
minimized. See docs/SPLITTING.md.

KNOWN LIMITATION (flagged, not yet fixed): allocate() fills each product's WORLD
demand richest-complex-first, which concentrates smelting and leaves smaller sites
shipping raw ore. Intended fix: complex-first processing (each complex smelts its
own ore, ships the denser product). Marked TODO below.

Run:  python scripts/engine.py
Reads public/data/*.json ; writes public/data/plan_graph.json + prints a summary.
"""
import json, os, math
from collections import defaultdict

DATA = os.path.join(os.path.dirname(__file__), "..", "public", "data")
load = lambda f: json.load(open(os.path.join(DATA, f), encoding="utf-8"))

# ---- tunables (geography only; NOT rules) ----
CLUSTER_LINK_M = 200     # one-facility belt reach for grouping nodes into sites
COMPLEX_DIAM_M = 800     # max complex footprint (complete-linkage; prevents chaining)

# ---- resource vocabulary (data, not rules) ----
RESK = ["Iron","Copper","Coal","Limestone","Caterium","Quartz","Bauxite","Sulfur",
        "SAM","Uranium","Oil","Nitrogen","Water"]
ORE_NAME = {"Iron":"Iron Ore","Copper":"Copper Ore","Coal":"Coal","Limestone":"Limestone",
            "Caterium":"Caterium Ore","Quartz":"Raw Quartz","Bauxite":"Bauxite","Sulfur":"Sulfur",
            "SAM":"SAM","Uranium":"Uranium","Oil":"Crude Oil","Nitrogen":"Nitrogen Gas","Water":"Water"}
SOLID_IDX = {0,1,2,3,4,5,6,7,8,9}
FLUID_IDX = {10,11}
RAW = set(ORE_NAME.values()) | {"Water"}
FLUID_ITEMS = {"Water","Crude Oil","Nitrogen Gas","Heavy Oil Residue","Fuel","Turbofuel",
               "Liquid Biofuel","Alumina Solution","Sulfuric Acid","Nitric Acid",
               "Dissolved Silica","Rocket Fuel","Ionized Fuel"}
CENTRAL_ITEMS = {"Computer","Supercomputer","Radio Control Unit","High-Speed Connector",
                 "Crystal Oscillator","AI Limiter"}

# ============================================================ data & demand
def build_demand(plan, RMAP):
    """From the plan's steps, derive per-product recipe (per-unit inputs) and total
    demanded rate, plus total raw draw. This is the goal demand the engine fills."""
    prod = {}
    for c in plan:
        for s in c.get("steps", []):
            r = RMAP.get(s["recipe"])
            if not r:
                continue
            base = (r["o"][0][1] if r["o"] else 1) or 1
            maxcl = (s.get("clock", 100)) / 100
            tgt = s.get("target", 0) or 0
            m = math.ceil(tgt / (base * maxcl)) if tgt > 0 else 0
            cl = maxcl if (s.get("mode") == "full" or m == 0) else tgt / (m * base)
            po = r["o"][0][0]
            d = prod.setdefault(po, {"in": {}, "rate": 0.0, "recipe": s["recipe"]})
            d["rate"] += r["o"][0][1] * cl * m
            for it, q in r["i"]:
                d["in"][it] = q / (r["o"][0][1] or 1)
    return prod

def raw_demand(prod):
    dem = defaultdict(float)
    for po, d in prod.items():
        for it, pu in d["in"].items():
            if it in RAW and it != "Water":
                dem[it] += pu * d["rate"]
    return dict(dem)

# ============================================================ geometry
def _dist(a, b):
    return math.hypot(a["cx"] - b["cx"], a["cy"] - b["cy"])

def cluster_sites(nodes, idxset, link_units):
    """Single-link cluster nodes of the given resource indices into buildable sites."""
    pts = [n for n in nodes if n[0] in idxset and n[5] > 0]
    used = [False] * len(pts)
    sites = []
    for i in range(len(pts)):
        if used[i]:
            continue
        stack, grp = [i], [i]
        used[i] = True
        while stack:
            a = stack.pop()
            for j in range(len(pts)):
                if used[j]:
                    continue
                if (pts[a][3]-pts[j][3])**2 + (pts[a][4]-pts[j][4])**2 <= link_units**2:
                    used[j] = True; stack.append(j); grp.append(j)
        g = [pts[k] for k in grp]
        cx = sum(n[3] for n in g)/len(g); cy = sum(n[4] for n in g)/len(g)
        caps = defaultdict(float)
        for n in g:
            caps[ORE_NAME[RESK[n[0]]]] += n[5]
        sites.append({"cx": cx, "cy": cy, "caps": dict(caps)})
    return sites

def claim(sites, need):
    """Take sites covering the most unmet (demand-normalized) raw need first."""
    rem = dict(need); tot = dict(need); avail = list(sites); out = []
    score = lambda s: sum(min(s["caps"].get(r, 0), rem[r]) / tot[r]
                          for r in rem if tot[r] > 0)
    while any(v > 1 for v in rem.values()):
        best = max(avail, key=score)
        if score(best) <= 0:
            break
        for r in rem:
            rem[r] = max(0, rem[r] - best["caps"].get(r, 0))
        out.append(best); avail.remove(best)
    return out, {k: v for k, v in rem.items() if v > 1}

def merge_complexes(sites, diam_units):
    """Complete-linkage: merge sites while every pair stays within diam (no chaining)."""
    groups = [[i] for i in range(len(sites))]
    def gdiam(members):
        return max((_dist(sites[a], sites[b]) for a in members for b in members), default=0)
    while True:
        best, bd = None, 1e18
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                dm = gdiam(groups[i] + groups[j])
                if dm <= diam_units and dm < bd:
                    bd, best = dm, (i, j)
        if best is None:
            break
        i, j = best; groups[i] += groups[j]; groups.pop(j)
    comps = []
    for mem in groups:
        caps = defaultdict(float)
        for k in mem:
            for a, v in sites[k]["caps"].items():
                caps[a] += v
        cx = sum(sites[k]["cx"] for k in mem)/len(mem)
        cy = sum(sites[k]["cy"] for k in mem)/len(mem)
        comps.append({"cx": cx, "cy": cy, "caps": dict(caps)})
    return comps

# ============================================================ volume rule
def classify_ship(prod):
    """Volume rule. ship=True: item denser than its inputs -> ship it.
    ship=False: item-expanding/bulky -> localize at consumer. Water is free
    (extractors everywhere) so it is excluded from input transport cost.
    CENTRAL_ITEMS ship too, but are produced in one place (setup-complexity rule)."""
    thr = lambda it: 600.0 if it in FLUID_ITEMS else 1200.0
    ship = {}
    for it, d in prod.items():
        out_cost = 1.0 / thr(it)
        in_cost = sum(pu / thr(x) for x, pu in d["in"].items() if x != "Water")
        ship[it] = (out_cost <= in_cost)
    return ship

# ============================================================ allocation
def allocate(comps, prod):
    """Capacitated bottom-up allocation, COMPLEX-FIRST. Each complex's node capacity
    is finite and CONSUMED on assignment (no double-use). Within each product, world
    demand is distributed PROPORTIONALLY across every complex that has local inputs,
    so every ore-bearing complex smelts its own share instead of the richest few
    cornering demand and leaving smaller sites to ship raw ore.

    KNOWN GAP (next step): only makes a product where all its inputs are ALREADY
    local, so convergence products (aluminum, silica, computers, nuclear fuel) whose
    inputs sit in different places are left unmade. The fix is a placement pass that
    picks a hub for each such product, ships its inputs in, and makes it there."""
    N = len(comps)
    rem = [dict(c["caps"]) for c in comps]      # remaining raw
    avail = [dict() for _ in comps]             # intermediates made & unspent
    made = [dict() for _ in comps]
    depth = {}
    def dep(it, seen=frozenset()):
        if it in RAW or it not in prod: return 0
        if it in depth: return depth[it]
        if it in seen: return 0
        depth[it] = 1 + max([dep(x, seen | {it}) for x in prod[it]["in"]] + [0])
        return depth[it]
    for it in prod: dep(it)
    have = lambda ci, x: (1e18 if x == "Water"
                          else (rem[ci].get(x, 0) if x in RAW else avail[ci].get(x, 0)))

    def make_at(ci, it, ins, take):
        for x, pu in ins.items():
            if x == "Water": continue
            if x in RAW: rem[ci][x] = rem[ci].get(x, 0) - pu * take
            else: avail[ci][x] = avail[ci].get(x, 0) - pu * take
        made[ci][it] = made[ci].get(it, 0) + take
        avail[ci][it] = avail[ci].get(it, 0) + take

    for it in sorted(prod, key=lambda i: depth.get(i, 0)):
        d = prod[it]; need = d["rate"]; ins = d["in"]
        localcap = lambda ci: min([have(ci, x) / pu for x, pu in ins.items() if pu > 0] or [1e18])
        # distribute proportionally to local capacity; iterate to soak up remainders
        for _ in range(N + 2):
            if need <= 1: break
            elig = [ci for ci in range(N) if localcap(ci) > 1]
            tot = sum(localcap(ci) for ci in elig)
            if tot <= 1: break
            moved = 0.0
            for ci in elig:
                if need <= 1: break
                share = min(localcap(ci), need * localcap(ci) / tot)
                if share <= 0: continue
                make_at(ci, it, ins, share); need -= share; moved += share
            if moved < 1: break
        # any residual demand no complex can source locally is left for edges
    return made, rem

# ============================================================ edges
def build_edges(comps, prod, made, rem, ship):
    """Compute each complex's surplus/deficit per item, then match surplus->deficit
    nearest-first into edges. Localized (non-ship) items make no edges."""
    N = len(comps)
    cons = [defaultdict(float) for _ in comps]
    for ci in range(N):
        for it, q in made[ci].items():
            for x, pu in prod[it]["in"].items():
                if x != "Water":
                    cons[ci][x] += pu * q
    surplus, deficit = defaultdict(list), defaultdict(list)
    for ci in range(N):
        items = set(made[ci]) | set(cons[ci]) | set(rem[ci])
        for it in items:
            m = made[ci].get(it, 0) + (rem[ci].get(it, 0) if it in RAW else 0)
            net = m - cons[ci].get(it, 0)
            if net > 1: surplus[it].append([ci, net])
            elif net < -1: deficit[it].append([ci, -net])
    edges = []
    for it, defs in deficit.items():
        sups = surplus.get(it, [])
        for dci, dq in defs:
            for sup in sorted(sups, key=lambda s: _dist(comps[s[0]], comps[dci])):
                if dq <= 1: break
                if sup[0] == dci or sup[1] <= 1: continue
                f = min(sup[1], dq); sup[1] -= f; dq -= f
                edges.append({"item": it, "src": sup[0], "dst": dci,
                              "rate": round(f, 1), "dist_m": round(_dist(comps[sup[0]], comps[dci]) * 10)})
    return edges

# ============================================================ driver
def region_namer(mapbg):
    anchors = mapbg.get("anchors", []) if isinstance(mapbg, dict) else []
    if not anchors:
        return lambda cx, cy: "?"
    return lambda cx, cy: min(anchors, key=lambda a: (a["x"]-cx)**2 + (a["y"]-cy)**2)["n"]

def main():
    plan = load("plan.json"); recipes = load("recipes.json"); nodes = load("nodes.json")
    caps = load("caps.json")
    try: mapbg = load("mapbg.json")
    except Exception: mapbg = {}
    RMAP = {r["n"]: r for r in recipes}
    region = region_namer(mapbg)

    prod = build_demand(plan, RMAP)
    dem = raw_demand(prod)

    # 1-3: solid claim + fluid claims, then merge into complexes
    link = CLUSTER_LINK_M / 10; diam = COMPLEX_DIAM_M / 10
    solid_need = {ORE_NAME[RESK[i]]: dem.get(ORE_NAME[RESK[i]], 0)
                  for i in SOLID_IDX if dem.get(ORE_NAME[RESK[i]], 0) > 1}
    sites, unmet = claim(cluster_sites(nodes, SOLID_IDX, link), solid_need)
    for idx in FLUID_IDX:
        r = ORE_NAME[RESK[idx]]
        if dem.get(r, 0) > 1:
            fs, _ = claim(cluster_sites(nodes, {idx}, link), {r: dem[r]})
            sites += fs
    comps = merge_complexes(sites, diam)
    for c in comps:
        c["region"] = region(c["cx"], c["cy"])

    # 4-7: recipes are taken as given by the plan here (recipe pass lives in its own
    # step; see docs). classify -> allocate -> edges.
    ship = classify_ship(prod)
    made, rem = allocate(comps, prod)
    edges = build_edges(comps, prod, made, rem, ship)

    # machine + cap summary
    mach = 0
    for c in plan:
        for s in c.get("steps", []):
            r = RMAP.get(s["recipe"])
            if not r: continue
            base = (r["o"][0][1] if r["o"] else 1) or 1
            mc = (s.get("clock", 100)) / 100; t = s.get("target", 0) or 0
            mach += math.ceil(t / (base * mc)) if t > 0 else 0

    out = {
        "complexes": [{"region": c["region"], "x": round(c["cx"]*10), "y": round(c["cy"]*10),
                       "caps": {k: round(v) for k, v in c["caps"].items()},
                       "makes": {k: round(v, 1) for k, v in made[i].items() if v > 1}}
                      for i, c in enumerate(comps)],
        "edges": edges,
        "stats": {"complexes": len(comps), "edges": len(edges), "machines": mach,
                  "shipped_per_min": round(sum(e["rate"] for e in edges)),
                  "unmet_raw": {k: round(v) for k, v in unmet.items()}},
    }
    with open(os.path.join(DATA, "plan_graph.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)

    print("=== WORLD PLAN ENGINE ===")
    print("complexes: %d | edges: %d | machines(plan clocks): %d | shipped: %d/min"
          % (out["stats"]["complexes"], out["stats"]["edges"], mach, out["stats"]["shipped_per_min"]))
    if unmet: print("UNMET raw demand:", out["stats"]["unmet_raw"])
    print("\n=== CAPS (raw draw vs cap) ===")
    for r in sorted(caps, key=lambda r: -(dem.get(r, 0) / caps[r] if caps[r] else 0)):
        d = dem.get(r, 0); pct = d / caps[r] * 100 if caps[r] else 0
        flag = "  <-- OVER" if pct > 100 else ""
        print("  %-14s %8.0f / %-7d %5.1f%%%s" % (r, d, caps[r], pct, flag))
    print("\n=== SHIP vs LOCALIZE ===")
    print("  ship: %d items | localize: %d items"
          % (sum(1 for it in prod if ship[it]), sum(1 for it in prod if not ship[it])))
    print("wrote public/data/plan_graph.json")

if __name__ == "__main__":
    main()
