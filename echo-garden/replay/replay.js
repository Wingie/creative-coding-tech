/* Echo Garden replay: plays back a session exported by gateway/export_web.py.
   No network beyond this folder: the demo comes from data/demo_session.js (window.SESSION),
   ?session=<file>.json fetches a JSON beside the page, and a file picker / drop loads others. */
(function () {
  "use strict";

  var TICK = 0.1279;
  // DexArm-ish geometry (approximate): shoulder on the base axis, two 150 mm links,
  // the tool tip 60 mm further out than the wrist. Reach 150..360 mm as in gateway/arm.py.
  var L1 = 150, L2 = 150, HEAD = 60, SHOULDER_Z = 0;

  var $ = function (id) { return document.getElementById(id); };
  var S = null;                  // the session
  var T = 0, playing = false, speed = 1, lastFrame = 0;
  var colors = {};
  var ui = {};

  // ---------------------------------------------------------------- helpers
  function fmtTime(t) {
    t = Math.max(0, t);
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }
  function fmtShort(t) {
    var m = Math.floor(t / 60), s = Math.floor(t - m * 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  // index of the last row with row[0] <= t (rows sorted by time), -1 if none
  function lastAt(rows, t) {
    var lo = 0, hi = rows.length - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (rows[mid][0] <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["bg", "panel", "ink", "muted", "line", "grid", "leaf", "leaf-2", "soil", "bed", "wood", "sun",
      "raw", "played", "glow", "panel-edge"].forEach(function (k) {
      colors[k] = cs.getPropertyValue("--" + k).trim() || "#888";
    });
  }
  // size a canvas to its CSS width and a given aspect; returns a 2D context in CSS pixels
  function prep(cv, aspect, minH) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth || 300;
    var h = Math.max(minH || 0, Math.round(w * aspect));
    if (cv._w !== w || cv._h !== h || cv._dpr !== dpr) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.height = h + "px";
      cv._w = w; cv._h = h; cv._dpr = dpr;
    }
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.font = "16px ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif";
    g.textBaseline = "middle";
    return { g: g, w: w, h: h };
  }

  // ---------------------------------------------------------------- session state at time t
  function armAt(t) {
    var p = S.arm_path;
    if (!p || !p.length) return { x: 0, y: 300, z: 5, contact: 0 };
    var i = lastAt(p, t);
    if (i < 0) i = 0;
    var a = p[i], b = p[Math.min(i + 1, p.length - 1)];
    var u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
    if (t >= p[p.length - 1][0]) { a = b = p[p.length - 1]; u = 0; }
    return {
      x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u, z: a[3] + (b[3] - a[3]) * u,
      contact: contactAt(t)
    };
  }
  function contactAt(t) {
    var c = S.contacts || [];
    for (var i = 0; i < c.length; i++) {
      if (c[i][0] <= t && t < c[i][1]) return { on: true, station: c[i][2] };
      if (c[i][0] > t) break;
    }
    return { on: false, station: null };
  }
  function loopAt(t) {
    var i = lastAt(S.loop, t);
    var r = i >= 0 ? S.loop[i] : (S.loop[0] || [0, 0, 30, 0]);
    return { feedback: r[1], time_s: r[2], send: r[3] };
  }
  function stepAt(t) {
    var i = lastAt(S.seq_steps, t);
    return i >= 0 ? S.seq_steps[i] : null;
  }
  function stationName(i) {
    for (var k = 0; k < S.stations.length; k++) if (S.stations[k].i === i) return S.stations[k].name;
    return i == null ? "" : "station " + i;
  }

  // ---------------------------------------------------------------- arm geometry
  // two-link IK in the vertical plane through the base axis: returns radial r and z of each joint
  function armJoints(x, y, z) {
    var r = Math.hypot(x, y);
    var rw = r - HEAD, zw = z;                     // wrist
    var dx = rw, dz = zw - SHOULDER_Z;
    var d = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2) + 0.01, Math.hypot(dx, dz)));
    var base = Math.atan2(dz, dx);
    var a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    var th = base + a;                              // elbow up
    var er = L1 * Math.cos(th), ez = SHOULDER_Z + L1 * Math.sin(th);
    return { r: r, angle: Math.atan2(y, x), elbow: [er, ez], wrist: [rw, zw], tip: [r, z] };
  }

  // ---------------------------------------------------------------- drawing: top view
  function drawTop() {
    var c = prep(ui.armTop, 1.0, 300), g = c.g, W = c.w, H = c.h;
    // world window: x -150..150, y -10..315 (mm), keep aspect
    var wx0 = -150, wx1 = 150, wy0 = -10, wy1 = 315;
    var sc = Math.min(W / (wx1 - wx0), H / (wy1 - wy0));
    var ox = W / 2, oy = H - (0 - wy0) * sc - (H - (wy1 - wy0) * sc) / 2;
    function P(x, y) { return [ox + x * sc, oy - y * sc]; }
    var rig = S.rig || { base: [0, 0], plant: [0, 250], r_min: 150, r_max: 360 };

    // reach annulus
    var b = P(0, 0);
    g.save();
    g.strokeStyle = colors.line; g.lineWidth = 1.5; g.setLineDash([5, 6]);
    [rig.r_min || 150, rig.r_max || 360].forEach(function (r) {
      g.beginPath(); g.arc(b[0], b[1], r * sc, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
    });
    g.restore();

    // garden bed around the plant
    var pc = rig.plant || [0, 250];
    var bed0 = P(pc[0] - 62, pc[1] + 52), bed1 = P(pc[0] + 62, pc[1] - 52);
    g.fillStyle = colors.bed; g.globalAlpha = 0.55;
    roundRect(g, bed0[0], bed0[1], bed1[0] - bed0[0], bed1[1] - bed0[1], 12 * sc); g.fill();
    g.globalAlpha = 1;

    var arm = armAt(T), con = arm.contact;
    // plant: glow when the circuit is closed
    var pp = P(pc[0], pc[1]);
    if (con.on) {
      var grd = g.createRadialGradient(pp[0], pp[1], 4, pp[0], pp[1], 48 * sc);
      grd.addColorStop(0, colors.glow); grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(pp[0], pp[1], 48 * sc, 0, Math.PI * 2); g.fill();
    }
    drawPlant(g, pp[0], pp[1], 20 * sc, con.on);

    // stations
    var cur = con.on ? con.station : null;
    S.stations.forEach(function (st) {
      var p = P(st.x, st.y);
      var isCur = st.i === cur;
      g.beginPath(); g.arc(p[0], p[1], Math.max(7, 7 * sc), 0, Math.PI * 2);
      g.fillStyle = isCur ? colors.sun : colors.panel; g.fill();
      g.lineWidth = isCur ? 3 : 2; g.strokeStyle = isCur ? colors.wood : colors.soil; g.stroke();
      // label radially outward from the plant
      var ang = Math.atan2(st.y - pc[1], st.x - pc[0]);
      var lx = p[0] + Math.cos(ang) * (14 + 8 * sc), ly = p[1] - Math.sin(ang) * (14 + 6 * sc);
      g.fillStyle = colors.ink;
      g.textAlign = Math.cos(ang) > 0.3 ? "left" : (Math.cos(ang) < -0.3 ? "right" : "center");
      g.fillText(st.name, lx, ly);
    });
    g.textAlign = "left";

    // arm: base, then the two links projected onto the floor (they lie along one radial line)
    var j = armJoints(arm.x, arm.y, arm.z);
    var ca = Math.cos(j.angle), sa = Math.sin(j.angle);
    var pe = P(j.elbow[0] * ca, j.elbow[0] * sa), pw = P(j.wrist[0] * ca, j.wrist[0] * sa);
    var pt = P(arm.x, arm.y);
    g.lineCap = "round";
    g.strokeStyle = colors.wood; g.lineWidth = Math.max(8, 14 * sc);
    g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(pe[0], pe[1]); g.stroke();
    g.strokeStyle = colors.soil; g.lineWidth = Math.max(6, 10 * sc);
    g.beginPath(); g.moveTo(pe[0], pe[1]); g.lineTo(pw[0], pw[1]); g.stroke();
    g.strokeStyle = colors.muted; g.lineWidth = Math.max(3, 5 * sc);
    g.beginPath(); g.moveTo(pw[0], pw[1]); g.lineTo(pt[0], pt[1]); g.stroke();
    [b, pe, pw].forEach(function (q, k) {
      g.beginPath(); g.arc(q[0], q[1], k === 0 ? Math.max(12, 22 * sc) : Math.max(5, 7 * sc), 0, Math.PI * 2);
      g.fillStyle = k === 0 ? colors.wood : colors.panel; g.fill();
      g.lineWidth = 2; g.strokeStyle = colors.wood; g.stroke();
    });
    g.beginPath(); g.arc(pt[0], pt[1], Math.max(5, 6 * sc), 0, Math.PI * 2);
    g.fillStyle = con.on ? colors.sun : colors.ink; g.fill();
    g.fillStyle = colors.muted; g.textAlign = "left";
    g.fillText("arm base (fixed)", b[0] + Math.max(14, 24 * sc) + 6, Math.min(H - 12, b[1] - 6));
    g.textAlign = "left";
  }

  function drawPlant(g, x, y, r, lit) {
    var n = 7;
    for (var k = 0; k < n; k++) {
      var a = k / n * Math.PI * 2 + 0.3;
      g.save();
      g.translate(x, y); g.rotate(a);
      g.beginPath(); g.ellipse(r * 0.75, 0, r * 0.8, r * 0.38, 0, 0, Math.PI * 2);
      g.fillStyle = k % 2 ? colors.leaf : colors["leaf-2"]; g.fill();
      g.restore();
    }
    g.beginPath(); g.arc(x, y, r * 0.32, 0, Math.PI * 2);
    g.fillStyle = lit ? colors.sun : colors.soil; g.fill();
  }

  function roundRect(g, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------------------------------------------------------------- drawing: side view
  function drawSide() {
    var c = prep(ui.armSide, 0.42, 150), g = c.g, W = c.w, H = c.h;
    var r0 = -20, r1 = 380, z0 = -40, z1 = 175;
    var padB = 26;
    var sc = Math.min(W / (r1 - r0), (H - padB) / (z1 - z0));
    var ox = (W - (r1 - r0) * sc) / 2 - r0 * sc, oy = (H - padB) - (-z0) * sc;
    function P(r, z) { return [ox + r * sc, oy - z * sc]; }
    var arm = armAt(T), con = arm.contact;
    var zt = S.stations.length ? S.stations[0].z_touch : -10;
    var zh = S.stations.length ? S.stations[0].z_hover : 5;
    // the leaf / electrode surface at the touch height
    var pr = Math.hypot((S.rig && S.rig.plant ? S.rig.plant[0] : 0), (S.rig && S.rig.plant ? S.rig.plant[1] : 250));
    var s0 = P(pr - 50, zt), s1 = P(pr + 50, zt);
    g.fillStyle = colors.bed; g.globalAlpha = 0.6;
    g.fillRect(s0[0], s0[1], s1[0] - s0[0], P(0, z0)[1] - s0[1]); g.globalAlpha = 1;
    g.strokeStyle = con.on ? colors.sun : colors.leaf; g.lineWidth = con.on ? 5 : 3;
    g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.stroke();
    // hover line
    var h0 = P(r0, zh), h1 = P(r1, zh);
    g.strokeStyle = colors.line; g.setLineDash([4, 6]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(h0[0], h0[1]); g.lineTo(h1[0], h1[1]); g.stroke(); g.setLineDash([]);
    // arm
    var j = armJoints(arm.x, arm.y, arm.z);
    var b = P(0, SHOULDER_Z), e = P(j.elbow[0], j.elbow[1]), w = P(j.wrist[0], j.wrist[1]), t = P(j.tip[0], j.tip[1]);
    var bb = P(0, z0);
    g.fillStyle = colors.wood; g.fillRect(b[0] - 14, b[1], 28, bb[1] - b[1]);
    g.lineCap = "round";
    g.strokeStyle = colors.wood; g.lineWidth = 9; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.stroke();
    g.strokeStyle = colors.soil; g.lineWidth = 7; g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(w[0], w[1]); g.stroke();
    g.strokeStyle = colors.muted; g.lineWidth = 4; g.beginPath(); g.moveTo(w[0], w[1]); g.lineTo(t[0], t[1]); g.stroke();
    [b, e, w].forEach(function (q) {
      g.beginPath(); g.arc(q[0], q[1], 5, 0, Math.PI * 2); g.fillStyle = colors.panel; g.fill();
      g.strokeStyle = colors.wood; g.lineWidth = 2; g.stroke();
    });
    g.beginPath(); g.arc(t[0], t[1], 5, 0, Math.PI * 2); g.fillStyle = con.on ? colors.sun : colors.ink; g.fill();
    // Z bar on the right
    var bx = W - 18, zb0 = P(0, -20)[1], zb1 = P(0, 40)[1];
    g.fillStyle = colors.line; g.fillRect(bx - 5, zb1, 10, zb0 - zb1);
    var zy = P(0, Math.max(-20, Math.min(40, arm.z)))[1];
    g.fillStyle = con.on ? colors.sun : colors.played; g.fillRect(bx - 8, zy - 3, 16, 6);
    g.fillStyle = colors.ink; g.textAlign = "left";
    g.fillText((con.on ? "Touching" : arm.z.toFixed(0) + " mm up"), 8, H - 12);
  }

  // ---------------------------------------------------------------- drawing: onset lanes
  function laneWindow() {
    var W = parseFloat(ui.win.value) || 8;
    return [T - W * 0.75, T + W * 0.25];
  }
  function gridPhase(a, b) {
    // circular mean phase of the raw onsets in view (a looped replay jumps phase at each join)
    var n = S.plant_notes, i = Math.max(0, lastAt(n, a)), sx = 0, sy = 0, k = 0;
    for (; i < n.length && n[i][0] <= b; i++) {
      if (n[i][0] < a) continue;
      var ph = (n[i][0] / TICK) % 1 * Math.PI * 2;
      sx += Math.cos(ph); sy += Math.sin(ph); k++;
    }
    if (!k) return null;
    var m = Math.atan2(sy, sx) / (Math.PI * 2);
    return (m < 0 ? m + 1 : m) * TICK;
  }
  function drawLane(cv, rows, col, isRaw, phase, win) {
    var c = prep(cv, 0.16, 74), g = c.g, W = c.w, H = c.h;
    var a = win[0], b = win[1], sx = W / (b - a);
    var top = 6, bot = H - 22;
    g.fillStyle = colors.panel; g.fillRect(0, top, W, bot - top);
    var drawGrid = ui.gridOn.checked && phase != null;
    var pxPer = TICK * sx;
    if (drawGrid && pxPer >= 3) {
      g.strokeStyle = colors.grid; g.lineWidth = 1;
      var k0 = Math.ceil((a - phase) / TICK), k1 = Math.floor((b - phase) / TICK);
      g.beginPath();
      for (var k = k0; k <= k1; k++) {
        var x = Math.round((phase + k * TICK - a) * sx) + 0.5;
        g.moveTo(x, top); g.lineTo(x, bot);
      }
      g.stroke();
    }
    // contacts behind the played lane
    if (!isRaw) {
      g.fillStyle = colors.glow;
      (S.contacts || []).forEach(function (ct) {
        if (ct[1] < a || ct[0] > b) return;
        g.globalAlpha = 0.35;
        g.fillRect((Math.max(a, ct[0]) - a) * sx, bot - 6, (Math.min(b, ct[1]) - Math.max(a, ct[0])) * sx, 6);
        g.globalAlpha = 1;
      });
    }
    // onsets
    var i = Math.max(0, lastAt(rows, a)), shown = 0;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5;
    for (; i < rows.length && rows[i][0] <= b; i++) {
      var t = rows[i][0];
      if (t < a) continue;
      shown++;
      var x2 = (t - a) * sx, v = rows[i][2] / 127;
      var hh = (bot - top - 8) * (0.35 + 0.65 * v);
      var past = t <= T;
      g.globalAlpha = past ? 1 : 0.4;
      g.beginPath(); g.moveTo(x2, bot - 1); g.lineTo(x2, bot - hh); g.stroke();
      g.beginPath(); g.arc(x2, bot - hh, 3.5, 0, Math.PI * 2); g.fill();
      if (!isRaw && rows[i][3]) {        // note duration as a faint tail
        g.globalAlpha = past ? 0.35 : 0.15;
        g.fillRect(x2, bot - hh - 2, Math.max(1, rows[i][3] * sx), 4);
      }
    }
    g.globalAlpha = 1;
    if (!shown) {
      g.fillStyle = colors.muted; g.textAlign = "center";
      g.fillText(isRaw ? "no plant notes in view" : "no notes played in view", W / 2, (top + bot) / 2 - 8);
      g.textAlign = "left";
    }
    // playhead
    var px = (T - a) * sx;
    g.strokeStyle = colors.ink; g.lineWidth = 2;
    g.beginPath(); g.moveTo(px, top - 4); g.lineTo(px, bot + 2); g.stroke();
    // time labels
    g.fillStyle = colors.muted; g.textAlign = "left";
    g.fillText(fmtShort(Math.max(0, a)), 2, H - 10);
    g.textAlign = "right"; g.fillText(fmtShort(b), W - 2, H - 10);
    g.textAlign = "left";
    return pxPer;
  }
  function drawLanes() {
    var win = laneWindow();
    var ph = gridPhase(win[0], win[1]);
    var pxPer = drawLane(ui.laneRaw, S.plant_notes, colors.raw, true, ph, win);
    drawLane(ui.lanePlayed, S.seq_notes, colors.played, false, ph, win);
    var note = "";
    if (ui.gridOn.checked) {
      if (pxPer < 3) note = "Zoom in (a shorter window) to see the 127.9 ms grid.";
      else if (ph == null) note = "No raw notes in view to fit the grid's phase.";
      else note = "The grid's phase is fitted to the raw notes in view.";
    }
    ui.gridNote.textContent = note || " ";
  }

  // ---------------------------------------------------------------- drawing: loop
  function drawLoop() {
    var c = prep(ui.loopCv, 0.36, 150), g = c.g, W = c.w, H = c.h;
    var D = S.meta.duration_s || 1;
    var l = 34, r = 10, top = 22, bot = H - 30;
    var sx = (W - l - r) / D;
    function X(t) { return l + t * sx; }
    function Y(v) { return bot - v * (bot - top); }
    g.fillStyle = colors.panel; g.fillRect(l, top, W - l - r, bot - top);
    // ceiling 0.98
    g.strokeStyle = colors.raw; g.setLineDash([5, 5]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(l, Y(0.98)); g.lineTo(W - r, Y(0.98)); g.stroke(); g.setLineDash([]);
    g.fillStyle = colors.muted; g.textAlign = "right";
    g.fillText("1", l - 6, Y(1)); g.fillText("0", l - 6, Y(0));
    // contacts
    g.fillStyle = colors.soil;
    (S.contacts || []).forEach(function (ct) { g.fillRect(X(ct[0]), bot + 4, Math.max(1, (ct[1] - ct[0]) * sx), 6); });
    // feedback line (step-after)
    var L = S.loop;
    if (L.length) {
      g.beginPath(); g.moveTo(X(L[0][0]), Y(L[0][1]));
      for (var i = 1; i < L.length; i++) { g.lineTo(X(L[i][0]), Y(L[i - 1][1])); g.lineTo(X(L[i][0]), Y(L[i][1])); }
      g.lineTo(X(D), Y(L[L.length - 1][1]));
      g.strokeStyle = colors.leaf; g.lineWidth = 2.5; g.stroke();
      g.lineTo(X(D), Y(0)); g.lineTo(X(L[0][0]), Y(0)); g.closePath();
      g.globalAlpha = 0.18; g.fillStyle = colors.leaf; g.fill(); g.globalAlpha = 1;
    }
    // ctrl markers
    var lab = { "ctrl.duck": "D", "ctrl.clear": "C", "ctrl.panic": "P" };
    g.textAlign = "center";
    (S.ctrl || []).forEach(function (e) {
      var k = lab[e[1]]; if (!k) return;
      var x = X(e[0]);
      g.strokeStyle = e[1] === "ctrl.panic" ? colors.raw : colors.sun; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
      g.fillStyle = e[1] === "ctrl.panic" ? colors.raw : colors.wood;
      g.fillText(k, x, top - 10);
    });
    // playhead
    var px = X(T);
    g.strokeStyle = colors.ink; g.lineWidth = 2;
    g.beginPath(); g.moveTo(px, top - 2); g.lineTo(px, bot + 12); g.stroke();
    g.fillStyle = colors.muted; g.textAlign = "left"; g.fillText("0:00", l, H - 9);
    g.textAlign = "right"; g.fillText(fmtShort(D), W - r, H - 9);
    g.textAlign = "left";
    ui.loopGeom = { l: l, r: r, W: W, D: D };
  }

  // ---------------------------------------------------------------- drawing: histograms
  function drawHist(cv, counts, col, labels) {
    var c = prep(cv, 0.5, 110), g = c.g, W = c.w, H = c.h;
    if (!counts || !counts.length) {
      g.fillStyle = colors.muted; g.fillText("not enough notes", 6, H / 2); return;
    }
    var top = 6, bot = H - 24, mx = Math.max.apply(null, counts) || 1;
    var bw = W / counts.length;
    g.fillStyle = colors.panel; g.fillRect(0, top, W, bot - top);
    g.fillStyle = col;
    counts.forEach(function (n, i) {
      var h = (bot - top) * n / mx;
      g.fillRect(i * bw + 1, bot - h, Math.max(1, bw - 2), h);
    });
    g.fillStyle = colors.muted; g.textAlign = "left"; g.fillText(labels[0], 2, H - 10);
    g.textAlign = "right"; g.fillText(labels[1], W - 2, H - 10); g.textAlign = "left";
  }
  function drawHists() {
    var st = S.stats || {};
    var r = st.raw || {}, p = st.played || {};
    drawHist(ui.hRawIoi, r.ioi_hist && r.ioi_hist.counts, colors.raw, ["0 s", "2 s+"]);
    drawHist(ui.hRawPh, r.tick_phase_hist, colors.raw, ["-64 ms", "+64 ms"]);
    drawHist(ui.hPlIoi, p.ioi_hist && p.ioi_hist.counts, colors.played, ["0 s", "2 s+"]);
    drawHist(ui.hPlPh, p.tick_phase_hist, colors.played, ["-64 ms", "+64 ms"]);
  }

  // ---------------------------------------------------------------- text
  function verdictHtml(s) {
    if (!s || !s.comb) return "Not enough notes to tell.";
    var stuck = s.comb.verdict === "COMB" || s.grid.verdict === "GRIDDED";
    return s.n + " notes. " + (stuck
      ? '<span class="bad">Stuck to a grid.</span>'
      : '<span class="good">No grid in sight.</span>') +
      ' <span class="nums">(grid match ' + s.comb.R.toFixed(2) + ", chance up to " + s.comb.null_p99.toFixed(2) + ")</span>";
  }
  function updateText() {
    ui.time.textContent = fmtTime(T) + " / " + fmtShort(S.meta.duration_s || 0);
    if (!ui.scrubbing) ui.scrub.value = T.toFixed(1);
    var arm = armAt(T), con = arm.contact, step = stepAt(T);
    var s;
    if (con.on) s = "Touching the " + stationName(con.station) + " spot. The plant is playing.";
    else if (step && step[2] === "travel") s = "Moving to the " + stationName(step[1]) + " spot.";
    else if (step && step[2] === "panic") s = "Panic stop. Everything goes quiet and the arm heads home.";
    else s = "Arm lifted. The plant is quiet.";
    ui.armStatus.textContent = s;
    var L = loopAt(T);
    var body = bodyAt(T);
    ui.loopStatus.textContent = "Echo level " + Math.round(L.feedback * 100) + "%, a " + Math.round(L.time_s) +
      " s loop" + (body ? ". " + body : ".");
  }
  function bodyAt(t) {
    var B = S.body; if (!B || !B.frames || !B.frames.length) return "";
    var i = lastAt(B.frames, t);
    if (i < 0 || t - B.frames[i][0] > 1.0) return "";
    var f = B.frames[i], k = B.keys, o = {};
    for (var j = 0; j < k.length; j++) o[k[j]] = f[j + 1];
    if (!o.present) return "";
    return "A pretend visitor" + (o.cz != null ? ", " + o.cz.toFixed(1) + " m from the plant" : "");
  }

  // ---------------------------------------------------------------- audio
  var A = null, audioOn = false, schedT = 0;
  function initAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { ui.soundhint.textContent = "This browser has no Web Audio."; return false; }
    var ctx = new Ctx();
    var master = ctx.createDynamicsCompressor();
    master.threshold.value = -8; master.knee.value = 0; master.ratio.value = 20;
    master.attack.value = 0.003; master.release.value = 0.25;
    var out = ctx.createGain(); out.gain.value = 0.9;
    master.connect(out); out.connect(ctx.destination);
    var dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(master);
    var send = ctx.createGain(); send.gain.value = 0.8;
    // the long loop: delay(s) -> tone -> feedback gain -> back in
    var maxD = 60, delays = [], loopLen = 30;
    try { delays.push(ctx.createDelay(maxD)); }
    catch (e) { maxD = 1; }
    var tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3200; tone.Q.value = 0.3;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120;
    var fb = ctx.createGain(); fb.gain.value = 0;
    var wet = ctx.createGain(); wet.gain.value = 0.75;
    if (!delays.length) {               // very old engine: chain short delays up to the loop time
      for (var k = 0; k < Math.ceil(loopLen / maxD); k++) delays.push(ctx.createDelay(maxD));
    }
    for (var d = 0; d < delays.length; d++) {
      delays[d].delayTime.value = Math.min(maxD, loopLen / delays.length);
      if (d > 0) delays[d - 1].connect(delays[d]);
    }
    var first = delays[0], last = delays[delays.length - 1];
    send.connect(first); last.connect(tone); tone.connect(hp); hp.connect(fb); fb.connect(first);
    last.connect(wet); wet.connect(master);
    A = { ctx: ctx, master: master, dry: dry, send: send, delays: delays, maxD: maxD, fb: fb, loopLen: loopLen };
    return true;
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function pluck(when, pitch, vel, dur, raw) {
    var ctx = A.ctx, f = mtof(pitch), amp = 0.22 * Math.pow(vel / 127, 1.4) * (raw ? 0.6 : 1);
    var len = Math.max(0.35, Math.min(3.5, raw ? 0.3 : dur * 1.6 + 0.25));
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(amp, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + len);
    var o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 3.93;
    var e2 = ctx.createGain();
    e2.gain.setValueAtTime(0.0001, when);
    e2.gain.exponentialRampToValueAtTime(0.35, when + 0.002);
    e2.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    o1.connect(env); o2.connect(e2); e2.connect(env);
    env.connect(A.dry);
    if (!raw) env.connect(A.send);
    o1.start(when); o2.start(when); o1.stop(when + len + 0.05); o2.stop(when + len + 0.05);
  }
  function setLoopParams(now) {
    if (!A) return;
    var L = loopAt(T);
    var target = Math.max(0, Math.min(0.98, L.feedback));
    A.fb.gain.setTargetAtTime(audioOn && playing ? target * 0.92 : 0, now, 0.08);
    A.send.gain.setTargetAtTime(L.send, now, 0.1);
    var want = Math.max(1, Math.min(L.time_s || 30, A.maxD * A.delays.length - 0.01));
    if (Math.abs(want - A.loopLen) > 0.05) {
      A.loopLen = want;
      A.delays.forEach(function (d) { d.delayTime.setValueAtTime(Math.min(A.maxD, want / A.delays.length), now); });
    }
  }
  function scheduleAudio() {
    if (!A || !audioOn || !playing) return;
    var now = A.ctx.currentTime;
    setLoopParams(now);
    var raw = ui.rawmode.checked;
    var rows = raw ? S.plant_notes : S.seq_notes;
    var horizon = T + 0.15 * speed;
    var i = Math.max(0, lastAt(rows, schedT));
    for (; i < rows.length && rows[i][0] < horizon; i++) {
      var tn = rows[i][0];
      if (tn < schedT) continue;
      var when = now + Math.max(0, (tn - T) / speed) + 0.03;
      if (raw) pluck(when, rows[i][1], rows[i][2], 0.2, true);
      else pluck(when, rows[i][1], rows[i][2], rows[i][3], false);
    }
    schedT = horizon;
  }
  function clearEcho() {
    if (!A) return;
    var now = A.ctx.currentTime;
    A.fb.gain.cancelScheduledValues(now); A.fb.gain.setValueAtTime(0, now);
  }

  // ---------------------------------------------------------------- loop / transport
  function render() {
    readColorsIfNeeded();
    drawTop(); drawSide(); drawLanes(); drawLoop(); updateText();
  }
  var colorsStamp = null;
  function readColorsIfNeeded() {
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var stamp = String(dark) + (document.documentElement.getAttribute("data-theme") || "");
    if (stamp !== colorsStamp) { colorsStamp = stamp; readColors(); if (S) drawHists(); }
  }
  function frame(ts) {
    if (S) {
      if (playing) {
        var dt = lastFrame ? Math.min(0.25, (ts - lastFrame) / 1000) : 0;
        T += dt * speed;
        if (T >= S.meta.duration_s) { T = S.meta.duration_s; setPlaying(false); }
        scheduleAudio();
      }
      render();
    }
    lastFrame = ts;
    requestAnimationFrame(frame);
  }
  function setPlaying(p) {
    playing = p;
    ui.play.textContent = p ? "Pause" : "Play";
    ui.play.setAttribute("aria-pressed", String(p));
    schedT = T;
    if (!p) clearEcho();
  }
  function seek(t) {
    T = Math.max(0, Math.min(S.meta.duration_s, t));
    schedT = T;
    clearEcho();
  }

  // ---------------------------------------------------------------- loading
  function validate(d) {
    if (!d || typeof d !== "object") return "not a JSON object";
    if (String(d.format || "").indexOf("echo-garden-replay/") !== 0) return "not an Echo Garden replay export (format field)";
    var need = ["meta", "stations", "plant_notes", "seq_notes", "loop", "arm_path"];
    for (var i = 0; i < need.length; i++) if (!d[need[i]]) return "missing " + need[i];
    return null;
  }
  function useSession(d, from) {
    var err = validate(d);
    if (err) { ui.loadStatus.textContent = "Could not load " + from + ": " + err + "."; return false; }
    d.seq_steps = d.seq_steps || []; d.contacts = d.contacts || []; d.ctrl = d.ctrl || [];
    S = d;
    ui.scrub.max = String(S.meta.duration_s || 1);
    ui.play.disabled = false;
    seek(0); setPlaying(false);
    var demo = /probe/.test(S.meta.source || "") || /probe/.test(S.meta.label || "");
    // The demo's intro (with its "How it works" link) is in the HTML; only other sessions replace it.
    if (!demo) ui.notice.textContent = "A recorded session of the plant. If the arm wasn't connected, its moves here are simulated.";
    ui.vRaw.innerHTML = verdictHtml(S.stats && S.stats.raw);
    ui.vPlayed.innerHTML = verdictHtml(S.stats && S.stats.played);
    ui.meta.textContent = S.plant_notes.length + " notes came in from the plant and " +
      S.seq_notes.length + " were played. The arm's proportions are a best guess.";
    ui.loadStatus.textContent = "Loaded " + from + ".";
    colorsStamp = null;
    return true;
  }
  function loadText(txt, from) {
    try { return useSession(JSON.parse(txt), from); }
    catch (e) { ui.loadStatus.textContent = "Could not read " + from + ": " + e.message; return false; }
  }
  function sessionParam() {
    var m = /[?&]session=([^&#]+)/.exec(location.search);
    if (!m) return null;
    var name = decodeURIComponent(m[1]);
    // only a .json file in this folder (or below it): no other hosts, no climbing out
    if (!/^[A-Za-z0-9_\-./]+\.json$/.test(name) || name.indexOf("..") >= 0 || name.charAt(0) === "/" ||
        name.indexOf("//") >= 0) return { bad: name };
    return { name: name };
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    ["play", "sound", "time", "scrub", "speed", "rawmode", "soundhint", "armTop", "armSide", "armStatus",
      "gridOn", "win", "laneRaw", "lanePlayed", "vRaw", "vPlayed", "gridNote", "loopCv", "loopStatus",
      "hRawIoi", "hRawPh", "hPlIoi", "hPlPh", "file", "loadStatus", "meta", "notice"].forEach(function (id) {
      ui[id] = $(id);
    });
    readColors();
    ui.play.addEventListener("click", function () {
      if (!S) return;
      if (!playing && T >= S.meta.duration_s - 0.01) seek(0);
      setPlaying(!playing);
    });
    ui.sound.addEventListener("click", function () {
      if (!A && !initAudio()) return;
      audioOn = !audioOn;
      if (audioOn && A.ctx.state === "suspended") A.ctx.resume();
      ui.sound.textContent = audioOn ? "Mute" : "Sound on";
      ui.sound.setAttribute("aria-pressed", String(audioOn));
      schedT = T;
      if (!audioOn) clearEcho();
    });
    ui.speed.addEventListener("change", function () { speed = parseFloat(ui.speed.value) || 1; schedT = T; });
    ui.rawmode.addEventListener("change", function () { schedT = T; });
    ui.scrub.addEventListener("input", function () { ui.scrubbing = true; if (S) seek(parseFloat(ui.scrub.value)); });
    ui.scrub.addEventListener("change", function () { ui.scrubbing = false; });
    ui.loopCv.addEventListener("click", function (ev) {
      if (!S || !ui.loopGeom) return;
      var rc = ui.loopCv.getBoundingClientRect(), G = ui.loopGeom;
      var u = (ev.clientX - rc.left - G.l) / (G.W - G.l - G.r);
      seek(Math.max(0, Math.min(1, u)) * G.D);
    });
    ui.file.addEventListener("change", function () {
      var f = ui.file.files && ui.file.files[0];
      if (!f) return;
      f.text().then(function (txt) { loadText(txt, f.name); });
    });
    document.addEventListener("dragover", function (e) { e.preventDefault(); document.body.classList.add("dragging"); });
    document.addEventListener("dragleave", function (e) { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
    document.addEventListener("drop", function (e) {
      e.preventDefault(); document.body.classList.remove("dragging");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) f.text().then(function (txt) { loadText(txt, f.name); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.target && /INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === "Space" && S) { e.preventDefault(); ui.play.click(); }
    });
    window.addEventListener("resize", function () { if (S) drawHists(); });

    var p = sessionParam();
    if (p && p.name) {
      fetch(p.name).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      }).then(function (txt) { loadText(txt, p.name); }).catch(function (e) {
        ui.loadStatus.textContent = "Could not fetch " + p.name + " (" + e.message + "); showing the demo.";
        if (window.SESSION) useSession(window.SESSION, "the demo session");
      });
    } else {
      if (p && p.bad) ui.loadStatus.textContent = "Ignored ?session=" + p.bad + ": only a .json file beside this page.";
      if (window.SESSION) useSession(window.SESSION, "the demo session");
      else ui.loadStatus.textContent = "The demo didn't load.";
    }
    requestAnimationFrame(frame);
    // test hook: lets a headless check read state without poking at internals
    window.__replay = {
      seek: function (t) { if (S) { seek(t); render(); } },
      arm: function () { return S ? armAt(T) : null; },
      time: function () { return T; },
      session: function () { return S; }
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
