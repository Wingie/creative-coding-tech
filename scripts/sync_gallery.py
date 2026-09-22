#!/usr/bin/env python3
"""Sync the Lightroom Showcases albums into the walkable gallery.

Reads _data/gallery_people.yml (one room per Showcases album, each with a public
Lightroom share link), pulls the edited renditions through Lightroom's public
share API, and writes a media folder the gallery page reads:

    gallery-media/
        gallery.json        what the public gallery shows (curated, sitter_ok only)
        gallery_all.json    every photo before curation (the curation page uses it)
        curation.json       written by the curation page, merged over the automatic picks
        <slug>/<id>_640.jpg, <id>_2048.jpg, <id>_vec.svg, <id>_cutout.png (optional)

Only Showcases albums belong in the yml. Full shoots stay private.

Usage:
    python3 scripts/sync_gallery.py                 # sync into gallery-media/
    python3 scripts/sync_gallery.py --dry-run       # print counts, write nothing
    python3 scripts/sync_gallery.py --upload        # also push the folder to R2
"""

import argparse
import colorsys
import concurrent.futures
import datetime
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

import yaml
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LR = "https://lightroom.adobe.com/v2/spaces/"
UA = {"User-Agent": "creativecodingtech-gallery-sync/1.0"}
THEMES = ["light", "studio-dark", "studio-white", "outdoor", "bw"]
TREATMENTS = ["photo", "vector", "cutout"]


# ---------------------------------------------------------------- Lightroom


def _get(url):
    # No Origin header: Lightroom answers 403 to cross-origin rendition requests.
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read(), resp.geturl()


