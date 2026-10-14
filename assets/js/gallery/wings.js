// Theme first, then person. Every photo is given one primary theme, so it hangs
// in exactly one wing; inside a wing there is one section per person, newest
// shoot first. The walk, the grid and the map all read this one arrangement.
//
// No three.js here: this is plain data, so it can be checked from node.
//
// Where the theme comes from. Two sources, neither complete on its own:
//  - gallery.json `themes`: Lightroom search where it tagged the photo, else a
//    pixel heuristic (saturation, brightness, the border). Covers about half.
//  - tags.json (CLIP): colour, light, place on almost every photo. These name
//    the same things more directly ("black and white", "light patterns on a
//    face", "white backdrop", "trees and leaves") but miss as often as not.
// Both vote, weighted by how plainly the tag names the theme. A photo neither
// says anything about goes with the person's own majority theme: a shoot is
// mostly one set-up, so that is the best guess there is.

export const WINGS = [
  ["light", "Light & projection"],
  ["studio-dark", "Dark studio"],
  ["studio-white", "White studio"],
  ["outdoor", "Outdoor"],
  ["bw", "B&W"],
];
const ORDER = WINGS.map(([id]) => id);

// CLIP tag -> [theme, weight]
const CLIP = {
  colour: {
    "black and white": ["bw", 3],
    // CLIP's backdrop words follow the clothes as much as the wall (a white
    // dress on black reads "white backdrop"), so they only lean, never decide
    "white on white": ["studio-white", 0.5],
  },
  light: {
    // the two CLIP says most often also fire on any warm, dark frame
    "light patterns on a face": ["light", 1.5],
    "warm projected light": ["light", 1],
    "dots of light": ["light", 2.5],
    "stripes of light": ["light", 2.5],
    "soft window light": ["studio-white", 0.5],
    "sunset light": ["outdoor", 1.5],
    daylight: ["outdoor", 1.5],
  },
  place: {
    "black backdrop": ["studio-dark", 0.5],
    "white backdrop": ["studio-white", 0.5],
    "trees and leaves": ["outdoor", 2],
    "by the water": ["outdoor", 2.5],
    "grass and park": ["outdoor", 2.5],
    "under a bridge": ["outdoor", 2],
  },
  // the night shoots by the cars read as dark studio to every other test
  scene: {
    car: ["outdoor", 1.5],
    motorcycle: ["outdoor", 1.5],
    boat: ["outdoor", 2],
    bench: ["outdoor", 1],
  },
};

// Cues that only happen outside. Leaves and green alone do not count: a costume
// of leaves in the studio reads as "trees and leaves" to CLIP and as nature to
// the pixel test, and one shoot is exactly that.
const OUTSIDE = {
  place: ["by the water", "grass and park", "under a bridge"],
  light: ["sunset light", "daylight"],
  scene: ["car", "motorcycle", "boat", "bench"],
};
function outside(rec) {
  if (!rec) return false;
  return Object.entries(OUTSIDE).some(([axis, list]) => {
    const v = rec[axis];
    return (Array.isArray(v) ? v : [v]).some((x) => list.includes(x));
  });
}

function votes(photo, rec) {
  const s = Object.fromEntries(ORDER.map((t) => [t, 0]));
  // B&W is the one theme a picture cannot half belong to: a desaturated frame
  // reads as B&W whatever room it was taken in.
  // The pixel test for light (dark frame, some hot colour) also takes sunsets
  // and warm night shots, so it counts for less. The backdrop tests read the
  // border of the frame itself, which beats CLIP's guess at the backdrop.
  // Light and dark studio at once is a projection on a dark set: the light wing.
  const PIXEL = { bw: 3, light: 1.5, "studio-dark": 2, "studio-white": 2.5, outdoor: 2 };
  const px = photo.themes || [];
  for (const t of px) {
    if (t === "studio-dark" && px.includes("light")) continue;
    if (t in s) s[t] += PIXEL[t];
  }
  if (rec) {
    for (const [axis, table] of Object.entries(CLIP)) {
      const v = rec[axis];
      for (const x of Array.isArray(v) ? v : v ? [v] : []) {
        const hit = table[x];
        if (hit) s[hit[0]] += hit[1];
      }
    }
  }
  return s;
}

