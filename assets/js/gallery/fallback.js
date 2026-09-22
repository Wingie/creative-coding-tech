// Flat grid of the same rooms, for screens without WebGL, reduced motion, or the Grid button.
import { formatDate } from "./building.js";
import { matches } from "./rehang.js";

export function renderGrid(container, people, base, theme, lightbox) {
  container.textContent = "";
  for (const person of people) {
    const photos = person.photos.filter((p) => matches(p, theme));
    const section = document.createElement("section");
    section.className = "grid-room";
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