def _get_json(url):
    body, _ = _get(url)
    text = body.decode("utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Lightroom prefixes JSON with a `while (1) {}` line.
        return json.loads(text.split("\n", 1)[1])


def resolve_space(share_url):
    """adobe.ly/<x> or lightroom.adobe.com/shares/<space> -> space id."""
    _, final = _get(share_url)
    parts = [p for p in final.split("?")[0].split("/") if p]
    return parts[-1]


def album_assets(space):
    resources = _get_json(LR + space + "/resources")["resources"]
    albums = [r for r in resources if r.get("type") == "album"]
    if not albums:
        raise RuntimeError("share %s has no album" % space)
    album = albums[0]
    url = LR + space + "/albums/" + album["id"] + "/assets?embed=asset&subtype=image&limit=500"
    assets = []
    while url:
        page = _get_json(url)
        for r in page.get("resources", []):
            a = r.get("asset")
            if a:
                assets.append(a)
        nxt = page.get("links", {}).get("next", {}).get("href")
        url = LR + space + "/" + nxt if nxt else None
    return album, assets


# ---------------------------------------------------------------- images


def download(space, asset, size, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    link = asset.get("links", {}).get("/rels/rendition_type/" + size)
    if not link:
        return False
    body = None
    for attempt in range(3):
        try:
            body, _ = _get(LR + space + "/" + link["href"])
            break
        except urllib.error.HTTPError as e:
            err = e.code
        except urllib.error.URLError as e:
            err = e.reason
        time.sleep(1 + attempt * 2)
    if body is None:
        print("  ! %s %s: %s" % (asset["id"], size, err), file=sys.stderr)
        return False
    with open(dest + ".part", "wb") as f:
        f.write(body)
    os.replace(dest + ".part", dest)
    return True


def pixel_themes(path):
    """Fallback themes from pixel statistics, used when search has not tagged a photo."""
    im = Image.open(path).convert("RGB").resize((64, 64))
    px = list(im.getdata())
    hsv = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in px]
    n = len(hsv)
    mean_s = sum(s for _, s, _ in hsv) / n
    mean_v = sum(v for _, _, v in hsv) / n
    border = [hsv[i] for i in range(n) if i % 64 in (0, 1, 62, 63) or i // 64 in (0, 1, 62, 63)]
    border_v = sum(v for _, _, v in border) / len(border)
    hot = sum(1 for _, s, v in hsv if s > 0.5 and v > 0.4) / n
    nature = sum(1 for h, s, v in hsv if s > 0.25 and v > 0.3 and (0.16 < h < 0.47 or 0.5 < h < 0.67)) / n

    themes = []
    if mean_s < 0.08:
        themes.append("bw")
    if mean_v < 0.35 and hot > 0.05 and mean_s >= 0.08:
        themes.append("light")
    if mean_v < 0.3 and border_v < 0.2:
        themes.append("studio-dark")
    if border_v > 0.75:
        themes.append("studio-white")
    if nature > 0.25 and mean_v > 0.35:
        themes.append("outdoor")
    return themes


def vectorize(src, dest, grid_w=200, colours=6):
    """Posterize and trace into flat colour rectangles, one <path> per colour."""
    if os.path.exists(dest):
        return True
    im = Image.open(src).convert("RGB")
    w, h = im.size
    gw, gh = grid_w, max(1, round(grid_w * h / w))
    small = im.resize((gw, gh), Image.LANCZOS)
    q = small.quantize(colors=colours, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: colours * 3]
    # Mode filter on the palette indices removes speckle so shapes read as flat areas.
    q = Image.frombytes("L", q.size, q.tobytes()).filter(ImageFilter.ModeFilter(5))
    idx = list(q.getdata())

    counts = [0] * colours
    for c in idx:
        counts[c] += 1
    bg = counts.index(max(counts))

    # Greedy rectangles: horizontal runs, extended downward while the run repeats.
    open_runs = {}  # (x0, x1, c) -> y0
    rects = {c: [] for c in range(colours)}
    for y in range(gh + 1):
        row = []
        if y < gh:
            x = 0
            while x < gw:
                c = idx[y * gw + x]
                x1 = x
                while x1 + 1 < gw and idx[y * gw + x1 + 1] == c:
                    x1 += 1
                if c != bg:
                    row.append((x, x1 + 1, c))
                x = x1 + 1
        current = set(row)
        for key in list(open_runs):
            if key not in current:
                x0, x1, c = key
                y0 = open_runs.pop(key)
                rects[c].append((x0, y0, x1 - x0, y - y0))
        for key in row:
            if key not in open_runs:
                open_runs[key] = y

    def hexc(c):
        r, g, b = pal[c * 3 : c * 3 + 3]
        return "#%02x%02x%02x" % (r, g, b)

    scale = 8
    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" shape-rendering="crispEdges">'
        % (gw * scale, gh * scale, gw, gh),
        '<rect width="%d" height="%d" fill="%s"/>' % (gw, gh, hexc(bg)),
    ]
    for c, rs in rects.items():
        if not rs:
            continue
        d = "".join("M%d %dh%dv%dh-%dz" % (x, y, rw, rh, rw) for x, y, rw, rh in rs)
        out.append('<path fill="%s" d="%s"/>' % (hexc(c), d))
    out.append("</svg>")
    with open(dest, "w") as f:
        f.write("".join(out))
    return True


# ---------------------------------------------------------------- sync


def load_people():
    with open(os.path.join(ROOT, "_data", "gallery_people.yml")) as f:
        return yaml.safe_load(f) or []


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def sync_room(person, out, search_themes, make_vectors, dry_run):
    space = resolve_space(person["share"])
    album, assets = album_assets(space)
    room_dir = os.path.join(out, person["slug"])
    if not dry_run:
        os.makedirs(room_dir, exist_ok=True)

    def one(a):
        aid = a["id"]
        p = a.get("payload", {})
        rec = {
            "id": aid,
            "score": (p.get("aesthetics") or {}).get("score"),
            "captured": p.get("captureDate"),
        }
        if dry_run:
            rec["themes"] = search_themes.get(aid, [])
            return rec
        big = os.path.join(room_dir, aid + "_2048.jpg")
        small = os.path.join(room_dir, aid + "_640.jpg")
        if not download(space, a, "2048", big):
            return None
        if not download(space, a, "640", small):
            with Image.open(big) as im:
                im.convert("RGB").resize((640, 640 * im.size[1] // im.size[0])).save(small, quality=85)
        with Image.open(big) as im:
            rec["w"], rec["h"] = im.size
        rec["src2048"] = person["slug"] + "/" + aid + "_2048.jpg"
        rec["src640"] = person["slug"] + "/" + aid + "_640.jpg"
        rec["themes"] = search_themes.get(aid) or pixel_themes(small)
        if make_vectors:
            vectorize(small, os.path.join(room_dir, aid + "_vec.svg"))
        if os.path.exists(os.path.join(room_dir, aid + "_vec.svg")):
            rec["vector"] = person["slug"] + "/" + aid + "_vec.svg"
        if os.path.exists(os.path.join(room_dir, aid + "_cutout.png")):
            rec["cutout"] = person["slug"] + "/" + aid + "_cutout.png"
        return rec

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        photos = [r for r in pool.map(one, assets) if r]

    photos.sort(key=lambda r: -(r.get("score") or 0))
    dates = [r["captured"] for r in photos if r.get("captured")]
    return {
        "slug": person["slug"],
        "name": person["name"],
        "blurb": person.get("blurb") or "",
        "sitter_ok": bool(person.get("sitter_ok", False)),
        "share_space": space,
        "album": album["id"],
        "shoot_date": max(dates) if dates else None,
        "photos": photos,
    }


def curate(rooms, curation, limit):
    public = []
    for room in rooms:
        c = curation.get(room["slug"], {})
        if not c.get("sitter_ok", room["sitter_ok"]):
            continue
        hidden = set(c.get("hidden", []))
        pinned = [p for p in c.get("pinned", []) if p not in hidden]
        by_id = {p["id"]: p for p in room["photos"]}
        order = [by_id[i] for i in pinned if i in by_id]
        rest = [p for p in room["photos"] if p["id"] not in hidden and p["id"] not in set(pinned)]
        chosen = (order + rest)[: max(limit, len(order))]
        treatment = c.get("treatment", {})
        photos = []
        for p in chosen:
            q = dict(p)
            t = treatment.get(p["id"])
            if t in TREATMENTS:
                q["treatment"] = t
            photos.append(q)
        out = {k: room[k] for k in ("slug", "name", "shoot_date")}
        out["blurb"] = c.get("blurb") or room["blurb"]
        out["photos"] = photos
        public.append(out)
    public.sort(key=lambda r: r["shoot_date"] or "", reverse=True)
    return public


def upload(out):
    for dirpath, _, files in os.walk(out):
        for name in files:
            if name == "curation.json":
                continue  # owned by the curation page in R2
            path = os.path.join(dirpath, name)
            key = "media/gallery/" + os.path.relpath(path, out)
            subprocess.run(["npx", "wrangler", "r2", "object", "put", key, "--file", path, "--remote"], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=os.path.join(ROOT, "gallery-media"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-vector", action="store_true")
    ap.add_argument("--limit-per-room", type=int, default=24)
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--only", help="sync one room slug")
    args = ap.parse_args()

    people = [p for p in load_people() if not args.only or p["slug"] == args.only]
    search_themes = load_json(os.path.join(ROOT, "_data", "gallery_themes.json"), {})
    if not args.dry_run:
        os.makedirs(args.out, exist_ok=True)

    rooms = []
    for person in people:
        print("room %s ..." % person["slug"], flush=True)
        room = sync_room(person, args.out, search_themes, not args.no_vector, args.dry_run)
        counts = {t: sum(1 for p in room["photos"] if t in p.get("themes", [])) for t in THEMES}
        print("  %d photos, newest %s, themes %s" % (len(room["photos"]), room["shoot_date"], counts))
        rooms.append(room)

    if args.dry_run:
        return

    if args.only:
        previous = load_json(os.path.join(args.out, "gallery_all.json"), {"people": []})["people"]
        rooms = [r for r in previous if r["slug"] != args.only] + rooms

    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    curation = load_json(os.path.join(args.out, "curation.json"), {})
    with open(os.path.join(args.out, "gallery_all.json"), "w") as f:
        json.dump({"generated": now, "people": rooms}, f)
    public = curate(rooms, curation, args.limit_per_room)
    with open(os.path.join(args.out, "gallery.json"), "w") as f:
        json.dump({"generated": now, "people": public}, f)
    print("gallery.json: %d rooms, %d photos" % (len(public), sum(len(r["photos"]) for r in public)))

    if args.upload:
        upload(args.out)


if __name__ == "__main__":
    main()
