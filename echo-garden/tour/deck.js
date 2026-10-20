// Echo Garden onboarding deck: eight slides over one 320x180 pixel scene.
// Each slide sets what the scene shows and what a tap (or Space) does.
// Keys: arrows / PageUp / PageDown / a clicker move slides, Space or a tap acts.
(function () {
  "use strict";
  var W = 320, H = 180, HZ = 98, TICK = 0.1279;
  var C = { mag: "#ff2bd6", cyan: "#22e6ff", ink: "#f4e9ff", muted: "#8a6fb8", green: "#39ff9f",
    sun: "#ffb238", warn: "#ff5c7a", dark: "#0d0322", leaf: "#39ff9f", leaf2: "#1fae6a", pot: "#ff7a3d" };
  var SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
  var cv = document.getElementById("cv"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // "click" on desktop, "tap" on touch screens
  var VERB = window.matchMedia("(pointer: coarse)").matches ? "tap" : "click";
  function verb(str) { return VERB === "click" ? str : str.replace(/\bClick\b/g, "Tap").replace(/\bclick\b/g, "tap"); }

  // ------------------------------------------------------------------ slides
  var SLIDES = [
    { k: "Echo Garden", t: "A gridless instrument for live sets",
      b: "A plant, a robot arm, a performer and a Frippertronics-style tape delay, played as one performance. Click the plant and the arm closes its circuit. The plant's signal turns into MIDI, which goes into the Ableton set and triggers instruments. Space works too. The arrows move to the next slide.",
      act: "click and hold the plant", mode: "intro" },
    { k: "Working today", t: "Touch a leaf and the plant joins the set",
      b: "When the arm rests on a leaf, it closes the plant's circuit. A Pocket Scion turns the plant's signal into MIDI. The MIDI runs into the live Ableton set and triggers instruments. Lift the arm and the plant drops out.",
      act: "hold: keep the arm on the leaf", mode: "touch" },
    { k: "Working today", t: "How many notes get through",
      b: "A density threshold sets how many of the plant's notes get through. Raise it and fewer notes play. Lower it and more do. Other instruments in the set share the same threshold, such as the sting.",
      act: "click: raise / lower the threshold", mode: "tick" },
    { k: "Working today", t: "Frippertronics",
      b: "Frippertronics is looping over yourself through a long tape delay. Robert Fripp and Brian Eno did it with two tape machines. The loop takes a live performer, the plant's notes or a performer's body. A Kinect reads the body, and it's played like a theremin.",
      act: "click: drop notes into the loop", mode: "echo" },
    { k: "Still being tried", t: "The arm meets the performer",
      b: "A Kinect reads how a performer moves. The idea is that when she comes near the plant, the arm moves to meet her there and brings the plant in. Wekinator learns her poses and passes them on. Light is projected onto her body too.",
      act: "move across the scene: come near the plant", mode: "body" },
    { k: "The hackathon work", t: "What gets built at the hackathon",
      b: "The plant's notes land on three rings that loop at 3.1, 5.3 and 8.6 seconds. They drift apart and never line up, and each note fades a little every time round. Wekinator conducts the rings from the plant and the performer's body. She steers by gesture, or by voice and buttons on a Pebble watch.",
      act: "", mode: "open", tpl: "tpl-ideas" },
    { k: "Where you fit", t: "Pick a role, or add your own",
      b: "Looking for genuine musicians, signal movers, digital makers and visual orchestrators of light. Technology and music aficionados are welcome too. Click any that fit.",
      act: "", mode: "roles", tpl: "tpl-roles" },
    { k: "ADE Lab Hackathon, Amsterdam, 21 to 23 October 2026", t: "Come and build it",
      b: "Echo Garden is an entry for Colin Benders' challenge, Escape the Grid. Sign up on the hackathon page and mention the roles you picked.",
      act: "", mode: "join", tpl: "tpl-join" }
  ];
  var cur = 0;

  // ------------------------------------------------------------------ state
  var S = {
    t: 0, armK: 0, armWant: 0, holding: false, notes: [], rings: [], echoes: [],
    freed: true, nextTick: 0, tickMarks: [], dancerX: 0.5, pointerSeen: 0, roles: [], stars: []
  };
  for (var i = 0; i < 60; i++) S.stars.push([Math.random() * W, Math.random() * (HZ - 30), Math.random()]);

  // ------------------------------------------------------------------ sound
  var soundOn = false;
  function audio() { return soundOn && window.Sound && window.Sound.ctx; }
  function play(pitch, vel, delay) {
    if (!audio()) return;
    var ctx = window.Sound.ctx;
    window.Sound.pluck(ctx.currentTime + (delay || 0) + 0.02, pitch, vel || 90, 0.4, false);
  }
  function loopFor(mode) {
    if (!audio()) return;
    if (mode === "echo") window.Sound.setLoop(0.75, 0.85, 6, true);
    else if (mode === "touch" || mode === "body" || mode === "intro") window.Sound.setLoop(0.45, 0.6, 6, true);
    else window.Sound.setLoop(0.2, 0.3, 6, true);
  }
  $("snd").addEventListener("click", function () {
    if (!soundOn && window.Sound && window.Sound.init()) {
      soundOn = true;
      if (window.Sound.ctx.state === "suspended") window.Sound.ctx.resume();
    } else soundOn = !soundOn;
    if (!soundOn && window.Sound && window.Sound.ctx) window.Sound.setLoop(0, 0, 6, false);
    $("snd").setAttribute("aria-pressed", String(soundOn));
    $("snd").textContent = soundOn ? "Sound on" : "Sound off";
    loopFor(SLIDES[cur].mode);
  });
  function wantSound() { if (!soundOn) $("snd").click(); }

  // ------------------------------------------------------------------ pixel helpers
  function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function line(x0, y0, x1, y1, c, dash) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, n = 0;
    g.fillStyle = c;
    while (n++ < 900) {
      if (!dash || (n % 6) < 3) g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function thick(x0, y0, x1, y1, c, w) {
    for (var o = -Math.floor(w / 2); o <= Math.floor(w / 2); o++) { line(x0 + o, y0, x1 + o, y1, c); line(x0, y0 + o, x1, y1 + o, c); }
  }
  function ellipse(cx, cy, rx, ry, c) {
    var n = Math.max(24, Math.round((rx + ry) * 1.6));
    g.fillStyle = c;
    for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
  }
  function text(s, x, y, c, sh) { if (window.Font) window.Font.draw(g, s, x, y, 1, c, sh || "#0d0322"); }
  function textC(s, x, y, c, sh) { if (window.Font) window.Font.drawCentered(g, s, x, y, 1, c, sh || "#0d0322"); }

  // ------------------------------------------------------------------ scenery
  function sky(t) {
    var bands = ["#0b0221", "#160535", "#24074a", "#3a0b5c", "#5a0f6a", "#7e1670"];
    for (var b = 0; b < bands.length; b++) rect(0, b * HZ / bands.length, W, HZ / bands.length + 1, bands[b]);
    S.stars.forEach(function (s) { if (Math.sin(t * 2 + s[2] * 20) > -0.3) rect(s[0], s[1], 1, 1, s[2] > 0.7 ? C.cyan : C.ink); });
    var cx = 160, cy = HZ - 6, r = 30;
    for (var y = -r; y <= 0; y++) {
      var w = Math.sqrt(r * r - y * y), yy = cy + y;
      var stripe = y > -14 && ((yy + Math.floor(t * 6)) % 5 < 1 + (y + 14) / 6);
      if (!stripe) rect(cx - w, yy, w * 2, 1, y < -18 ? "#ffd84a" : y < -8 ? C.sun : "#ff6a5a");
    }
    ridge(0.3, 14, "#2b0b4f", "#ff2bd6"); ridge(1.7, 8, "#1b0638", "#7a2bb0");
  }
  function ridge(seed, amp, fill, rim) {
    for (var x = 0; x < W; x++) {
      var h = (Math.sin(x * 0.05 + seed) * 0.5 + Math.sin(x * 0.13 + seed * 3) * 0.3 + Math.sin(x * 0.31 + seed) * 0.2 + 1) * amp * 0.5;
      if (Math.abs(x - 160) < 40) h *= Math.abs(x - 160) / 40;
      rect(x, HZ - h, 1, h, fill); rect(x, HZ - h, 1, 1, rim);
    }
  }
  function floor(t, wob) {
    rect(0, HZ, W, H - HZ, "#12052b");
    rect(0, HZ, W, 1, C.mag);
    var sp = (t * 0.6) % 1;
    for (var k = 0; k < 9; k++) {
      var z = (k + 1 - sp) / 9, y = HZ + Math.pow(z, 2.2) * (H - HZ);
      var off = wob ? Math.sin(t * 3 + k * 1.7) * wob * z * 3 : 0;
      if (y > HZ + 1) line(0, y + off, W, y - off, z > 0.2 ? C.mag : "#7a1a8a");
    }
    for (var v = -8; v <= 8; v++) {
      var bx = 160 + v * 40, bend = wob ? Math.sin(t * 2.3 + v) * wob * 6 : 0;
      line(160 + v * 3, HZ + 1, bx + bend, H, Math.abs(v) < 6 ? "#c21fa8" : "#5e1470");
    }
  }

  // ------------------------------------------------------------------ the rig
  var POT = { x: 198, y: 134 };
  var LEAF = { x: 208, y: 104 };
  var ARM = { bx: 270, by: 140, sx: 270, sy: 122, L1: 34, L2: 32 };
  function plant(t, glow) {
    rect(POT.x - 14, POT.y - 4, 28, 3, "#ffa36b");
    for (var y = 0; y < 16; y++) { var w = 13 - y * 0.35; rect(POT.x - w, POT.y - 1 + y, w * 2, 1, y % 5 === 0 ? "#c4521f" : C.pot); }
    rect(POT.x - 12, POT.y - 5, 24, 2, "#3a1d12");
    var leaves = [[-1, 22, -0.9], [1, 26, -0.5], [-1, 30, 0.4], [1, 18, 0.9], [-1, 14, 1.3], [1, 34, -0.1]];
    leaves.forEach(function (L, i) {
      var sway = Math.sin(t * 1.3 + i) * 1.5;
      var ex = POT.x + L[0] * (8 + i * 2) + sway, ey = POT.y - 6 - L[1];
      line(POT.x, POT.y - 6, ex, ey + 3, C.leaf2);
      var col = glow > 0 && (i === 1) ? (glow > 0.5 ? "#c8ffe4" : C.green) : C.leaf;
      for (var r = 0; r < 5; r++) rect(ex - 5 + r, ey - r * 0.6 + 2, 10 - r * 2 + 2, 1, r === 0 ? C.leaf2 : col);
    });
    // Scion box with its two cables
    rect(150, 136, 18, 9, "#1a1028"); rect(150, 136, 18, 1, "#3d2a55");
    rect(164, 138, 2, 2, glow > 0 ? C.green : "#2d4a3a");
    line(167, 138, 188, 112, glow > 0 ? C.sun : "#a33a2a"); line(188, 112, LEAF.x - 3, LEAF.y + 1, glow > 0 ? C.sun : "#a33a2a");
    line(166, 143, 190, 131, "#4a3d58");
  }
  function ik(tx, ty) {
    var dx = tx - ARM.sx, dy = ty - ARM.sy, d = Math.min(Math.hypot(dx, dy), ARM.L1 + ARM.L2 - 0.5);
    var a = Math.atan2(dy, dx), c = (ARM.L1 * ARM.L1 + d * d - ARM.L2 * ARM.L2) / (2 * ARM.L1 * d);
    var th = a - Math.acos(Math.max(-1, Math.min(1, c)));
    var ex = ARM.sx + ARM.L1 * Math.cos(th), ey = ARM.sy + ARM.L1 * Math.sin(th);
    return { ex: ex, ey: ey, tx: ARM.sx + Math.cos(a) * d, ty: ARM.sy + Math.sin(a) * d };
  }
  function arm(tx, ty, contact, ghost) {
    var j = ik(tx, ty), body = ghost ? "#5fb8c8" : "#d9d2e9", dark = ghost ? "#2a6b78" : "#6b6080";
    rect(ARM.bx - 10, ARM.by - 2, 20, 6, "#1a1028"); rect(ARM.bx - 10, ARM.by - 2, 20, 1, C.cyan);
    rect(ARM.bx - 5, ARM.sy, 10, ARM.by - ARM.sy, dark); rect(ARM.bx - 5, ARM.sy, 10, 1, body);
    thick(ARM.sx, ARM.sy, j.ex, j.ey, body, 3); thick(j.ex, j.ey, j.tx, j.ty, body, 2);
    rect(j.ex - 2, j.ey - 2, 4, 4, dark); rect(ARM.sx - 3, ARM.sy - 3, 6, 6, dark);
    rect(j.tx - 1, j.ty - 1, 3, 5, contact ? C.green : C.sun);
    if (contact) { ellipse(j.tx + 1, j.ty + 4, 4 + (S.t * 8) % 4, 2, C.green); }
    return j;
  }
  function note(n) {
    var a = Math.max(0, Math.min(1, n.life));
    var c = a > 0.5 ? n.c : "#7a2bb0";
    rect(n.x, n.y, 1, 5, c); rect(n.x - 2, n.y + 4, 3, 2, c); rect(n.x + 1, n.y, 2, 1, c);
  }
  function spawnNote(x, y, col, pitchIdx, delay) {
    S.notes.push({ x: x + (Math.random() * 10 - 5), y: y, vy: -(10 + Math.random() * 8), life: 1.6, c: col || C.sun });
    var p = 60 + SCALE[pitchIdx != null ? pitchIdx : Math.floor(Math.random() * SCALE.length)];
    play(p, 80 + Math.random() * 30, delay);
    return p;
  }
  function ring(col) { S.rings.push({ r: 14, life: 1, c: col || C.cyan }); }

  // ------------------------------------------------------------------ per-slide behaviour
  var lastNote = 0;
  function update(dt) {
    var m = SLIDES[cur].mode;
    S.t += dt;
    // the arm: intro and touch dip on demand; echo auto-touches; body follows the dancer
    if (m === "touch" || m === "intro") S.armWant = S.holding ? 1 : 0;
    if (m === "echo") S.armWant = (S.t % 6) < 2.2 ? 1 : 0;
    if (m === "tick") S.armWant = 1;
    if (m === "open" || m === "roles" || m === "join") S.armWant = 0;
    S.armK += (S.armWant - S.armK) * Math.min(1, dt * 6);
    var touching = S.armK > 0.92 && m !== "body";

    if (touching && (m === "touch" || m === "intro" || m === "echo") && S.t - lastNote > 0.18 + Math.random() * 0.35) {
      lastNote = S.t; spawnNote(LEAF.x, LEAF.y - 6, C.sun);
      if (m === "echo") S.echoes.push({ at: S.t + 2.4, n: 0, x: LEAF.x, p: Math.floor(Math.random() * 8) });
    }
    if (m === "tick") {
      while (S.nextTick <= S.t) {
        var at = S.nextTick; S.nextTick += TICK;
        if (Math.random() < (S.freed ? 0.4 : 0.06)) {
          var off = 0;
          S.tickMarks.push({ t: at + off, p: Math.floor(Math.random() * 8) });
          (function (o) { setTimeout(function () { if (SLIDES[cur].mode === "tick") spawnNote(LEAF.x, LEAF.y - 6, S.freed ? C.cyan : C.sun); }, Math.max(0, o * 1000)); })(off + (at - S.t));
        }
      }
      S.tickMarks = S.tickMarks.filter(function (k) { return S.t - k.t < 2.2; });
    }
    if (m === "body") {
      if (S.t - S.pointerSeen > 2.5) S.dancerX = 0.5 + Math.sin(S.t * 0.6) * 0.42;
      if (S.t - lastNote > 0.6 && Math.abs(S.dancerX - 0.5) < 0.12) { lastNote = S.t; spawnNote(LEAF.x, LEAF.y - 6, C.cyan); }
    }
    // echoes: each note comes back quieter, a few times
    S.echoes = S.echoes.filter(function (e) {
      if (S.t >= e.at) {
        e.n++; e.at += 2.4; ring(C.cyan);
        S.notes.push({ x: e.x + (Math.random() * 30 - 15), y: LEAF.y - 4, vy: -8, life: 1.4 - e.n * 0.25, c: C.cyan });
        if (audio()) play(60 + SCALE[e.p], Math.max(20, 70 - e.n * 15));
      }
      return e.n < 4;
    });
    if (touching && Math.random() < dt * 1.2) ring(C.green);
    S.notes.forEach(function (n) { n.y += n.vy * dt; n.x += Math.sin(S.t * 4 + n.y) * 0.2; n.life -= dt * 0.7; });
    S.notes = S.notes.filter(function (n) { return n.life > 0 && n.y > -8; });
    S.rings.forEach(function (r) { r.r += dt * 26; r.life -= dt * 0.55; });
    S.rings = S.rings.filter(function (r) { return r.life > 0; });
  }

  function armTarget() {
    var m = SLIDES[cur].mode, rest = { x: 250, y: 80 };
    if (m === "body") {
      var a = { x: 188, y: 100 }, b = { x: 232, y: 108 }, k = S.dancerX;
      var dip = Math.abs(k - 0.5) < 0.12 ? 1 : 0;
      return { x: a.x + (b.x - a.x) * k, y: (a.y + (b.y - a.y) * k) - (1 - dip) * 10, contact: !!dip };
    }
    return { x: rest.x + (LEAF.x + 2 - rest.x) * S.armK, y: rest.y + (LEAF.y - 2 - rest.y) * S.armK, contact: S.armK > 0.92 };
  }

  function draw() {
    var m = SLIDES[cur].mode, t = reduce ? 0 : S.t;
    var wob = m === "tick" ? (S.freed ? 0.9 : 0.1) : m === "echo" ? 0.5 : m === "open" ? 2.2 : 0.25;
    sky(t); floor(t, wob);
    S.rings.forEach(function (r) { ellipse(POT.x, POT.y + 12, r.r, r.r * 0.28, r.life > 0.5 ? r.c : "#4b1a7a"); });
    var tg = armTarget();
    plant(t, tg.contact ? 1 : 0);
    if (m !== "join" && m !== "roles") arm(tg.x, tg.y, tg.contact, m === "body");
    S.notes.forEach(note);

    if (m === "intro") {
      textC("ECHO GARDEN", 160, 12, C.mag, "#2b0040");
      textC(VERB + " the plant to close its circuit", 160, 26, C.cyan);
    }
    if (m === "tick") {
      rect(20, 8, 280, 22, "#0d0322cc"); line(20, 8, 300, 8, "#3b1670"); line(20, 30, 300, 30, "#3b1670");
      for (var k = Math.ceil((S.t - 2.2) / TICK); k * TICK <= S.t; k++) {
        var x = 300 - (S.t - k * TICK) / 2.2 * 280; line(x, 10, x, 28, "#4b2a7a");
      }
      S.tickMarks.forEach(function (n) {
        if (n.t > S.t) return;
        var x = 300 - (S.t - n.t) / 2.2 * 280; rect(x - 1, 16, 3, 7, S.freed ? C.cyan : C.sun);
      });
      text(S.freed ? "threshold low: dense" : "threshold high: sparse", 24, 34, S.freed ? C.cyan : C.sun);
      text("sting", 262, 34, C.muted); rect(292, 36, 6, 6, S.tickMarks.some(function (n) { return S.t - n.t < 0.12; }) ? C.mag : "#2b0b4f");
    }
    if (m === "echo") {
      var load = Math.min(1, S.echoes.length / 12);
      text("echo", 20, 10, C.cyan); rect(48, 12, 80, 4, "#2b0b4f"); rect(48, 12, 80 * load, 4, C.cyan);
    }
    if (m === "body") {
      var dx = 40 + S.dancerX * 240, dy = 150, f = Math.sin(S.t * 6) * 2;
      var dc = (Math.floor(S.t * 8) % 7) ? C.cyan : "#7ff3ff";
      rect(dx - 2, dy - 30, 5, 5, dc); line(dx, dy - 25, dx, dy - 12, dc);
      line(dx, dy - 22, dx - 7, dy - 28 + f, dc); line(dx, dy - 22, dx + 7, dy - 16 - f, dc);
      line(dx, dy - 12, dx - 5, dy, dc); line(dx, dy - 12, dx + 5, dy, dc);
      line(dx, dy - 34, tg.x, tg.y - 6, "#2a8fa0", true);
      text("experimental", 8, 8, C.cyan); text("kinect", 8, 20, "#7ad7e6");
    }
    if (m === "open") {
      var q = function (x, y, a, b) {
        var j = (Math.floor(S.t * 5) % 9 === 0) ? 2 : 0;
        rect(x + j, y, 104, 38, "#0d0322dd"); line(x, y, x + 104, y, C.mag); line(x, y + 38, x + 104, y + 38, C.mag);
        textC("?", x + 8 + j, y + 6, C.sun); text(a, x + 18, y + 6, C.ink); text(b, x + 18, y + 20, C.muted);
      };
      q(6, 12, "find leaves", "on show day"); q(108, 12, "line it up", "in a new room"); q(210, 12, "shape a set", "touch to loop");
    }
    if (m === "roles" || m === "join") {
      var picks = S.roles.length ? S.roles : (m === "join" ? ["you?"] : []);
      picks.forEach(function (r, i) {
        var a = S.t * 0.5 + i / picks.length * Math.PI * 2, x = 200 + Math.cos(a) * 86, y = 70 + Math.sin(a) * 26;
        var w = window.Font ? window.Font.width(r, 1) : r.length * 6;
        rect(x - w / 2 - 3, y - 2, w + 6, 13, "#0d0322dd"); line(x - w / 2 - 3, y + 11, x + w / 2 + 3, y + 11, C.mag);
        textC(r, x, y, i % 2 ? C.cyan : C.sun);
      });
    }
  }

  // ------------------------------------------------------------------ slide UI
  function show(i) {
    cur = Math.max(0, Math.min(SLIDES.length - 1, i));
    var s = SLIDES[cur];
    $("kicker").textContent = s.k; $("title").textContent = s.t; $("body").textContent = verb(s.b);
    $("act").textContent = verb(s.act); $("count").textContent = (cur + 1) + " / " + SLIDES.length;
    $("prev").disabled = cur === 0; $("next").disabled = cur === SLIDES.length - 1;
    var ex = $("extra"); ex.innerHTML = "";
    if (s.tpl) ex.appendChild($(s.tpl).content.cloneNode(true));
    if (s.mode === "roles") wireRoles();
    if (s.mode === "join") $("joinRoles").textContent = S.roles.length ? "Your roles: " + S.roles.join(", ") + "." : "";
    S.holding = false; S.armK = s.mode === "tick" ? 1 : 0; S.notes = []; S.rings = []; S.echoes = []; S.tickMarks = [];
    S.nextTick = Math.ceil(S.t / TICK) * TICK;
    loopFor(s.mode);
    try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {}
  }
  function wireRoles() {
    var box = document.querySelector("#extra .roles"), form = document.querySelector("#extra .add");
    Array.prototype.forEach.call(box.children, function (b) { if (S.roles.indexOf(b.textContent) >= 0) b.setAttribute("aria-pressed", "true"); });
    S.roles.forEach(function (r) {
      var have = Array.prototype.some.call(box.children, function (b) { return b.textContent === r; });
      if (!have) addChip(box, r);
    });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on));
      if (on) { S.roles.push(b.textContent); spawnNote(POT.x, 80, C.mag); } else S.roles = S.roles.filter(function (r) { return r !== b.textContent; });
      saveRoles();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); var inp = form.querySelector("input"), v = inp.value.trim();
      if (!v || S.roles.indexOf(v) >= 0) return;
      addChip(box, v); S.roles.push(v); inp.value = ""; spawnNote(POT.x, 80, C.mag); saveRoles();
    });
    saveRoles();
  }
  function addChip(box, name) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = name; b.setAttribute("aria-pressed", "true"); box.appendChild(b);
  }
  function saveRoles() {
    var p = $("picked"); if (p) p.textContent = S.roles.length ? "You picked: " + S.roles.join(", ") + "." : "Nothing picked yet. Nothing here is required.";
    try { localStorage.setItem("eg-roles", JSON.stringify(S.roles)); } catch (e) {}
  }
  try { S.roles = JSON.parse(localStorage.getItem("eg-roles") || "[]") || []; } catch (e) { S.roles = []; }

  // ------------------------------------------------------------------ input
  function act(down) {
    var m = SLIDES[cur].mode;
    if (down) wantSound();
    if (m === "touch" || m === "intro") S.holding = down;
    if (!down) return;
    if (m === "tick") S.freed = !S.freed;
    if (m === "echo") { for (var k = 0; k < 3; k++) { spawnNote(LEAF.x, LEAF.y - 6, C.sun, null, k * 0.15); S.echoes.push({ at: S.t + 2.4 + k * 0.15, n: 0, x: LEAF.x, p: Math.floor(Math.random() * 8) }); } ring(C.cyan); }
  }
  cv.tabIndex = 0;
  cv.addEventListener("pointerdown", function (e) { e.preventDefault(); act(true); });
  window.addEventListener("pointerup", function () { act(false); });
  cv.addEventListener("pointermove", function (e) {
    if (SLIDES[cur].mode !== "body") return;
    var r = cv.getBoundingClientRect(); S.dancerX = Math.max(0, Math.min(1, ((e.clientX - r.left) / r.width * W - 40) / 240)); S.pointerSeen = S.t;
  });
  $("prev").onclick = function () { show(cur - 1); };
  $("next").onclick = function () { show(cur + 1); };
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT") return;
    if (["ArrowRight", "ArrowDown", "PageDown"].indexOf(e.key) >= 0) { e.preventDefault(); show(cur + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); show(cur - 1); }
    else if (e.key === " " && !e.repeat && e.target.tagName !== "BUTTON" && e.target.tagName !== "A") { e.preventDefault(); act(true); }
  });
  document.addEventListener("keyup", function (e) { if (e.key === " " && e.target.tagName !== "INPUT") act(false); });

  // ------------------------------------------------------------------ run
  var start = parseInt((location.hash || "#1").slice(1), 10);
  show(isNaN(start) ? 0 : start - 1);
  var params = new URLSearchParams(location.search);
  if (params.has("hold")) { S.holding = true; S.armK = 1; }        // for screenshots
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw(); requestAnimationFrame(frame);
  }
  if (params.has("t")) { for (var f = 0; f < parseFloat(params.get("t")) * 30; f++) update(1 / 30); draw(); }
  else requestAnimationFrame(frame);
})();
