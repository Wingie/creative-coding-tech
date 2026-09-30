"""Generated categories for the cloud path.

Every Showcase photo is embedded with CLIP ViT-L/14, the embeddings are clustered
into a binary tree, and each branch is named by the vocabulary phrase that best
separates it from its sibling. The tree is the path: every split is a fork.

Used by sync_gallery.py --embed. Writes gallery-media/path.json.
"""

import os

import numpy as np

CLIP_DIR = os.path.expanduser(
    "~/.cache/huggingface/hub/models--openai--clip-vit-large-patch14/snapshots/"
    "32bd64288804d66eefd0ccbe215aa642df71cc41"
)
MIN_SIDE = 4
NEIGHBOURS = 8

# Short phrases a branch can be named after. Picked by CLIP, never written per branch.
VOCAB = [
    # light
    "warm projected light", "cool projected light", "light patterns on a face", "stripes of light",
    "dots of light", "neon tubes", "light trails", "soft window light", "hard spotlight",
    "backlit hair", "candle glow", "sunset light", "daylight", "deep shadows", "high contrast",
    "glowing skin", "reflections", "fairy lights",
    # colour
    "red and orange", "blue and purple", "green tones", "pink tones", "golden yellow",
    "black and white", "muted colours", "saturated colours", "pastel colours", "white on white",
    # backdrop and place
    "black backdrop", "white backdrop", "coloured backdrop", "painted wall", "studio",
    "trees and leaves", "city street", "by the water", "grass and park", "indoors at home",
    "under a bridge", "on a bed",
    # pose and framing
    "close up face", "full body", "hands near face", "looking away", "eyes closed",
    "lying down", "sitting", "standing tall", "two people", "profile view", "hair in motion",
    "looking at the camera",
    # mood
    "calm and quiet", "dreamy", "playful", "dramatic", "mysterious", "tender", "bold", "surreal",
]


def _device(torch):
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _load_clip():
    import torch
    from transformers import CLIPImageProcessor, CLIPModel, CLIPProcessor, CLIPTokenizer

    model = CLIPModel.from_pretrained(CLIP_DIR, local_files_only=True)
    # The cached snapshot has no preprocessor_config.json; these are CLIP's standard settings.
    images = CLIPImageProcessor(
        size={"shortest_edge": 224},
        crop_size={"height": 224, "width": 224},
        image_mean=[0.48145466, 0.4578275, 0.40821073],
        image_std=[0.26862954, 0.26130258, 0.27577711],
    )
    proc = CLIPProcessor(image_processor=images, tokenizer=CLIPTokenizer.from_pretrained(CLIP_DIR, local_files_only=True))
    dev = _device(torch)
    return torch, model.to(dev).eval(), proc, dev


def _unit(x):
    return x / np.linalg.norm(x, axis=-1, keepdims=True)


def embed(photos, out, clip=None):
    """photos: [(id, path_to_640)]. Returns (ids, unit vectors), cached in embeddings.npz."""
    from PIL import Image

    cache_path = os.path.join(out, "embeddings.npz")
    cache = {}
    if os.path.exists(cache_path):
        z = np.load(cache_path)
        cache = dict(zip(z["ids"].tolist(), z["vecs"]))
    todo = [(i, p) for i, p in photos if i not in cache and os.path.exists(p)]
    if todo:
        torch, model, proc, dev = clip or _load_clip()
        for start in range(0, len(todo), 16):
            batch = todo[start : start + 16]
            ims = [Image.open(p).convert("RGB") for _, p in batch]
            with torch.no_grad():
                inp = proc(images=ims, return_tensors="pt").to(dev)
                v = model.get_image_features(**inp).float().cpu().numpy()
            for (i, _), vec in zip(batch, v):
                cache[i] = vec
            print("  embedded %d/%d" % (min(start + 16, len(todo)), len(todo)), flush=True)
        ids_all = list(cache)
        np.savez(cache_path, ids=np.array(ids_all), vecs=np.stack([cache[i] for i in ids_all]))
    ids = [i for i, _ in photos if i in cache]
    return ids, _unit(np.stack([cache[i] for i in ids]))


def text_vectors(clip):
    torch, model, proc, dev = clip
    with torch.no_grad():
        inp = proc(text=["a photo with " + t for t in VOCAB], return_tensors="pt", padding=True).to(dev)
        t = model.get_text_features(**inp).float().cpu().numpy()
    return _unit(t)


def build_tree(vecs):
    """Agglomerative clustering into a binary tree. Returns (children, n_leaves)."""
    from sklearn.cluster import AgglomerativeClustering

    ac = AgglomerativeClustering(n_clusters=1, linkage="ward", compute_full_tree=True)
    ac.fit(vecs)
    return ac.children_, len(vecs)