// Highest vote; a tie goes to `prefer` (the person's own lean), then wing order.
const best = (s, prefer) =>
  ORDER.reduce((a, t) => (s[t] > s[a] + 1e-9 || (Math.abs(s[t] - s[a]) < 1e-9 && t === prefer) ? t : a), ORDER[0]);
const total = (s) => ORDER.reduce((n, t) => n + s[t], 0);

// people: gallery.json people. tags: tags.json (may be missing or stale).
// Returns { wings: [{id, label, count, sections: [{person, photos}]}], themeOf: Map(id -> theme) }
export function arrangeWings(people, tags = {}) {
  const themeOf = new Map();
  const source = { voted: 0, person: 0, fallback: 0 };
  for (const person of people) {
    const scored = person.photos.map((p) => ({ p, s: votes(p, tags[p.id]) }));
    // a shoot with no outdoor cue anywhere in it was not outdoors
    if (!person.photos.some((p) => outside(tags[p.id]))) for (const { s } of scored) s.outdoor = 0;
    // the person's lean, from the photos that said something
    const lean = Object.fromEntries(ORDER.map((t) => [t, 0]));
    for (const { s } of scored) if (total(s) > 0) lean[best(s)]++;
    const n = Object.values(lean).reduce((a, b) => a + b, 0);
    const major = n ? best(lean) : null;
    for (const { p, s } of scored) {
      let t;
      if (total(s) > 0) {
        // a shoot is mostly one set-up: its lean settles the weak single
        // signals, and a plain tag (B&W, a backdrop, trees) still wins over it
        for (const k of ORDER) s[k] += n ? (2 * lean[k]) / n : 0;
        t = best(s, major);
        source.voted++;
      } else if (major) {
        t = major;
        source.person++;
      } else {
        t = ORDER[0];
        source.fallback++;
      }
      themeOf.set(p.id, t);
      p.wing = t;
    }
  }
  const newest = (a, b) => String(b.shoot_date || "").localeCompare(String(a.shoot_date || ""));
  const byPerson = people.slice().sort(newest);
  const wings = WINGS.map(([id, label]) => {
    const sections = [];
    for (const person of byPerson) {
      const photos = person.photos.filter((p) => themeOf.get(p.id) === id);
      if (photos.length) sections.push({ person, photos });
    }
    return { id, label, sections, count: sections.reduce((n, s) => n + s.photos.length, 0) };
  }).filter((w) => w.count);
  return { wings, themeOf, source };
}

export function monthYear(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "";
}

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

// The same arrangement in the shape path.json has ({root, nodes, photos,
// neighbours}), so the walk and the map need no second reader. Root -> one node
// per wing -> one node per person in it. `extra` is path.json if there is one:
// its look-alike neighbours are kept for drifting, but only for photos still in
// gallery.json; ids it has lost or never had are simply left out.
export function wingTree(arr, extra) {
  const photos = {};
  const nodes = {};
  const root = "wings";
  const wingKeys = [];
  for (const w of arr.wings) {
    const wk = "wing-" + w.id;
    wingKeys.push(wk);
    const kids = [];
    for (const { person, photos: list } of w.sections) {
      const pk = wk + "--" + slug(person.slug || person.name);
      kids.push(pk);
      const ids = [];
      for (const p of list) {
        photos[p.id] = { ...p, room: person.name, shoot: person.shoot_date, wing: w.id };
        ids.push(p.id);
      }
      nodes[pk] = { name: person.name, photos: ids, person: person.slug, date: person.shoot_date, dateLabel: monthYear(person.shoot_date), wing: w.id };
    }
    nodes[wk] = { name: w.label, photos: kids.flatMap((k) => nodes[k].photos), children: kids, wing: w.id };
  }
  nodes[root] = { name: "Everything", photos: wingKeys.flatMap((k) => nodes[k].photos), children: wingKeys };
  const neighbours = {};
  const near = (extra && extra.neighbours) || {};
  for (const id of Object.keys(photos)) {
    const list = (near[id] || []).filter((n) => photos[n]);
    if (list.length) neighbours[id] = list;
  }
  return { root, nodes, photos, neighbours, wings: wingKeys, ordered: true };
}
