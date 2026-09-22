// Merge the curation page's choices over the automatic picks.
// Mirrors curate() in scripts/sync_gallery.py; keep the two in step.

const TREATMENTS = new Set(["photo", "vector", "cutout"]);

export function curate(rooms, curation, limit = 24) {
  const out = [];
  for (const room of rooms) {
    const c = curation[room.slug] || {};
    const ok = c.sitter_ok !== undefined ? c.sitter_ok : room.sitter_ok;
    if (!ok) continue;
    const hidden = new Set(c.hidden || []);
    const pinned = (c.pinned || []).filter((id) => !hidden.has(id));
    const pinnedSet = new Set(pinned);
    const byId = new Map(room.photos.map((p) => [p.id, p]));
    const order = pinned.filter((id) => byId.has(id)).map((id) => byId.get(id));
    const rest = room.photos.filter((p) => !hidden.has(p.id) && !pinnedSet.has(p.id));
    const chosen = order.concat(rest).slice(0, Math.max(limit, order.length));
    const treatment = c.treatment || {};
    out.push({
      slug: room.slug,
      name: room.name,
      shoot_date: room.shoot_date,
      blurb: c.blurb || room.blurb || "",
      photos: chosen.map((p) => (TREATMENTS.has(treatment[p.id]) ? { ...p, treatment: treatment[p.id] } : { ...p })),
    });
  }
  out.sort((a, b) => (b.shoot_date || "").localeCompare(a.shoot_date || ""));
  return out;
}
