"""Group the photos by what people are actually wearing.

The garment tags in tags.json say "long dress" but not which long dress, so they
cannot tell one sitter's red dress from another's. This crops the clothing out of
each photo with YOLOE and embeds the crop with CLIP, so the same garment lands in
the same place whoever is wearing it. Clusters of that embedding are outfits, and
a cluster holding more than one sitter is the same outfit on different people.

Writes gallery-media/outfits.json, caching crop embeddings in outfits.npz.

    python3 scripts/gallery_outfits.py                  # everything not yet done
    python3 scripts/gallery_outfits.py --threshold 0.1  # tighter grouping
    python3 scripts/gallery_outfits.py --report         # no re-crop, just regroup
"""

import argparse
import json
import os
import sys
from collections import Counter

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "gallery-media")

# What counts as the outfit. The small things are left out on purpose: a crop
# around a pair of earrings tells you nothing about what someone is wearing.
OUTFIT = [
    "dress", "long dress", "jacket", "leather jacket", "coat", "shirt", "t-shirt",
    "top", "crop top", "jumper", "cardigan", "jeans", "trousers", "shorts", "skirt",
    "swimsuit", "lingerie", "veil", "scarf",
]
PAD = 0.06          # a little context around the clothing
MIN_CLUSTER = 3
THRESHOLD = 0.12    # cosine distance; below this two crops are the same outfit


def crop_box(result, w, h):
    """Union of the clothing boxes, padded, as (l, t, r, b) in pixels."""
    best = None
    for b in result.boxes or []:
        if float(b.conf) < 0.2:
            continue
        x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
        best = (min(best[0], x1), min(best[1], y1), max(best[2], x2), max(best[3], y2)) if best else (x1, y1, x2, y2)
    if not best:
        return None
    px = (best[2] - best[0]) * PAD
    py = (best[3] - best[1]) * PAD
    l, t = max(0, best[0] - px), max(0, best[1] - py)
    r, b2 = min(w, best[2] + px), min(h, best[3] + py)
    if r - l < 24 or b2 - t < 24:
        return None
    return (int(l), int(t), int(r), int(b2))


def embed_crops(photos, out, force=False):
    """photos: [(id, path)]. Returns {id: unit vector} over the clothing crop."""
    from PIL import Image

    cache_path = os.path.join(out, "outfits.npz")
    cache = {}
    if os.path.exists(cache_path) and not force:
        z = np.load(cache_path)
        cache = dict(zip(z["ids"].tolist(), z["vecs"]))
    todo = [(i, p) for i, p in photos if i not in cache and os.path.exists(p)]
    print("%d crops to make (%d cached)" % (len(todo), len(cache)), flush=True)
    if not todo:
        return cache

    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    import gallery_path as gp
    from ultralytics import YOLOE

    os.makedirs(os.path.join(ROOT, "models"), exist_ok=True)
    os.chdir(os.path.join(ROOT, "models"))
    torch, model, proc, dev = gp._load_clip()
    yoloe = YOLOE("yoloe-26l-seg.pt")
    yoloe.set_classes(OUTFIT, yoloe.get_text_pe(OUTFIT))

    for n, (pid, path) in enumerate(todo, 1):
        im = Image.open(path).convert("RGB")
        r = yoloe.predict(path, conf=0.2, verbose=False, device="mps" if torch.backends.mps.is_available() else "cpu")[0]
        box = crop_box(r, im.width, im.height)
        if not box:
            continue
        with torch.no_grad():
            inp = proc(images=[im.crop(box)], return_tensors="pt").to(dev)
            v = model.get_image_features(**inp).float().cpu().numpy()[0]
        cache[pid] = v / np.linalg.norm(v)
        if n % 50 == 0 or n == len(todo):
            ids = list(cache)
            np.savez(cache_path, ids=np.array(ids), vecs=np.stack([cache[i] for i in ids]))
            print("  %d/%d" % (n, len(todo)), flush=True)
    ids = list(cache)
    np.savez(cache_path, ids=np.array(ids), vecs=np.stack([cache[i] for i in ids]))
    return cache


