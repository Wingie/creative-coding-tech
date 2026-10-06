// The gallery seen from above: the generated category tree as a mind map.
//
// path.json is already a binary tree of look-alike photos, one fork per split.
// Walking it from inside means you only meet a fork once you are standing at it.
// Here you see the shape, open the branches you want, and drop into one.
//
// Drawn as DOM rather than 3D: the cards are text and thumbnails, which stay
// sharp, pan and zoom for free, and cost nothing to lay out.

const CARD_W = 210;
const CARD_H = 150;
const GAP_X = 26;
const GAP_Y = 104;
const SUGGESTIONS = 3;

export class MindMap {
  constructor(el, data, base, { onEnter, tags }) {
    this.el = el;
    this.data = data;
    this.base = base;
    this.onEnter = onEnter;
    this.nodes = data.nodes;
    this.tags = tags || {};
    this.open = new Set([data.root]);
    this.view = { x: 0, y: 0, k: 1 };
    this.placed = new Map();

    el.textContent = "";
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "map-lines");
    this.layer = document.createElement("div");
    this.layer.className = "map-layer";
    this.layer.append(this.svg);
    el.append(this.layer);

    this.photoNode = this.indexPhotos();
    this.parent = this.indexParents();
    this.buildProfiles();
    this.bindPanZoom();
    this.draw();
  }

  // Which leaf does each photo sit in? Needed to say where a suggestion leads.
  indexPhotos() {
    const owner = new Map();
    for (const [key, n] of Object.entries(this.nodes)) {
      if (n.children && n.children.length) continue;
      for (const id of n.photos) owner.set(id, key);
    }
    return owner;
  }

  indexParents() {
    const parent = new Map();
    const walk = (k) => {
      for (const c of this.nodes[k].children || []) {
        parent.set(c, k);
        walk(c);
      }
    };
    walk(this.data.root);
    return parent;
  }

  // What each branch is made of, in generated tags, weighted so a tag that is
  // everywhere counts for little and a rare one counts for a lot.
  buildProfiles() {
    const seen = new Map();
    const df = new Map();
    for (const [id, rec] of Object.entries(this.tags)) {
      const list = [];
      for (const [axis, v] of Object.entries(rec)) {
        if (axis === "people") continue;
        if (Array.isArray(v)) for (const t of v) list.push(axis + ":" + t);
        else if (v) list.push(axis + ":" + v);
      }
      seen.set(id, list);
      for (const t of new Set(list)) df.set(t, (df.get(t) || 0) + 1);
    }
    const n = seen.size || 1;
    this.idf = new Map([...df].map(([t, c]) => [t, Math.log(n / c)]));
    this.photoTags = seen;
    this.profile = new Map();
    for (const [key, node] of Object.entries(this.nodes)) {
      const sample = node.photos.slice(0, 80);
      const count = new Map();
      for (const id of sample) for (const t of this.photoTags.get(id) || []) count.set(t, (count.get(t) || 0) + 1);
      const total = sample.length || 1;
      this.profile.set(key, new Map([...count].map(([t, k]) => [t, (k / total) * (this.idf.get(t) || 0)])));
    }
  }

  // Branches elsewhere in the tree that are made of the same uncommon things.
  //
  // This used to follow CLIP's nearest neighbours, which returned nothing: the
  // tree is built from that same similarity, so a photo's nearest neighbours are
  // always already in its own branch. Shared rare tags cross the tree instead,
  // which is the point — somewhere else that is nevertheless like here.
  suggestions(key) {
    const mine = this.profile.get(key);
    if (!mine || !mine.size) return [];
    const skip = new Set(this.descendants(key));
    for (let c = key; this.parent.has(c); ) {
      c = this.parent.get(c);
      skip.add(c);
    }
    const out = [];
    for (const [other, theirs] of this.profile) {
      if (skip.has(other) || this.nodes[other].photos.length < 6) continue;
      let score = 0;
      let best = ["", 0];
      for (const [t, w] of mine) {
        const v = theirs.get(t);
        if (!v) continue;
        const m = Math.min(w, v);
        score += m;
        if (m > best[1]) best = [t, m];
      }
      if (score > 0.08 && best[0]) out.push({ key: other, score, shared: best[0].split(":")[1] });
    }
    const byName = new Set();
    const picked = [];
    for (const s of out.sort((a, b) => b.score - a.score)) {
      const name = this.nodes[s.key].name || "more";
      if (byName.has(name)) continue;
      byName.add(name);
      picked.push({ key: s.key, name, shared: s.shared });
      if (picked.length === SUGGESTIONS) break;
    }
    return picked;
  }

  descendants(key, out = []) {
    out.push(key);
    for (const c of this.nodes[key].children || []) this.descendants(c, out);
    return out;
  }

  // Tidy tree over the open nodes only: a closed node is a leaf as far as
  // layout is concerned, so the cost follows what is on screen.
  layout() {
    const placed = new Map();
    let cursor = 0;
    const walk = (key, depth) => {
      const kids = this.open.has(key) ? this.nodes[key].children || [] : [];
      let x;
      if (!kids.length) {
        x = cursor;
        cursor += CARD_W + GAP_X;
      } else {
        const xs = kids.map((c) => walk(c, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      placed.set(key, { x, y: depth * (CARD_H + GAP_Y) });
      return x;
    };
    walk(this.data.root, 0);
    this.placed = placed;
  }

  draw() {
    const before = this.placed.get(this.data.root);
    this.layout();
    const after = this.placed.get(this.data.root);
    if (before && after) this.view.x += (before.x - after.x) * this.view.k;
    for (const old of [...this.layer.querySelectorAll(".map-card")]) old.remove();

    let maxX = 0;
    let maxY = 0;
    const lines = [];
    for (const [key, at] of this.placed) {
      maxX = Math.max(maxX, at.x + CARD_W);
      maxY = Math.max(maxY, at.y + CARD_H);
      this.layer.append(this.card(key, at));
      if (this.open.has(key)) {
        for (const c of this.nodes[key].children || []) {
          const to = this.placed.get(c);
          if (to) lines.push([at.x + CARD_W / 2, at.y + CARD_H, to.x + CARD_W / 2, to.y]);
        }
      }
    }
    this.svg.setAttribute("width", maxX + 40);
    this.svg.setAttribute("height", maxY + 40);
    this.svg.textContent = "";
    for (const [x1, y1, x2, y2] of lines) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const mid = (y1 + y2) / 2;
      p.setAttribute("d", `M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`);
      this.svg.append(p);
    }
    this.apply();
  }

  card(key, at) {
    const node = this.nodes[key];
    const kids = node.children || [];
    const el = document.createElement("div");
    el.className = "map-card" + (this.open.has(key) ? " open" : "") + (kids.length ? "" : " leaf");
    el.style.left = at.x + "px";
    el.style.top = at.y + "px";

    const head = document.createElement("div");
    head.className = "map-name";
    head.textContent = node.name || "everything";
    const count = document.createElement("span");
    count.textContent = node.photos.length;
    head.append(count);
    el.append(head);

    const strip = document.createElement("div");
    strip.className = "map-strip";
    for (const id of node.photos.slice(0, 3)) {
      const rec = this.data.photos[id];
      if (!rec || !rec.src640) continue;
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = this.base + rec.src640;
      strip.append(img);
    }
    el.append(strip);

    const foot = document.createElement("div");
    foot.className = "map-foot";
    if (kids.length) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = this.open.has(key) ? "Close" : "Open fork";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.open.has(key)) for (const k of this.descendants(key)) this.open.delete(k);
        else this.open.add(key);
        this.draw();
      });
      foot.append(b);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "go";
    go.textContent = "Walk here";
    go.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onEnter(key, node.name);
    });
    foot.append(go);
    el.append(foot);

    const also = this.suggestions(key);
    if (also.length) {
      const row = document.createElement("div");
      row.className = "map-also";
      row.append("also ");
      also.forEach((s, i) => {
        const a = document.createElement("button");
        a.type = "button";
        a.textContent = s.name;
        a.title = "Also " + s.shared + " \u2014 go to " + s.name;
        a.addEventListener("click", (e) => {
          e.stopPropagation();
          this.reveal(s.key);
        });
        row.append(a);
        if (i < also.length - 1) row.append(" · ");
      });
      el.append(row);
    }
    return el;
  }

  // Open every ancestor of a node so it can be seen, then centre on it.
  reveal(key) {
    const parent = new Map();
    const walk = (k) => {
      for (const c of this.nodes[k].children || []) {
        parent.set(c, k);
        walk(c);
      }
    };
    walk(this.data.root);
    let cur = key;
    while (parent.has(cur)) {
      cur = parent.get(cur);
      this.open.add(cur);
    }
    this.draw();
    const at = this.placed.get(key);
    if (!at) return;
    const r = this.el.getBoundingClientRect();
    this.view.x = r.width / 2 - (at.x + CARD_W / 2) * this.view.k;
    this.view.y = r.height / 2 - (at.y + CARD_H / 2) * this.view.k;
    this.apply();
    const el = [...this.layer.querySelectorAll(".map-card")].find((c) => parseFloat(c.style.left) === at.x && parseFloat(c.style.top) === at.y);
    if (el) {
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 900);
    }
  }

  apply() {
    this.layer.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.k})`;
  }

  bindPanZoom() {
    let drag = null;
    this.el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add("grabbing");
    });
    this.el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.view.x = drag.vx + (e.clientX - drag.x);
      this.view.y = drag.vy + (e.clientY - drag.y);
      this.apply();
    });
    const stop = () => {
      drag = null;
      this.el.classList.remove("grabbing");
    };
    this.el.addEventListener("pointerup", stop);
    this.el.addEventListener("pointercancel", stop);
    this.el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const r = this.el.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const k = Math.max(0.25, Math.min(1.6, this.view.k * (e.deltaY > 0 ? 0.9 : 1.1)));
        // keep the point under the cursor still
        this.view.x = mx - ((mx - this.view.x) / this.view.k) * k;
        this.view.y = my - ((my - this.view.y) / this.view.k) * k;
        this.view.k = k;
        this.apply();
      },
      { passive: false }
    );
  }

  // Start with the root near the top middle.
  home() {
    const r = this.el.getBoundingClientRect();
    const at = this.placed.get(this.data.root);
    this.view.k = 1;
    this.view.x = r.width / 2 - (at ? at.x + CARD_W / 2 : 0);
    this.view.y = 70;
    this.apply();
  }
}
