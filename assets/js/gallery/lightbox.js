// Full-size view of one photo, with previous/next inside the same room.
import { formatDate } from "./building.js";

export class Lightbox {
  constructor(base, onClose) {
    this.base = base;
    this.onClose = onClose;
    this.el = document.getElementById("lightbox");
    this.img = this.el.querySelector("img");
    this.caption = this.el.querySelector(".lb-caption");
    this.list = [];
    this.i = 0;
    this.el.querySelector(".lb-close").addEventListener("click", () => this.close());
    this.el.querySelector(".lb-prev").addEventListener("click", () => this.step(-1));
    this.el.querySelector(".lb-next").addEventListener("click", () => this.step(1));
    this.el.addEventListener("click", (e) => {
      if (e.target === this.el) this.close();
    });
    addEventListener("keydown", (e) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowLeft") this.step(-1);
      if (e.key === "ArrowRight") this.step(1);
    });
  }

  get isOpen() {
    return !this.el.hidden;
  }

  open(person, photos, photo) {
    this.person = person;
    this.list = photos;
    this.i = Math.max(0, photos.indexOf(photo));
    this.el.hidden = false;
    this.show();
  }

  step(d) {
    if (!this.list.length) return;
    this.i = (this.i + d + this.list.length) % this.list.length;
    this.show();
  }

  show() {
    const p = this.list[this.i];
    this.img.src = this.base + p.src640;
    const full = new Image();
    full.onload = () => {
      if (this.list[this.i] === p) this.img.src = full.src;
    };
    full.src = this.base + p.src2048;
    const date = formatDate(p.captured || this.person.shoot_date);
    this.caption.textContent = [this.person.name, date, `${this.i + 1} of ${this.list.length}`]
      .filter(Boolean)
      .join("  ·  ");
  }

  close() {
    this.el.hidden = true;
    this.img.removeAttribute("src");
    if (this.onClose) this.onClose();
  }
}
