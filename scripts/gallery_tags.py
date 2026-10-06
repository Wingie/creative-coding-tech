"""Generated tags for every Showcase photo.

Lightroom has no keywords for these pictures — the share payload carries none and
the local catalogue has no keyword documents — so the categories have to come from
the pictures themselves. Four axes:

  dress   YOLOE, open vocabulary, prompted with garment names
  pose    YOLO26 pose keypoints turned into readable phrases by geometry
  scene   YOLO26 over COCO, for what else is in the room
  light   CLIP against a vocabulary of light, colour and mood phrases

Writes gallery-media/tags.json, keyed by photo id, cached so a second run only
looks at photos it has not seen.

    python3 scripts/gallery_tags.py                # everything not yet tagged
    python3 scripts/gallery_tags.py --limit 20     # a quick look
    python3 scripts/gallery_tags.py --force        # redo them all
"""

import argparse
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "gallery-media")

# Open-vocabulary prompts. YOLOE takes arbitrary names, so this list is editable
# without retraining anything.
GARMENTS = [
    "dress", "long dress", "jacket", "leather jacket", "coat", "shirt", "t-shirt",
    "top", "crop top", "jumper", "cardigan", "jeans", "trousers", "shorts", "skirt",
    "swimsuit", "lingerie", "veil", "scarf", "hat", "cap", "glasses", "sunglasses",
    "earrings", "necklace", "boots", "shoes", "bare shoulders",
]

# CLIP phrases, grouped so each group contributes its own best match rather than
# one global winner.
PHRASES = {
    "light": [
        "warm projected light", "cool projected light", "light patterns on a face",
        "stripes of light", "dots of light", "neon tubes", "light trails",
        "soft window light", "hard spotlight", "backlit hair", "sunset light",
        "daylight", "deep shadows", "high contrast", "fairy lights", "flat even light",
    ],
    "colour": [
        "red and orange", "blue and purple", "green tones", "pink tones",
        "golden yellow", "black and white", "muted colours", "saturated colours",
        "pastel colours", "white on white",
    ],
    "fabric": [
        "sheer fabric", "denim", "leather", "knitted wool", "satin", "lace",
        "sequins", "cotton", "velvet",
    ],
    "mood": [
        "calm and quiet", "dreamy", "playful", "dramatic", "mysterious", "tender",
        "bold", "surreal",
    ],
    "place": [
        "black backdrop", "white backdrop", "coloured backdrop", "painted wall",
        "studio", "trees and leaves", "city street", "by the water", "grass and park",
        "indoors at home", "under a bridge", "on a bed",
    ],
}

# How sure CLIP has to be before a group contributes a tag at all. Below this the
# best phrase is no better than the second, and the tag would be noise. Tuned on a
# first pass that only tagged mood on 17% of photos.
CLIP_MARGIN = 0.004
YOLO_CONF = 0.25
GARMENT_CONF = 0.20

KP = {
    "nose": 0, "l_eye": 1, "r_eye": 2, "l_ear": 3, "r_ear": 4,
    "l_shoulder": 5, "r_shoulder": 6, "l_elbow": 7, "r_elbow": 8,
    "l_wrist": 9, "r_wrist": 10, "l_hip": 11, "r_hip": 12,
    "l_knee": 13, "r_knee": 14, "l_ankle": 15, "r_ankle": 16,
}


def device():
    import torch

    return "mps" if torch.backends.mps.is_available() else "cpu"


def pose_tags(keypoints, conf, box, img_h):
    """COCO keypoints -> phrases a person would use. keypoints: (17, 2), conf: (17,)."""
    def seen(name, t=0.5):
        return conf[KP[name]] > t

    def pt(name):
        return keypoints[KP[name]]

    out = []
    # scale everything by shoulder width, so it works at any crop
    if seen("l_shoulder") and seen("r_shoulder"):
        span = float(np.linalg.norm(pt("l_shoulder") - pt("r_shoulder")))
    else:
        span = float(box[3] - box[1]) * 0.3
    if span < 1e-3:
        return out

    if seen("nose"):
        for w in ("l_wrist", "r_wrist"):
            if seen(w) and np.linalg.norm(pt(w) - pt("nose")) < span * 1.1:
                out.append("hands near face")
                break
    for w, s in (("l_wrist", "l_shoulder"), ("r_wrist", "r_shoulder")):
        if seen(w) and seen(s) and pt(w)[1] < pt(s)[1] - span * 0.2:
            out.append("arms raised")
            break

    # sitting: knees are up near the hips rather than below them
    if seen("l_hip") and seen("l_knee") and seen("l_shoulder"):
        torso = abs(pt("l_shoulder")[1] - pt("l_hip")[1])
        thigh = abs(pt("l_knee")[1] - pt("l_hip")[1])
        if torso > 1e-3 and thigh < torso * 0.6:
            out.append("sitting")

    ears = sum(1 for e in ("l_ear", "r_ear") if seen(e))
    if not seen("nose", 0.35):
        out.append("turned away")
    elif ears == 1:
        out.append("profile view")
    elif seen("l_eye") and seen("r_eye"):
        out.append("looking at the camera")

    if seen("l_ankle") or seen("r_ankle"):
        out.append("full body")
    elif (box[3] - box[1]) > img_h * 0.75 and not seen("l_hip"):
        out.append("close up face")
    return out


