// scene.js: the rig in space, drawn into a 320x200 canvas that CSS scales up with crisp pixels.
// Procedural sprites only. The neon floor grid holds its lines while the played events sit on
// the plant's 127.9 ms tick (hold = 1) and bends and dissolves as they leave it (hold = 0).
(function () {
  "use strict";
  var W = 320, H = 200, HZ = 96;
  var C = {
    mag: "#ff2bd6", cyan: "#22e6ff", ink: "#f4e9ff", muted: "#8a6fb8", green: "#39ff9f",
    warn: "#ff5c7a", sun: "#ffb238", deck: "#1b0a3c", deck2: "#12052b", dark: "#0d0322"
  };
  var cv, g, sky, floorCv, floorG, floorImg, stars = [];
  var packets = [], ripples = [], flashes = {};
  var wiring = null, prevCables = [], tr = null;

  // ---------------------------------------------------------------- tiny pixel helpers
  function px(x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function line(x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, n = 0;
    g.fillStyle = col;
    while (n++ < 800) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function ellipse(cx, cy, rx, ry, col, fill) {
    g.fillStyle = col;
    for (var y = -ry; y <= ry; y++) {
      var w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (fill) g.fillRect(Math.round(cx - w), Math.round(cy + y), 2 * w + 1, 1);
      else { g.fillRect(Math.round(cx - w), Math.round(cy + y), 1, 1); g.fillRect(Math.round(cx + w), Math.round(cy + y), 1, 1); }
    }
    if (!fill) { g.fillRect(Math.round(cx - 1), Math.round(cy - ry), 3, 1); g.fillRect(Math.round(cx - 1), Math.round(cy + ry), 3, 1); }
  }
  function text(s, x, y, col, shadow) { if (window.Font) window.Font.draw(g, s, x, y, 1, col, shadow || null); }
  function textC(s, cx, y, col, shadow) { if (window.Font) window.Font.drawCentered(g, s, cx, y, 1, col, shadow || null); }
  function hash(a, b, c) { var h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); }
  function mix(a, b, k) { return a + (b - a) * k; }

  // ---------------------------------------------------------------- the sky, drawn once
  function buildSky() {
    sky = document.createElement("canvas"); sky.width = W; sky.height = H;
    var s = sky.getContext("2d");
    var bands = ["#0b0221", "#10032c", "#160436", "#1d0641", "#25084c", "#2f0a56", "#3b0c5e", "#4a0f66", "#5c126c", "#701671", "#861a74"];
    var bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    for (var y = 0; y < HZ; y++) {
      var f = Math.pow(y / HZ, 1.6) * (bands.length - 1), i = Math.floor(f), fr = f - i;
      for (var x = 0; x < W; x++) {
        var b = fr * 16 > bayer[y & 3][x & 3] ? Math.min(bands.length - 1, i + 1) : i;
        s.fillStyle = bands[b]; s.fillRect(x, y, 1, 1);
      }
    }
    // the sun: a gradient disc, cut by widening gaps toward the horizon
    var R = 34, cx = 160, cy = HZ - 4;
    var sunC = ["#fff16b", "#ffd24a", "#ffb238", "#ff8c3a", "#ff6a4a", "#ff4a6a", "#ff2b8a"];
    for (var yy = -R; yy <= 0; yy++) {
      var row = cy + yy;
      var k = (yy + R) / R, gap = false;
      if (k > 0.5) gap = (yy + R) % 5 < Math.floor((k - 0.5) * 8);
      if (gap) continue;
      var w = Math.round(Math.sqrt(R * R - yy * yy));
      s.fillStyle = sunC[Math.min(sunC.length - 1, Math.floor(k * sunC.length))];
      s.fillRect(cx - w, row, 2 * w + 1, 1);
    }
    // mountains: two ridges with a neon rim
    function ridge(seed, base, amp, fill, rim) {
      var prev = null;
      for (var x = 0; x < W; x++) {
        var h = amp * (0.55 * Math.abs(Math.sin(x * 0.045 + seed)) + 0.3 * Math.abs(Math.sin(x * 0.11 + seed * 2.1)) + 0.15 * hash(x, seed, 1));
        if (x > 110 && x < 210) h *= 0.35 + 0.65 * Math.abs(x - 160) / 50;
        var top = Math.round(base - h);
        s.fillStyle = fill; s.fillRect(x, top, 1, HZ - top);
        s.fillStyle = rim; s.fillRect(x, top, 1, 1);
        if (prev !== null && Math.abs(prev - top) > 1) s.fillRect(x, Math.min(prev, top), 1, Math.abs(prev - top));
        prev = top;
      }
    }
    ridge(1.3, HZ, 22, "#1a0636", "#7a2a9a");
    ridge(4.1, HZ, 12, "#12042a", "#ff2bd6");
    s.fillStyle = "#ff5fa2"; s.fillRect(0, HZ, W, 1);
    for (var n = 0; n < 90; n++) {
      var sx = Math.floor(hash(n, 1, 2) * W), sy = Math.floor(hash(n, 3, 4) * (HZ - 26));
      if (Math.hypot(sx - cx, sy - cy) < R + 6) continue;
      stars.push([sx, sy, hash(n, 5, 6)]);
    }
  }

  // ---------------------------------------------------------------- the floor grid (pixel buffer)
  function plotF(x, y, r, gg, b, a) {
    x = Math.round(x); y = Math.round(y) - HZ;
    if (x < 0 || x >= W || y < 1 || y >= H - HZ) return;
    var d = floorImg.data, i = (y * W + x) * 4;
    d[i] = Math.max(d[i], r); d[i + 1] = Math.max(d[i + 1], gg); d[i + 2] = Math.max(d[i + 2], b); d[i + 3] = Math.max(d[i + 3], a);
  }
  function drawFloor(t, hold) {
    var bend = 1 - hold, diss = Math.min(0.85, bend * 0.9);
    floorImg.data.fill(0);
    var F = H - HZ, F2 = 22, scroll = (t * 0.9) % 1;
    var col = [Math.round(mix(255, 34, bend * 0.6)), Math.round(mix(43, 230, bend * 0.6)), Math.round(mix(214, 255, bend * 0.6))];
    var tq = Math.floor(t * 5);
    function warp(xw, z) {
      var w = bend * (6 + 10 / z) * Math.sin(xw * 0.8 + z * 0.55 + t * 1.4) + bend * 4 * Math.sin(z * 1.7 - t * 2.1 + xw * 0.3);
      var v = bend * 3 * Math.sin(xw * 0.5 - t * 1.1 + z * 0.9);
      return [w, v];
    }
    function P(xw, z) {
      var o = warp(xw, z);
      return [160 + (xw * F2) / z + o[0] * (1 / Math.sqrt(z)), HZ + F / z + o[1] / z];
    }
    // lines along the depth
    for (var xw = -18; xw <= 18; xw++) {
      var prev = null;
      for (var z = 26; z >= 0.9; z *= 0.9) {
        var p = P(xw, z);
        if (prev && hash(xw, Math.round(z * 10), tq) >= diss) segF(prev, p, col, z);
        prev = p;
      }
    }
    // lines across, scrolling toward the viewer
    for (var k = 1; k <= 28; k++) {
      var zz = 26 / (k - scroll + 0.0001);
      if (zz < 0.9 || zz > 30) continue;
      var pr = null;
      for (var x2 = -18; x2 <= 18; x2 += 0.5) {
        var q = P(x2, zz);
        if (pr && hash(k, Math.round(x2 * 2), tq + 7) >= diss) segF(pr, q, col, zz);
        pr = q;
      }
    }
    // ripples: one per played event, rings spreading over the floor from the deck
    ripples = ripples.filter(function (r) { return t - r.t < 1.6; });
    ripples.forEach(function (r) {
      var age = (t - r.t) / 1.6, rad = 20 + age * 150, a = Math.round(255 * (1 - age));
      for (var s2 = 0; s2 < 160; s2++) {
        var ang = (s2 / 160) * Math.PI * 2;
        plotF(160 + Math.cos(ang) * rad, 152 + Math.sin(ang) * rad * 0.28, r.c[0], r.c[1], r.c[2], a);
      }
    });
    floorG.putImageData(floorImg, 0, 0);
    g.drawImage(floorCv, 0, HZ);
  }
  function segF(a, b, col, z) {
    var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    if (n > 200) return;
    var al = Math.round(255 * Math.min(1, 0.25 + 1.6 / Math.sqrt(z)));
    for (var i = 0; i <= n; i++) plotF(a[0] + (dx * i) / n, a[1] + (dy * i) / n, col[0], col[1], col[2], al);
  }

  // ---------------------------------------------------------------- the rig on its deck
  function proj(x, y, z) { return [160 + x * 1.25, 152 - (y - 250) * 0.42 - (z || 0) * 0.35]; }
  var BASE = [160, 188];
  var L1 = 150, L2 = 150, HEAD = 60;
  function armJoints(x, y, z) {            // replay.js armJoints, elbow up
    var r = Math.hypot(x, y), rw = r - HEAD, dx = rw, dz = z;
    var d = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2) + 0.01, Math.hypot(dx, dz)));
    var a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)), th = Math.atan2(dz, dx) + a;
    return { r: r, elbow: [L1 * Math.cos(th), L1 * Math.sin(th)], wrist: [rw, z] };
  }
  function anchors(S) {
    var a = S.world.arm, tip = proj(a.x, a.y, a.z);
    var c = S.world.ctl, py = mix(132, 190, c.close), ps = mix(0.6, 1.25, c.close);
    var head = [262, py - 30 * ps];
    return {
      plant: [160, 128], arm: tip, body: head, wek: [head[0] + 14, head[1] - 8], pads: [35, 146], dj: [50, 170],
      box: [104, 6, 112, 26], dests: { notes: [282, 8], loop: [282, 30], projection: [282, 52], macros: [282, 74] }
    };
  }
  var SRC_AT = { pulse: "plant", level: "plant", agit: "plant", drift: "plant", touch: "arm", place: "arm",
                 distance: "body", motion: "body", wcls: "wek", wval: "wek", hand: "pads", energy: "dj" };
  var DEST_LBL = { notes: "NOTES", loop: "LOOP", projection: "LIGHT", macros: "MACRO" };

  function drawDeck(S, t) {
    ellipse(160, 156, 70, 27, C.deck2, true);
    ellipse(160, 152, 70, 27, C.deck, true);
    ellipse(160, 152, 70, 27, "#5a2a9a", false);
    var w = S.world, eng = S.engine, cur = w.arm.contact ? w.arm.st : null;
    var lit = S.lit || {};
    var stations = w.stations.slice().sort(function (a, b) { return b.y - a.y; });
    function pad(s) {
      var p = proj(s.x, s.y, 0), l = lit[s.i] ? Math.max(0, 1 - (t - lit[s.i].t) / lit[s.i].hold) : 0;
      ellipse(p[0], p[1], 7, 3, l > 0 ? (l > 0.5 ? C.cyan : "#1a7f99") : "#2a1250", true);
      ellipse(p[0], p[1], 7, 3, s.i === cur ? C.mag : "#6b3fb0", false);
      if (s.i === cur) ellipse(p[0], p[1], 9, 4, "rgba(255,43,214,0.55)", false);
    }
    stations.filter(function (s) { return s.y >= 250; }).forEach(pad);
    drawDome(S, t);
    stations.filter(function (s) { return s.y < 250; }).forEach(pad);
  }
  function drawDome(S, t) {
    var cx = 160, cy = 150, glow = flashes.plant ? Math.max(0, 1 - (t - flashes.plant) / 0.35) : 0;
    // plant: stem and leaves in neon green, brighter on a pulse
    var leaf = glow > 0.3 ? "#b6ffd9" : C.green;
    line(cx, cy, cx, cy - 15, leaf);
    for (var i = 0; i < 5; i++) {
      var yy = cy - 3 - i * 3, dir = i % 2 ? 1 : -1, sw = Math.sin(t * 1.3 + i) * 0.8;
      line(cx, yy, cx + dir * (5 - i * 0.5) + sw, yy - 3, leaf);
      px(cx + dir * (6 - i * 0.5) + sw, yy - 4, leaf);
    }
    // glass dome
    g.globalAlpha = 0.18 + 0.25 * glow;
    ellipse(cx, cy - 8, 13, 15, C.cyan, true);
    g.globalAlpha = 1;
    for (var a = Math.PI; a <= 2 * Math.PI + 0.001; a += 0.04) px(cx + Math.cos(a) * 13, cy + 1 + Math.sin(a) * 19, "#9feeff");
    line(cx - 6, cy - 14, cx - 4, cy - 16, "#ffffff");
    ellipse(cx, cy + 1, 13, 3, "#3a1a6a", false);
  }
  function drawArm(S) {
    var a = S.world.arm, J = armJoints(a.x, a.y, a.z), tip = proj(a.x, a.y, a.z), flat = proj(a.x, a.y, 0);
    var f = J.r > 1 ? J.elbow[0] / J.r : 0.5, fw = J.r > 1 ? J.wrist[0] / J.r : 0.8;
    var sh = [BASE[0], BASE[1] - 7];
    var el = [mix(sh[0], flat[0], f), mix(sh[1], flat[1], f) - J.elbow[1] * 0.12 - 8];
    var wr = [mix(sh[0], flat[0], fw), mix(sh[1], flat[1], fw) - J.wrist[1] * 0.35 - 6];
    rect(BASE[0] - 6, BASE[1] - 3, 13, 5, "#2a1250");
    line(BASE[0] - 6, BASE[1] - 3, BASE[0] + 6, BASE[1] - 3, C.cyan);
    rect(BASE[0] - 2, sh[1], 5, 5, "#3a1a6a");
    line(sh[0], sh[1], el[0], el[1], "#7a5ad0"); line(sh[0] + 1, sh[1], el[0] + 1, el[1], C.cyan);
    line(el[0], el[1], wr[0], wr[1], "#7a5ad0"); line(el[0] + 1, el[1], wr[0] + 1, wr[1], C.cyan);
    line(wr[0], wr[1], tip[0], tip[1] - 1, C.ink);
    rect(el[0] - 1, el[1] - 1, 3, 3, C.mag);
    rect(wr[0] - 1, wr[1] - 1, 3, 3, C.mag);
    if (a.contact) { ellipse(tip[0], tip[1] + 1, 4, 1, C.mag, false); px(tip[0], tip[1], "#ffffff"); }
    else px(tip[0], tip[1], C.mag);
  }
  function drawPerformer(S, t) {
    var c = S.world.ctl, s = mix(0.6, 1.25, c.close), fx = 262, fy = mix(132, 190, c.close);
    var m = c.motion, sw = Math.sin(t * 11) * m, sw2 = Math.sin(t * 9 + 1) * m;
    var col = C.cyan, h = 30 * s, cx = fx + sw2 * 3 * s;
    ellipse(fx, fy, 7 * s, 2 * s, "rgba(34,230,255,0.25)", true);
    var hip = [cx, fy - h * 0.45], neck = [cx + sw * 2 * s, fy - h * 0.82];
    line(hip[0], hip[1], fx - 4 * s - sw * 3 * s, fy, col);
    line(hip[0], hip[1], fx + 4 * s + sw * 3 * s, fy, col);
    line(hip[0], hip[1], neck[0], neck[1], col);
    line(hip[0] + 1, hip[1], neck[0] + 1, neck[1], col);
    var armA = -0.6 - sw * 1.6, armB = -0.6 + sw * 1.6;
    line(neck[0], neck[1] + 2, neck[0] - Math.cos(armA) * 9 * s, neck[1] + 2 + Math.sin(-armA) * -9 * s, col);
    line(neck[0], neck[1] + 2, neck[0] + Math.cos(armB) * 9 * s, neck[1] + 2 + Math.sin(-armB) * -9 * s, col);
    ellipse(neck[0], neck[1] - 4 * s, Math.max(2, 3 * s), Math.max(2, 3 * s), C.mag, true);
    // Wekinator orb: class number and the learned value as a ring
    var o = [neck[0] + 14, neck[1] - 8 * s - 4], cls = c.wcls;
    ellipse(o[0], o[1], 4, 4, cls ? C.sun : "#3a1a6a", true);
    for (var a = 0; a < c.wval * Math.PI * 2; a += 0.12) px(o[0] + Math.cos(a - Math.PI / 2) * 7, o[1] + Math.sin(a - Math.PI / 2) * 7, C.green);
    if (cls) text(String(cls), o[0] - 2, o[1] - 4, "#1a0030");
  }
  function drawSideKit(S, t) {
    // pads
    ["duck", "clear", "panic"].forEach(function (k, i) {
      var on = flashes["pad_" + k] && t - flashes["pad_" + k] < 0.5;
      rect(24 + i * 8, 142, 6, 6, on ? (k === "panic" ? C.warn : C.cyan) : "#2a1250");
      line(24 + i * 8, 148, 29 + i * 8, 148, "#6b3fb0");
    });
    if (S.world.arm.paused) text("PANIC", 22, 131, C.warn);
    // DJ deck: a turntable that spins with the outside energy
    var e = S.world.ctl.energy, cx = 50, cy = 172;
    rect(cx - 16, cy - 3, 32, 9, "#1d0a3a"); line(cx - 16, cy - 3, cx + 15, cy - 3, C.mag);
    ellipse(cx - 6, cy - 4, 7, 2, "#2a1250", true); ellipse(cx - 6, cy - 4, 7, 2, C.mag, false);
    var ang = t * (1 + 8 * e);
    line(cx - 6, cy - 4, cx - 6 + Math.cos(ang) * 6, cy - 4 + Math.sin(ang) * 1.6, C.ink);
    for (var i2 = 0; i2 < 5; i2++) rect(cx + 6 + i2 * 2, cy + 3 - Math.round(e * 7 * (0.6 + 0.4 * Math.sin(t * 8 + i2))), 1, Math.max(1, Math.round(e * 7 * (0.6 + 0.4 * Math.sin(t * 8 + i2)))), C.cyan);
    text("dj", cx - 16, cy + 8, C.muted);
  }

  // ---------------------------------------------------------------- cables + the mapping box
  function bez(a, b, k, up) {
    var c1 = [a[0], a[1] - up], c2 = [b[0] - 20, b[1]];
    var u = 1 - k;
    return [u * u * u * a[0] + 3 * u * u * k * c1[0] + 3 * u * k * k * c2[0] + k * k * k * b[0],
            u * u * u * a[1] + 3 * u * u * k * c1[1] + 3 * u * k * k * c2[1] + k * k * k * b[1]];
  }
  function cablesFor(w, A) {
    if (!w) return [];
    var bx = A.box, out = [];
    w.src.forEach(function (id, i) {
      var at = A[SRC_AT[id]] || A.plant;
      out.push({ kind: "src", id: id, a: at, b: [bx[0], bx[1] + 8 + i * 9], col: C.mag, up: 40 });
    });
    var d = A.dests[w.dest];
    if (d) out.push({ kind: "dest", id: w.dest, a: [bx[0] + bx[2], bx[1] + 12], b: [d[0], d[1] + 6], col: C.cyan, up: 0 });
    return out;
  }
  function drawCable(c, p0, p1, bad) {
    var n = 60;
    for (var i = Math.floor(p0 * n); i < p1 * n; i++) {
      var q = bez(c.a, c.b, i / n, c.up), q2 = bez(c.a, c.b, Math.min(1, (i + 1) / n), c.up);
      if (bad && i % 4 > 1) continue;
      line(q[0], q[1], q2[0], q2[1], bad ? C.warn : c.col);
    }
    if (p1 >= 1 && !bad) { var e = c.b; rect(e[0] - 1, e[1] - 1, 3, 3, "#ffffff"); }
  }
  // the transition: old cables come out one at a time, new ones go in one at a time
  var RET = 0.16, EXT = 0.34, FLIP = 0.4;
  function setWiring(w, valid, now, A) {
    prevCables = tr ? tr.newC : cablesFor(wiring, A);
    var old = wiring;
    wiring = w;
    var newC = cablesFor(w, A);
    tr = { t0: now, oldC: prevCables, newC: newC, oldW: old, valid: valid };
    var nSrc = newC.filter(function (c) { return c.kind === "src"; }).length;
    tr.tFlip = prevCables.length * RET + nSrc * EXT;
    tr.dur = tr.tFlip + FLIP + EXT;
    return tr.dur;
  }
  function drawCables(S, t) {
    if (!tr) return;
    var A = anchors(S), tt = t - tr.t0, i;
    // re-anchor live (the arm and performer move)
    tr.newC = cablesFor(wiring, A);
    var nOld = tr.oldC.length;
    for (i = 0; i < nOld; i++) {
      var k = (nOld - 1 - i), p = 1 - Math.min(1, Math.max(0, (tt - k * RET) / RET));
      if (p > 0) drawCable(tr.oldC[i], 0, p, false);
    }
    var t1 = nOld * RET, si = 0;
    tr.newC.forEach(function (c) {
      var start = c.kind === "src" ? t1 + (si++) * EXT : tr.tFlip + FLIP;
      var p2 = Math.min(1, Math.max(0, (tt - start) / EXT));
      if (p2 > 0) drawCable(c, 0, p2, !tr.valid);
    });
    // packets riding the cables
    packets = packets.filter(function (pk) { return t - pk.t < pk.d; });
    if (tt > tr.dur && tr.valid) {
      packets.forEach(function (pk) {
        var c = tr.newC.filter(function (x) { return x.kind === pk.kind; })[0];
        if (!c) return;
        var q = bez(c.a, c.b, (t - pk.t) / pk.d, c.up);
        rect(q[0] - 1, q[1] - 1, 3, 3, pk.kind === "src" ? "#ffd6f6" : "#d9fbff");
      });
    }
  }
  function drawBox(S, t) {
    var A = anchors(S), b = A.box, tt = tr ? t - tr.t0 : 99, w = wiring, valid = tr ? tr.valid : true;
    var flipping = tr && tt >= tr.tFlip && tt < tr.tFlip + FLIP;
    var showNew = !tr || tt >= tr.tFlip + FLIP / 2;
    var ww = showNew ? w : tr.oldW;
    rect(b[0], b[1], b[2], b[3], "rgba(18,4,42,0.88)");
    var edge = flipping ? (Math.floor(tt * 30) % 2 ? C.mag : C.cyan) : valid || !showNew ? C.cyan : C.warn;
    line(b[0], b[1], b[0] + b[2] - 1, b[1], edge); line(b[0], b[1] + b[3] - 1, b[0] + b[2] - 1, b[1] + b[3] - 1, edge);
    line(b[0], b[1], b[0], b[1] + b[3] - 1, edge); line(b[0] + b[2] - 1, b[1], b[0] + b[2] - 1, b[1] + b[3] - 1, edge);
    if (!ww) return;
    var tm = window.SIM.byId(window.SIM.TIMES, ww.time), sh = window.SIM.byId(window.SIM.SHAPES, ww.shape);
    var l1 = tm ? tm.name : "?", l2 = sh ? sh.name : "?";
    if (flipping) { l1 = scramble(l1, tt); l2 = scramble(l2, tt + 0.1); }
    if (showNew && !valid) { l1 = "can't work"; l2 = "see the left"; }
    textC(l1, b[0] + b[2] / 2, b[1] + 3, showNew && !valid ? C.warn : C.ink, "#000000");
    textC(l2, b[0] + b[2] / 2, b[1] + 14, C.cyan, "#000000");
  }
  function scramble(s, k) {
    var ch = "#%&*+=<>/\\|01", out = "";
    for (var i = 0; i < s.length; i++) out += s[i] === " " ? " " : hash(i, Math.floor(k * 30), 3) < 0.5 ? ch[Math.floor(hash(i, k * 30, 9) * ch.length)] : s[i];
    return out;
  }
  function drawDests(S, t) {
    var A = anchors(S);
    Object.keys(A.dests).forEach(function (k) {
      var d = A.dests[k], on = wiring && wiring.dest === k, fl = flashes["dest_" + k] ? Math.max(0, 1 - (t - flashes["dest_" + k]) / 0.3) : 0;
      rect(d[0], d[1], 36, 13, fl > 0 ? "rgba(34,230,255," + (0.25 + 0.5 * fl) + ")" : "rgba(18,4,42,0.85)");
      var e = on ? C.cyan : "#4a2a80";
      line(d[0], d[1], d[0] + 35, d[1], e); line(d[0], d[1] + 12, d[0] + 35, d[1] + 12, e);
      line(d[0], d[1], d[0], d[1] + 12, e); line(d[0] + 35, d[1], d[0] + 35, d[1] + 12, e);
      text(DEST_LBL[k], d[0] + 3, d[1] + 2, on ? C.ink : C.muted);
    });
  }

  // ---------------------------------------------------------------- frame
  function draw(S) {
    var t = S.t;
    g.drawImage(sky, 0, 0);
    stars.forEach(function (s) { if (Math.sin(t * (1 + s[2] * 3) + s[2] * 20) > -0.6) px(s[0], s[1], s[2] > 0.7 ? C.cyan : "#e8dcff"); });
    rect(0, HZ + 1, W, H - HZ, C.dark);
    drawFloor(t, S.hold);
    drawDeck(S, t);
    drawArm(S);
    drawPerformer(S, t);
    drawSideKit(S, t);
    drawDests(S, t);
    drawCables(S, t);
    drawBox(S, t);
    // the grid's state in words, bottom left
    var hold = S.hold;
    text(hold > 0.66 ? "on the grid" : hold > 0.33 ? "slipping" : "off the grid", 4, 189, hold > 0.66 ? C.sun : C.green, "#000000");
  }

  window.Scene = {
    init: function (canvas) {
      cv = canvas; g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
      floorCv = document.createElement("canvas"); floorCv.width = W; floorCv.height = H - HZ;
      floorG = floorCv.getContext("2d"); floorImg = floorG.createImageData(W, H - HZ);
      buildSky();
    },
    draw: draw,
    setWiring: function (w, valid, S) { return setWiring(w, valid, S.t, anchors(S)); },
    inTransition: function (t) { return tr ? t - tr.t0 < tr.dur : false; },
    packet: function (kind, t, d) { packets.push({ kind: kind, t: t, d: d || 0.35 }); if (packets.length > 80) packets.shift(); },
    ripple: function (t, rgb) { ripples.push({ t: t, c: rgb }); if (ripples.length > 24) ripples.shift(); },
    flash: function (k, t) { flashes[k] = t; },
    // performer drag: canvas y (0..200) -> closeness
    closeFromY: function (y) { return Math.max(0, Math.min(1, (y - 120) / 70)); },
    W: W, H: H
  };
})();
