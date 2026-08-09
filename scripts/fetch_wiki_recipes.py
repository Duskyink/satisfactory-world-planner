"""
Fetch complete Satisfactory recipe/item/building data from the official wiki
and rebuild public/data/recipes.json from the authoritative source.

Compares against our current file to report what's missing.
"""
import json, re, os, sys

# We'll use the wiki's raw JSON templates
# The data is inside a <pre> or <code> block in the HTML
# We need to extract just the JSON

BASE = os.path.join(os.path.dirname(__file__), "..", "public", "data")

def load_wiki_json(url):
    """Fetch a wiki template page and extract the JSON from it."""
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "SatisfactoryPlanner/1.0"})
    html = urllib.request.urlopen(req).read().decode("utf-8")
    # The JSON is inside a <pre> tag with class mw-code
    # Try to find the JSON block
    # Look for the content between <pre ...> and </pre>
    m = re.search(r'<pre[^>]*>(.*?)</pre>', html, re.DOTALL)
    if not m:
        # Try code block
        m = re.search(r'<code[^>]*>(.*?)</code>', html, re.DOTALL)
    if not m:
        # The JSON might be directly in a div
        # Try to find a large JSON object
        m = re.search(r'(\{["\s]*\w+[^}]{100,})', html, re.DOTALL)
    if m:
        txt = m.group(1)
        # Unescape HTML entities
        txt = txt.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", '"')
        return json.loads(txt)
    return None

def load_wiki_json_raw(url):
    """Fetch raw wiki source via action=raw"""
    import urllib.request
    raw_url = url + "?action=raw"
    req = urllib.request.Request(raw_url, headers={"User-Agent": "SatisfactoryPlanner/1.0"})
    txt = urllib.request.urlopen(req).read().decode("utf-8")
    return json.loads(txt)

print("Fetching items...")
try:
    items_data = load_wiki_json_raw("https://satisfactory.wiki.gg/wiki/Template:DocsItems.json")
    print(f"  Got {len(items_data)} item entries")
except Exception as e:
    print(f"  Failed: {e}")
    items_data = {}

print("Fetching buildings...")
try:
    buildings_data = load_wiki_json_raw("https://satisfactory.wiki.gg/wiki/Template:DocsBuildings.json")
    print(f"  Got {len(buildings_data)} building entries")
except Exception as e:
    print(f"  Failed: {e}")
    buildings_data = {}

print("Fetching recipes...")
try:
    recipes_data = load_wiki_json_raw("https://satisfactory.wiki.gg/wiki/Template:DocsRecipes.json")
    print(f"  Got {len(recipes_data)} recipe entries")
except Exception as e:
    print(f"  Failed: {e}")
    recipes_data = {}

# Build item name lookup: className -> display name
item_names = {}
for key, entries in items_data.items():
    for entry in (entries if isinstance(entries, list) else [entries]):
        item_names[entry.get("className", key)] = entry.get("name", key)

# Build building name lookup
bldg_names = {}
for key, entries in buildings_data.items():
    for entry in (entries if isinstance(entries, list) else [entries]):
        bldg_names[entry.get("className", key)] = entry.get("name", key)

# Convert recipes to our format
# Our format: {"n": name, "b": building, "i": [[item, qty/min], ...], "o": [[item, qty/min], ...]}
# Wiki format uses total amounts per cycle + duration in seconds

our_recipes = []
skipped_build_gun = 0
skipped_no_building = 0

for key, entries in recipes_data.items():
    for r in (entries if isinstance(entries, list) else [entries]):
        name = r.get("name", key)
        duration = r.get("duration", 1)
        produced_in = r.get("producedIn", [])
        
        # Skip build gun / customizer only recipes (buildings, not production)
        if not produced_in:
            if r.get("inBuildGun") or r.get("inCustomizer"):
                skipped_build_gun += 1
                continue
            if r.get("inWorkshop") or r.get("inCraftBench"):
                # Hand-crafted only, skip for automation
                skipped_no_building += 1
                continue
            skipped_no_building += 1
            continue
        
        # Get building name
        bldg_class = produced_in[0] if produced_in else ""
        bldg = bldg_names.get(bldg_class, bldg_class.replace("Desc_", "").replace("_C", "").replace("Mk1", ""))
        
        # Convert ingredients: amount per cycle -> per minute
        # rate = amount * 60 / duration
        inputs = []
        for ing in r.get("ingredients", []):
            item_class = ing["item"]
            item_name = item_names.get(item_class, item_class)
            rate = ing["amount"] * 60 / duration
            inputs.append([item_name, round(rate, 4)])
        
        outputs = []
        for prod in r.get("products", []):
            item_class = prod["item"]
            item_name = item_names.get(item_class, item_class)
            rate = prod["amount"] * 60 / duration
            outputs.append([item_name, round(rate, 4)])
        
        if not outputs:
            # Some burn recipes have no products listed (ficsonium)
            # We'll handle power output separately
            pass
        
        our_recipes.append({
            "n": name,
            "b": bldg,
            "i": inputs,
            "o": outputs,
            "_alt": r.get("alternate", False),
            "_class": r.get("className", key)
        })

print(f"\nConverted {len(our_recipes)} production recipes")
print(f"Skipped {skipped_build_gun} build-gun recipes, {skipped_no_building} no-building recipes")

# Compare with our current recipes.json
current = json.load(open(os.path.join(BASE, "recipes.json"), encoding="utf-8"))
current_names = {r["n"] for r in current}
wiki_names = {r["n"] for r in our_recipes}

missing = wiki_names - current_names
extra = current_names - wiki_names

print(f"\nCurrent recipes.json: {len(current)} recipes")
print(f"Wiki production recipes: {len(our_recipes)}")
print(f"Missing from our file: {len(missing)}")
print(f"In our file but not wiki: {len(extra)}")

if missing:
    print("\n=== MISSING RECIPES (in wiki, not in our file) ===")
    for name in sorted(missing):
        r = next(x for x in our_recipes if x["n"] == name)
        print(f"  {name} ({r['b']}) {'[ALT]' if r['_alt'] else ''}")
        print(f"    in: {r['i']}")
        print(f"    out: {r['o']}")

if extra:
    print("\n=== EXTRA RECIPES (in our file, not in wiki) ===")
    for name in sorted(extra):
        print(f"  {name}")
