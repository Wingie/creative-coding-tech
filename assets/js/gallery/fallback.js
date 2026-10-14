// Flat grid of the same photos, for screens without WebGL, reduced motion, or the Grid button.
// renderGrid is one section per person; renderWings, which the page uses, is the
// walk's order.
import { formatDate } from "./building.js";
import { matches } from "./rehang.js";

export function renderGrid(container, people, base, theme, lightbox) {
  container.textContent = "";
  for (const person of people) {
    const photos = person.photos.filter((p) => matches(p, theme));
    const section = document.createElement("section");
    section.className = "grid-room";
    section.id = "room-" + person.slug;
    const h = document.createElement("h2");
    h.textContent = person.name;
    const date = document.createElement("span");
    date.textContent = formatDate(person.shoot_date);
    h.append(" ", date);
    section.append(h);
    if (person.blurb) {
      const b = document.createElement("p");
      b.textContent = person.blurb;
      section.append(b);
    }
    if (!photos.length) {
      section.classList.add("empty");
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "Nothing in this room for this filter.";
      section.append(none);
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const p of photos) {
      const btn = document.createElement("button");
      btn.type = "button";
      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = base + p.src640;
      img.alt = person.name;
      img.width = p.w || 640;
      img.height = p.h || 960;
      btn.append(img);
      btn.addEventListener("click", () => lightbox.open(person, photos, p));
      grid.append(btn);
    }
    section.append(grid);
    container.append(section);
  }
}

// The same photos in the walk's order: theme first, then person, newest shoot
// first within each wing (see wings.js).
export function renderWings(container, wings, base, theme, lightbox) {
  container.textContent = "";
  for (const wing of wings) {
    const block = document.createElement("section");
    block.className = "grid-wing";
    block.id = "wing-" + wing.id;
    const h = document.createElement("h2");
    h.textContent = wing.label;
    const n = document.createElement("span");
    n.textContent = wing.count + " photos";
    h.append(" ", n);
    block.append(h);
    let shown = 0;
    for (const { person, photos: all } of wing.sections) {
      const photos = all.filter((p) => matches(p, theme));
      const section = document.createElement("section");
      section.className = "grid-room";
      section.id = "wing-" + wing.id + "-" + person.slug;
      section.dataset.person = person.slug;
      const h3 = document.createElement("h3");
      h3.textContent = person.name;
      const date = document.createElement("span");
      date.textContent = formatDate(person.shoot_date);
      h3.append(" ", date);
      section.append(h3);
      if (!photos.length) {
        section.classList.add("empty");
        const none = document.createElement("p");
        none.className = "none";
        none.textContent = "Nothing here for this filter.";
        section.append(none);
      }
      shown += photos.length;
      const grid = document.createElement("div");
      grid.className = "grid";
      for (const p of photos) {
        const btn = document.createElement("button");
        btn.type = "button";
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = base + p.src640;
        img.alt = person.name + ", " + wing.label;
        img.width = p.w || 640;
        img.height = p.h || 960;
        btn.append(img);
        btn.addEventListener("click", () => lightbox.open(person, photos, p));
        grid.append(btn);
      }
      section.append(grid);
      block.append(section);
    }
    if (!shown) block.classList.add("empty");
    container.append(block);
  }
}