def name_cluster(ids, tags):
    """Commonest garment, coloured by the colour phrase already in tags.json."""
    garments = Counter()
    colours = Counter()
    for i in ids:
        t = tags.get(i, {})
        for g in t.get("dress", []):
            if g in OUTFIT:
                garments[g] += 1
        if t.get("colour"):
            colours[t["colour"]] += 1
    g = garments.most_common(1)[0][0] if garments else "outfit"
    c = colours.most_common(1)[0][0] if colours else ""
    # "muted colours long dress" reads badly; keep the plain colour words only
    if c and " " not in c.replace(" and ", "&"):
        return (c + " " + g).strip()
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=THRESHOLD)
    ap.add_argument("--report", action="store_true", help="regroup from the cache, no cropping")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--out", default=MEDIA)
    args = ap.parse_args()
    out = os.path.abspath(args.out)

    data = json.load(open(os.path.join(out, "path.json")))
    photos = data["photos"]
    tags = json.load(open(os.path.join(out, "tags.json"))) if os.path.exists(os.path.join(out, "tags.json")) else {}
    pairs = [(pid, os.path.join(out, r["src640"])) for pid, r in photos.items() if r.get("src640")]

    if args.report:
        z = np.load(os.path.join(out, "outfits.npz"))
        cache = dict(zip(z["ids"].tolist(), z["vecs"]))
    else:
        cache = embed_crops(pairs, out, args.force)
    if len(cache) < MIN_CLUSTER:
        sys.exit("not enough clothing crops to group")

    ids = [i for i in photos if i in cache]
    vecs = np.stack([cache[i] for i in ids])

    from sklearn.cluster import AgglomerativeClustering

    ac = AgglomerativeClustering(n_clusters=None, distance_threshold=args.threshold, metric="cosine", linkage="average")
    labels = ac.fit_predict(vecs)

    groups = {}
    for i, lab in zip(ids, labels):
        groups.setdefault(int(lab), []).append(i)
    groups = {k: v for k, v in groups.items() if len(v) >= MIN_CLUSTER}

    outfits = {}
    of_photo = {}
    used = {}
    for n, (_, members) in enumerate(sorted(groups.items(), key=lambda kv: -len(kv[1]))):
        key = "o%d" % n
        sitters = sorted({photos[i].get("room", "?") for i in members})
        name = name_cluster(members, tags)
        # the garment classifier disagrees with itself across a shoot, so two groups
        # can land on the same words; the sitter tells them apart
        if name in used:
            name = "%s \u00b7 %s" % (name, sitters[0])
        while name in used:
            used[name] += 1
            name = "%s %d" % (name, used[name])
        used.setdefault(name, 1)
        outfits[key] = {"name": name, "photos": members, "sitters": sitters}
        for i in members:
            of_photo[i] = key

    path = os.path.join(out, "outfits.json")
    with open(path, "w") as f:
        json.dump({"outfits": outfits, "of": of_photo}, f)

    sizes = sorted((len(v["photos"]) for v in outfits.values()), reverse=True)
    shared = {k: v for k, v in outfits.items() if len(v["sitters"]) > 1}
    print("\n%d outfit groups over %d photos (%d photos grouped, %d left ungrouped)" % (
        len(outfits), len(ids), sum(sizes), len(ids) - sum(sizes)))
    print("group sizes:", sizes[:20], "..." if len(sizes) > 20 else "")
    print("\n%d groups span more than one sitter:" % len(shared))
    for k, v in sorted(shared.items(), key=lambda kv: -len(kv[1]["photos"]))[:15]:
        print("  %-26s %2d photos  %s" % (v["name"], len(v["photos"]), ", ".join(v["sitters"])))
    if not shared:
        print("  (none — every outfit stayed inside one shoot)")
    print("\nwrote", path)


if __name__ == "__main__":
    main()
