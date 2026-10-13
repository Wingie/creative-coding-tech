// sim.js: the Echo Garden possibility simulator's core. Plain JS, no DOM, runs in a page
// (window.SIM) and in node (module.exports) for the tick-match check.
//
// A rough sim, on purpose: it borrows the shape of plant/gateway (the plant on its 127.9 ms
// tick, re-time 0-400 ms from the plant's own signals, the 12 notes / 30 s cap, the loop ride
// with duck, clear and panic, the station walk) and keeps it plausible. It is not a port.
//
//   World   the room: plant (recorded probe or simulated), arm walk, body, Wekinator, pads,
//           DJ energy. advance(t) returns timed input events and keeps the last 40 s.
//   Engine  one wiring (sources -> time -> shape -> destination). feed(events) turns inputs
//           into played events and the messages the rig would send.
//   comb    the tick check from plant/onset_report.py (Rayleigh R at 127.9 ms +- 1.5 ms).
(function (root) {
  "use strict";

  var TICK = 0.1279;

  // ------------------------------------------------------------------ small helpers
  function rng(seed) {                       // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  // a signal against its own recent range (gateway mappers' _Norm)
  function Norm(tau) { this.tau = tau; this.lo = null; this.hi = null; this.t = 0; }
  Norm.prototype.at = function (t, x) {
    if (this.lo === null) { this.lo = x - 1e-3; this.hi = x + 1e-3; this.t = t; return 0.5; }
    var a = 1 - Math.exp(-Math.max(0, t - this.t) / this.tau);
    this.t = t;
    this.lo += (x - this.lo) * a; this.hi += (x - this.hi) * a;
    this.lo = Math.min(this.lo, x); this.hi = Math.max(this.hi, x);
    return (x - this.lo) / Math.max(this.hi - this.lo, 1e-3);
  };

  // ------------------------------------------------------------------ the plant
  // recorded: the 08-27 probe, looped with a 1 s gap like gateway/in_plant.py
  // simulated: in_plant._synth_chunk, a coin flip per 127.9 ms tick at about 1.9/s
  function Plant(mode, probe, seed) {
    this.mode = mode; this.probe = probe; this.r = rng(seed || 7);
    this.buf = []; this.until = 0; this.cc = [64, 65, 64, 61, 49]; this.t0 = null;
  }
  Plant.prototype._chunk = function () {
    var a = this.until, out = [], k, i;
    if (this.mode === "recorded" && this.probe) {
      var L = this.probe.dur + 1.0;
      var p = this.probe;
      for (i = 0; i < p.notes.length; i++) out.push({ t: a + p.notes[i][0], k: "note", pitch: p.notes[i][1], vel: p.notes[i][2] });
      for (i = 0; i < p.cc.length; i++) out.push({ t: a + p.cc[i][0], k: "cc", cc: p.cc[i][1], v: p.cc[i][2] });
      this.until = a + L;
    } else {
      var r = this.r, n = Math.floor(60 / TICK);
      if (this.t0 === null) this.t0 = a;
      for (k = 0; k < n; k++) {
        var tt = a + (k + 0.5) * TICK;
        var lam = 1.9 * (1 + 0.6 * Math.sin(2 * Math.PI * (tt - this.t0) / 47));
        if (r() < clamp(lam * TICK, 0, 1)) {
          out.push({ t: tt + gauss(r) * 0.001, k: "note", pitch: Math.round(clamp(61 + 6 * gauss(r), 49, 73)),
                     vel: Math.round(clamp(70 + 12 * gauss(r), 1, 127)) });
        }
      }
      var last = {};
      for (k = 0; k < 60 * 20; k++) {
        var tc = a + k / 20, ph = 2 * Math.PI * (tc - this.t0);
        var base = 64 + 10 * Math.sin(ph / 1.6) + 6 * Math.sin(ph / 13);
        this.cc[0] = base + gauss(r); this.cc[1] = base + 1 + gauss(r); this.cc[2] = base + gauss(r);
        this.cc[3] = clamp(this.cc[3] + 3 * gauss(r), 30, 100);
        this.cc[4] = clamp(this.cc[4] + 0.2 * gauss(r), 20, 100);
        for (var c = 0; c < 5; c++) {
          var v = Math.round(clamp(this.cc[c], 0, 127));
          if (last[c] !== v) { last[c] = v; out.push({ t: tc, k: "cc", cc: c, v: v }); }
        }
      }
      this.until = a + 60;
    }
    out.sort(function (x, y) { return x.t - y.t; });
    this.buf = this.buf.concat(out);
  };
  Plant.prototype.take = function (t1) {
    while (this.until <= t1 + 0.5) this._chunk();
    var i = 0;
    while (i < this.buf.length && this.buf[i].t <= t1) i++;
    return this.buf.splice(0, i);
  };

  // ------------------------------------------------------------------ the world
  var PARK = { x: 0, y: 300, z: 40 };
  function World(opts) {
    opts = opts || {};
    var S = opts.stations || (root.STATIONS || {});
    this.stations = (S.stations || []).map(function (s) { return Object.assign({}, s); });
    this.poseA = S.pose_a || { x: 30, y: 215, z: 10 };
    this.poseB = S.pose_b || { x: -30, y: 300, z: 60 };
    var cx = 0, cy = 0, me = this;
    this.stations.forEach(function (s) { cx += s.x; cy += s.y; });
    cx /= this.stations.length || 1; cy /= this.stations.length || 1;
    this.centre = { x: cx, y: cy };
    var dx = this.poseB.x - this.poseA.x, dy = this.poseB.y - this.poseA.y, L2 = dx * dx + dy * dy || 1;
    this.stations.forEach(function (s) {
      s.ang = Math.atan2(s.y - cy, s.x - cx);
      s.u = clamp(((s.x - me.poseA.x) * dx + (s.y - me.poseA.y) * dy) / L2, 0, 1);
    });
    this.ring = this.stations.slice().sort(function (a, b) { return a.ang - b.ang; }).map(function (s) { return s.i; });
    this.r = rng(opts.seed || 11);
    this.plant = new Plant(opts.plant || "recorded", opts.probe || root.PROBE, opts.seed || 7);
    this.t = 0; this.log = []; this.keep = 40;
    // controls (set by the page)
    this.ctl = { close: 0.35, motion: 0.0, wcls: 0, wval: 0.5, energy: 0.4, steer: "walk" };
    // arm
    this.arm = { x: PARK.x, y: PARK.y, z: PARK.z, phase: "idle", st: null, to: null, contact: false,
                 tPhase: 0, notes: 0, k: 8, paused: false };
    this._clk = 0; this._last = { wcls: 0 };
  }
  World.prototype.setPlant = function (mode) {
    this.plant = new Plant(mode, root.PROBE, 7);
    this.plant.until = this.t; this.plant.t0 = this.t;
  };
  World.prototype.station = function (i) { return this.stations[i] || null; };
  World.prototype.posePoint = function (u) {
    var A = this.poseA, B = this.poseB;
    return { x: A.x + u * (B.x - A.x), y: A.y + u * (B.y - A.y), z: A.z + u * (B.z - A.z) };
  };
  World.prototype.panic = function (on) {
    this.arm.paused = on;
    if (on) { this.arm.phase = "park"; this.arm.to = null; }
  };
  // move toward a point at the arm's feeds: XY 3000 mm/min, Z 1500 mm/min
  World.prototype._moveArm = function (p, dt) {
    var a = this.arm, sxy = 50 * dt, sz = 25 * dt;
    var dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0.5) {                               // lift to hover before any travel
      if (a.z < 5 - 0.01) { a.z = Math.min(5, a.z + sz); return false; }
      var s = Math.min(1, sxy / d); a.x += dx * s; a.y += dy * s;
      return false;
    }
    a.x = p.x; a.y = p.y;
    a.z += clamp(p.z - a.z, -sz, sz);
    return Math.abs(p.z - a.z) < 0.01;
  };
  World.prototype._stepArm = function (t, dt, out) {
    var a = this.arm, me = this, st;
    function touch(i) {
      a.contact = true; a.st = i; a.tPhase = t; a.notes = 0;
      a.k = Math.round(Math.exp(Math.log(3) + me.r() * (Math.log(40) - Math.log(3))));
      out.push({ t: t, k: "touch", st: i }); out.push({ t: t, k: "place", st: i });
    }
    function lift() { a.contact = false; out.push({ t: t, k: "lift", st: a.st }); }
    if (a.paused) {
      if (a.contact) lift();
      a.phase = "park"; this._moveArm(PARK, dt); return;
    }
    if (this.ctl.steer === "pose") {
      var u = clamp(this.ctl.wval, 0, 1), p = this.posePoint(u);
      var zone = null, best = 1e9;
      this.stations.forEach(function (s) { var d = Math.abs(s.u - u); if (d < best) { best = d; zone = s; } });
      var inZone = zone && best <= 0.08;
      if (a.poseU === undefined || Math.abs(u - a.poseU) > 0.02) { a.poseU = u; a.tStill = t; }
      if (inZone && t - a.tStill >= 0.6) {
        if (a.contact && a.st === zone.i) return;
        if (a.contact) { lift(); return; }
        if (this._moveArm({ x: zone.x, y: zone.y, z: zone.z_touch }, dt)) touch(zone.i);
        return;
      }
      if (a.contact) lift();
      this._moveArm({ x: p.x, y: p.y, z: Math.max(p.z, 5) }, dt);
      a.phase = "pose";
      return;
    }
    // walk ccw round the ring, as the Sequencer's _walk_station
    if (a.phase === "idle" || a.phase === "park" || a.phase === "pose") {
      a.to = this.ring[0]; a.phase = "travel";
    }
    if (a.phase === "travel") {
      st = this.station(a.to);
      if (this._moveArm({ x: st.x, y: st.y, z: st.z_touch }, dt)) { touch(a.to); a.phase = "contact"; }
    } else if (a.phase === "contact") {
      var held = t - a.tPhase;
      if (held >= 2 && (a.notes >= a.k || held >= 20)) {
        lift(); a.phase = "lift";
        var k = this.ring.indexOf(a.st);
        a.to = this.ring[(k + 1) % this.ring.length];
      }
    } else if (a.phase === "lift") {
      st = this.station(a.st);
      if (this._moveArm({ x: st.x, y: st.y, z: st.z_hover }, dt)) a.phase = "travel";
    }
  };
  World.prototype.advance = function (t1) {
    var t0 = this.t, out = [], me = this;
    if (t1 <= t0) return out;
    var plant = this.plant.take(t1), pi = 0, c = this.ctl;
    var dt = 0.05;
    for (var tc = Math.ceil(t0 / dt + 1e-9) * dt; tc <= t1 + 1e-9; tc += dt) {
      while (pi < plant.length && plant[pi].t <= tc) {
        var ev = plant[pi++];
        if (ev.k === "note" && this.arm.contact) this.arm.notes++;
        out.push(ev);
      }
      this._stepArm(tc, dt, out);
      this._clk++;
      out.push({ t: tc, k: "clk" });
      if (this._clk % 2 === 0) {
        out.push({ t: tc, k: "body", close: c.close, motion: c.motion });
        out.push({ t: tc, k: "wval", v: c.wval });
        out.push({ t: tc, k: "energy", v: c.energy });
      }
      if (c.motion > 0.12 && this.r() < 3.2 * Math.pow(c.motion, 1.4) * dt) out.push({ t: tc + this.r() * dt, k: "move", v: c.motion });
      if (c.wcls !== this._last.wcls) { this._last.wcls = c.wcls; out.push({ t: tc, k: "wcls", cls: c.wcls }); }
    }
    while (pi < plant.length) out.push(plant[pi++]);
    (this._pending || []).forEach(function (e) { e.t = Math.max(t0, Math.min(t1, e.t)); out.push(e); });
    this._pending = [];
    out.sort(function (a, b) { return a.t - b.t; });
    this.t = t1;
    this.log = this.log.concat(out);
    var cut = 0;
    while (cut < this.log.length && this.log[cut].t < t1 - this.keep) cut++;
    if (cut) this.log = this.log.slice(cut);
    return out;
  };
  World.prototype.pad = function (kind) {               // duck | clear | panic | resume
    (this._pending = this._pending || []).push({ t: this.t, k: "pad", kind: kind });
    if (kind === "panic") this.panic(true);
    if (kind === "resume") this.panic(false);
  };

  // ------------------------------------------------------------------ the blocks
  // kinds: ev = makes events, val = a level to follow, held = can be held
  var SOURCES = [
    { id: "pulse", name: "plant pulse", ev: 1, hw: "Pocket Scion", m: "measured", what: "the plant's note-ons, about 1.9 a second, on its 127.9 ms tick" },
    { id: "level", name: "plant level", val: 1, hw: "Pocket Scion", m: "measured", what: "CC0-2, one signal wobbling over 1-2 s" },
    { id: "agit", name: "plant agitation", val: 1, hw: "Pocket Scion", m: "measured", what: "CC3, faster than the level" },
    { id: "drift", name: "plant drift", val: 1, hw: "Pocket Scion", m: "measured", what: "CC4, a slow drift" },
    { id: "touch", name: "touch", ev: 1, held: 1, hw: "Rotrics arm + Scion electrode", m: "predicted, untested", what: "arm contact closes the Scion circuit; simulated here, never measured on the rig" },
    { id: "place", name: "place", val: 1, hw: "Rotrics arm", m: "runs", what: "which station the arm is at" },
    { id: "distance", name: "distance", val: 1, held: 1, hw: "Kinect + body features (UDP 7401)", m: "runs", what: "how close the performer stands" },
    { id: "motion", name: "motion", ev: 1, val: 1, hw: "Kinect + body features (UDP 7401)", m: "runs", what: "how much the performer moves; big moves fire events" },
    { id: "wcls", name: "learned shape", ev: 1, held: 1, hw: "Wekinator (12020, relayed to TD 12000)", m: "trained live", what: "a pose class, trained live" },
    { id: "wval", name: "learned value", val: 1, hw: "Wekinator (12020, relayed to TD 12000)", m: "trained live", what: "a 0..1 value between two taught poses" },
    { id: "hand", name: "hand", ev: 1, hw: "MIDIMix pads", m: "runs", what: "duck, clear, panic pads" },
    { id: "energy", name: "outside energy", val: 1, hw: "none yet (a slider)", m: "no input", what: "the DJ set's level; no input module exists, so it is a slider" }
  ];
  var TIMES = [
    { id: "tick", name: "on the tick", st: "built", what: "as the plant plays it, on its 127.9 ms tick" },
    { id: "bend", name: "bent off the tick", st: "planned", what: "each event waits 0-400 ms, an amount taken from the plant's own signals" },
    { id: "density", name: "as density", st: "sketch", what: "a chance per moment, on a free clock, following a level" },
    { id: "gate", name: "as a gate", st: "sketch", what: "events pass only while something is held" },
    { id: "stretch", name: "stretched playhead", st: "sketch", what: "events step a written phrase; a slow level stretches its beat" },
    { id: "ornament", name: "as ornament", st: "sketch", what: "each event becomes a short burst of 2-4 hits" }
  ];
  var SHAPES = [
    { id: "pitch", name: "pitch from a set", st: "planned", dest: ["notes"] },
    { id: "loud", name: "loudness", st: "planned", dest: ["notes", "macros"] },
    { id: "phrase", name: "phrase length", st: "planned", dest: ["notes", "projection"] },
    { id: "fb", name: "loop feedback", st: "planned", dest: ["loop"] },
    { id: "send", name: "loop send", st: "planned", dest: ["loop"] },
    { id: "len", name: "loop length", st: "planned", dest: ["loop"] },
    { id: "light", name: "light on a place", st: "planned", dest: ["projection"] },
    { id: "fx", name: "effect amount", st: "sketch", dest: ["macros"] }
  ];
  var DESTS = [
    { id: "notes", name: "notes", st: "built", hw: "Ableton via IAC Driver Bus 1", what: "IAC Driver Bus 1, ch 2-4 (gateway out_live)" },
    { id: "loop", name: "loop", st: "built", hw: "Ableton loop (Frippertronics / Valhalla) mapped to IAC ch 16", what: "IAC ch 16: CC30 feedback, CC31 send, CC32 clear, CC33 loop time" },
    { id: "projection", name: "projection", st: "built", hw: "projector + Limn + TouchDesigner", what: "Limn :8779 /area?action=colour, TD :10000 /seq/step" },
    { id: "macros", name: "TD rack macros", st: "sketch", hw: "TouchDesigner + TDAbleton", what: "TDAbleton rack macros, driven from TD" }
  ];
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  var SHAPE_DEST_WHY = {
    pitch: "pitch only means something as notes",
    loud: "loudness goes to notes or a rack macro",
    phrase: "phrase length goes to notes or to how long a light holds",
    fb: "loop feedback only goes to the loop CCs", send: "loop send only goes to the loop CCs",
    len: "loop length only goes to the loop CCs",
    light: "light on a place only goes to the projection", fx: "an effect amount goes to a TD rack macro"
  };

  // roles of a wiring's sources; null fields when missing
  function roles(w) {
    var s = w.src.map(function (id) { return byId(SOURCES, id); }).filter(Boolean);
    var ev = s.filter(function (x) { return x.ev; });
    var trig = ev.filter(function (x) { return x.id === "pulse"; })[0] || ev[0] || null;
    var held = null, val = null;
    if (w.time === "gate") {
      held = s.filter(function (x) { return x.held && x !== trig; })[0] || null;
      if (!held && trig && trig.held) {
        var other = ev.filter(function (x) { return x !== trig; })[0];
        if (other) { held = trig; trig = other; }
      }
    }
    val = s.filter(function (x) { return x.val && x !== trig && x !== held; })[0] ||
          s.filter(function (x) { return x.val && x !== held; })[0] || null;
    return { trig: trig, held: held, val: val };
  }

  // one line saying why a wiring can't work, or null
  function why(w) {
    if (!w.src.length) return "pick a source";
    if (w.src.length === 2 && w.src[0] === w.src[1]) return "two different sources, please";
    var r = roles(w);
    var hasPulse = w.src.indexOf("pulse") >= 0;
    switch (w.time) {
      case "tick":
        if (!hasPulse) return "only the plant's own pulse sits on its tick: add plant pulse";
        break;
      case "bend": case "ornament": case "stretch":
        if (!r.trig) return (w.time === "stretch" ? "a playhead needs events to step it" : w.time === "bend" ? "bending needs events to move" : "an ornament needs events to decorate") + ": add plant pulse, touch, motion, a learned shape or a pad";
        break;
      case "density":
        if (!r.val) return "a chance needs a level to follow: add plant level, agitation, drift, distance, motion, learned value or energy";
        break;
      case "gate":
        if (!r.held) return "a gate needs something that is held, like touch, distance or a learned shape";
        if (!r.trig || r.trig === r.held) return "a gate needs something to pass through it: add plant pulse, motion or a pad";
        break;
      default: return "pick a time block";
    }
    var sh = byId(SHAPES, w.shape);
    if (!sh) return "pick a shape";
    if (!byId(DESTS, w.dest)) return "pick a destination";
    if (sh.dest.indexOf(w.dest) < 0) return SHAPE_DEST_WHY[sh.id];
    if (w.shape === "len" && r.val === null && r.trig && r.trig.id === "hand") return "loop length from a pad press has nothing to set it to: add a level";
    return null;
  }

  function allWirings() {
    var out = [], i, j;
    var sets = [];
    for (i = 0; i < SOURCES.length; i++) {
      sets.push([SOURCES[i].id]);
      for (j = i + 1; j < SOURCES.length; j++) sets.push([SOURCES[i].id, SOURCES[j].id]);
    }
    sets.forEach(function (src) {
      TIMES.forEach(function (tm) {
        SHAPES.forEach(function (sh) {
          sh.dest.forEach(function (d) {
            var w = { src: src, time: tm.id, shape: sh.id, dest: d };
            if (!why(w)) out.push(w);
          });
        });
      });
    });
    return out;
  }
  function key(w) { return w.src.slice().sort().join("+") + "|" + w.time + "|" + w.shape + "|" + w.dest; }

  // where a wiring meets something already written up in POSSIBILITIES.md
  var WRITTEN = [
    { n: 1, name: "plant through stations", st: "planned", test: function (w, h) { return h.pulse && (w.time === "bend") && (h.touch || h.place || h.level || h.agit || h.drift) && w.dest === "notes"; } },
    { n: 2, name: "density field, body-fired events", st: "idea", test: function (w, h) { return w.time === "density" && (h.motion || h.distance || h.level || h.agit) && w.dest === "notes"; } },
    { n: 3, name: "arm contact as a section gate", st: "idea", test: function (w, h) { return w.time === "gate" && h.touch; } },
    { n: 4, name: "plant drift clock", st: "idea", test: function (w, h) { return w.time === "stretch" && h.pulse; } },
    { n: 5, name: "pose-regression steering", st: "planned", test: function (w, h) { return h.wval && (w.dest === "notes" || w.dest === "projection"); } },
    { n: 6, name: "loop as instrument", st: "planned", test: function (w, h) { return w.dest === "loop" && (h.distance || h.hand || h.motion); } },
    { n: 7, name: "DJ-set-reactive stage", st: "idea", test: function (w, h) { return h.energy; } },
    { n: 8, name: "projection score", st: "planned", test: function (w, h) { return w.dest === "projection"; } },
    { n: 9, name: "ratchet ornaments", st: "idea", test: function (w, h) { return w.time === "ornament" && h.pulse; } },
    { n: 10, name: "Wekinator class as section preset", st: "planned", test: function (w, h) { return h.wcls; } }
  ];
  function written(w) {
    var h = {};
    w.src.forEach(function (s) { h[s] = true; });
    return WRITTEN.filter(function (c) { return c.test(w, h); });
  }

  // ------------------------------------------------------------------ the engine
  var PHRASE = [1, 0.5, 0.5, 1, 1.5, 0.5, 1, 2];
  function Engine(w, world, seed) {
    this.w = w; this.world = world; this.R = roles(w); this.r = rng(seed || 3);
    this.raw = []; this.played = []; this.msgs = []; this.pending = [];
    this.notesT = []; this.cap = 12; this.capWin = 30;
    // plant signal
    this.cc = {}; this.level = null; this.tl = null; this.agit = 0; this.ta = null;
    this.nl = new Norm(20); this.na = new Norm(20); this.nf = new Norm(20); this.nd = new Norm(60);
    this.levelN = 0.5; this.agitN = 0; this.fastN = 0.5; this.driftN = 0.5;
    this.wh = [];
    // room state
    this.contact = false; this.st = 0; this.close = 0.35; this.motion = 0; this.wcls = 0; this.wval = 0.5; this.energy = 0.4;
    this.lastPad = -1e9; this.paused = false;
    // loop (gateway Sequencer defaults)
    this.loop = { feedback: 0.5, base: 0.5, send: 0.8, time: 30, ovr: null, until: 0 };
    this.target = null; this.ph = { k: 0, last: -1e9 };
    this.counts = { in: 0, played: 0, capped: 0, thinned: 0, gated: 0 };
  }
  Engine.prototype.value = function (id, t) {
    switch (id) {
      case "level": return this.levelN;
      case "agit": return this.agitN;
      case "drift": return this.driftN;
      case "place": return this.st / 5;
      case "distance": return this.close;
      case "motion": return this.motion;
      case "wval": return this.wval;
      case "energy": return this.energy;
      case "wcls": return this.wcls / 3;
      case "touch": return this.contact ? 1 : 0;
      case "hand": return Math.exp(-(t - this.lastPad) / 2);
      case "pulse": return this.levelN;
    }
    return 0.5;
  };
  Engine.prototype.v = function (t) { return this.R.val ? this.value(this.R.val.id, t) : this.levelN; };
  Engine.prototype._held = function () {
    var h = this.R.held;
    if (!h) return true;
    if (h.id === "touch") return this.contact;
    if (h.id === "distance") return this.close > 0.5;
    if (h.id === "wcls") return this.wcls >= 2;
    return true;
  };
  Engine.prototype._rank = function (w) {
    var h = this.wh, r;
    if (h.length < 8) r = clamp(w, 0, 1);
    else {
      var below = 0, same = 0;
      for (var i = 0; i < h.length; i++) { if (h[i] < w) below++; else if (h[i] === w) same++; }
      r = (below + 0.5 * same) / h.length;
    }
    h.push(w); if (h.length > 48) h.shift();
    return r;
  };
  Engine.prototype._plantCC = function (t, cc, v) {
    if (cc <= 2) {
      this.cc[cc] = v;
      var s = 0, n = 0;
      for (var k = 0; k <= 2; k++) if (this.cc[k] !== undefined) { s += this.cc[k]; n++; }
      var x = s / n;
      if (this.level === null) { this.level = x; this.tl = t; }
      this.level += (x - this.level) * (1 - Math.exp(-Math.max(0, t - this.tl) / 1.5)); this.tl = t;
      this.levelN = this.nl.at(t, this.level);
    } else if (cc === 3) {
      var prev = this.cc[3]; this.cc[3] = v;
      this.fastN = this.nf.at(t, v);
      if (prev !== undefined) { this._decay(t); this.agit += Math.abs(v - prev); this.agitN = this.na.at(t, this.agit); }
    } else if (cc === 4) this.driftN = this.nd.at(t, v);
  };
  Engine.prototype._decay = function (t) {
    if (this.ta !== null) this.agit *= Math.exp(-Math.max(0, t - this.ta) / 0.5);
    this.ta = t;
  };
  Engine.prototype._out = function (t, tr, idx, vel) {
    this.pending.push({ t: t, tr: tr, idx: idx, vel: vel });
  };
  // a trigger event arrives at t
  Engine.prototype._trigger = function (t, idx, vel) {
    var w = this.w, i;
    this.counts.in++;
    this.raw.push([t, idx, vel]);
    if (w.time === "tick") { this._out(t, t, idx, vel); return; }
    if (w.time === "gate") {
      if (!this._held()) { this.counts.gated++; return; }
      this._out(t, t, idx, vel); return;
    }
    if (w.time === "bend") {
      if (this.R.trig && this.R.trig.id === "pulse") {
        this._decay(t);
        var p = 0.35 + 0.65 * this.agitN;
        if (this.r() >= p) { this.counts.thinned++; return; }
      }
      var src = this.R.val ? this.value(this.R.val.id, t) : 0.25 / 0.4 * this.levelN + 0.15 / 0.4 * this.agitN;
      var wv = 0.4 * src + 0.6 * this.fastN;
      this._out(t + 0.4 * this._rank(wv), t, idx, vel); return;
    }
    if (w.time === "density") {
      if (this.r() < this.v(t)) this._out(t, t, idx, vel);
      return;
    }
    if (w.time === "stretch") {
      var beat = 0.25 + 0.65 * (this.R.val ? this.value(this.R.val.id, t) : this.driftN);
      var step = PHRASE[this.ph.k % PHRASE.length];
      // the step lands on the stretched playhead's next boundary, not on the trigger
      var len = step * beat, last = this.ph.last > -1e8 ? this.ph.last : t;
      var at = last + Math.max(1, Math.ceil((t - last) / len)) * len;
      this.ph.last = at; this.ph.k++;
      this._out(at, t, this.ph.k % 6, vel); return;
    }
    if (w.time === "ornament") {
      this._out(t, t, idx, vel);
      var n = 1 + Math.floor(this.r() * 3);
      for (i = 0; i < n; i++) this._out(t + 0.015 + 0.03 * this.r() + i * 0.04, t, idx + i + 1, Math.max(20, vel - 20 * (i + 1)));
    }
  };
  // the free clock for density with no event source
  Engine.prototype._clk = function (t, dt) {
    if (this.w.time === "density" && !this.R.trig) {
      var rate = 0.3 + 2.7 * this.v(t);
      if (this.r() < rate * dt) { var tt = t - this.r() * dt; this.raw.push([tt, 0, 80]); this._out(tt, tt, Math.floor(this.r() * 6), 80); }
    }
    // loop slew, 0.5 per s, with duck / clear / panic overrides
    var L = this.loop;
    if (L.ovr && t >= L.until) L.ovr = null;
    var want = L.ovr ? L.ovr.v : L.base, step = 0.5 * dt;
    L.feedback = clamp(L.feedback + clamp(want - L.feedback, -step, step), 0, 0.98);
  };
  Engine.prototype._shape = function (o) {
    var w = this.w, t = o.t, v = this.v(t), st = this.world.station(this.st) || { pitch_set: [60], channel: 2, limn_area: "st0", hex: "#ffffff" };
    var set = st.pitch_set || [60];
    var oct = this.driftN < 1 / 3 ? -1 : this.driftN > 2 / 3 ? 1 : 0;
    var note = clamp(set[((o.idx % set.length) + set.length) % set.length] + 12 * oct, 0, 127);
    var vel = Math.round(40 + 78 * (w.shape === "loud" ? v : this.agitN));
    var dur = +(w.shape === "phrase" ? 0.2 + 0.7 * v : 0.2 + 0.7 * this.levelN).toFixed(2);
    var m = { t: t, dest: w.dest, st: this.st, note: note, vel: vel, dur: dur, v: v };
    if (w.dest === "notes") {
      while (this.notesT.length && this.notesT[0] <= t - this.capWin) this.notesT.shift();
      if (this.notesT.length >= this.cap) { this.counts.capped++; return null; }
      this.notesT.push(t);
      m.ch = st.channel;
    } else if (w.dest === "loop") {
      var L = this.loop;
      if (w.shape === "fb") { L.base = clamp(0.2 + 0.78 * v, 0, 0.98); m.cc = 30; m.val = Math.round(L.base * 127); }
      else if (w.shape === "send") { L.send = v; m.cc = 31; m.val = Math.round(v * 127); }
      else { L.time = Math.round((5 + 55 * v) * 2) / 2; m.cc = 33; m.val = Math.round((L.time - 5) / 55 * 127); }
    } else if (w.dest === "projection") {
      m.area = st.limn_area; m.hex = st.hex; m.level = +(w.shape === "light" ? v : 1).toFixed(2);
      m.hold = w.shape === "phrase" ? dur * 4 : 1.5;
    } else if (w.dest === "macros") {
      m.macro = 1 + (this.st % 8); m.val = +v.toFixed(2);
    }
    return m;
  };
  Engine.prototype._flush = function (t) {
    if (!this.pending.length) return;
    this.pending.sort(function (a, b) { return a.t - b.t; });
    while (this.pending.length && this.pending[0].t <= t) {
      var o = this.pending.shift();
      if (this.paused || this.dead) continue;
      var m = this._shape(o);
      if (!m) continue;
      this.counts.played++;
      this.played.push([o.t, m.note, m.vel, m.dur, o.tr]);
      this.msgs.push(m);
    }
  };
  Engine.prototype.feed = function (evs) {
    var w = this.w, trig = this.R.trig ? this.R.trig.id : null;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], t = e.t;
      this._flush(t);
      switch (e.k) {
        case "note": if (trig === "pulse") this._trigger(t, e.pitch, e.vel); break;
        case "cc": this._plantCC(t, e.cc, e.v); break;
        case "touch": this.contact = true; this.st = e.st;
          if (trig === "touch") this._trigger(t, e.st, 90);
          if (w.dest === "loop" || w.dest === "notes") { /* station send on contact, as the mapper */ if (w.shape !== "send") { var s0 = this.world.station(e.st); if (s0) this.loop.send = s0.send; } }
          break;
        case "lift": this.contact = false; break;
        case "place": this.st = e.st; break;
        case "body": this.close = e.close; this.motion = e.motion;
          if (w.dest === "loop" && w.shape === "fb" && this.R.val && this.R.val.id === "distance") this.loop.base = 0.2 + 0.8 * e.close;
          break;
        case "move": if (trig === "motion") this._trigger(t, Math.floor(e.v * 12), Math.round(50 + 70 * e.v)); break;
        case "wcls": this.wcls = e.cls; if (trig === "wcls" && e.cls) this._trigger(t, e.cls * 2, 100); break;
        case "wval": this.wval = e.v; break;
        case "energy": this.energy = e.v; break;
        case "pad":
          this.lastPad = t;
          var L = this.loop;
          if (e.kind === "duck") { L.ovr = { v: L.feedback * 0.85 }; L.until = t + 2; L.feedback = L.ovr.v; }
          if (e.kind === "clear") { L.ovr = { v: 0 }; L.until = t + 1.5; L.feedback = 0; this.msgs.push({ t: t, dest: "loop", cc: 32, val: 127, clear: true }); }
          if (e.kind === "panic") { L.ovr = { v: 0 }; L.until = Infinity; L.feedback = 0; this.paused = true; this.pending = []; }
          if (e.kind === "resume") { this.paused = false; L.ovr = null; }
          if (trig === "hand" && e.kind !== "resume") this._trigger(t, { duck: 0, clear: 2, panic: 4 }[e.kind] || 0, 100);
          break;
        case "clk": this._clk(t, 0.05); break;
      }
    }
    this._trim(evs.length ? evs[evs.length - 1].t : 0);
  };
  Engine.prototype._trim = function (t) {
    var keep = this.keep || 40;
    function cut(a) { var i = 0; while (i < a.length && a[i][0] < t - keep) i++; if (i) a.splice(0, i); }
    cut(this.raw); cut(this.played);
    var i = 0; while (i < this.msgs.length && this.msgs[i].t < t - keep) i++;
    if (i) this.msgs.splice(0, i);
  };

  // ------------------------------------------------------------------ the tick check
  function rayleighMax(ts, periods) {
    var best = 0;
    for (var p = 0; p < periods.length; p++) {
      var P = periods[p], sx = 0, sy = 0;
      for (var i = 0; i < ts.length; i++) { var a = 2 * Math.PI * ts[i] / P; sx += Math.cos(a); sy += Math.sin(a); }
      var R = Math.hypot(sx, sy) / ts.length;
      if (R > best) best = R;
    }
    return best;
  }
  function periods(step) {
    var out = [];
    for (var P = TICK - 0.0015; P <= TICK + 0.0015 + 1e-12; P += step) out.push(P);
    return out;
  }
  var P_FULL = periods(0.00002), P_LIVE = periods(0.0001);
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); var n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; }
  function pct(a, q) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(q * (b.length - 1) + 0.5))]; }
  // onset_report.comb_stat: median over 30 s windows (step 15 s) of the best R near the tick
  function combStat(ts, per) {
    per = per || P_FULL;
    if (ts.length < 6) return NaN;
    var t0 = ts[0], t = ts.map(function (x) { return x - t0; }), vals = [], a = 0, end = Math.max(0, t[t.length - 1] - 15);
    for (; a <= end; a += 15) {
      var w = t.filter(function (x) { return x >= a && x < a + 30; });
      if (w.length >= 6) { var w0 = w[0]; vals.push(rayleighMax(w.map(function (x) { return x - w0; }), per)); }
    }
    return vals.length ? median(vals) : NaN;
  }
  function combTest(ts, nNull, seed, per) {
    var r = rng(seed || 1), real = combStat(ts, per), nulls = [];
    if (!isFinite(real)) return { R: NaN, verdict: "too few" };
    for (var k = 0; k < (nNull || 100); k++) {
      var j = ts.map(function (x) { return x + (r() - 0.5) * TICK; }).sort(function (a, b) { return a - b; });
      nulls.push(combStat(j, per));
    }
    var p99 = pct(nulls, 0.99), p50 = median(nulls);
    return { R: real, p50: p50, p99: p99, stuck: real > p99, verdict: real > p99 ? "stuck to the tick" : "free of the tick" };
  }
  // the live meter: one window (the last 30 s), coarser periods, fewer nulls
  function tickMatch(ts, r) {
    if (ts.length < 6) return null;
    var t0 = ts[0], t = ts.map(function (x) { return x - t0; });
    var R = rayleighMax(t, P_LIVE), nulls = [];
    r = r || Math.random;
    for (var k = 0; k < 40; k++) nulls.push(rayleighMax(t.map(function (x) { return x + (r() - 0.5) * TICK; }), P_LIVE));
    var p99 = pct(nulls, 0.99), p50 = median(nulls);
    return { R: R, p50: p50, p99: p99, n: ts.length, stuck: R > p99 };
  }

  var SIM = {
    TICK: TICK, rng: rng, World: World, Engine: Engine, Plant: Plant,
    SOURCES: SOURCES, TIMES: TIMES, SHAPES: SHAPES, DESTS: DESTS, byId: byId,
    roles: roles, why: why, allWirings: allWirings, key: key, written: written, WRITTEN: WRITTEN,
    combStat: combStat, combTest: combTest, tickMatch: tickMatch
  };
  if (typeof module !== "undefined" && module.exports) module.exports = SIM;
  else root.SIM = SIM;
})(typeof window !== "undefined" ? window : globalThis);