def collapse(children, n):
    """Turn sklearn's merge list into nested nodes, dropping splits with a side under MIN_SIDE."""
    members = {i: [i] for i in range(n)}
    for k, (a, b) in enumerate(children):
        members[n + k] = members[a] + members[b]
    kids = {n + k: (int(a), int(b)) for k, (a, b) in enumerate(children)}

    def split(i):
        """First descendant split (following the bigger side) where both sides are big enough."""
        while i in kids:
            a, b = kids[i]
            if len(members[a]) >= MIN_SIDE and len(members[b]) >= MIN_SIDE:
                return a, b
            i = a if len(members[a]) >= len(members[b]) else b
        return None

    def node(i):
        s = split(i)
        # A node keeps all its members; lopsided merges below it are skipped, so the
        # few photos they peel off are only seen on this node's stretch of carpet.
        return {"id": i, "members": members[i], "children": [node(s[0]), node(s[1])] if s else []}

    return node(n + len(children) - 1)


def name_branches(tree, img, txt):
    """Name each child by the phrase with the largest mean-similarity gap to its sibling."""
    used_by_parent = {}

    def walk(nd, depth):
        ch = nd["children"]
        if len(ch) == 2:
            sims = [img[c["members"]] @ txt.T for c in ch]
            means = [s.mean(axis=0) for s in sims]
            taken = set(used_by_parent.get(id(nd), []))
            for side in (0, 1):
                gap = means[side] - means[1 - side]
                # Only phrases that actually describe this side (its top 12 by similarity)
                # compete; among those, the one that best tells it apart from its sibling wins.
                fits = set(int(j) for j in np.argsort(-means[side])[:12])
                order = [j for j in np.argsort(-gap) if int(j) in fits] + list(np.argsort(-gap))
                pick = next(int(j) for j in order if int(j) not in taken)
                taken.add(pick)
                ch[side]["name"] = VOCAB[pick]
                used_by_parent[id(ch[side])] = [pick]
            for c in ch:
                walk(c, depth + 1)

    tree["name"] = "everything"
    walk(tree, 0)


def write_path(photo_recs, img, ids, txt, out_path):
    import json

    children, n = build_tree(img)
    tree = collapse(children, n)
    name_branches(tree, img, txt)

    nodes = {}
    depth_max = [0]
    forks = [0]

    def emit(nd, depth):
        depth_max[0] = max(depth_max[0], depth)
        key = "n%d" % nd["id"]
        entry = {"name": nd.get("name", ""), "photos": [ids[m] for m in nd["members"]]}
        if nd["children"]:
            forks[0] += 1
            entry["children"] = [emit(c, depth + 1) for c in nd["children"]]
        nodes[key] = entry
        return key

    root = emit(tree, 0)
    # order each leaf/node's photos by similarity chain is done client side via neighbours
    sim = img @ img.T
    np.fill_diagonal(sim, -1)
    neighbours = {ids[i]: [ids[j] for j in np.argsort(-sim[i])[:NEIGHBOURS]] for i in range(len(ids))}
    data = {"root": root, "nodes": nodes, "photos": photo_recs, "neighbours": neighbours}
    with open(out_path, "w") as f:
        json.dump(data, f)
    return tree, depth_max[0], forks[0], nodes, root


def run(rooms, curation, out):
    """rooms: gallery_all rooms. Honours sitter_ok and hidden from curation."""
    recs, pairs = {}, []
    for room in rooms:
        c = curation.get(room["slug"], {})
        if not c.get("sitter_ok", room.get("sitter_ok", False)):
            continue
        hidden = set(c.get("hidden", []))
        treatment = c.get("treatment", {})
        for p in room["photos"]:
            if p["id"] in hidden or "src640" not in p:
                continue
            r = {k: p[k] for k in ("src640", "src1280", "w", "h", "score", "captured") if k in p}
            for k in ("vector", "cutout", "themes"):
                if p.get(k):
                    r[k] = p[k]
            if treatment.get(p["id"]):
                r["treatment"] = treatment[p["id"]]
            r["room"] = room["name"]
            recs[p["id"]] = r
            pairs.append((p["id"], os.path.join(out, p["src640"])))
    clip = _load_clip()
    ids, img = embed(pairs, out, clip)
    txt = text_vectors(clip)
    recs = {i: recs[i] for i in ids}
    tree, depth, forks, nodes, root = write_path(recs, img, ids, txt, os.path.join(out, "path.json"))
    print("path.json: %d photos, %d forks, depth %d" % (len(ids), forks, depth))
    # first three forks, breadth first
    queue, shown = [root], 0
    while queue and shown < 3:
        k = queue.pop(0)
        ch = nodes[k].get("children")
        if ch:
            a, b = (nodes[c] for c in ch)
            print("  fork %s: %s (%d) / %s (%d)" % (k, a["name"], len(a["photos"]), b["name"], len(b["photos"])))
            shown += 1
            queue += ch
    return nodes, root
