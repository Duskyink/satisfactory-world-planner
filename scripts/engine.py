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

Run:  python scripts/engine.py           writes plan_graph.json + prints a summary
      python scripts/engine.py --check   also prints coverage, actual caps, top edges
Reads public/data/*.json ; writes public/data/plan_graph.json.
"""
import json, os, math, sys
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
# hand-fed / ubiquitous items we never compute or source (treated as free, like water)
FREE_ITEMS = {"Water", "Biomass", "Mycelia"}

# ============================================================ data & demand
def build_demand(plan, RMAP):
    """From the plan's steps, derive per-product recipe (per-unit inputs) and total
    demanded rate. Only primary outputs drive demand and routing. Byproducts are tracked
    separately so emit_app_plan knows they exist locally, but they don't inflate demand."""
    prod = {}
    byproduct_rate = defaultdict(float)   # item -> total byproduct rate across the plan
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
            if po not in FREE_ITEMS and po != "Power":
                d = prod.setdefault(po, {"in": {}, "rate": 0.0, "recipe": s["recipe"]})
                d["rate"] += r["o"][0][1] * cl * m
                for it, q in r["i"]:
                    d["in"][it] = q / (r["o"][0][1] or 1)
            # track byproducts (secondary outputs) — they're available but don't drive demand
            for oi in range(1, len(r["o"])):
                bp, bq = r["o"][oi]
                if bp not in FREE_ITEMS and bp != "Power":
                    byproduct_rate[bp] += bq * cl * m
    return prod, byproduct_rate

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
        if not avail:
            break
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
def allocate(comps, prod, ship):
    """Capacitated bottom-up allocation, COMPLEX-FIRST. Distributes only the SHIPPABLE
    production (ingots, plates, dense parts) across complexes by their own capacity,
    consumed on assignment (no double-use). Non-shippable "localize" items (screws,
    wire, fluids) are NOT made here - route() makes them at their consumers, so they
    are never produced twice."""
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
        if not ship.get(it, True) and it not in FLUID_ITEMS:
            continue                      # bulky-expanding: route() makes them at consumers
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

# ============================================================ routing (placement)
def route(comps, prod, made, rem, ship, RMAP):
    """Convergence-placement + routing. After the complex-first pass has distributed
    what it can, this fills the residual: for each still-unmet product (bottom-up),
    pick the hub where its inputs are cheapest to gather, import shippable inputs as
    edges, make non-shippable inputs on-site, and make the product there. Returns the
    edge list; `made` is updated in place so downstream products can pull from it.

    Non-shippable inputs are handled by kind: fluids are made once (in the base pass,
    at their raw site) and imported/consumed here, never re-made, so they cannot
    double-produce and breach caps; bulky-expanding parts (screws, wire) are made
    on-site at each consumer. Convergence hubs are pinned to the complex holding a
    product's fluid inputs first, then to where its shippable inputs gather."""
    N = len(comps)
    depth = {}
    def dep(it, seen=frozenset()):
        if it in RAW or it not in prod: return 0
        if it in depth: return depth[it]
        if it in seen: return 0
        depth[it] = 1 + max([dep(x, seen | {it}) for x in prod[it]["in"]] + [0]); return depth[it]
    for it in prod: dep(it)

    # export pool: net surplus per item per complex after the local pass
    # includes byproducts: secondary outputs of recipes whose primary output is in made
    cons = [defaultdict(float) for _ in comps]
    byprod = [defaultdict(float) for _ in comps]   # byproduct production per complex
    for ci in range(N):
        for it, q in made[ci].items():
            if it in prod:
                for x, pu in prod[it]["in"].items():
                    if x != "Water": cons[ci][x] += pu * q
                # compute byproduct output from this recipe
                rname = prod[it].get("recipe", "")
                r = RMAP.get(rname)
                if r and len(r["o"]) > 1:
                    base = r["o"][0][1] or 1
                    for oi in range(1, len(r["o"])):
                        bp, bq = r["o"][oi]
                        if bp not in FREE_ITEMS and bp != "Power":
                            byprod[ci][bp] += bq / base * q
    pool = defaultdict(lambda: defaultdict(float))
    for ci in range(N):
        for it in set(made[ci]) | set(rem[ci]) | set(byprod[ci]):
            net = (made[ci].get(it, 0) + byprod[ci].get(it, 0)
                   + (rem[ci].get(it, 0) if it in RAW else 0) - cons[ci].get(it, 0))
            if net > 1: pool[it][ci] = net
    edges = []
    def imp(item, qty, dst):
        for sci in sorted(pool[item], key=lambda c: _dist(comps[c], comps[dst])):
            if qty <= 1: break
            a = pool[item][sci]
            if a <= 1: continue
            f = min(a, qty); pool[item][sci] -= f; qty -= f
            if sci != dst:
                edges.append({"item": item, "src": sci, "dst": dst, "rate": round(f, 1),
                              "dist_m": round(_dist(comps[sci], comps[dst]) * 10)})
        return qty
    def ensure(hub, item, qty):
        if item == "Water" or qty <= 1: return
        have = pool[item].get(hub, 0); u = min(have, qty); pool[item][hub] -= u; qty -= u
        if qty <= 1: return
        if item in RAW or ship.get(item, True) or item in FLUID_ITEMS:
            imp(item, qty, hub)           # raw / dense / fluid: bring from where it's made (never re-make)
        else:                             # bulky-expanding only: make on-site at the consumer
            for x, pu in prod[item]["in"].items(): ensure(hub, x, pu * qty)
            made[hub][item] = made[hub].get(item, 0) + qty
    assigned = defaultdict(float)          # throughput placed per complex (load balancing)
    for it in sorted(prod, key=lambda i: depth.get(i, 0)):
        if not ship.get(it, True):
            continue                       # non-shippable: made on demand by ensure()
        residual = prod[it]["rate"] - sum(made[ci].get(it, 0) for ci in range(N))
        if residual <= 1: continue
        def fluid_cover(ci):               # fraction of fluid inputs already present here
            need = tot = 0.0
            for x, pu in prod[it]["in"].items():
                if x in FLUID_ITEMS and x != "Water":
                    need += pu * residual; tot += min(pool[x].get(ci, 0), pu * residual)
            return tot / need if need > 1 else 1.0
        def ship_gather(ci):               # local availability of shippable inputs (higher=closer)
            return sum(min(pool[x].get(ci, 0), pu * residual)
                       for x, pu in prod[it]["in"].items() if x != "Water" and x not in FLUID_ITEMS)
        # fluid inputs must be local (hard); among those, spread load and prefer local shippables
        hub = max(range(N), key=lambda ci: (round(fluid_cover(ci), 3),
                                            ship_gather(ci) - 0.5 * assigned[ci]))
        for x, pu in prod[it]["in"].items(): ensure(hub, x, pu * residual)
        made[hub][it] = made[hub].get(it, 0) + residual
        pool[it][hub] = pool[it].get(hub, 0) + residual
        assigned[hub] += residual
    # second pass: non-shippable items (localize + terminal) left short by the first pass.
    # Place residual at the complexes that consume them (proportional to consumption),
    # or if nothing consumes them (terminal), at the best hub. Iterate to soak remainders.
    for it in sorted(prod, key=lambda i: depth.get(i, 0)):
        for _round in range(N + 2):
            residual = prod[it]["rate"] - sum(made[ci].get(it, 0) for ci in range(N))
            if residual <= 1: break
            ins = prod[it]["in"]
            # find where this item is consumed (by anything that uses it as input)
            consumers = defaultdict(float)
            for P, d in prod.items():
                if it in d["in"]:
                    pu = d["in"][it]
                    for ci in range(N):
                        consumers[ci] += made[ci].get(P, 0) * pu
            elig = {ci: q for ci, q in consumers.items() if q > 1}
            if not elig:
                # terminal item: pick hub with best fluid coverage (like main loop),
                # then ensure() will import/make what's needed
                def _fc(ci):
                    need = tot = 0.0
                    for x, pu in ins.items():
                        if x in FLUID_ITEMS and x != "Water":
                            need += pu * residual; tot += min(pool[x].get(ci, 0), pu * residual)
                    return tot / need if need > 1 else 1.0
                def _sc(ci):
                    return sum(min(pool[x].get(ci, 0), pu * residual)
                               for x, pu in ins.items() if x != "Water" and x not in FLUID_ITEMS)
                best = max(range(N), key=lambda ci: (round(_fc(ci), 3), _sc(ci)))
                for x, pu in ins.items(): ensure(best, x, pu * residual)
                made[best][it] = made[best].get(it, 0) + residual
                pool[it][best] = pool[it].get(best, 0) + residual
                break
            tot_e = sum(elig.values())
            moved = 0.0
            for ci, w in sorted(elig.items(), key=lambda kv: -kv[1]):
                if residual <= 1: break
                take = min(residual, residual * w / tot_e)
                if take <= 0.5: continue
                for x, pu in ins.items(): ensure(ci, x, pu * take)
                made[ci][it] = made[ci].get(it, 0) + take
                pool[it][ci] = pool[it].get(ci, 0) + take
                residual -= take; moved += take
            if moved < 1: break
    return edges

# ============================================================ emit app-shaped plan
def emit_app_plan(comps, prod, made, edges, RMAP, caps):
    """Convert the engine graph into the app's complex shape so every tab renders the
    engine world. Emits, per complex: a step for each item it makes; generator steps
    that burn produced fuels into Power (so fuel rods / rocket fuel get a real consumer
    and the dashboard shows generation); complete sourcesN for each input (a 'local' row
    for on-site production, 'raw' for raw/free items, and one row per import edge); and
    dests split into a 'local' row plus one row per external consumer. Quantities are
    rounded once and reused on both sides. Every row carries a stable key."""
    from collections import Counter
    # fuel -> (burn recipe, fuel-in per unit, Power out) for every power recipe
    BURN = {}
    for r in RMAP.values():
        if any(o[0] == "Power" for o in r["o"]):
            fin = next((x for x in r["i"] if x[0] != "Water"), None)
            if fin:
                BURN[fin[0]] = (r["n"], fin[1], next(o[1] for o in r["o"] if o[0] == "Power"))
    freq = Counter(c["region"] for c in comps)
    ctr = defaultdict(int); names = []
    for c in comps:
        r = c["region"]; ctr[r] += 1
        names.append(r if freq[r] == 1 else "%s %d" % (r, ctr[r]))
    imp_by = defaultdict(lambda: defaultdict(list))   # dst -> item -> [(src, rate)]
    exp_by = defaultdict(lambda: defaultdict(list))   # src -> item -> [(dst, rate)]
    for e in edges:
        imp_by[e["dst"]][e["item"]].append((e["src"], e["rate"]))
        exp_by[e["src"]][e["item"]].append((e["dst"], e["rate"]))
    # Build recipe lookup: for any item, which recipe produces it?
    # Prefer recipes where the item is a primary output; fall back to byproduct sources
    produces = {}  # item -> recipe name
    for r in RMAP.values():
        for oi, (it, q) in enumerate(r["o"]):
            if it not in FREE_ITEMS and it != "Power":
                if it not in produces or oi == 0:  # primary output wins
                    produces[it] = r["n"]
    plan = []
    all_steps = {}
    auto_remote_steps = {}                            # ci -> [steps to add at remote complexes]
    for i, c in enumerate(comps):
        M = {k: v for k, v in made[i].items() if v > 0.5 and k not in FREE_ITEMS}
        cons = defaultdict(float)                     # consumption from what it makes
        for P, rate in M.items():
            for x, pu in prod.get(P, {"in": {}})["in"].items():
                if x not in FREE_ITEMS: cons[x] += pu * rate
        steps = []
        for j, (item, rate) in enumerate(sorted(M.items(), key=lambda x: -x[1])):
            rec = prod.get(item, {}).get("recipe")
            if not rec: continue
            steps.append({"id": "s%d_%d" % (i, j), "recipe": rec, "target": round(rate),
                          "clock": 100, "status": "todo", "sec": "PRODUCTION FLOW", "name": item})
        burned = {}                                   # fuels consumed on-site by generators
        for fuel, (rname, qin, pout) in BURN.items():
            R = made[i].get(fuel, 0)
            if R <= 0.5: continue
            steps.append({"id": "g%d_%d" % (i, len(steps)), "recipe": rname,
                          "target": round(R * pout / qin), "clock": 100, "status": "todo",
                          "sec": "POWER", "name": "Power \u2014 " + fuel.replace(" Fuel Rod", "")})
            burned[fuel] = R
        # derive needs from the ACTUAL steps (same way the app does), not just from M
        needs = defaultdict(float)                    # total input consumption from all steps
        local_out = defaultdict(float)                # total output from all steps
        for s in steps:
            r = RMAP.get(s["recipe"])
            if not r: continue
            base = r["o"][0][1] or 1
            for it, q in r["i"]:
                needs[it] += q / base * s["target"]
            for it, q in r["o"]:
                local_out[it] += q / base * s["target"]
        all_steps[i] = steps
        srcs = {}                                     # inputs: local / raw / import rows
        for x, u in needs.items():
            if u <= 0.5 or x in FREE_ITEMS: continue
            if x in RAW:
                srcs[x] = [{"from": "raw", "q": round(u), "station": "", "key": "c%d|%s|raw" % (i, x)}]
                continue
            rows = []
            lo = local_out.get(x, 0)
            imp_q = sum(rate for _, rate in imp_by[i].get(x, []))
            if lo > 0.5:
                # local production covers this need (partially or fully)
                rows.append({"from": "local", "q": round(min(lo, u)), "station": "", "key": "c%d|%s|local" % (i, x)})
            for src, rate in imp_by[i].get(x, []):
                rows.append({"from": "c%d" % src, "q": round(rate), "station": "", "key": "c%d|%s|c%d" % (i, x, src)})
            # ensure total sourced >= need (fix rounding shortfalls)
            if rows:
                total_sourced = sum(r["q"] for r in rows)
                if total_sourced < round(u) and rows:
                    rows[0]["q"] += round(u) - total_sourced
            if rows: srcs[x] = rows
        # VERIFY: any input still unsourced? Check local byproduct output first,
        # then look across all complexes for a producer and create an import link.
        # Build per-complex byproduct output map
        bp_map = defaultdict(lambda: defaultdict(float))  # item -> ci -> rate
        for ci2 in range(len(comps)):
            for s2 in all_steps.get(ci2, []):
                r2 = RMAP.get(s2["recipe"])
                if not r2: continue
                base2 = r2["o"][0][1] or 1
                for oi2 in range(len(r2["o"])):
                    it2, q2 = r2["o"][oi2]
                    if it2 not in FREE_ITEMS and it2 != "Power":
                        bp_map[it2][ci2] += q2 / base2 * s2["target"]
        for x, u in list(needs.items()):
            if x in FREE_ITEMS or x in RAW or x in srcs: continue
            if u <= 0.5: continue
            lo = local_out.get(x, 0)
            if lo > 0.5:
                srcs[x] = [{"from": "local", "q": round(min(lo, u)), "station": "", "key": "c%d|%s|local" % (i, x)}]
            elif bp_map[x]:
                # find nearest complex that produces this byproduct
                rows = []
                rem_need = u
                for sci in sorted(bp_map[x], key=lambda c: _dist(comps[c], comps[i]) if c != i else -1):
                    if rem_need <= 0.5: break
                    avail = bp_map[x][sci]
                    take = min(avail, rem_need)
                    bp_map[x][sci] -= take; rem_need -= take
                    if sci == i:
                        rows.append({"from": "local", "q": round(take), "station": "", "key": "c%d|%s|local" % (i, x)})
                    else:
                        rows.append({"from": "c%d" % sci, "q": round(take), "station": "", "key": "c%d|%s|c%d" % (i, x, sci)})
                # if byproducts didn't cover the full need, add a producing step for the remainder
                if rem_need > 1 and x in produces:
                    rname = produces[x]
                    r = RMAP.get(rname)
                    if r:
                        base = r["o"][0][1] or 1
                        oq = next((q for it2, q in r["o"] if it2 == x), base)
                        target_rate = round(rem_need * base / oq) if oq > 0 else round(rem_need)
                        raw_needs_r = {it2: q2 / base * target_rate for it2, q2 in r["i"] if it2 in RAW}
                        # check world feasibility — don't auto-add if raw demand exceeds world cap
                        world_feasible = all(caps.get(rn, 0) >= rq for rn, rq in raw_needs_r.items())
                        if not world_feasible:
                            pass  # infeasible recipe chain — can't auto-fix, leave gap visible
                        elif not r["i"]:
                            # zero-input recipe (e.g., Excited Photonic Matter) — add locally
                            steps.append({"id": "a%d_%d" % (i, len(steps)), "recipe": rname,
                                          "target": target_rate, "clock": 100, "status": "todo",
                                          "sec": "PRODUCTION FLOW", "name": x})
                            for it2, q2 in r["o"]:
                                local_out[it2] += q2 / base * target_rate
                            rows.append({"from": "local", "q": round(rem_need), "station": "", "key": "c%d|%s|local" % (i, x)})
                        else:
                            # find complex with best raw resource coverage
                            if raw_needs_r:
                                best_ci = max(range(len(comps)),
                                              key=lambda ci: min(comps[ci]["caps"].get(rn, 0) / (rq or 1)
                                                                for rn, rq in raw_needs_r.items()))
                            else:
                                best_ci = i  # no raw needs, place locally
                            if best_ci == i:
                                steps.append({"id": "a%d_%d" % (i, len(steps)), "recipe": rname,
                                              "target": target_rate, "clock": 100, "status": "todo",
                                              "sec": "PRODUCTION FLOW", "name": x})
                                for it2, q2 in r["o"]:
                                    local_out[it2] += q2 / base * target_rate
                                for it2, q2 in r["i"]:
                                    needs[it2] = needs.get(it2, 0) + q2 / base * target_rate
                                rows.append({"from": "local", "q": round(rem_need), "station": "", "key": "c%d|%s|local" % (i, x)})
                            else:
                                rows.append({"from": "c%d" % best_ci, "q": round(rem_need), "station": "", "key": "c%d|%s|c%d" % (i, x, best_ci)})
                                auto_remote = auto_remote_steps.setdefault(best_ci, [])
                                auto_remote.append({"id": "a%d_%d" % (best_ci, len(auto_remote)), "recipe": rname,
                                                    "target": target_rate, "clock": 100, "status": "todo",
                                                    "sec": "PRODUCTION FLOW", "name": x})
                if rows: srcs[x] = rows
            elif x in produces:
                # No complex produces this item — find or add a producing recipe
                rname = produces[x]
                r = RMAP.get(rname)
                if r:
                    base = r["o"][0][1] or 1
                    oq = next((q for it2, q in r["o"] if it2 == x), base)
                    target_rate = round(u * base / oq) if oq > 0 else round(u)
                    # check if recipe needs raw resources this complex doesn't have enough of
                    raw_needs = {it2: q2 / base * target_rate for it2, q2 in r["i"] if it2 in RAW}
                    can_local = all(comps[i]["caps"].get(rn, 0) >= rq * 0.5 for rn, rq in raw_needs.items()) if raw_needs else True
                    if can_local or not r["i"]:
                        # place here (zero-input or has local resources)
                        sid = "a%d_%d" % (i, len(steps))
                        steps.append({"id": sid, "recipe": rname, "target": target_rate,
                                      "clock": 100, "status": "todo", "sec": "PRODUCTION FLOW",
                                      "name": x})
                        for it2, q2 in r["o"]:
                            local_out[it2] += q2 / base * target_rate
                        for it2, q2 in r["i"]:
                            needs[it2] = needs.get(it2, 0) + q2 / base * target_rate
                        srcs[x] = [{"from": "local", "q": round(u), "station": "", "key": "c%d|%s|local" % (i, x)}]
                    else:
                        # place at a complex that has the raw resources, import the output
                        best_ci = max(range(len(comps)),
                                      key=lambda ci: min(comps[ci]["caps"].get(rn, 0) / (rq or 1) for rn, rq in raw_needs.items()) if raw_needs else 1e18)
                        if best_ci != i:
                            # add step at best complex (will be picked up when we process that complex)
                            # for now, create import source row
                            srcs[x] = [{"from": "c%d" % best_ci, "q": round(u), "station": "", "key": "c%d|%s|c%d" % (i, x, best_ci)}]
                            # also add the step to that complex's pending auto-steps
                            auto_remote = auto_remote_steps.setdefault(best_ci, [])
                            auto_remote.append({"id": "a%d_%d" % (best_ci, len(auto_remote)), "recipe": rname,
                                                "target": target_rate, "clock": 100, "status": "todo",
                                                "sec": "PRODUCTION FLOW", "name": x})
        # after adding auto-steps, re-source any new needs — iterate until stable
        for _pass in range(5):
            added = False
            for x, u in list(needs.items()):
                if x in FREE_ITEMS: continue
                if u <= 0.5: continue
                existing = sum(r.get("q", 0) for r in srcs.get(x, []))
                if existing >= u - 5: continue  # fully sourced
                added = True
                shortfall = u - existing
                if x in RAW:
                    # update or create raw source row to match total need
                    srcs[x] = [{"from": "raw", "q": round(u), "station": "", "key": "c%d|%s|raw" % (i, x)}]
                elif local_out.get(x, 0) > 0.5:
                    srcs[x] = [{"from": "local", "q": round(min(local_out[x], u)), "station": "", "key": "c%d|%s|local" % (i, x)}]
                elif bp_map[x]:
                    rows = []
                    rem_need = u
                    for sci in sorted(bp_map[x], key=lambda c: _dist(comps[c], comps[i]) if c != i else -1):
                        if rem_need <= 0.5: break
                        avail_bp = bp_map[x][sci]
                        take = min(avail_bp, rem_need)
                        bp_map[x][sci] -= take; rem_need -= take
                        if sci == i:
                            rows.append({"from": "local", "q": round(take), "station": "", "key": "c%d|%s|local" % (i, x)})
                        else:
                            rows.append({"from": "c%d" % sci, "q": round(take), "station": "", "key": "c%d|%s|c%d" % (i, x, sci)})
                    if rows: srcs[x] = rows
                elif x in produces:
                    rname = produces[x]
                    r = RMAP.get(rname)
                    if r:
                        base = r["o"][0][1] or 1
                        oq = next((q for it2, q in r["o"] if it2 == x), base)
                        target_rate = round(u * base / oq) if oq > 0 else round(u)
                        steps.append({"id": "a%d_%d" % (i, len(steps)), "recipe": rname,
                                      "target": target_rate, "clock": 100, "status": "todo",
                                      "sec": "PRODUCTION FLOW", "name": x})
                        for it2, q2 in r["o"]:
                            local_out[it2] += q2 / base * target_rate
                        for it2, q2 in r["i"]:
                            needs[it2] = needs.get(it2, 0) + q2 / base * target_rate
                        srcs[x] = [{"from": "local", "q": round(u), "station": "", "key": "c%d|%s|local" % (i, x)}]
            if not added: break
        # append any remote auto-steps assigned to this complex by other complexes
        for rs in auto_remote_steps.get(i, []):
            steps.append(rs)
        all_steps[i] = steps
        dests = {}                                    # outputs: local + one row per consumer
        for x, mrate in M.items():
            rows = []
            local_q = min(mrate, needs.get(x, 0))
            if local_q > 0.5:
                rows.append({"to": "local", "q": round(local_q), "station": "", "key": "c%d|%s|local" % (i, x)})
            for dst, rate in exp_by[i].get(x, []):
                rows.append({"to": "c%d" % dst, "q": round(rate), "station": "", "key": "c%d|%s|c%d" % (i, x, dst)})
            if rows: dests[x] = rows
        for fuel, R in burned.items():                # burned on-site -> local destination
            rows = dests.get(fuel, [])
            if not any(rw["to"] == "local" for rw in rows):
                rows.insert(0, {"to": "local", "q": round(R), "station": "",
                                "key": "c%d|%s|gen" % (i, fuel)})
                dests[fuel] = rows
        res = ", ".join("%s %d" % (k.replace(" Ore", ""), round(v)) for k, v in
                        sorted(c["caps"].items(), key=lambda x: -x[1]))
        phase = 1                                     # build phase from the most-advanced thing made
        for item in M:
            b = RMAP.get(prod.get(item, {}).get("recipe", ""), {}).get("b", "")
            if "Fuel Rod" in item or "Ficsonium" in item or "Plutonium" in item or "Uranium" in item or b == "Nuclear Plant":
                p = 5
            elif b in ("Quantum Encoder", "Converter"): p = 6
            elif b in ("Particle Accelerator", "Blender", "Manufacturer"): p = 4
            elif item == "Rocket Fuel" or b == "Fuel Gen": p = 3
            elif b == "Coal Gen": p = 1
            else: p = 2
            phase = max(phase, p)
        plan.append({"id": "c%d" % i, "name": names[i], "region": c["region"], "parent": None,
                     "tier": "", "bstep": "", "tags": "", "status": "To Do", "steps": steps,
                     "totals": {}, "sourcesN": srcs, "dests": dests, "stations": [],
                     "site": {"x": round(c["cx"] * 10), "y": round(c["cy"] * 10)},
                     "_phase": phase, "_vol": sum(M.values()),
                     "desc": "Engine-generated. Nodes: %s. %d recipes." % (res or "none", len(steps))})
    # order by build phase (then production volume) and assign tier + build-step numbers
    TIER = {1: "T1", 2: "T2", 3: "T3", 4: "T5", 5: "T7", 6: "T8"}
    plan.sort(key=lambda c: (c["_phase"], -c["_vol"]))
    seq = defaultdict(int)
    for c in plan:
        ph = c.pop("_phase"); c.pop("_vol"); seq[ph] += 1
        c["tier"] = TIER.get(ph, "T2")
        c["bstep"] = "%d.%d" % (ph, seq[ph])
    with open(os.path.join(DATA, "app_plan.json"), "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=1)
    return plan

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

    prod, byproduct_rate = build_demand(plan, RMAP)
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
    made, rem = allocate(comps, prod, ship)
    edges = route(comps, prod, made, rem, ship, RMAP)
    emit_app_plan(comps, prod, made, edges, RMAP, caps)   # write app_plan.json for the whole UI

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

    # ACTUAL raw draw, computed from what is produced (catches any over-production)
    made_tot = defaultdict(float)
    for m in made:
        for k, v in m.items(): made_tot[k] += v
    draw = defaultdict(float)
    for k, v in made_tot.items():
        for x, pu in prod.get(k, {"in": {}})["in"].items():
            if x in caps: draw[x] += pu * v

    print("=== WORLD PLAN ENGINE ===")
    print("complexes: %d | edges: %d | machines(plan clocks): %d | shipped: %d/min"
          % (out["stats"]["complexes"], out["stats"]["edges"], mach, out["stats"]["shipped_per_min"]))
    if unmet: print("UNMET raw demand:", out["stats"]["unmet_raw"])
    print("\n=== CAPS (actual raw draw vs cap) ===")
    breach = False
    for r in sorted(caps, key=lambda r: -(draw[r] / caps[r] if caps[r] else 0)):
        pct = draw[r] / caps[r] * 100 if caps[r] else 0
        if pct > 100.5: breach = True
        print("  %-14s %8.0f / %-7d %5.1f%%%s" % (r, draw[r], caps[r], pct, "  <-- OVER" if pct > 100.5 else ""))
    print("  " + ("*** CAP BREACH ***" if breach else "all under cap"))
    print("\n=== SHIP vs LOCALIZE ===")
    print("  ship: %d items | localize: %d items"
          % (sum(1 for it in prod if ship[it]), sum(1 for it in prod if not ship[it])))
    print("wrote public/data/plan_graph.json")

    if "--check" in sys.argv:
        print("\n=== COVERAGE (demand vs made) ===")
        short = [(it, prod[it]["rate"], made_tot.get(it, 0)) for it in prod
                 if made_tot.get(it, 0) < prod[it]["rate"] - 2]
        if not short:
            print("  all products fully made")
        for it, d, m in sorted(short, key=lambda x: -(x[1] - x[2]))[:20]:
            print("  SHORT %-24s demand %8.0f made %8.0f" % (it, d, m))
        print("\n=== BIGGEST EDGES (item, from -> to, rate, dist) ===")
        for e in sorted(edges, key=lambda e: -e["rate"])[:15]:
            print("  %-22s %-16s -> %-16s %8.0f (%dm)"
                  % (e["item"], comps[e["src"]]["region"][:16], comps[e["dst"]]["region"][:16],
                     e["rate"], e["dist_m"]))
        print("\n=== PER-COMPLEX LOAD (top by throughput; spot concentration) ===")
        imp = defaultdict(float); exp = defaultdict(float)
        nim = defaultdict(int); nex = defaultdict(int)
        for e in edges:
            imp[e["dst"]] += e["rate"]; nim[e["dst"]] += 1
            exp[e["src"]] += e["rate"]; nex[e["src"]] += 1
        for ci in sorted(range(len(comps)), key=lambda ci: -(imp[ci] + exp[ci]))[:10]:
            print("  %-18s makes %3d | imports %2d (%7.0f) | exports %2d (%7.0f)"
                  % (comps[ci]["region"][:18], len(made[ci]), nim[ci], imp[ci], nex[ci], exp[ci]))

if __name__ == "__main__":
    main()
