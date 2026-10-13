// app.js: wires the blocks UI, the sim, the scene, the lanes, the sound, the rig read-out and
// the shortlist together. Plain script, works from file://.
(function () {
  "use strict";
  var SIM = window.SIM, $ = function (id) { return document.getElementById(id); };
  var LA = 0.12;                                   // run the sim this far ahead, for exact audio timing
  var world = new SIM.World({ plant: "recorded" });
  var wiring = { src: ["pulse", "touch"], time: "bend", shape: "pitch", dest: "notes" };
  var engine = null, old = null, xfade = { t0: -99, dur: 1.5 };
  var simT = 0, lastMs = 0, audioOn = false, hold = 1, holdTarget = 1, meter = null, rawMeter = null;
  var visq = [], lit = {}, shake = 0, sliderMotion = 0;
  var all = SIM.allWirings(), walkOrder = null, walkIdx = -1, walking = false, nextWalk = 0;
  var store = load();

  // ---------------------------------------------------------------- engine swap
  function setWiring(w, why) {
    wiring = { src: w.src.slice(0, 2), time: w.time, shape: w.shape, dest: w.dest };
    var reason = SIM.why(wiring);
    old = engine ? { played: engine.played.slice(), raw: engine.raw.slice() } : null;
    engine = new SIM.Engine(wiring, world, 3);
    engine.dead = !!reason;
    engine.feed(world.log);                       // warm it on the last 40 s, so the lanes are full
    engine.raw.forEach(function (r) { if (r[0] <= simT) r.done = true; });
    engine.msgs.forEach(function (m) { if (m.t <= simT) m.done = true; });
    world.ctl.steer = wiring.src.indexOf("wval") >= 0 ? "pose" : "walk";
    var dur = window.Scene.setWiring(wiring, !reason, state());
    xfade = { t0: simT, dur: Math.max(1.2, dur) };
    meter = null; measure();
    renderRail(reason);
    renderShortlist();
    if (why !== "walk") { walking = false; renderWalk(); }
  }

  // ---------------------------------------------------------------- the rail
  function chip(parent, cls, label, tag, on, title, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip " + cls + (on ? " on" : "");
    b.textContent = label; b.title = title || "";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    if (tag) { var s = document.createElement("span"); s.className = "tag"; s.textContent = tag; b.appendChild(s); }
    b.addEventListener("click", fn);
    parent.appendChild(b);
  }
  function renderRail(reason) {
    var el = $("chips-src"); el.textContent = "";
    SIM.SOURCES.forEach(function (s) {
      var on = wiring.src.indexOf(s.id) >= 0;
      var tag = s.m === "predicted, untested" ? "untested" : s.m === "no input" ? "slider" : "";
      chip(el, "src", s.name, tag, on, s.what + " (" + s.hw + ", " + s.m + ")", function () {
        var src = wiring.src.slice(), i = src.indexOf(s.id);
        if (i >= 0) { if (src.length > 1) src.splice(i, 1); }
        else { src.push(s.id); if (src.length > 2) src.shift(); }
        setWiring({ src: src, time: wiring.time, shape: wiring.shape, dest: wiring.dest });
      });
    });
    [["chips-time", SIM.TIMES, "time"], ["chips-shape", SIM.SHAPES, "shape"], ["chips-dest", SIM.DESTS, "dest"]].forEach(function (r) {
      var box = $(r[0]); box.textContent = "";
      r[1].forEach(function (b) {
        var w2 = Object.assign({}, wiring); w2[r[2]] = b.id;
        var ok = !SIM.why(w2);
        chip(box, (ok ? "" : "dim"), b.name, b.st === "sketch" ? "sketch" : "", wiring[r[2]] === b.id,
          (b.what || "") + (ok ? "" : " (with these sources: " + SIM.why(w2) + ")"), function () {
            var w3 = Object.assign({}, wiring); w3[r[2]] = b.id; setWiring(w3);
          });
      });
    });
    var v = $("verdict");
    v.className = "verdict " + (reason ? "bad" : "good");
    if (reason) v.textContent = "Can't work: " + reason + ".";
    else {
      v.innerHTML = "";
      var b = document.createElement("b"); b.textContent = "This can work. "; v.appendChild(b);
      v.appendChild(document.createTextNode(describe(wiring)));
    }
    renderNeeds(reason);
    var wr = SIM.written(wiring), wp = $("written");
    wp.textContent = "";
    if (!reason && wr.length) {
      wp.appendChild(document.createTextNode("Close to an idea already on the list: "));
      wr.forEach(function (c, i) {
        var a = document.createElement("strong");
        a.textContent = "'" + c.name + "' (" + c.n + ", " + c.st + ")";
        if (i) wp.appendChild(document.createTextNode(", "));
        wp.appendChild(a);
      });
      wp.appendChild(document.createTextNode("."));
    }
  }
  function describe(w) {
    var names = w.src.map(function (id) { return SIM.byId(SIM.SOURCES, id).name; });
    var R = SIM.roles(w), t = SIM.byId(SIM.TIMES, w.time), sh = SIM.byId(SIM.SHAPES, w.shape), d = SIM.byId(SIM.DESTS, w.dest);
    var s = (R.trig ? R.trig.name : "a free clock") + " fires, " + t.name;
    if (R.held) s += " while " + R.held.name + " is held";
    s += "; " + (R.val ? R.val.name : "the plant level") + " sets the " + sh.name + "; out to " + d.name + ".";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function renderNeeds(reason) {
    var n = $("needs"); n.textContent = "";
    var h = document.createElement("h3"); h.textContent = "What it needs"; n.appendChild(h);
    var dl = document.createElement("dl");
    function row(k, v, cls) {
      var dt = document.createElement("dt"); dt.textContent = k;
      var dd = document.createElement("dd"); dd.textContent = v; if (cls) dd.className = cls;
      dl.appendChild(dt); dl.appendChild(dd);
    }
    var hw = [], seen = {};
    wiring.src.forEach(function (id) { var s = SIM.byId(SIM.SOURCES, id); if (!seen[s.hw]) { seen[s.hw] = 1; hw.push(s.hw); } });
    var d = SIM.byId(SIM.DESTS, wiring.dest); if (d && !seen[d.hw]) hw.push(d.hw);
    row("hardware", hw.join("; "));
    wiring.src.forEach(function (id) {
      var s = SIM.byId(SIM.SOURCES, id);
      row(s.name, s.m, s.m === "measured" ? "ok" : s.m.indexOf("untested") >= 0 || s.m === "no input" ? "warn" : "");
    });
    var t = SIM.byId(SIM.TIMES, wiring.time), sh = SIM.byId(SIM.SHAPES, wiring.shape);
    row("time", t.name + ": " + t.st, t.st === "sketch" ? "warn" : "");
    row("shape", sh.name + ": " + sh.st, sh.st === "sketch" ? "warn" : "");
    if (d) row("out", d.what + " (" + d.st + ")", d.st === "sketch" ? "warn" : "");
    var risks = [];
    if (wiring.src.indexOf("touch") >= 0) risks.push("arm contact is predicted from the Scion manual and untested; here it is simulated");
    if (wiring.src.indexOf("energy") >= 0) risks.push("no DJ input module exists; the slider stands in");
    if (wiring.time === "tick" || wiring.time === "gate" || wiring.time === "ornament") risks.push("timing stays on the plant's 127.9 ms grid");
    if (wiring.dest === "notes") risks.push("notes are capped at 12 per 30 s");
    if (risks.length) row("watch", risks.join("; "), "warn");
    n.appendChild(dl);
  }
  function renderWalk() {
    $("walk").classList.toggle("on", walking);
    $("walk").textContent = walking ? "Stop walking" : "Walk the space";
    $("walkpos").textContent = walkIdx >= 0 ? "(walk: " + (walkIdx + 1) + " of " + all.length + ")" : "";
  }
  function walkStep() {
    if (!walkOrder) {
      var r = SIM.rng(1); walkOrder = all.map(function (_, i) { return i; });
      for (var i = walkOrder.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = walkOrder[i]; walkOrder[i] = walkOrder[j]; walkOrder[j] = x; }
    }
    walkIdx = (walkIdx + 1) % all.length;
    setWiring(all[walkOrder[walkIdx]], "walk");
    renderWalk();
  }

  // ---------------------------------------------------------------- the frame loop
  function state() { return { t: simT, world: world, engine: engine, hold: hold, lit: lit }; }
  function measure() {
    if (!engine) return;
    var pl = [], rw = [], i;
    for (i = 0; i < engine.played.length; i++) if (engine.played[i][0] <= simT && engine.played[i][0] > simT - 30) pl.push(engine.played[i][0]);
    for (i = 0; i < engine.raw.length; i++) if (engine.raw[i][0] <= simT && engine.raw[i][0] > simT - 30) rw.push(engine.raw[i][0]);
    pl.sort(function (a, b) { return a - b; });
    meter = SIM.tickMatch(pl); rawMeter = SIM.tickMatch(rw);
    if (meter) holdTarget = Math.max(0, Math.min(1, (meter.R - meter.p99) / Math.max(0.05, 0.9 - meter.p99)));
    else holdTarget = 0.5;
    renderMeter();
  }
  function step(ms) {
    var dt = lastMs ? Math.min(0.1, (ms - lastMs) / 1000) : 0.016;
    lastMs = ms;
    simT += dt;
    shake *= Math.exp(-dt * 1.5);
    world.ctl.motion = Math.max(sliderMotion, shake);
    var evs = world.advance(simT + LA);
    engine.feed(evs);
    evs.forEach(function (e) { if (e.k === "note") visq.push({ t: e.t, k: "plant" }); });
    schedule();
    // visuals due now
    var keep = [];
    visq.forEach(function (v) {
      if (v.t > simT) { keep.push(v); return; }
      if (v.k === "plant") window.Scene.flash("plant", simT);
      else if (v.k === "src") window.Scene.packet("src", simT, 0.3);
      else if (v.k === "out") {
        window.Scene.packet("dest", simT, 0.3);
        window.Scene.flash("dest_" + v.m.dest, simT + 0.3);
        if (v.m.dest === "projection") lit[v.m.st] = { t: simT, hold: v.m.hold || 1.5 };
        window.Scene.ripple(simT, v.m.dest === "notes" ? [34, 230, 255] : v.m.dest === "loop" ? [255, 178, 56] : [57, 255, 159]);
      }
    });
    visq = keep;
    hold += (holdTarget - hold) * Math.min(1, dt * 1.2);
    if (Math.floor(simT) !== Math.floor(simT - dt)) measure();
    if (walking && simT >= nextWalk) { walkStep(); nextWalk = simT + 4.5; }
    window.Scene.draw(state());
    drawLanes();
    if (Math.floor(simT * 5) !== Math.floor((simT - dt) * 5)) { renderLoop(); renderMsgs(); }
    requestAnimationFrame(step);
  }
  function schedule() {
    var ctx = audioOn && window.Sound.ctx, now = ctx ? ctx.currentTime : 0;
    var hearRaw = $("hear-raw").checked, trig = engine.R.trig ? engine.R.trig.id : null;
    engine.raw.forEach(function (r) {
      if (r.done) return;
      r.done = true;
      visq.push({ t: r[0], k: "src" });
      if (!ctx) return;
      var when = now + Math.max(0, r[0] - simT) + 0.02;
      if (trig === "pulse" && (hearRaw || wiring.dest === "loop")) window.Sound.pluck(when, r[1], r[2], 0.3, wiring.dest !== "loop");
    });
    engine.msgs.forEach(function (m) {
      if (m.done) return;
      m.done = true;
      if (m.clear) { if (ctx) window.Sound.clearEcho(); return; }
      visq.push({ t: m.t, k: "out", m: m });
      if (!ctx) return;
      var when = now + Math.max(0, m.t - simT) + 0.02;
      if (m.dest === "notes") window.Sound.pluck(when, m.note, m.vel, m.dur, false);
      else if (m.dest === "projection") window.Sound.chime(when, m.note, m.level);
      else if (m.dest === "macros") window.Sound.thump(when, m.val);
    });
    if (ctx) window.Sound.setLoop(engine.loop.feedback, engine.loop.send, engine.loop.time, audioOn);
  }

  // ---------------------------------------------------------------- lanes and meters
  function prepCanvas(cv) {
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, w: r.width, h: r.height };
  }
  function gridPhase(a, b) {                       // replay.js gridPhase on the raw plant notes
    var sx = 0, sy = 0, k = 0;
    world.log.forEach(function (e) {
      if (e.k !== "note" || e.t < a || e.t > b) return;
      var ph = (e.t / SIM.TICK) % 1 * Math.PI * 2; sx += Math.cos(ph); sy += Math.sin(ph); k++;
    });
    if (!k) return null;
    var m = Math.atan2(sy, sx) / (Math.PI * 2);
    return (m < 0 ? m + 1 : m) * SIM.TICK;
  }
  function drawLane(cv, rows, oldRows, col, phase, a, b, k) {
    var c = prepCanvas(cv), g = c.g, W = c.w, H = c.h, sx = W / (b - a), top = 4, bot = H - 4;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#10032a"; g.fillRect(0, 0, W, H);
    if (phase !== null && SIM.TICK * sx >= 2.5) {
      g.strokeStyle = "rgba(255,43,214,0.22)"; g.lineWidth = 1; g.beginPath();
      for (var j = Math.ceil((a - phase) / SIM.TICK); j <= Math.floor((b - phase) / SIM.TICK); j++) {
        var x = Math.round((phase + j * SIM.TICK - a) * sx) + 0.5; g.moveTo(x, top); g.lineTo(x, bot);
      }
      g.stroke();
    }
    function marks(rs, alpha) {
      if (!rs || alpha <= 0.01) return;
      g.globalAlpha = alpha; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
      rs.forEach(function (r) {
        if (r[0] < a || r[0] > b) return;
        var x = (r[0] - a) * sx, hh = (bot - top - 6) * (0.4 + 0.6 * Math.min(1, (r[2] || 80) / 127));
        g.beginPath(); g.moveTo(x, bot); g.lineTo(x, bot - hh); g.stroke();
        g.fillRect(x - 2, bot - hh - 2, 4, 4);
        if (r[4] !== undefined && r[4] < r[0] - 0.002) {  // a played event: show how far it moved
          g.globalAlpha = alpha * 0.4; g.fillRect((r[4] - a) * sx, bot - 2, (r[0] - r[4]) * sx, 2); g.globalAlpha = alpha;
        }
      });
      g.globalAlpha = 1;
    }
    marks(oldRows, 1 - k); marks(rows, k);
    g.fillStyle = "#a38cc8"; g.font = "11px ui-monospace, Menlo, monospace";
    g.fillText(cv.id === "lane-raw" ? "raw source" : "played", 6, 14);
  }
  function drawLanes() {
    var span = window.innerWidth < 760 ? 8 : 14, a = simT - span, b = simT, ph = gridPhase(a, b);
    var k = Math.min(1, Math.max(0, (simT - xfade.t0) / xfade.dur));
    drawLane($("lane-raw"), engine.raw, old && old.raw, "#ffb238", ph, a, b, k);
    drawLane($("lane-played"), engine.played, old && old.played, "#22e6ff", ph, a, b, k);
  }
  function renderMeter() {
    function set(barId, p99Id, txtId, m) {
      $(barId).style.width = m ? Math.round(m.R * 100) + "%" : "0";
      $(p99Id).style.left = m ? Math.round(m.p99 * 100) + "%" : "0";
      $(txtId).textContent = m ? m.R.toFixed(2) : "--";
    }
    set("m-played", "m-p99", "m-pv", meter);
    set("m-raw", "m-rp99", "m-rv", rawMeter);
    var v = $("m-verdict"); v.textContent = "";
    var s = document.createElement("span");
    if (!meter) { s.textContent = "Too few played events in the last 30 s to tell."; }
    else {
      s.className = meter.stuck ? "stuck" : "free";
      s.textContent = meter.stuck ? "Played: stuck to the grid (R " + meter.R.toFixed(2) + ", chance p99 " + meter.p99.toFixed(2) + ")."
        : "Played: free of the grid (R " + meter.R.toFixed(2) + ", chance p99 " + meter.p99.toFixed(2) + ").";
    }
    v.appendChild(s);
  }
  function renderLoop() {
    var L = engine.loop;
    $("l-fb").style.width = Math.round(L.feedback * 100) + "%"; $("l-fbv").textContent = L.feedback.toFixed(2);
    $("l-send").style.width = Math.round(L.send * 100) + "%"; $("l-sendv").textContent = L.send.toFixed(2);
    $("l-time").style.width = Math.round(L.time / 60 * 100) + "%"; $("l-timev").textContent = L.time.toFixed(1) + " s";
  }

  // ---------------------------------------------------------------- rig read-out
  var SETS = ((window.RIGDATA || {}).sets || []).slice().sort(function (a, b) { return a.mtime < b.mtime ? 1 : -1; });
  var TOES = ((window.RIGDATA || {}).toes || []).filter(function (t) { return t.ops && t.ops.length; });
  function base(p) { return p.split("/").pop(); }
  function fmt(m) {
    var st = world.station(m.st), sn = st ? st.name : "?";
    if (m.dest === "notes") return "IAC ch " + m.ch + "  note " + m.note + "  vel " + m.vel + "  dur " + m.dur.toFixed(2) + " s  (station " + m.st + " " + sn + ")";
    if (m.dest === "loop") return m.clear ? "IAC ch 16  CC32 = 127  loop clear" : "IAC ch 16  CC" + m.cc + " = " + m.val + "  " + ({ 30: "loop feedback", 31: "loop send", 33: "loop time" })[m.cc];
    if (m.dest === "projection") return "Limn :8779 /area " + m.area + " colour " + (st ? st.hex : "") + " at " + m.level.toFixed(2) + "  +  TD :10000 /seq/step " + m.st;
    if (m.dest === "macros") return "TD to TDAbleton: rack macro " + m.macro + " = " + m.val.toFixed(2);
    return "";
  }
  function renderMsgs() {
    var ol = $("msgs"), ms = engine.msgs.filter(function (m) { return m.t <= simT; }).slice(-6).reverse();
    ol.textContent = "";
    if (!ms.length) {
      var li0 = document.createElement("li"); li0.textContent = engine.dead ? "Nothing: this wiring can't work." : engine.paused ? "Nothing: panic is on. Press resume." : "Waiting for the first event.";
      ol.appendChild(li0);
    }
    ms.forEach(function (m) { var li = document.createElement("li"); li.textContent = (simT - m.t).toFixed(1) + " s ago  " + fmt(m); ol.appendChild(li); });
    renderLands(ms[0]);
  }
  function renderLands(m) {
    var ul = $("lands"), set = SETS[+$("set").value] || null, toe = TOES[+$("toe").value] || null;
    ul.textContent = "";
    function li(t) { var x = document.createElement("li"); x.textContent = t; ul.appendChild(x); }
    var d = wiring.dest;
    if (d === "notes") {
      var ch = m && m.ch ? m.ch : (world.station(world.arm.st || 0) || { channel: 2 }).channel;
      if (!set) { li("No Ableton sets in the rig map."); return; }
      var iac = [], allIns = [];
      set.tracks.forEach(function (t) {
        if (t.k !== "Midi") return;
        if (/IAC Driver/.test(t.in) && (/all ch/.test(t.in) || new RegExp("ch " + ch + "$").test(t.in))) iac.push(t.n);
        else if (t.in === "All") allIns.push(t.n);
      });
      li("IAC ch " + ch + " in " + base(set.path) + ": " + (iac.length ? "listened to by " + iac.join(", ") : "no track listens to IAC by name"));
      if (allIns.length) li("plus " + allIns.length + " MIDI tracks on All Ins, which hear it too: " + allIns.slice(0, 4).join(", ") + (allIns.length > 4 ? " and " + (allIns.length - 4) + " more" : ""));
    } else if (d === "loop") {
      if (!set) { li("No Ableton sets in the rig map."); return; }
      var maps = (set.maps || []).filter(function (x) { return x[0] === 16 && x[2] >= 30 && x[2] <= 33; });
      if (maps.length) maps.forEach(function (x) { li("ch 16 CC" + x[2] + " lands on " + x[3] + " / " + x[4]); });
      else li("Nothing in " + base(set.path) + " is MIDI-mapped to ch 16 CC30-33 yet. Map them to the loop's feedback, send, clear and time.");
    } else if (d === "projection") {
      var st = m ? world.station(m.st) : null;
      li("Limn area " + (st ? st.limn_area : "st0-st5") + " (stations_plantarm.json), colour " + (st ? st.hex : "per station") + ", over HTTP :8779");
      li("TouchDesigner oscin_desk on :10000 gets /seq/step, /seq/note and /seq/loop for anything richer");
    } else if (d === "macros") {
      if (!toe) { li("No TD files with TDAbleton racks in the rig map."); return; }
      var n = m && m.macro ? m.macro : 1, op = toe.ops[(n - 1) % toe.ops.length];
      li(base(toe.path) + ": " + op.op + " drives " + op.track + " (" + op.device + ")");
      (op.binds || []).slice(0, 3).forEach(function (b) { li(b[0] + " is bound to " + b[1]); });
    }
  }
  function fillSelects() {
    var s = $("set"), pick = 0;
    SETS.forEach(function (x, i) {
      var o = document.createElement("option"); o.value = i; o.textContent = base(x.path) + " (" + x.mtime + ")"; s.appendChild(o);
      if (!pick && x.tracks.some(function (t) { return /IAC|Scion/.test(t.in); })) pick = i;
    });
    s.value = pick;
    var tsel = $("toe");
    TOES.forEach(function (x, i) { var o = document.createElement("option"); o.value = i; o.textContent = base(x.path); tsel.appendChild(o); });
    s.addEventListener("change", renderMsgs); tsel.addEventListener("change", renderMsgs);
  }

  // ---------------------------------------------------------------- shortlist (this browser only)
  function load() { try { return JSON.parse(localStorage.getItem("possim.v1")) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem("possim.v1", JSON.stringify(store)); } catch (e) { /* private window: keep it in memory */ } }
  function renderShortlist() {
    var k = SIM.key(wiring), it = store[k];
    $("star").classList.toggle("on", !!(it && it.star));
    $("star").textContent = it && it.star ? "Starred" : "Star this wiring";
    $("note").value = it && it.note ? it.note : "";
    var ul = $("starred"); ul.textContent = "";
    Object.keys(store).filter(function (x) { return store[x].star || store[x].note; }).forEach(function (x) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.textContent = (store[x].star ? "* " : "") + describe(store[x].w);
      if (store[x].note) { var em = document.createElement("em"); em.textContent = store[x].note; b.appendChild(em); }
      b.addEventListener("click", function () { setWiring(store[x].w); });
      var del = document.createElement("button"); del.type = "button"; del.className = "x"; del.textContent = "remove";
      del.addEventListener("click", function () { delete store[x]; save(); renderShortlist(); });
      li.appendChild(b); li.appendChild(del); ul.appendChild(li);
    });
  }

  // ---------------------------------------------------------------- controls
  function boot() {
    window.Scene.init($("scene"));
    $("nvalid").textContent = all.length;
    fillSelects();
    document.querySelectorAll("[data-plant]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("[data-plant]").forEach(function (x) { x.classList.toggle("on", x === b); });
        world.setPlant(b.getAttribute("data-plant"));
      });
    });
    $("sound").addEventListener("click", function () {
      if (!window.Sound.init()) { $("soundhint").textContent = "This browser has no Web Audio."; return; }
      audioOn = !audioOn;
      if (audioOn && window.Sound.ctx.state !== "running") window.Sound.ctx.resume();
      $("sound").classList.toggle("on", audioOn);
      $("sound").textContent = audioOn ? "Sound off" : "Sound on";
      $("soundhint").textContent = audioOn ? "Plucks for notes, a chime for light, a thump for a rack macro; the loop echoes what is sent." : "Sound is off.";
      window.Sound.setLoop(engine.loop.feedback, engine.loop.send, engine.loop.time, audioOn);
    });
    $("walk").addEventListener("click", function () { walking = !walking; if (walking) { walkStep(); nextWalk = simT + 4.5; } renderWalk(); });
    $("surprise").addEventListener("click", function () { setWiring(all[Math.floor(Math.random() * all.length)]); });
    // the "Some wirings to try" buttons in the panel above the sim
    document.querySelectorAll("[data-wiring]").forEach(function (b) {
      b.addEventListener("click", function () {
        setWiring(JSON.parse(b.getAttribute("data-wiring")));
        $("rail").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    $("c-close").addEventListener("input", function (e) { world.ctl.close = +e.target.value; });
    $("c-motion").addEventListener("input", function (e) { sliderMotion = +e.target.value; });
    $("c-wval").addEventListener("input", function (e) { world.ctl.wval = +e.target.value; });
    $("c-energy").addEventListener("input", function (e) { world.ctl.energy = +e.target.value; });
    document.querySelectorAll("#c-wcls button").forEach(function (b) {
      b.addEventListener("click", function () {
        world.ctl.wcls = +b.getAttribute("data-cls");
        document.querySelectorAll("#c-wcls button").forEach(function (x) { x.classList.toggle("on", x === b); });
      });
    });
    document.querySelectorAll(".pad").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-pad");
        if (k === "panic" && world.arm.paused) k = "resume";
        world.pad(k);
        window.Scene.flash("pad_" + (k === "resume" ? "panic" : k), simT);
        if (k === "panic" || k === "resume") {
          $("panic").classList.toggle("on", k === "panic");
          $("panic").textContent = k === "panic" ? "resume" : "panic";
        }
      });
    });
    $("star").addEventListener("click", function () {
      var k = SIM.key(wiring), it = store[k] || { w: wiring };
      it.star = !it.star; it.w = wiring; store[k] = it; save(); renderShortlist();
    });
    $("note").addEventListener("input", function (e) {
      var k = SIM.key(wiring), it = store[k] || { w: wiring };
      it.note = e.target.value; it.w = wiring; store[k] = it; save();
    });
    $("note").addEventListener("change", renderShortlist);
    // drag the performer: up and down is distance, shaking is motion
    var cv = $("scene"), drag = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 320, (e.clientY - r.top) / r.height * 200, performance.now()]; }
    cv.addEventListener("pointerdown", function (e) {
      var p = pos(e); if (p[0] < 215) return;
      drag = p; cv.setPointerCapture(e.pointerId);
      world.ctl.close = window.Scene.closeFromY(p[1]); $("c-close").value = world.ctl.close;
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var p = pos(e), v = Math.hypot(p[0] - drag[0], p[1] - drag[1]) / Math.max(8, p[2] - drag[2]);
      shake = Math.min(1, Math.max(shake, v * 0.9));
      world.ctl.close = window.Scene.closeFromY(p[1]); $("c-close").value = world.ctl.close;
      drag = p;
    });
    function up() { drag = null; }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    // warm the world so the lanes start full, then go
    world.advance(12); simT = 12 - LA;
    setWiring(wiring);
    requestAnimationFrame(step);
  }

  window.__sim = {
    get wiring() { return wiring; }, get engine() { return engine; }, world: world, all: all,
    get audio() { return window.Sound.ctx ? window.Sound.ctx.state : "none"; },
    get meter() { return meter; }, get hold() { return hold; }, setWiring: setWiring, walkStep: walkStep
  };
  boot();
})();