def load_models():
    from ultralytics import YOLO, YOLOE

    # ultralytics downloads into the working directory unless told otherwise
    os.makedirs(os.path.join(ROOT, "models"), exist_ok=True)
    os.chdir(os.path.join(ROOT, "models"))
    dev = device()
    print("  loading models on %s (first run downloads weights)" % dev, flush=True)
    garment = YOLOE("yoloe-26l-seg.pt")
    garment.set_classes(GARMENTS, garment.get_text_pe(GARMENTS))
    pose = YOLO("yolo26l-pose.pt")
    scene = YOLO("yolo26l.pt")
    return dev, garment, pose, scene


def clip_bank():
    """CLIP, plus a unit text vector per phrase, grouped."""
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    import gallery_path as gp

    clip = gp._load_clip()
    torch, model, proc, dev = clip
    bank = {}
    for group, phrases in PHRASES.items():
        with torch.no_grad():
            inp = proc(text=["a photo with " + p for p in phrases], return_tensors="pt", padding=True).to(dev)
            v = model.get_text_features(**inp).float().cpu().numpy()
        bank[group] = v / np.linalg.norm(v, axis=-1, keepdims=True)
    return clip, bank


def clip_tags(vec, bank):
    """Best phrase per group, but only where it clearly beats the runner-up."""
    out = {}
    for group, mat in bank.items():
        sims = mat @ vec
        order = np.argsort(-sims)
        if len(order) < 2 or sims[order[0]] - sims[order[1]] >= CLIP_MARGIN:
            out[group] = PHRASES[group][int(order[0])]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only this many photos, for a quick look")
    ap.add_argument("--force", action="store_true", help="retag photos already done")
    ap.add_argument("--out", default=MEDIA)
    args = ap.parse_args()
    args.out = os.path.abspath(args.out)  # load_models chdirs, so fix paths first

    path_json = os.path.join(args.out, "path.json")
    if not os.path.exists(path_json):
        sys.exit("no path.json in %s — run sync_gallery.py --embed first" % args.out)
    photos = json.load(open(path_json))["photos"]

    tags_path = os.path.join(args.out, "tags.json")
    tags = {} if args.force else (json.load(open(tags_path)) if os.path.exists(tags_path) else {})

    todo = []
    for pid, rec in photos.items():
        if pid in tags or "src640" not in rec:
            continue
        f = os.path.join(args.out, rec["src640"])
        if os.path.exists(f):
            todo.append((pid, f))
    if args.limit:
        todo = todo[: args.limit]
    print("%d photos to tag (%d already done)" % (len(todo), len(tags)), flush=True)
    if not todo:
        return

    from PIL import Image

    dev, garment, pose, scene = load_models()
    clip, bank = clip_bank()
    torch, model, proc, cdev = clip

    for n, (pid, f) in enumerate(todo, 1):
        rec = {"dress": [], "pose": [], "scene": [], "people": 0}

        g = garment.predict(f, conf=GARMENT_CONF, verbose=False, device=dev)[0]
        seen = {}
        for b in g.boxes:
            name = GARMENTS[int(b.cls)]
            seen[name] = max(seen.get(name, 0), float(b.conf))
        rec["dress"] = [k for k, _ in sorted(seen.items(), key=lambda kv: -kv[1])[:4]]

        pr = pose.predict(f, conf=YOLO_CONF, verbose=False, device=dev)[0]
        rec["people"] = len(pr.boxes)
        if len(pr.boxes):
            # the biggest person in the frame is the subject
            areas = [(float((b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1])), i) for i, b in enumerate(pr.boxes)]
            _, i = max(areas)
            kxy = pr.keypoints.xy[i].cpu().numpy()
            kcf = pr.keypoints.conf[i].cpu().numpy() if pr.keypoints.conf is not None else np.ones(17)
            box = pr.boxes[i].xyxy[0].cpu().numpy()
            rec["pose"] = pose_tags(kxy, kcf, box, pr.orig_shape[0])
        if rec["people"] > 1:
            rec["pose"].append("two people")

        sc = scene.predict(f, conf=YOLO_CONF, verbose=False, device=dev)[0]
        objs = {}
        for b in sc.boxes:
            name = sc.names[int(b.cls)]
            if name == "person":
                continue
            objs[name] = max(objs.get(name, 0), float(b.conf))
        rec["scene"] = [k for k, _ in sorted(objs.items(), key=lambda kv: -kv[1])[:4]]

        with torch.no_grad():
            inp = proc(images=[Image.open(f).convert("RGB")], return_tensors="pt").to(cdev)
            v = model.get_image_features(**inp).float().cpu().numpy()[0]
        rec.update(clip_tags(v / np.linalg.norm(v), bank))

        tags[pid] = rec
        if n % 25 == 0 or n == len(todo):
            with open(tags_path, "w") as fh:
                json.dump(tags, fh)
            print("  %d/%d" % (n, len(todo)), flush=True)

    with open(tags_path, "w") as fh:
        json.dump(tags, fh)

    # what did we actually get?
    from collections import Counter
    print("\ntagged %d photos -> %s" % (len(tags), tags_path))
    for axis in ("dress", "pose", "scene", "light", "colour", "fabric", "mood", "place"):
        c = Counter()
        for r in tags.values():
            v = r.get(axis)
            c.update(v if isinstance(v, list) else ([v] if v else []))
        have = sum(1 for r in tags.values() if r.get(axis))
        print("  %-7s %3d%% of photos | %s" % (
            axis, round(100 * have / max(1, len(tags))),
            ", ".join("%s %d" % kv for kv in c.most_common(8)) or "-"))


if __name__ == "__main__":
    main()
