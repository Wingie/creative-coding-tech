// game.js — the engine: levels as slides, a walking presenter, talking things,
// in-scene big numbers, and controls (knobs, levers, pads) that drive live lanes.
//
// Why it is built this way:
// - One 1280×800 canvas (the talk's output size). The world is drawn into a
//   320×200 buffer and copied up ×4 with no smoothing, so every art pixel is a
//   crisp 4×4 block. Text is drawn straight onto the 1280×800 canvas with the
//   bitmap font at integer scales, so it is sharp and large enough to project.
// - Levels are data (levels.js). The engine never hard-codes a number or a line.
// - Input from keyboard, gamepad and touch is merged into one set of actions,
//   so every control works the same way whichever device the speaker has.
(function () {
  'use strict';

  const SW = 1280, SH = 800, BW = 320, BH = 200, TS = 16, UP = 4;
  const { P } = Art;
  const cv = document.getElementById('screen');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const [buf, bx] = Art.canvas(BW, BH);

  // ?demo shows the capability stamp; ?edit (only when served over http by
  // edit_server.mjs) turns on click-to-edit. On stage (file://) both are off.
  const QS = location.search;
  const DEMO = /[?&]demo(?:[=&]|$)/.test(QS);
  const EDIT = /^https?:$/.test(location.protocol) && /[?&]edit(?:[=&]|$)/.test(QS);
  // Audience participation (crowd/crowd_server.mjs) is on only with ?crowd
  // (the default server), ?crowd=http://host:port, or CROWD_URL in levels.js.
  // Off, the game never opens a connection: a failed EventSource load is
  // logged by Chrome itself, so the only silent way is not to connect.
  const CROWD = (() => {
    const m = QS.match(/[?&]crowd(?:=([^&#]*))?(?:[&#]|$)/);
    let u = m ? (m[1] ? m[1] : 'http://127.0.0.1:8791') : (typeof window.CROWD_URL === 'string' ? window.CROWD_URL : '');
    try { u = decodeURIComponent(u); } catch (e) { u = ''; }
    u = String(u).trim().replace(/\/+$/, '');
    return /^https?:\/\/[^\s/?#]+$/.test(u) ? u : '';
  })();

  const dataErrors = [];
  function problem(msg) { dataErrors.push(msg); console.error('[levels.js] ' + msg); }

  // ------------------------------------------------------------ level data
  const SOLID_TYPES = new Set(['npc', 'sign', 'object', 'billboard', 'board', 'control', 'lane', 'qr']);
  // Crowd things (a qr board, a crowd area, anything with crowd: true) exist
  // only while participation is on and not killed: otherwise they are not
  // drawn, not solid and do not talk, so the level plays as it always did.
  const crowdOnly = (t) => t.type === 'qr' || t.type === 'crowd' || t.crowd === true;
  const THING_TYPES = new Set(['npc', 'sign', 'object', 'door', 'billboard', 'board', 'control', 'lane', 'qr', 'crowd']);
  // What a lane can draw (see drawLane).
  const LANE_MODES = new Set(['pulse', 'raw', 'rig', 'arm', 'loop', 'smooth', 'light']);

  // Every prompt in the deck (on a level or on a thing), by id.
  function promptsOf(def) { return [def.prompt, ...(def.things || []).map((t) => t && t.prompt)].filter(Boolean); }
  function checkPrompt(p, where, seen) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(p.id)) { problem(`${where}: prompt needs an id (letters, digits, _ or -)`); return; }
    if (seen[p.id]) problem(`${where}: prompt id '${p.id}' is used twice`);
    seen[p.id] = true;
    if (typeof p.text !== 'string' || !p.text.trim()) problem(`${where}: prompt '${p.id}' needs text`);
    if (p.choices !== undefined && (!Array.isArray(p.choices) || !p.choices.length || !p.choices.every((c) => typeof c === 'string' && c.trim())))
      problem(`${where}: prompt '${p.id}' choices must be a non-empty list of non-empty strings`);
    // guess: true: the choices are the room's guesses, not figures; the tally says so.
    if (p.guess !== undefined && p.guess !== true) problem(`${where}: prompt '${p.id}' guess must be true or left out`);
    if (p.guess === true && !Array.isArray(p.choices)) problem(`${where}: prompt '${p.id}' is a guess, so it needs choices`);
  }
  function checkPrompts() {
    const seen = {};
    for (const def of LEVELS) {
      if (def.prompt !== undefined) checkPrompt(def.prompt, `${def.id}`, seen);
      for (const t of def.things || []) if (t && t.prompt !== undefined) checkPrompt(t.prompt, `${def.id}: ${t.type} at ${t.x},${t.y}`, seen);
    }
  }
  const promptById = (id) => { for (const def of LEVELS) for (const p of promptsOf(def)) if (p.id === id) return p; return null; };

  function compile(def, index) {
    if (!Array.isArray(def.map) || !def.map.length || typeof def.map[0] !== 'string') { problem(`${def.id}: map must be a list of strings`); def.map = [' ']; }
    const H = def.map.length, W = def.map[0].length;
    def.map.forEach((row, y) => {
      if (row.length !== W) problem(`${def.id}: map row ${y} is ${row.length} wide, expected ${W}`);
      for (const ch of row) if (!Art.LEGEND[ch]) problem(`${def.id}: unknown tile '${ch}' in row ${y}`);
    });
    // A short row is reported, then padded with void, so a typo in the deck
    // shows up as a black tile rather than stopping the talk.
    def.map = def.map.map((row) => (row.length < W ? row.padEnd(W, ' ') : row.slice(0, W)))
      .map((row) => [...row].map((ch) => (Art.LEGEND[ch] ? ch : ' ')).join(''));
    const things = (def.things || []).map((t) => ({ ...t, w: t.w || 1, h: t.h || 1, dir: t.dir || 'down' }));
    for (const [ti, t] of things.entries()) {
      const where = `${def.id}: ${t.type} at ${t.x},${t.y}`;
      const raw = def.things[ti];
      if (!THING_TYPES.has(t.type)) problem(`${where}: unknown thing type '${t.type}'`);
      if (t.type === 'qr' || t.type === 'crowd') {
        if (!(Number.isInteger(raw.w) && raw.w >= 1 && Number.isInteger(raw.h) && raw.h >= 1)) problem(`${where}: a ${t.type} needs w and h (whole tiles)`);
        if (t.type === 'qr' && (raw.w < 3 || raw.h < 3)) problem(`${where}: a qr needs at least 3×3 tiles`);
      }
      if (t.type === 'crowd') {
        if (t.max !== undefined && !(Number.isInteger(t.max) && t.max >= 1)) problem(`${where}: max must be a whole number, 1 or more`);
        if (t.source !== undefined && t.source !== 'blurbs' && t.source !== 'questions') problem(`${where}: source must be 'blurbs' or 'questions', not ${JSON.stringify(t.source)}`);
        if (t.lines !== undefined || t.action !== undefined) problem(`${where}: a crowd area does not talk (its people do); move lines or action to another thing`);
      }
      if (t.crowd !== undefined && t.crowd !== true) problem(`${where}: crowd must be true or left out`);
      if (t.x < 0 || t.y < 0 || t.x + t.w > W || t.y + t.h > H) problem(`${where} is outside the map`);
      if (t.card && !FIGURES[t.card]) problem(`${where} uses unknown figure '${t.card}'`);
      if (t.action && t.action.fig && !FIGURES[t.action.fig]) problem(`${where} uses unknown figure '${t.action.fig}'`);
      if (t.type === 'npc' && t.sprite && !(t.sprite in PEOPLE_OK)) problem(`${where} has unknown person sprite '${t.sprite}'`);
      if (t.type !== 'npc' && t.sprite && !Art.OBJ[t.sprite]) problem(`${where} has unknown sprite '${t.sprite}'`);
      for (const a of actionsOf(t)) checkAction(a, where, def, things);
      if (t.lines !== undefined) checkLines(t.lines, `${where} lines`);
      if (t.doneLines !== undefined) checkLines(t.doneLines, `${where} doneLines`);
      if (t.cards !== undefined) {
        if (!Array.isArray(t.cards)) problem(`${where}: cards must be a list, one figure id (or null) per line`);
        else t.cards.forEach((c) => { if (c !== null && !FIGURES[c]) problem(`${where}: cards uses unknown figure '${c}'`); });
      }
      if (t.type === 'door') {
        const to = t.to;
        if (to !== 'next' && to !== 'prev' && !(Number.isInteger(to) && to >= 1 && to <= LEVELS.length)) problem(`${where}: door to must be 'next', 'prev' or a level number 1–${LEVELS.length}, not ${JSON.stringify(to)}`);
      }
    }
    // A D tile that leads nowhere feels broken on stage: it needs a door thing,
    // or a solid thing on it (a shut door).
    def.map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'D') return;
      const on = things.filter((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
      if (!on.some((t) => t.type === 'door' || (SOLID_TYPES.has(t.type) && !crowdOnly(t)))) problem(`${def.id}: door tile at ${x},${y} goes nowhere (add a door thing, or a solid thing to shut it)`);
    }));
    checkControls(def, things);
    if (def.key !== undefined && !/^[0-9]$/.test(String(def.key))) problem(`${def.id}: key must be one digit`);
    for (const t of things) if (t.type === 'billboard' && t.start) checkItem(t.start, `${def.id}: billboard ${t.id}`);
    if (index === 0) checkPrompts();
    // Crowd mode: the room follows the speaker, so every level has exactly
    // one place for it to stand.
    const areas = things.filter((t) => t.type === 'crowd').length;
    if (areas !== 1) problem(`${def.id}: needs exactly one crowd area (has ${areas})`);
    // A door or the spawn under a crowd thing would change with the crowd.
    for (const t of things) if (t.type === 'qr' || t.type === 'crowd') {
      if (things.some((d) => d.type === 'door' && d.x >= t.x && d.x < t.x + t.w && d.y >= t.y && d.y < t.y + t.h)) problem(`${def.id}: ${t.type} at ${t.x},${t.y} covers a door`);
    }
    // A missing or blocked spawn is reported, then replaced by the first free
    // floor tile, so the level still opens.
    const blocked = (x, y) => x < 0 || y < 0 || x >= W || y >= H || Art.LEGEND[def.map[y][x]].solid || def.map[y][x] === 'D'
      || things.some((t) => (SOLID_TYPES.has(t.type) || t.type === 'door') && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
    let spawn = def.spawn;
    if (!spawn || !Number.isInteger(spawn.x) || !Number.isInteger(spawn.y)) { problem(`${def.id}: no spawn { x, y }`); spawn = null; }
    else if (blocked(spawn.x, spawn.y)) { problem(`${def.id}: spawn ${spawn.x},${spawn.y} is not a free floor tile`); spawn = null; }
    if (!spawn) {
      spawn = { x: 0, y: 0, dir: 'down' };
      search: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!blocked(x, y)) { spawn = { x, y, dir: 'down' }; break search; }
    }
    // Per-cell tile variant, fixed per level so the grass does not shimmer.
    const variant = def.map.map((row, y) => [...row].map((_, x) => ((x * 73856093) ^ (y * 19349663) ^ (index * 83492791)) >>> 0 % 3));
    return { def, index, W, H, things, variant, spawn };
  }
  // lines: a non-empty list of strings.
  function checkLines(lines, where) {
    if (!Array.isArray(lines) || !lines.length || !lines.every((l) => typeof l === 'string' && l.trim())) problem(`${where} must be a non-empty list of non-empty strings`);
  }
  const PEOPLE_OK = Art.PEOPLE || {};
  // A level's controls: { key: { start, states: [{ label, ...numbers }] } }.
  // A control thing turns one key (A steps it through `cycle`, or sets `to`);
  // a lane reads the state its key is on. A pad with `fire` stamps a moment
  // instead (clear, duck), which a lane can show.
  function checkControls(def, things) {
    const C = def.controls;
    if (C !== undefined && (typeof C !== 'object' || C === null || Array.isArray(C))) { problem(`${def.id}: controls must be an object`); def.controls = {}; }
    for (const [k, c] of Object.entries(def.controls || {})) {
      if (!c || !Array.isArray(c.states) || !c.states.length || !c.states.every((st) => st && typeof st.label === 'string' && st.label.trim())) {
        problem(`${def.id}: control '${k}' needs states, each with a label`);
        def.controls[k] = { start: 0, states: [{ label: k.toUpperCase() }] };
      }
      const n = def.controls[k].states.length, s0 = def.controls[k].start;
      if (s0 !== undefined && !(Number.isInteger(s0) && s0 >= 0 && s0 < n)) problem(`${def.id}: control '${k}' start must be 0-${n - 1}`);
    }
    for (const t of things) {
      const where = `${def.id}: ${t.type} at ${t.x},${t.y}`;
      if (t.type === 'control') {
        const c = (def.controls || {})[t.key];
        if (t.fire !== undefined) { if (!/^[a-z]+$/.test(String(t.fire))) problem(`${where}: fire must be a lowercase word`); }
        else if (!c) problem(`${where}: no control '${t.key}' in this level's controls`);
        else {
          const n = c.states.length;
          if (t.to !== undefined && !(Number.isInteger(t.to) && t.to >= 0 && t.to < n)) problem(`${where}: to must be a state 0-${n - 1}`);
          if (t.cycle !== undefined && !(Array.isArray(t.cycle) && t.cycle.length && t.cycle.every((k) => Number.isInteger(k) && k >= 0 && k < n))) problem(`${where}: cycle must list states 0-${n - 1}`);
        }
        if (!t.sprite) problem(`${where}: a control needs a sprite`);
      }
      if (t.type === 'lane') {
        if (!LANE_MODES.has(t.mode)) problem(`${where}: lane mode must be one of ${[...LANE_MODES].join(', ')}`);
        for (const k of [].concat(t.key || [], t.route || [])) if (!(def.controls || {})[k]) problem(`${where}: no control '${k}' in this level's controls`);
      }
    }
  }

  // A thing's action may be one action or a list run in order.
  function actionsOf(t) { return !t.action ? [] : Array.isArray(t.action) ? t.action : [t.action]; }
  const ACTIONS = new Set(['bignum', 'show', 'sequence', 'clear', 'goto', 'end', 'tally', 'leftbehind', 'link']);
  // A billboard item is a figure id (a number, with its source) or an inline
  // { text, sub } for words that are not numbers (titles, headlines). Digits
  // in an inline item must go through FIGURES, except a leading "1 · ".
  function checkItem(it, where) {
    if (typeof it === 'string') { if (!FIGURES[it]) problem(`${where} uses unknown figure '${it}'`); return; }
    if (!it || typeof it.text !== 'string') { problem(`${where} has an item with no figure id or text`); return; }
    const bare = (it.text + ' ' + (it.sub || '')).replace(/^[0-9] · /, '');
    if (/[0-9]/.test(bare)) problem(`${where}: inline text "${it.text}" has a number; put it in FIGURES`);
  }
  function checkAction(a, where, def, things) {
    if (!a || !ACTIONS.has(a.do)) { problem(`${where} has unknown action '${a && a.do}'`); return; }
    const needsBoard = ['bignum', 'show', 'sequence', 'clear', 'tally'].includes(a.do) || (a.do === 'link' && a.board !== undefined);
    if (needsBoard && !things.some((o) => o.type === 'billboard' && o.id === a.board)) problem(`${where}: no billboard '${a.board}' in this level`);
    if (a.do === 'show') checkItem(a.item, where);
    if (a.do === 'bignum') checkItem(a.fig, where);
    if (a.do === 'sequence') {
      if (!Array.isArray(a.steps) || !a.steps.length) problem(`${where}: sequence needs steps`);
      else a.steps.forEach((s, k) => {
        if (!s || typeof s !== 'object') { problem(`${where}: sequence step ${k + 1} is not an object`); return; }
        checkItem(s.fig || s.item, where);
        if (s.card && !FIGURES[s.card]) problem(`${where} uses unknown figure '${s.card}'`);
        if (s.lines !== undefined) checkLines(s.lines, `${where} step ${k + 1} lines`);
      });
      if (a.then) checkAction(a.then, where, def, things);
    }
    if (a.do === 'goto' && !(Number.isInteger(a.level) && a.level >= 1 && a.level <= LEVELS.length)) problem(`${where}: goto level must be a level number 1–${LEVELS.length}, not ${JSON.stringify(a.level)}`);
    // link: a door to another page of the site. On http(s) A opens it; from
    // file:// (the stage) it only shows the address, so nothing leaves the talk.
    if (a.do === 'link' && !(typeof a.href === 'string' && /^(\.\.\/|\/|https:\/\/)[A-Za-z0-9._~\/#?=&%-]*$/.test(a.href))) problem(`${where}: link href must be a relative path or https address`);
    if (a.do === 'link' && a.item !== undefined) checkItem(a.item, where);
    if (a.do === 'tally' && !(typeof a.prompt === 'string' && promptById(a.prompt))) problem(`${where}: tally needs a prompt id from the deck, not ${JSON.stringify(a.prompt)}`);
  }
  let LV = LEVELS.map(compile);

  // ------------------------------------------------------------ game state
  const G = {
    level: 0, L: null,
    mode: 'play',          // play | dialog | menu
    player: { x: 0, y: 0, fx: 0, fy: 0, t: 1, dir: 'down', step: 0 },
    dlg: null, menu: null, trans: null,
    boards: {},            // billboard id -> { item, fig, t0, prev: [items], layout }
    seq: {},               // thing index -> steps shown so far (billboard sequence)
    ctl: {},               // control key -> state index (see checkControls)
    fx: {},                // pad `fire` name -> when it was pressed
    lanes: {},             // smooth lanes: running values and their history
    end: null,             // end to black: { t0 } holds until the operator acts
    help: true,            // the controls hint (dismiss with H / pad Y)
    paused: false,         // edit mode: frozen while a text box is open
    stampDrawn: false,     // the ?demo capability stamp was drawn last frame
    blackout: false,
    touch: false,
    time: 0,
    // Audience participation, from the crowd server's /feed. `on` is fixed
    // for the page (the URL or CROWD_URL); killed is the server's kill switch,
    // localKill the C key / __game.input('crowdoff').
    crowd: { on: !!CROWD, url: CROWD, status: CROWD ? 'connecting' : 'off', version: 0, snapshots: 0,
      link: null, qr: null, room: 0, killed: false, localKill: false, prompt: null,
      people: [], blurbs: [], questions: [], tallies: {} },
  };

  // ------------------------------------------------------------ input
  // Everything becomes an action name. "held" is for walking and running,
  // "queue" is for one-shot presses.
  const queue = [];
  const keyDirs = [];                 // most recent direction key last
  const held = { run: false };
  let touchDir = null, touchRun = false, padDir = null, padRun = false;
  const hookDirs = [];                // __game.input: directions held, most recent last
  const hookDown = {};                // __game.input: which actions are pressed
  let hookRun = false;

  const KEY = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
    Enter: 'a', ' ': 'a', Escape: 'b', Backspace: 'b',
    PageDown: 'next', ']': 'next', e: 'next', E: 'next',
    PageUp: 'prev', '[': 'prev', q: 'prev', Q: 'prev',
    m: 'menu', M: 'menu', Tab: 'menu',
    h: 'help', H: 'help', '.': 'blackout', f: 'fullscreen', F: 'fullscreen',
    c: 'crowdoff', C: 'crowdoff',
  };
  const DIRS = ['up', 'down', 'left', 'right'];

  // Keys typed into the edit-mode text box never reach the game.
  const typing = (e) => { const t = e.target; return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT'); };
  // On a Mac, keys released while Cmd is down send no keyup, so Cmd (down or
  // up) lets go of everything held.
  function releaseKeys() { keyDirs.length = 0; held.run = false; held.bKey = false; }
  addEventListener('keydown', (e) => {
    if (e.key === 'Meta') { releaseKeys(); return; }
    if (typing(e)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') { held.run = true; return; }
    let act = KEY[e.key];
    if (!act && /^[0-9]$/.test(e.key)) act = 'level:' + e.key;
    if (!act) return;
    e.preventDefault();
    if (DIRS.includes(act)) {
      const i = keyDirs.indexOf(act); if (i >= 0) keyDirs.splice(i, 1);
      keyDirs.push(act);
    }
    if (!e.repeat) queue.push(act);
  });
  addEventListener('keyup', (e) => {
    if (e.key === 'Meta') { releaseKeys(); return; }
    if (typing(e)) return;
    if (e.key === 'Shift') { held.run = false; return; }
    const act = KEY[e.key];
    if (DIRS.includes(act)) { const i = keyDirs.indexOf(act); if (i >= 0) keyDirs.splice(i, 1); }
    if (act === 'b') held.bKey = false;
  });
  addEventListener('keydown', (e) => { if (!typing(e) && KEY[e.key] === 'b') held.bKey = true; });
  addEventListener('blur', releaseKeys);

  // Gamepad, standard mapping. B held = run, as in the games this copies.
  const PADBTN = { 0: 'a', 1: 'b', 2: 'blackout', 3: 'help', 4: 'prev', 5: 'next', 9: 'menu', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  let padPrev = [], padStickPrev = null, padName = '';
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) { padDir = null; padRun = false; padName = ''; padPrev = []; padStickPrev = null; return; }
    padName = pad.id;
    const now = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    for (const [i, act] of Object.entries(PADBTN)) if (now[i] && !padPrev[i]) queue.push(act);
    padPrev = now;
    let dir = null;
    if (now[12]) dir = 'up'; else if (now[13]) dir = 'down'; else if (now[14]) dir = 'left'; else if (now[15]) dir = 'right';
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    let stick = null;
    if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.5) stick = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
    if (stick && stick !== padStickPrev) queue.push(stick); // lets the stick drive menus too
    padStickPrev = stick;
    padDir = dir || stick;
    padRun = !!now[1];
  }

  // Touch: an on-screen D-pad and buttons (index.html), shown on touch devices.
  function setupTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    const enable = () => { if (!G.touch) { G.touch = true; document.body.classList.add('touch'); fit(); } };
    if (matchMedia('(pointer: coarse)').matches) enable();
    addEventListener('touchstart', enable, { passive: true });
    const dpad = document.getElementById('dpad');
    let dpadId = null;
    const dirFrom = (e) => {
      const r = dpad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.12) return null;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    };
    dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault(); dpadId = e.pointerId; dpad.setPointerCapture(e.pointerId);
      touchDir = dirFrom(e); if (touchDir) queue.push(touchDir); showDpad();
    });
    dpad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dpadId) return;
      const d = dirFrom(e); if (d && d !== touchDir) queue.push(d); touchDir = d; showDpad();
    });
    const up = (e) => { if (e.pointerId === dpadId) { dpadId = null; touchDir = null; showDpad(); } };
    dpad.addEventListener('pointerup', up); dpad.addEventListener('pointercancel', up);
    function showDpad() { dpad.dataset.dir = touchDir || ''; }
    for (const b of root.querySelectorAll('[data-act]')) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down');
        queue.push(act); if (act === 'b') touchRun = true;
      });
      const rel = () => { b.classList.remove('down'); if (act === 'b') touchRun = false; };
      b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel);
    }
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // TouchDesigner (Web Render TOP) can only call JS, so it drives the game with
  // window.__game.input(action, down): down = 1 on press, 0 on release. It
  // feeds the same queue and held state as the keyboard and the pad: an action
  // fires on the press; the release only lets go of a held direction or run.
  // A second press without a release in between is ignored (no double fire).
  const HOOK = { up: 'up', down: 'down', left: 'left', right: 'right', a: 'a', b: 'b', rb: 'next', lb: 'prev', x: 'blackout', y: 'help', start: 'menu', crowdoff: 'crowdoff' };
  function hookInput(action, down) {
    // 'level:0'..'level:9' jumps like the number keys (TD's sendKey mangles digits).
    const name = String(action).toLowerCase(), act = HOOK[name] || (/^level:[0-9]$/.test(name) ? name : null);
    if (!act) return false;
    const on = +down > 0;
    if (on === !!hookDown[name]) return true;
    hookDown[name] = on;
    const i = hookDirs.indexOf(act);
    if (i >= 0) hookDirs.splice(i, 1);
    if (on && DIRS.includes(act)) hookDirs.push(act);
    if (act === 'b') hookRun = on;
    if (on) queue.push(act);
    return true;
  }

  function heldDir() { return keyDirs[keyDirs.length - 1] || hookDirs[hookDirs.length - 1] || touchDir || padDir || null; }
  function running() { return held.run || held.bKey || touchRun || padRun || hookRun; }

  // ------------------------------------------------------------ layout
  function fit() {
    // Site: fit the picture below the shared Echo Garden menu (../nav.js).
    const nav = document.querySelector('.eg-nav');
    const off = nav ? Math.ceil(nav.getBoundingClientRect().bottom) : 0;
    const vw = innerWidth, vh = innerHeight - off;
    const s = Math.min(vw / SW, vh / SH);
    const w = Math.floor(SW * s), h = Math.floor(SH * s);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.style.left = Math.floor((vw - w) / 2) + 'px';
    // On a phone held upright, park the picture at the top so the thumbs
    // have the bottom half of the screen to themselves.
    const top = G.touch && vh > vw * 1.2 ? Math.min(Math.floor((vh - h) / 2), 16) : Math.floor((vh - h) / 2);
    cv.style.top = off + top + 'px';
  }
  addEventListener('resize', fit);

  // ------------------------------------------------------------ levels
  // Everything a level remembers, kept per level index: leave with RB, come
  // back with LB, and the level is exactly as it was. A fresh load (the
  // level's own number key, or picking it in the menu) starts it over.
  const LEVEL_KEYS = ['boards', 'seq', 'used', 'ctl', 'fx', 'lanes'];
  const STORE = {};
  function freshState(L) {
    const s = { boards: {}, seq: {}, used: {}, ctl: {}, fx: {}, lanes: {} };
    for (const [k, c] of Object.entries(L.def.controls || {})) s.ctl[k] = c.start || 0;
    // A billboard with `start` is lit from the moment the level opens.
    L.things.forEach((t, i) => { if (t.type === 'billboard' && t.start) s.boards[t.id] = { item: t.start, fig: typeof t.start === 'string' ? t.start : null, t0: -99, prev: [], src: { start: i } }; });
    return s;
  }
  function stash() { if (G.L) STORE[G.level] = Object.fromEntries(LEVEL_KEYS.map((k) => [k, G[k]])); }
  function loadLevel(i, fresh, dir) {
    stash();
    if (fresh) delete STORE[i];
    G.level = i; G.L = LV[i];
    Object.assign(G, STORE[i] || freshState(G.L));
    const sp = G.L.spawn;
    Object.assign(G.player, { x: sp.x, y: sp.y, fx: sp.x, fy: sp.y, t: 1, dir: sp.dir || 'down' });
    G.mode = 'play'; G.dlg = null; G.menu = null;
    G.end = null;
    try { history.replaceState(null, '', '#level=' + (i + 1)); } catch (e) { /* file:// in some browsers */ }
    crowdArrive(dir || 0);
    crowdPostLevel();
  }

  // The RB chain skips appendix levels (appendix: true): the Q&A after the
  // performance is reached by the menu or its number key, never by RB.
  function nextIndex(i) { for (let k = i + 1; k < LV.length; k++) if (!LV[k].def.appendix) return k; return -1; }
  function prevIndex(i) {
    if (LV[i] && LV[i].def.appendix) return i - 1;
    for (let k = i - 1; k >= 0; k--) if (!LV[k].def.appendix) return k;
    return -1;
  }
  // Number keys: a level's own `key` wins, otherwise digit N is level N.
  function keyIndex(d) {
    const own = LV.findIndex((L) => L.def.key !== undefined && String(L.def.key) === d);
    if (own >= 0) return own;
    // A digit never lands on an appendix that has a key of its own (the Q&A is 0).
    const i = d === '0' ? -1 : +d - 1;
    return LV[i] && LV[i].def.appendix && LV[i].def.key !== undefined ? -1 : i;
  }
  // fresh: start the level over (its boards, sequences and controls too).
  function goLevel(i, dir, fresh) {
    if (!Number.isInteger(i) || i < 0 || i >= LV.length || G.trans) return;
    if (i === G.level && !fresh && !G.end) return;
    G.trans = { t: 0, to: i, dir: dir || (i >= G.level ? 1 : -1), fresh: !!fresh };
  }
  const TR_OUT = 0.28, TR_HOLD = 0.45, TR_IN = 0.28;

  // ------------------------------------------------------------ map queries
  function tileAt(x, y) { const L = G.L; if (x < 0 || y < 0 || x >= L.W || y >= L.H) return ' '; return L.def.map[y][x]; }
  // A crowd area is never a thing you bump into or talk to (its people are).
  function thingAt(x, y, filter) {
    return G.L.things.find((t) => t.type !== 'crowd' && present(t) && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h && (!filter || filter(t)));
  }
  function isSolid(x, y) {
    const ch = tileAt(x, y);
    if (Art.LEGEND[ch].solid) return true;
    return !!thingAt(x, y, (t) => SOLID_TYPES.has(t.type));
  }
  const talks = (t) => (t.lines && t.lines.length) || t.action || t.type === 'control';
  const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const FACE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // What would A talk to right now? The tile in front, else any neighbour —
  // forgiving on purpose: on stage nobody wants to line up a sprite.
  function target() {
    const p = G.player; if (p.t < 1) return null;
    const [dx, dy] = DELTA[p.dir];
    const front = thingAt(p.x + dx, p.y + dy, talks);
    if (front) return { thing: front, dir: p.dir };
    const cf = crowdAt(p.x + dx, p.y + dy);
    if (cf) return { crowd: cf, dir: p.dir };
    for (const d of DIRS) {
      const [ex, ey] = DELTA[d];
      const t = thingAt(p.x + ex, p.y + ey, talks);
      if (t) return { thing: t, dir: d };
    }
    for (const d of DIRS) {
      const [ex, ey] = DELTA[d];
      const c = crowdAt(p.x + ex, p.y + ey);
      if (c) return { crowd: c, dir: d };
    }
    return null;
  }

  // ------------------------------------------------------------ dialog
  const DLG_CHARS = 47, DLG_LINES = 3, CPS = 55;
  // `from` says where the lines live in the level ({ i, field } for a thing,
  // so edit mode can reopen the dialog after a reload.
  // `cards` (optional) is one figure id per line: the card switches when that
  // line's first page comes up; null keeps the card already showing.
  // Missing or empty lines mean no dialog (returns false).
  // crowd: the text came from the audience, not levels.js: no edit hit boxes.
  function openDialog({ name, lines, card, cards, onClose, from, crowd, big }) {
    if (!Array.isArray(lines)) return false;
    const pages = [], srcs = [], pageCards = [];
    let cur = card && FIGURES[card] ? card : null;
    lines.forEach((text, li) => {
      if (typeof text !== 'string' || !text.trim()) return;
      const c = Array.isArray(cards) ? cards[li] : null;
      if (c && FIGURES[c]) cur = c;
      const wrapped = Font.wrap(text, DLG_CHARS);
      for (let i = 0; i < wrapped.length; i += DLG_LINES) { pages.push(wrapped.slice(i, i + DLG_LINES)); srcs.push(text); pageCards.push(cur); }
    });
    if (!pages.length) return false;
    G.help = G.helpSeen ? G.help : false; G.helpSeen = true;
    G.dlg = { name, pages, srcs, pageCards, page: 0, t: 0, cardId: null, card: null, cardT0: G.time, onClose, from, args: { card, cards }, crowd: crowd || null, big: !!big };
    setPage(G.dlg, 0);
    G.mode = 'dialog';
    return true;
  }
  function setPage(d, n) {
    d.page = n; d.t = 0;
    const id = d.pageCards[n] || null;
    if (id !== d.cardId) { d.cardId = id; d.card = id ? FIGURES[id] : null; d.cardT0 = G.time; }
  }
  function pageLen(pg) { return pg.join(' ').length; }
  function closeDialog(runAfter) {
    const d = G.dlg; G.dlg = null; G.mode = 'play';
    if (runAfter && d && d.onClose) d.onClose();
  }

  // A thing's card, unless its bignum already puts that same figure on a
  // billboard (then the card would only repeat it).
  function cardFor(t) {
    return actionsOf(t).some((a) => a.do === 'bignum' && a.fig === t.card) ? null : t.card;
  }
  // The board state an action puts up; k is the sequence step. src says where
  // it came from in the level, so edit mode can re-read it after a reload.
  function boardFor(a, k, src) {
    let b = null;
    if (a.do === 'bignum') b = { item: a.fig, fig: a.fig, prev: [] };
    else if (a.do === 'show') b = { item: a.item, fig: typeof a.item === 'string' ? a.item : null, prev: [] };
    else if (a.do === 'tally') b = { item: null, fig: null, tally: a.prompt, prev: [] };
    else if (a.do === 'link') b = { item: a.item || { text: 'OPEN ' + a.href.replace(/^\.\.\/|\/$/g, '').toUpperCase(), sub: a.href }, fig: null, prev: [] };
    else if (a.do === 'sequence' && a.steps && a.steps[k]) {
      const step = a.steps[k];
      b = { item: step.fig || step.item, fig: step.fig || null, prev: a.layout || a.join ? a.steps.slice(0, k).map((s) => s.fig || s.item) : [],
        layout: a.layout || null, join: a.join || null };
    }
    return b && { ...b, t0: G.time, src };
  }

  function interact(tg) {
    const t = tg.thing, p = G.player;
    const idx = G.L.things.indexOf(t);
    G.used[idx] = true;
    const from = (field) => ({ i: idx, field });
    p.dir = tg.dir;
    if (t.type === 'npc') t.dir = FACE[tg.dir];
    const acts = actionsOf(t);
    // A billboard sequence: each A shows the next step; its own lines, if any.
    const seq = acts.find((a) => a.do === 'sequence');
    if (seq) {
      const si = acts.indexOf(seq);
      const k = G.seq[idx] || 0;
      if (k >= seq.steps.length) {
        if (seq.then) runAction(seq.then, t, idx, { i: idx, a: si, then: true });
        else openDialog({ name: t.name, lines: t.lines, card: t.card, cards: t.cards, from: from('lines') });
        return;
      }
      G.seq[idx] = k + 1;
      const step = seq.steps[k];
      G.boards[seq.board] = boardFor(seq, k, { i: idx, a: si, k });
      acts.forEach((a, ai) => { if (a !== seq) runAction(a, t, idx, { i: idx, a: ai }); });
      openDialog({ name: t.name, lines: step.lines, card: step.card, from: { i: idx, field: 'steps', step: k } });
      return;
    }
    // The Q&A's LEFT BEHIND note: questions whose askers have left, most
    // votes first; its own lines when there are none.
    if (acts.some((a) => a.do === 'leftbehind')) {
      const qs = leftBehind();
      if (qs.length) openDialog({ name: t.name, lines: qs.map((q) => `${q.name || 'GUEST'}: ${q.text}`), crowd: { ids: qs.map((q) => q.id), key: 'leftbehind' } });
      else openDialog({ name: t.name, lines: t.lines, from: from('lines') });
      return;
    }
    // A control: A turns it (or presses the pad). No dialog unless it has
    // lines: the lane it drives is the answer, and the speaker keeps walking.
    if (t.type === 'control') turn(t);
    acts.forEach((a, ai) => runAction(a, t, idx, { i: idx, a: ai }));
    if (acts.some((a) => a.do === 'goto' || a.do === 'end')) return;
    if (t.type === 'control' && !t.lines) return;
    // The join code: while the speaker talks at it, it fills the screen above
    // the dialog so the back of a large room can scan it.
    openDialog({ name: t.name, lines: t.lines, card: cardFor(t), cards: t.cards, from: from('lines'), big: t.type === 'qr' });
  }

  function runAction(a, t, idx, src) {
    switch (a.do) {
      case 'bignum': case 'show': case 'tally': G.boards[a.board] = boardFor(a, 0, src); break;
      case 'link': if (a.board) G.boards[a.board] = boardFor(a, 0, src); openLink(a.href); break;
      case 'clear': delete G.boards[a.board]; break;
      case 'end': startEnd(); break;
      case 'goto': goLevel(a.level - 1); break;
    }
  }

  // End to black: white for `white` seconds (default 2), then black that holds.
  // Only the operator lifts it: the menu, a number key, or LB. RB, A, B and
  // walking do nothing. The blackout key (. / X) keeps its own toggle.
  function startEnd() {
    G.end = { t0: G.time };
    G.mode = 'play'; G.dlg = null; G.help = false;
  }
  // Turn a control: step through its cycle, or set its `to`; a pad with
  // `fire` stamps the moment. `flash` makes the control glow for a beat.
  function turn(t) {
    t.flash = G.time;
    if (t.fire) { G.fx[t.fire] = G.time; return; }
    const c = (G.L.def.controls || {})[t.key];
    if (!c) return;
    if (t.to !== undefined) { G.ctl[t.key] = t.to; return; }
    const order = t.cycle || c.states.map((_, i) => i);
    const at = order.indexOf(G.ctl[t.key]);
    G.ctl[t.key] = order[(at + 1) % order.length];
  }
  const ctlState = (key) => { const c = (G.L.def.controls || {})[key]; return c ? c.states[G.ctl[key] || 0] || c.states[0] : null; };
  // A link opens only on the web, never from file:// (the stage) or in edit mode.
  function openLink(href) {
    if (/^https?:$/.test(location.protocol) && !EDIT && !window.__noLinks) location.href = href;
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    const acts = queue.splice(0);
    for (const a of acts) {
      if (a === 'blackout') G.blackout = !G.blackout;
      if (a === 'help') G.help = !G.help;
      if (a === 'crowdoff') { G.crowd.localKill = !G.crowd.localKill; crowdChanged(); }
      if (a === 'fullscreen') {
        if (document.fullscreenElement) document.exitFullscreen();
        else {
          // In fullscreen, Esc would leave fullscreen rather than reach the
          // game; the Keyboard Lock API (Chrome) keeps it for the game. B's
          // canonical key is Backspace anyway.
          const r = document.documentElement.requestFullscreen?.();
          if (r && r.then) r.then(() => { try { const k = navigator.keyboard?.lock?.(['Escape']); if (k && k.catch) k.catch(() => {}); } catch (e) { /* not supported */ } }).catch(() => {});
        }
      }
    }
    if (G.trans) { stepTransition(dt); return; }
    stepCrowd(dt);
    for (const a of acts) {
      if (a === 'next') { if (G.end) continue; const k = nextIndex(G.level); return k >= 0 ? goLevel(k, 1) : undefined; }
      if (a === 'prev') { const k = prevIndex(G.level); return k >= 0 ? goLevel(k, -1) : undefined; }
      // The current level's own key starts it over.
      if (a.startsWith('level:')) { const k = keyIndex(a.slice(6)); return k >= 0 && k < LV.length ? goLevel(k, 0, k === G.level) : undefined; }
    }
    if (G.end) {
      if (G.mode === 'menu') return updateMenu(acts);
      if (acts.includes('menu')) return openMenu();
      return;
    }
    stepLanes(dt);
    if (G.mode === 'menu') return updateMenu(acts);
    if (G.mode === 'dialog') return updateDialog(dt, acts);
    updatePlay(dt, acts);
  }

  function updateDialog(dt, acts) {
    const d = G.dlg; d.t += dt;
    const len = pageLen(d.pages[d.page]);
    for (const a of acts) {
      if (a === 'a') {
        if (d.t * CPS < len) d.t = len / CPS + 0.01;
        else if (d.page < d.pages.length - 1) setPage(d, d.page + 1);
        else return closeDialog(true);
      } else if (a === 'b') return closeDialog(false);
      else if (a === 'menu') { closeDialog(false); return openMenu(); }
    }
  }

  function updatePlay(dt, acts) {
    const p = G.player;
    for (const a of acts) {
      if (a === 'menu') return openMenu();
      if (a === 'a') { const tg = target(); if (tg) return tg.crowd ? interactCrowd(tg) : interact(tg); }
    }
    if (p.t < 1) {
      p.t = Math.min(1, p.t + dt / (running() ? 0.085 : 0.16));
      if (p.t >= 1) arrive();
      return;
    }
    // A quick tap still takes one step, even if the key was released before
    // this frame (and puppeteer taps are exactly that fast).
    const tapped = acts.filter((a) => DIRS.includes(a)).pop();
    const dir = heldDir() || tapped;
    if (!dir) return;
    p.dir = dir;
    const [dx, dy] = DELTA[dir];
    if (!isSolid(p.x + dx, p.y + dy)) {
      p.fx = p.x; p.fy = p.y; p.x += dx; p.y += dy; p.t = 0; p.step++;
    }
  }

  function arrive() {
    const p = G.player;
    const door = thingAt(p.x, p.y, (t) => t.type === 'door');
    if (door) goLevel(door.to === 'next' ? nextIndex(G.level) : door.to === 'prev' ? prevIndex(G.level) : door.to - 1);
  }

  function stepTransition(dt) {
    const tr = G.trans; tr.t += dt;
    if (!tr.switched && tr.t >= TR_OUT) { tr.switched = true; loadLevel(tr.to, tr.fresh, tr.dir); }
    if (tr.t >= TR_OUT + TR_HOLD + TR_IN) G.trans = null;
  }

  // ------------------------------------------------------------ menu
  function openMenu() { G.menu = { sel: G.level }; G.mode = 'menu'; }
  function updateMenu(acts) {
    const m = G.menu;
    for (const a of acts) {
      if (a === 'up') m.sel = (m.sel + LV.length - 1) % LV.length;
      if (a === 'down') m.sel = (m.sel + 1) % LV.length;
      if (a === 'b' || a === 'menu') { G.mode = 'play'; G.menu = null; return; }
      // Picking the current level starts it over (and lifts the end's black).
      if (a === 'a') { G.mode = 'play'; G.menu = null; goLevel(m.sel, 0, m.sel === G.level); return; }
    }
  }

  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  // A line of text on a dark plate (the HUD's title and the demo stamp).
  function plate(text, x, y, s, col) {
    ctx.fillStyle = 'rgba(11,2,33,0.88)';
    ctx.fillRect(x - 3 * s, y - 3 * s, Font.width(text, s) + 6 * s, 9 * s + 5 * s);
    occlude(x - 3 * s, y - 3 * s, Font.width(text, s) + 6 * s, 9 * s + 5 * s);
    Font.draw(ctx, text, x, y, s, col, null);
  }

  // ------------------------------------------------------------ the crowd
  // Audience participation: people join from their phones (crowd/), and the
  // crowd server streams what may be shown to /feed as Server-Sent Events.
  // Everything from the feed is data: it is cleaned to the bitmap font, never
  // put in HTML, and a sprite name only ever becomes a fixed path.
  const crowdVisible = () => G.crowd.on && !G.crowd.killed && !G.crowd.localKill;
  function present(t) { return !crowdOnly(t) || crowdVisible(); }
  function crowdChanged() {
    G.crowd.version++;
    // Hidden or withdrawn crowd text leaves the screen at once.
    if (!crowdVisible() && G.dlg && G.dlg.crowd) closeDialog(false);
  }

  // Only characters the bitmap font has (font.js); accents are stripped.
  const FONT_OK = new Set(' !"#%&\'()*+,-./0123456789:;<=>?ABCDEFGHIJKLMNOPQRSTUVWXYZ[]_abcdefghijklmnopqrstuvwxyz€·–');
  function cleanText(v, max) {
    const s = String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/[—−]/g, '–').replace(/\s+/g, ' ');
    let out = '';
    for (const ch of s) if (FONT_OK.has(ch)) out += ch;
    return out.trim().slice(0, max);
  }
  const cleanSprite = (v) => (typeof v === 'string' && v.length <= 40 && /^[A-Za-z0-9]+$/.test(v) ? v : null);
  const cleanId = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 80) : null);
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  const arr = (v) => (Array.isArray(v) ? v : []);
  function cleanLink(u) {
    if (typeof u !== 'string' || !/^https?:\/\//.test(u)) return null;
    return cleanText(u.replace(/^https?:\/\//, '').replace(/\/+$/, ''), 80) || null;
  }
  function cleanQr(q) {
    if (!q || !Number.isInteger(q.size) || q.size < 21 || q.size > 177 || !Array.isArray(q.rows) || q.rows.length !== q.size) return null;
    if (!q.rows.every((r) => typeof r === 'string' && r.length === q.size && /^[01]+$/.test(r))) return null;
    return { size: q.size, rows: q.rows.slice() };
  }
  function cleanTally(d) {
    const counts = {};
    let sum = 0;
    for (const [k, v] of Object.entries(d && typeof d.counts === 'object' && d.counts ? d.counts : {})) {
      const key = cleanText(k, 40), n = Math.max(0, Math.floor(num(v)));
      if (key) { counts[key] = (counts[key] || 0) + n; sum += n; }
    }
    return { counts, total: Math.max(sum, Math.floor(num(d && d.total))) };
  }
  // A movement rule from the phone: 'exact' / 'closer' with X = 1..5 tiles;
  // anything else (or none) is 'wander'.
  const cRule = (r, x) => ((r === 'exact' || r === 'closer') && Number.isInteger(x) && x >= 1 && x <= 5 ? { kind: r, x } : null);
  const cPerson = (p) => (p && cleanId(p.id) !== null ? { id: cleanId(p.id), sprite: cleanSprite(p.sprite), t: num(p.t), rule: cRule(p.rule, p.ruleX) } : null);
  function cText(b, extra) {
    if (!b || cleanId(b.id) === null) return null;
    const text = cleanText(b.text, 240);
    if (!text) return null;
    return { id: cleanId(b.id), personId: cleanId(b.personId), name: cleanText(b.name, 16).toUpperCase(), sprite: cleanSprite(b.sprite), text, t: num(b.t), ...extra(b) };
  }
  const cBlurb = (b) => cText(b, (x) => ({ promptId: cleanId(x.promptId), featured: !!x.featured }));
  // present: false means the asker has left; the question stays readable at
  // the Q&A (on the LEFT BEHIND note) and is not shown anywhere else.
  const cQuestion = (q) => cText(q, (x) => ({ pinned: !!x.pinned, votes: Math.max(0, Math.floor(num(x.votes))), present: x.present !== false }));
  // A long night: keep the newest few thousand of each.
  const CAP = 3000;
  function upsert(list, item, fresh) {
    if (!item) return;
    const i = list.findIndex((o) => o.id === item.id);
    if (i >= 0) { item.seen = fresh && list[i].text !== item.text ? G.time : list[i].seen; list[i] = item; return; }
    item.seen = fresh ? G.time : -99;
    list.push(item);
    if (list.length > CAP) list.splice(0, list.length - CAP);
  }
  // The feed contract (crowd/README.md): each event name and what it does.
  const FEED = {
    snapshot(d) {
      const C = G.crowd, oldB = new Map(C.blurbs.map((b) => [b.id, b])), oldQ = new Map(C.questions.map((q) => [q.id, q]));
      const keep = (old) => (o) => { o.seen = old.has(o.id) ? old.get(o.id).seen : -99; return o; };
      C.snapshots++;
      C.link = cleanLink(d.url); C.qr = cleanQr(d.qr);
      C.room = Math.max(0, Math.floor(num(d.room && typeof d.room === 'object' ? d.room.count : d.room)));
      C.killed = !!d.killed; C.prompt = d.prompt == null ? null : cleanId(d.prompt);
      C.people = arr(d.people).map(cPerson).filter(Boolean).slice(-CAP);
      C.blurbs = arr(d.blurbs).map(cBlurb).filter(Boolean).map(keep(oldB)).slice(-CAP);
      C.questions = arr(d.questions).map(cQuestion).filter(Boolean).map(keep(oldQ)).slice(-CAP);
      C.tallies = {};
      for (const [id, t] of Object.entries(d.tallies && typeof d.tallies === 'object' ? d.tallies : {})) C.tallies[cleanId(id)] = cleanTally(t);
      C.status = 'live';
    },
    url(d) { G.crowd.link = cleanLink(d.url); G.crowd.qr = cleanQr(d.qr); },
    room(d) { G.crowd.room = Math.max(0, Math.floor(num(d.count))); },
    person(d) { upsert(G.crowd.people, cPerson(d), false); },
    // Someone left (their phone went away): their character walks off.
    leave(d) {
      const id = cleanId(d.id), C = G.crowd;
      C.people = C.people.filter((p) => p.id !== id);
      if (G.dlg && G.dlg.crowd && G.dlg.crowd.key === 'p:' + id) closeDialog(false);
    },
    blurb(d) { upsert(G.crowd.blurbs, cBlurb(d), true); },
    question(d) { upsert(G.crowd.questions, cQuestion(d), true); },
    tally(d) { const id = cleanId(d.promptId); if (id !== null) G.crowd.tallies[id] = cleanTally(d); },
    prompt(d) { G.crowd.prompt = d.id == null ? null : cleanId(d.id); },
    kill(d) { G.crowd.killed = !!d.on; },
    remove(d) {
      const id = cleanId(d.id), C = G.crowd;
      C.blurbs = C.blurbs.filter((b) => b.id !== id);
      C.questions = C.questions.filter((q) => q.id !== id);
      if (G.dlg && G.dlg.crowd && G.dlg.crowd.ids.includes(id)) closeDialog(false);
    },
  };

  // One EventSource, which reconnects by itself (the server can set the delay
  // with `retry:`). Only a refused stream (CLOSED) needs a new one. Errors are
  // never logged: the status dot (?edit, ?demo) shows the link.
  let feed = null, feedRetry = null;
  function crowdConnect() {
    if (!CROWD || feed || typeof EventSource !== 'function') return;
    let src;
    try { src = new EventSource(CROWD + '/feed'); } catch (e) { G.crowd.status = 'closed'; feedRetry = setTimeout(crowdConnect, 5000); return; }
    feed = src;
    src.onopen = () => { G.crowd.status = 'live'; crowdPostLevel(); };
    src.onerror = () => {
      if (src.readyState === 2) { feed = null; G.crowd.status = 'closed'; clearTimeout(feedRetry); feedRetry = setTimeout(crowdConnect, 5000); }
      else G.crowd.status = 'connecting';
    };
    for (const [name, fn] of Object.entries(FEED)) {
      src.addEventListener(name, (e) => {
        let d = null;
        try { d = JSON.parse(e.data); } catch (x) { return; }
        if (!d || typeof d !== 'object') return;
        try { fn(d); } catch (x) { /* a malformed event is dropped */ }
        crowdChanged();
      });
    }
  }
  // The server opens the prompt that belongs to the level on screen.
  function crowdPostLevel() {
    if (!CROWD || !G.L) return;
    try {
      fetch(CROWD + '/game/state', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ level: G.L.def.id }) }).catch(() => {});
    } catch (e) { /* no fetch: nothing to tell */ }
  }

  // Who stands in a crowd area.
  // Everywhere but the Q&A, the same people follow the speaker from scene to
  // scene: one ranking for the whole deck (featured first, then anyone with
  // approved words, then the earliest to join), and each area shows its first
  // `max`. So a smaller area shows a subset of the same people, never others.
  // A person's question goes with them everywhere (a ? over their head, and A
  // reads it); an answer shows as a bubble only in the scene of its prompt,
  // and elsewhere as a … over their head.
  // The Q&A area (source: 'questions') stands one character per question:
  // most votes first, then pinned, then newest.
  const newestFirst = (a, b) => b.t - a.t;
  const byVotes = (a, b) => (b.votes - a.votes) || (b.pinned - a.pinned) || newestFirst(a, b);
  const bestBlurb = (a, b) => (b.featured - a.featured) || newestFirst(a, b);
  let RANK = null;
  function crowdRank() {
    const C = G.crowd;
    if (RANK && RANK.version === C.version) return RANK;
    const persons = new Map();
    const get = (id, o) => {
      let p = persons.get(id);
      if (!p) persons.set(id, (p = { pid: id, sprite: o.sprite, t: o.t, rule: o.rule || null, name: '', featured: false, blurbs: [], questions: [] }));
      if (!p.sprite && o.sprite) p.sprite = o.sprite;
      return p;
    };
    // Only people in the room: the words of someone who left are not drawn.
    const here = new Set(C.people.map((p) => p.id)), gone = (o) => !!o.personId && !here.has(o.personId);
    for (const p of C.people) get(p.id, p);
    for (const b of C.blurbs) { if (gone(b)) continue; const p = get(b.personId || 'b:' + b.id, b); p.blurbs.push(b); p.name = b.name || p.name; p.featured = p.featured || b.featured; }
    for (const q of C.questions) { if (gone(q) || !q.present) continue; const p = get(q.personId || 'q:' + q.id, q); p.questions.push(q); p.name = p.name || q.name; }
    // The three most-voted questions (with at least one vote) are gold.
    const top = new Set(C.questions.filter((q) => q.votes > 0).sort(byVotes).slice(0, 3).map((q) => q.id));
    const has = (p) => (p.blurbs.length || p.questions.length ? 1 : 0);
    const list = [...persons.values()].sort((a, b) => (b.featured - a.featured) || (has(b) - has(a)) || (a.t - b.t) || (a.pid < b.pid ? -1 : a.pid > b.pid ? 1 : 0));
    RANK = { version: C.version, list, top };
    return RANK;
  }
  function crowdPick(L, t) {
    const C = G.crowd, max = Number.isInteger(t.max) && t.max > 0 ? t.max : 24, R = crowdRank();
    if (t.source === 'questions') {
      return C.questions.filter((q) => q.present).sort(byVotes).slice(0, max).map((q) => ({
        key: 'q:' + q.id, id: q.id, ids: [q.id], name: q.name, sprite: q.sprite, text: q.text, lines: [q.text], seen: q.seen, pinned: q.pinned,
        icon: '?', votes: R.top.has(q.id) ? q.votes : 0, gold: R.top.has(q.id),
      }));
    }
    const ids = promptsOf(L.def).map((p) => p.id);
    return R.list.slice(0, max).map((p) => {
      const here = p.blurbs.filter((b) => ids.includes(b.promptId)).sort(bestBlurb)[0] || null;
      const any = here || p.blurbs.slice().sort(bestBlurb)[0] || null;
      const q = p.questions.slice().sort(byVotes)[0] || null;
      const lines = [], shown = [];
      if (any) { lines.push(any.text); shown.push(any.id); }
      if (q) { lines.push(q.text); shown.push(q.id); }
      return {
        key: 'p:' + p.pid, id: here ? here.id : q ? q.id : any ? any.id : p.pid, ids: shown, name: p.name, sprite: p.sprite, rule: p.rule,
        text: here ? here.text : '', seen: here ? here.seen : -99, featured: p.featured, lines,
        icon: q ? '?' : any ? '…' : null, votes: 0, gold: p.featured || (!!q && R.top.has(q.id)),
      };
    });
  }
  // The free tiles of an area, every other tile first so a small crowd is
  // spread out; never the spawn, a door or anything solid.
  function areaSlots(L, t) {
    const out = [];
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) {
      if (x < 0 || y < 0 || x >= L.W || y >= L.H) continue;
      const ch = L.def.map[y][x];
      if (Art.LEGEND[ch].solid || ch === 'D' || (x === L.spawn.x && y === L.spawn.y)) continue;
      if (L.things.some((o) => o !== t && (SOLID_TYPES.has(o.type) || o.type === 'door') && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)) continue;
      out.push({ x, y, k: ((x + y) % 2) * 10000 + (y - t.y) * t.w + (x - t.x) });
    }
    return out.sort((a, b) => a.k - b.k);
  }

  // Walkers: where each person is in the level on screen. A new level starts
  // them over: those shown within 2 s of arriving come in by the door the
  // speaker came through, one after another, and walk to their places; anyone
  // later just stands in a free place. Then every 2–5 s each takes a step to
  // a free tile of the area (never onto another person or the speaker), and
  // holds still while the speaker is next to them or a dialog is open. Every
  // person has their own seeded random numbers, so a rehearsal repeats.
  const CW = { level: -1, t0: 0, entry: null, walkers: new Map(), home: new Map(), n: 0, leaving: [] };
  function seedOf(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Which door the speaker came in by: going forward, the one back; going
  // back, the one forward; otherwise the door nearest the spawn. None: null.
  function entryDoor(L, dir) {
    const doors = L.things.filter((t) => t.type === 'door');
    if (!doors.length || !dir) return null;
    const want = dir > 0 ? 'prev' : 'next';
    const sp = L.spawn, d2 = (d) => (d.x - sp.x) ** 2 + (d.y - sp.y) ** 2;
    const d = doors.find((o) => o.to === want) || doors.slice().sort((a, b) => d2(a) - d2(b))[0];
    return { x: d.x, y: d.y };
  }
  function crowdArrive(dir) {
    CW.level = G.level; CW.t0 = G.time; CW.entry = entryDoor(G.L, dir); CW.walkers = new Map(); CW.home = new Map(); CW.n = 0; CW.leaving = [];
    G.L.crowdCache = null;
  }
  // Tiles a person may walk on to get to their place: not solid for the speaker.
  function pathTo(sx, sy, tx, ty) {
    const L = G.L, key = (x, y) => y * L.W + x, prev = new Map([[key(sx, sy), -1]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of Object.values(DELTA)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H || prev.has(k) || isSolid(nx, ny)) continue;
        prev.set(k, key(x, y)); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const out = [];
    for (let k = key(tx, ty); k !== key(sx, sy); k = prev.get(k)) out.unshift([k % L.W, Math.floor(k / L.W)]);
    return out;
  }
  function nearestDoor(L, at) {
    const doors = L.things.filter((t) => t.type === 'door'), d2 = (d) => (d.x - at.x) ** 2 + (d.y - at.y) ** 2;
    const d = doors.sort((a, b) => d2(a) - d2(b))[0];
    return d ? { x: d.x, y: d.y } : null;
  }
  function crowdArea(L) { return L.things.find((t) => t.type === 'crowd') || null; }
  function crowdChars(L) {
    if (!crowdVisible() || CW.level !== G.level || L !== G.L) return [];
    const t = crowdArea(L);
    if (!t) return [];
    const A = L.crowdCache || (L.crowdCache = { slots: areaSlots(L, t), version: -1, chars: [] });
    if (A.version !== G.crowd.version) {
      const picks = crowdPick(L, t).slice(0, A.slots.length), keys = new Set(picks.map((p) => p.key));
      // Whoever is no longer picked (left the room, or pushed out by a
      // featured answer) fades where they stand, and says nothing more.
      for (const c of A.chars) if (!keys.has(c.key) && !c.w.wait) CW.leaving.push({ ...c, gone: G.time, lines: [], text: '', icon: null });
      for (const k of [...CW.walkers.keys()]) if (!keys.has(k)) { CW.walkers.delete(k); CW.home.delete(k); }
      const usedHome = new Set(CW.home.values());
      A.chars = picks.map((p) => {
        let w = CW.walkers.get(p.key);
        if (!w) {
          // Their place: a slot nobody stands on or is walking to.
          const busy = (sl) => [...CW.walkers.values()].some((o) => (o.x === sl.x && o.y === sl.y) || (o.path && o.path.length && o.path[o.path.length - 1][0] === sl.x && o.path[o.path.length - 1][1] === sl.y));
          let si = CW.home.get(p.key);
          if (si === undefined) {
            si = A.slots.findIndex((sl, i) => !usedHome.has(i) && !busy(sl));
            if (si < 0) { si = 0; while (usedHome.has(si)) si++; }
            CW.home.set(p.key, si); usedHome.add(si);
          }
          const slot = A.slots[si], rnd = Art.rng(seedOf(p.key));
          w = { x: slot.x, y: slot.y, fx: slot.x, fy: slot.y, t: 1, dir: 'down', step: 0, rnd, next: G.time + 1 + rnd() * 3, path: null, wait: 0, entering: false };
          const taken = [...CW.walkers.values()].some((o) => o.x === slot.x && o.y === slot.y);
          // On arrival: in by the speaker's door, one after another. Later
          // (someone joins or comes back): in by the door nearest their place.
          const early = G.time - CW.t0 < 2, door = early ? CW.entry : nearestDoor(L, slot);
          const path = door && pathTo(door.x, door.y, slot.x, slot.y);
          if (path) Object.assign(w, { x: door.x, y: door.y, fx: door.x, fy: door.y, path, wait: early ? 0.2 + CW.n++ * 0.3 : 0, entering: true });
          else if (taken) {
            const free = A.slots.find((s) => ![...CW.walkers.values()].some((o) => o.x === s.x && o.y === s.y));
            if (free) Object.assign(w, { x: free.x, y: free.y, fx: free.x, fy: free.y });
          }
          CW.walkers.set(p.key, w);
        }
        return { ...p, w };
      });
      A.version = G.crowd.version;
    }
    for (const c of A.chars) { c.x = c.w.x; c.y = c.w.y; }
    return A.chars;
  }
  const inArea = (L, x, y) => !!(L.crowdCache && L.crowdCache.slots.some((s) => s.x === x && s.y === y));
  function stepCrowd(dt) {
    const L = G.L;
    if (!crowdVisible() || CW.level !== G.level || !L.crowdCache) return;
    const chars = L.crowdCache.chars, p = G.player;
    // A tile is taken if someone stands on it, is leaving it, or is walking in to it.
    const goal = (w) => (w.path && w.path.length ? w.path[w.path.length - 1] : null);
    const occupied = (x, y, me) => chars.some((c) => c.w !== me && ((!c.w.wait && ((c.w.x === x && c.w.y === y) || (c.w.t < 1 && c.w.fx === x && c.w.fy === y)))
      || (goal(c.w) && goal(c.w)[0] === x && goal(c.w)[1] === y)))
      || (p.x === x && p.y === y) || (p.t < 1 && p.fx === x && p.fy === y);
    for (const c of chars) {
      const w = c.w;
      if (w.wait > 0) { w.wait = Math.max(0, w.wait - dt); continue; }
      if (w.t < 1) {
        w.t = Math.min(1, w.t + dt / (w.entering ? 0.16 : 0.4));
        if (w.t < 1) continue;
      }
      if (w.path && w.path.length) {
        const [nx, ny] = w.path.shift();
        w.dir = nx > w.x ? 'right' : nx < w.x ? 'left' : ny > w.y ? 'down' : 'up';
        Object.assign(w, { fx: w.x, fy: w.y, x: nx, y: ny, t: 0, step: w.step + 1 });
        continue;
      }
      if (w.entering) { w.entering = false; w.path = null; w.dir = 'down'; w.next = G.time + 2 + w.rnd() * 3; }
      if (G.time < w.next) continue;
      if (c.rule) { stepRule(L, c, chars, occupied); continue; }
      w.next = G.time + 2 + w.rnd() * 3;
      // Next to the speaker, or while anyone is talking, a person stays put.
      if (G.mode !== 'play' || Math.abs(p.x - w.x) + Math.abs(p.y - w.y) <= 1) { w.dir = 'down'; continue; }
      const d = DIRS[Math.floor(w.rnd() * 4)], [dx, dy] = DELTA[d], nx = w.x + dx, ny = w.y + dy;
      if (!inArea(L, nx, ny) || occupied(nx, ny, w)) continue;
      Object.assign(w, { dir: d, fx: w.x, fy: w.y, x: nx, y: ny, t: 0, step: w.step + 1 });
    }
  }
  // A person with a rule from their phone ('exact' or 'closer', X tiles).
  // Distance is Manhattan (|dx| + |dy|), which is what one 4-way step changes
  // by exactly 1. "Nearest person" is whoever is nearest that tile: the
  // speaker or another crowd character standing in the area. Every 0.5–0.8 s
  // (faster than wandering, so they react to the speaker) they take the
  // neighbouring tile, or stay, that best meets the rule: 'exact' wants
  // distance == X, 'closer' wants distance <= X (a step never shares a tile,
  // so distance is at least 1). They move only when that is strictly better
  // than staying, and break ties between moves at random, so they settle.
  // Never out of the area, onto someone, or onto the speaker's tile.
  function stepRule(L, c, chars, occupied) {
    const w = c.w, p = G.player, r = c.rule;
    w.next = G.time + 0.5 + w.rnd() * 0.3;
    if (G.mode !== 'play') { w.dir = 'down'; return; }
    const others = [[p.x, p.y]];
    for (const o of chars) if (o.w !== w && !o.w.wait && !o.w.entering) others.push([o.w.x, o.w.y]);
    const cost = (x, y) => {
      let d = Infinity;
      for (const [ox, oy] of others) d = Math.min(d, Math.abs(ox - x) + Math.abs(oy - y));
      if (d === Infinity) return 0;
      return r.kind === 'exact' ? Math.abs(d - r.x) : Math.max(0, d - r.x);
    };
    const stay = cost(w.x, w.y);
    if (stay === 0) return;
    let best = stay, picks = [];
    for (const d of DIRS) {
      const [dx, dy] = DELTA[d], nx = w.x + dx, ny = w.y + dy;
      if (!inArea(L, nx, ny) || occupied(nx, ny, w)) continue;
      const k = cost(nx, ny);
      if (k < best) { best = k; picks = [d]; } else if (k === best && k < stay) picks.push(d);
    }
    if (!picks.length) return;
    const d = picks[Math.floor(w.rnd() * picks.length)], [dx, dy] = DELTA[d];
    Object.assign(w, { dir: d, fx: w.x, fy: w.y, x: w.x + dx, y: w.y + dy, t: 0, step: w.step + 1 });
  }
  const visibleChar = (c) => !c.w.wait && !c.w.entering;
  function leftBehind() { return G.crowd.questions.filter((q) => !q.present).sort(byVotes).slice(0, 20); }
  function crowdAt(x, y) { return crowdChars(G.L).find((c) => c.x === x && c.y === y && visibleChar(c) && c.lines.length) || null; }
  // A next to someone: their words, whole, in the normal dialog (their answer,
  // then their question, if they have both).
  function interactCrowd(tg) {
    const c = tg.crowd;
    G.player.dir = tg.dir;
    G.crowdFace = { key: c.key, dir: FACE[tg.dir] };
    openDialog({ name: c.name || 'GUEST', lines: c.lines, crowd: { ids: c.ids, key: c.key } });
  }

  // Characters come from assets/derived/folk/<id>.png (the Cozy Farm Lite farmer
  // recoloured, made by assets/tools/farm.py), loaded on first use (a plain
  // <img>, which works on file://). Until one loads, or if it cannot, a
  // default person stands in. A sheet has one column per direction and the
  // walk frames down the rows.
  const SHEETS = new Map(), SHEET_COL = { down: 0, up: 16, left: 32, right: 48 };
  function crowdSheet(name) {
    if (!name) return null;
    let im = SHEETS.get(name);
    if (!im) {
      if (SHEETS.size > 200) return null;
      im = new Image();
      im.onerror = () => { im.bad = true; };
      im.src = 'assets/derived/folk/' + name + '.png';
      SHEETS.set(name, im);
    }
    return !im.bad && im.complete && im.naturalWidth >= 64 ? im : null;
  }
  function charPos(c, cam) {
    const w = c.w, k = w.t;
    return [Math.round((w.fx + (w.x - w.fx) * k) * TS - cam.cx), Math.round((w.fy + (w.y - w.fy) * k) * TS - cam.cy)];
  }
  function drawCrowdChar(c, cam) {
    if (c.w.wait > 0) return;       // still outside the door
    const fade = c.gone !== undefined ? Math.max(0, 1 - (G.time - c.gone) / 0.6) : 1;
    if (fade <= 0) return;
    bx.globalAlpha = fade;
    try { drawCrowdBody(c, cam); } finally { bx.globalAlpha = 1; }
  }
  function drawCrowdBody(c, cam) {
    const [x, y] = charPos(c, cam), w = c.w, moving = w.t < 1;
    const dir = G.crowdFace && G.crowdFace.key === c.key && G.mode === 'dialog' ? G.crowdFace.dir : w.dir;
    bx.fillStyle = 'rgba(26,28,44,0.35)'; bx.fillRect(x + 3, y + 14, 10, 2);
    const im = crowdSheet(c.sprite);
    if (im) bx.drawImage(im, SHEET_COL[dir], moving ? ((w.step % 2) * 2 + (w.t < 0.5 ? 1 : 0)) * 16 : 0, 16, 16, x, y, 16, 16);
    else bx.drawImage(Art.person('guest1', dir, moving && w.t < 0.5 ? (w.step % 2 ? 1 : 2) : 0), x, y);
  }
  // Over the head: ? for a question, … for words said in another scene; gold
  // for a featured answer or a top-3 question (with its votes at the Q&A).
  // It bobs, so it reads as something to press A at.
  function drawHeadIcon(c, cam) {
    if (!c.icon || !visibleChar(c)) return null;
    const [x, y] = charPos(c, cam);
    const label = c.icon === '?' && c.votes ? '?' + c.votes : c.icon;
    const tw = label === '…' ? 7 : Font.width(label, 1);
    const bob = Math.round(Math.sin(G.time * 4 + (seedOf(c.key) % 7)) * 1.2);
    const bw = tw + 4, bh = 11, x0 = x + 8 - Math.ceil(bw / 2), y0 = y - bh - 2 + bob;
    const glow = Math.floor(G.time * 2 + (seedOf(c.key) % 3)) % 2;
    bx.fillStyle = P.ink; bx.fillRect(x0 - 1, y0 - 1, bw + 2, bh + 2);
    bx.fillStyle = c.gold ? (glow ? P.yellow : P.orange) : (glow ? P.white : '#d6d6d6'); bx.fillRect(x0, y0, bw, bh);
    bx.fillStyle = P.ink; bx.fillRect(x + 7, y0 + bh + 1, 2, 1);
    if (label === '…') for (let i = 0; i < 3; i++) bx.fillRect(x0 + 2 + i * 3 - (i ? 0 : 0), y0 + 7, 1, 1);
    else Font.draw(bx, label, x0 + 2, y0 + 2, 1, P.ink, null);
    return label;
  }

  // Speech bubbles: new words first, then a turn every 4 s through everyone
  // with something to say, at most three at a time. A bubble sits above its
  // speaker, or below, never over the HUD, a billboard or the QR, and never
  // off screen; if neither fits, it waits its turn.
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function crowdBubbles(chars, cam) {
    const talk = chars.filter((c) => c.text && visibleChar(c));
    if (!talk.length) return [];
    const fresh = talk.filter((c) => G.time - c.seen < 6).sort((a, b) => b.seen - a.seen).slice(0, 3);
    const rest = talk.filter((c) => !fresh.includes(c));
    const pick = fresh.slice();
    const m = Math.min(3 - pick.length, rest.length), k = Math.floor(G.time / 4);
    for (let j = 0; j < m; j++) pick.push(rest[(k * 3 + j) % rest.length]);
    const avoid = [...hudRects()];
    for (const t of G.L.things) if ((t.type === 'billboard' || t.type === 'qr') && present(t)) {
      avoid.push({ x: (t.x * TS - cam.cx) * UP, y: (t.y * TS - cam.cy) * UP, w: t.w * TS * UP, h: t.h * TS * UP });
    }
    const shown = [];
    for (const c of pick) if (drawBubble(c, cam, avoid)) shown.push(c.id);
    return shown;
  }
  function drawBubble(c, cam, avoid) {
    const s = 2, lh = 22, pad = 12;
    const lines = wrapN(c.text, 24, 2), name = c.name || 'GUEST';
    const w = Math.max(Font.width(name, s), ...lines.map((l) => Font.width(l, s))) + pad * 2;
    const h = pad * 2 + lh * (lines.length + 1) - 4;
    const cx = (c.x * TS - cam.cx + 8) * UP, top = (c.y * TS - cam.cy) * UP;
    for (const above of [true, false]) {
      const by = above ? top - 16 - h : top + TS * UP + 16;
      const bx0 = Math.round(Math.max(12, Math.min(SW - 12 - w, cx - w / 2)));
      const r = { x: bx0 - 4, y: by - 4, w: w + 8, h: h + 8 };
      if (r.y < 4 || r.y + r.h > SH - 4 || avoid.some((a) => overlaps(a, r))) continue;
      avoid.push(r);
      // Pixel-art bubble: an ink outline, a white body, a stepped tail.
      ctx.fillStyle = P.ink; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = P.white; ctx.fillRect(bx0, by, w, h);
      const tc = Math.round(Math.max(bx0 + 16, Math.min(bx0 + w - 16, cx)));
      const step = (i) => ({ x: tc - (12 - i * 4) / 2, y: above ? by + h + i * 4 : by - 4 - i * 4, w: 12 - i * 4 });
      ctx.fillStyle = P.ink;
      for (let i = 0; i < 3; i++) { const q = step(i); ctx.fillRect(q.x - 4, q.y, q.w + 8, 4); }
      ctx.fillRect(tc - 2, above ? by + h + 12 : by - 16, 4, 4);
      ctx.fillStyle = P.white;
      for (let i = 0; i < 3; i++) { const q = step(i); ctx.fillRect(q.x, q.y, q.w, 4); }
      Font.draw(ctx, name, bx0 + pad, by + pad, s, c.pinned || c.featured ? P.red : P.teal, null);
      lines.forEach((l, i) => Font.draw(ctx, l, bx0 + pad, by + pad + lh * (i + 1), s, P.ink, null));
      return true;
    }
    return false;
  }
  // Where the HUD sits this frame (see renderHUD), so bubbles keep off it.
  function hudRects() {
    const L = G.L.def, out = [];
    out.push({ x: 0, y: 0, w: Font.width(`${levelTag(G.level)} · ${L.title}`, 3) + 48, h: 64 });
    if (DEMO) out.push({ x: SW - 760, y: 0, w: 760, h: 56 });
    if (G.crowd.on && (DEMO || EDIT)) out.push({ x: SW - 30, y: 0, w: 30, h: 30 });
    if (EDIT) for (const r of promptPlates()) out.push(r.box);
    if (G.help && G.mode === 'play') out.push({ x: 0, y: SH - 24 - 140, w: SW, h: 164 });
    return out;
  }

  // The QR board: the matrix as crisp pixel art on white, at the largest
  // whole module size that fits with a quiet zone of 4 modules (3 or 2 if that
  // buys a bigger module), and the join address and the room count under it.
  let QRC = null, QRKEY = '';
  function qrCanvas(q) {
    const key = q.size + ':' + q.rows.join('');
    if (key !== QRKEY) {
      const [c, x] = Art.canvas(q.size, q.size);
      x.fillStyle = '#fff'; x.fillRect(0, 0, q.size, q.size);
      x.fillStyle = '#000';
      q.rows.forEach((r, yy) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') x.fillRect(i, yy, 1, 1); });
      QRC = c; QRKEY = key;
    }
    return QRC;
  }
  // The address on at most two lines, broken after a dot or a dash.
  function linkLines(link, n) {
    if (!link) return [];
    if (link.length <= n) return [link];
    let i = -1;
    for (let k = Math.min(n, link.length - 1); k > 0; k--) if (link[k] === '.' || link[k - 1] === '-') { i = k; break; }
    if (i <= 0) i = n;
    const rest = link.slice(i);
    return [link.slice(0, i), rest.length <= n ? rest : rest.slice(0, n - 3) + '...'];
  }
  // The join code at full size: everything above the dialog box, so it can be
  // scanned from the back of a large room (the board-sized code is ~145 px).
  function drawBigQr() {
    const q = G.crowd.qr, x = 24, y = 16, w = SW - 48, h = SH - 24 - 180 - 16 - 16;
    ctx.fillStyle = P.ink; ctx.fillRect(x - 4, y - 4, w + 8, h + 8); occlude(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
    const m = Math.max(1, Math.floor((h - 16) / (q.size + 4))), side = q.size * m;
    const qx = x + 2 * m + 8, qy = y + Math.round((h - side) / 2);
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas(q), qx, qy, side, side);
    ctx.imageSmoothingEnabled = was;
    const tx = qx + side + 2 * m + 24, tw = x + w - 24 - tx;
    // The address is for debugging only (?edit, ?demo): on stage the code is enough.
    const link = DEMO || EDIT ? [...linkLines(G.crowd.link, Math.max(8, Math.floor(tw / (Font.ADV * 3)))), ''] : [];
    const lines = ['JOIN ROOM!', '', ...link, `${G.crowd.room} IN THE ROOM`];
    lines.forEach((l, i) => Font.draw(ctx, l, tx, y + 40 + i * 36, i ? 3 : fitScale(l, tw, 6), i === lines.length - 1 ? P.red : P.ink, null));
    G.crowd.drawn.bigqr = { module: m, side, size: q.size, text: lines.filter(Boolean) };
  }

  function drawQrBoard(t, cam) {
    const x = (t.x * TS - cam.cx) * UP, y = (t.y * TS - cam.cy) * UP, w = t.w * TS * UP, h = t.h * TS * UP;
    const C = G.crowd, q = C.qr;
    ctx.fillStyle = P.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    if (!q) {
      Font.drawCentered(ctx, 'OFFLINE', x + w / 2, y + h / 2 - 14, 3, P.ink, null);
      C.drawn.qr = { offline: true, text: ['OFFLINE'] };
      return;
    }
    // JOIN ROOM! and the head count; the address only in ?edit and ?demo.
    const text = ['JOIN ROOM!', ...(DEMO || EDIT ? linkLines(C.link, Math.floor((w - 24) / (Font.ADV * 2))) : []), `${C.room} IN THE ROOM`];
    const textH = text.length * 22 + 6;
    let best = { m: 0, qz: 4 };
    for (const qz of [4, 3, 2]) {
      const m = Math.floor(Math.min((w - 8) / (q.size + 2 * qz), (h - 8 - textH) / (q.size + 2 * qz)));
      if (m > best.m) best = { m, qz };
    }
    const m = Math.max(1, best.m), side = (q.size + 2 * best.qz) * m;
    const top = Math.round(y + 4 + Math.max(0, (h - 8 - side - textH) / 2));
    const qx = Math.round(x + (w - q.size * m) / 2), qy = top + best.qz * m;
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas(q), qx, qy, q.size * m, q.size * m);
    ctx.imageSmoothingEnabled = was;
    text.forEach((l, i) => Font.drawCentered(ctx, l, x + w / 2, top + side + i * 22, 2, i === text.length - 1 ? P.red : P.ink, null));
    C.drawn.qr = { x: qx, y: qy, module: m, size: q.size, quiet: best.qz, text };
  }

  // A tally on a billboard: the prompt, then one bar per choice with its
  // count. The counts are live data from the room, so they are drawn as they
  // come; the bars grow toward them.
  const TALLY_SHOWN = new Map();
  let tallyT = 0;
  function drawTally(t, st, x, y, w, h) {
    const pr = promptById(st.tally), T = G.crowd.tallies[st.tally];
    const choices = (pr && Array.isArray(pr.choices) ? pr.choices : []).map((c) => [c, cleanText(c, 40)]);
    const counts = (T && T.counts) || {};
    const rows = choices.map(([src, c]) => ({ label: c, src, n: counts[c] || 0 }));
    for (const [k, n] of Object.entries(counts)) if (!choices.some(([, c]) => c === k)) rows.push({ label: k, src: null, n });
    const total = T ? T.total : 0;
    // The room's guesses are labelled as guesses: they are not figures.
    const head = !pr ? '' : pr.guess ? 'THE ROOM GUESSED · ' + pr.text.replace(/^guess:\s*/i, '') : pr.text;
    const hs = fitScale(head, w - 80, 3);
    Font.drawCentered(ctx, head, x + w / 2, y + 22, hs, P.white, null);
    if (pr) hitCentered(head, x + w / 2, y + 22, hs, pr.text, 'prompt');
    G.crowd.drawn.tally = { board: t.id, prompt: st.tally, total, empty: !total, guess: !!(pr && pr.guess), rows: rows.map((r) => ({ label: r.label, n: r.n })) };
    if (!total) { Font.drawCentered(ctx, 'no answers yet', x + w / 2, y + h / 2 + 4, 3, P.silver, null); return; }
    const dt = Math.min(0.25, Math.max(0, G.time - tallyT)); tallyT = G.time;
    const y0 = y + 22 + 9 * hs + 14, rh = Math.floor((y + h - 16 - y0) / Math.max(3, rows.length));
    const s = Math.max(2, Math.min(4, Math.floor((rh - 6) / 9)));
    const labW = Math.max(...rows.map((r) => Font.width(r.label.slice(0, 14), s)));
    const cntW = Font.width(String(Math.max(...rows.map((r) => r.n))), s);
    const barX = x + 40 + labW + 20, barW = Math.max(20, x + w - 40 - cntW - 20 - barX);
    const most = Math.max(1, ...rows.map((r) => r.n));
    rows.forEach((r, i) => {
      const ry = y0 + i * rh + Math.max(0, (rh - 9 * s) / 2), key = t.id + '|' + r.label;
      const cur = TALLY_SHOWN.has(key) ? TALLY_SHOWN.get(key) : 0, want = r.n / most;
      const k = cur + (want - cur) * Math.min(1, dt * 5);
      TALLY_SHOWN.set(key, k);
      Font.draw(ctx, r.label.slice(0, 14), x + 40, ry, s, P.white, null);
      if (r.src) hit(x + 40, ry, Font.width(r.label.slice(0, 14), s), 9 * s, r.src, 'prompt');
      ctx.fillStyle = P.navy; ctx.fillRect(barX, ry, barW, 9 * s);
      ctx.fillStyle = P.yellow; ctx.fillRect(barX, ry, Math.round(barW * k / 4) * 4, 9 * s);
      Font.draw(ctx, String(r.n), barX + barW + 20, ry, s, P.yellow, P.plum);
    });
  }

  // Edit mode only: the level's prompts as plates in the bottom-left corner
  // (above the controls hint and the EDIT MODE tag), so their words can be clicked and edited like
  // any other line in levels.js.
  function promptPlates() {
    const out = [];
    let bottom = SH - 56 - (G.help && G.mode === 'play' ? (G.touch ? 3 : 4) * 26 + 28 + 8 : 0);
    for (const p of promptsOf(G.L.def).reverse()) {
      if (typeof p.text !== 'string') continue;
      const line1 = 'ASKS: ' + p.text, choices = Array.isArray(p.choices) ? p.choices.filter((c) => typeof c === 'string') : [];
      const line2 = choices.join(' / ');
      const w = Math.max(Font.width(line1, 2), Font.width(line2, 2)) + 24, h = choices.length ? 58 : 34;
      const top = bottom - h;
      out.push({ p, line1, choices, y: top + 8, box: { x: 12, y: top, w, h } });
      bottom = top - 8;
    }
    return out;
  }
  function renderPromptPlates() {
    for (const { p, line1, choices, y, box } of promptPlates()) {
      ctx.fillStyle = 'rgba(26,28,44,0.88)'; ctx.fillRect(box.x, box.y, box.w, box.h); occlude(box.x, box.y, box.w, box.h);
      Font.draw(ctx, line1, 24, y, 2, P.cyan, null);
      hit(24 + Font.width('ASKS: ', 2) + 2, y, Font.width(p.text, 2), 18, p.text, 'prompt');
      let cx = 24;
      choices.forEach((c, i) => {
        if (i) { Font.draw(ctx, ' / ', cx, y + 26, 2, P.silver, null); cx += Font.width(' / ', 2) + 2; }
        Font.draw(ctx, c, cx, y + 26, 2, P.white, null);
        hit(cx, y + 26, Font.width(c, 2), 18, c, 'prompt');
        cx += Font.width(c, 2) + 2;
      });
    }
  }
  // ?edit and ?demo only: a dot in the top-right corner for the crowd link.
  function renderCrowdDot() {
    const C = G.crowd;
    const col = !crowdVisible() ? P.silver : C.status === 'live' ? P.lime : C.status === 'connecting' ? P.orange : P.red;
    ctx.fillStyle = P.ink; ctx.fillRect(SW - 24, 6, 16, 16);
    ctx.fillStyle = col; ctx.fillRect(SW - 21, 9, 10, 10);
    C.drawn.dot = true;
  }

  // ------------------------------------------------------------ render: world
  function camera() {
    const p = G.player, k = p.t;
    const px = (p.fx + (p.x - p.fx) * k) * TS, py = (p.fy + (p.y - p.fy) * k) * TS;
    const L = G.L, mw = L.W * TS, mh = L.H * TS;
    const cx = mw <= BW ? (mw - BW) / 2 : Math.max(0, Math.min(mw - BW, px + 8 - BW / 2));
    const cy = mh <= BH ? (mh - BH) / 2 : Math.max(0, Math.min(mh - BH, py + 8 - BH / 2));
    return { px, py, cx: Math.round(cx), cy: Math.round(cy) };
  }

  function renderWorld() {
    const L = G.L, cam = camera();
    bx.fillStyle = '#000'; bx.fillRect(0, 0, BW, BH);
    const x0 = Math.max(0, Math.floor(cam.cx / TS)), y0 = Math.max(0, Math.floor(cam.cy / TS));
    const x1 = Math.min(L.W, Math.ceil((cam.cx + BW) / TS)), y1 = Math.min(L.H, Math.ceil((cam.cy + BH) / TS));
    const frame = Math.floor(G.time * 2) % 2;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const ch = L.def.map[y][x];
      const v = (Art.tileAt && Art.tileAt(L.def.map, x, y, L.variant[y][x])) || Art.TILES[ch][L.variant[y][x] % 3];
      bx.drawImage(Array.isArray(v) ? v[frame] : v, x * TS - cam.cx, y * TS - cam.cy);
    }
    // Things and the player, back to front.
    const draw = [];
    for (const t of L.things) if (present(t) && t.type !== 'qr' && t.type !== 'crowd') draw.push({ y: t.y + t.h, fn: () => drawThing(t, cam) });
    const chars = crowdChars(L);   // none unless participation is on and not killed
    for (const c of chars) draw.push({ y: c.w.fy + (c.w.y - c.w.fy) * c.w.t + 1, fn: () => drawCrowdChar(c, cam) });
    if (crowdVisible() && CW.level === G.level) {
      CW.leaving = CW.leaving.filter((c) => G.time - c.gone < 0.6);
      for (const c of CW.leaving) draw.push({ y: c.w.y + 1, fn: () => drawCrowdChar(c, cam) });
    }
    draw.push({ y: cam.py / TS + 1 + 0.01, fn: () => drawPlayer(cam) });
    draw.sort((a, b) => a.y - b.y).forEach((d) => d.fn());
    const icons = [];
    for (const c of chars) { const i = drawHeadIcon(c, cam); if (i) icons.push({ key: c.key, id: c.id, icon: i, gold: !!c.gold }); }
    // A ? with the count over the LEFT BEHIND note while it holds questions.
    const left = crowdVisible() ? leftBehind().length : 0;
    if (left) for (const t of L.things) if (present(t) && actionsOf(t).some((a) => a.do === 'leftbehind')) {
      const i = drawHeadIcon({ key: 'leftbehind', icon: '?', votes: left, gold: false, w: { x: t.x, y: t.y, fx: t.x, fy: t.y, t: 1, wait: 0, entering: false } }, cam);
      icons.push({ key: 'leftbehind', id: null, icon: i, gold: false });
    }
    for (const lb of L.def.labels || []) {
      const w = Font.width(lb.text, 1);
      const x = lb.x * TS - cam.cx - (lb.align === 'left' ? 0 : w / 2), y = lb.y * TS - cam.cy;
      bx.fillStyle = 'rgba(26,28,44,0.8)'; bx.fillRect(x - 2, y - 2, w + 4, 11);
      Font.draw(bx, lb.text, x, y, 1, P.white, null);
      hit(x * UP, y * UP, w * UP, 9 * UP, lb.text, 'label');
    }
    // The "press A" bubble over whatever A would talk to.
    const tg = G.mode === 'play' && !G.trans ? target() : null;
    if (tg) {
      const t = tg.thing || { x: tg.crowd.x, y: tg.crowd.y, w: 1 }, bxp = (t.x + t.w / 2) * TS - cam.cx - 5, byp = t.y * TS - cam.cy - 12 - (Math.floor(G.time * 3) % 2);
      bx.fillStyle = P.ink; bx.fillRect(bxp - 1, byp - 1, 12, 12);
      bx.fillStyle = P.white; bx.fillRect(bxp, byp, 10, 10);
      Font.draw(bx, 'A', bxp + 3, byp + 2, 1, P.magenta, null);
    }
    ctx.drawImage(buf, 0, 0, BW, BH, 0, 0, SW, SH);
    // Screen-resolution layers that sit in the world (billboards).
    for (const t of L.things) if (t.type === 'lane' && present(t)) drawLane(t, cam);
    for (const t of L.things) if (t.type === 'billboard' && present(t)) drawBillboard(t, cam);
    if (crowdVisible()) {
      for (const t of L.things) if (t.type === 'qr') drawQrBoard(t, cam);
      G.crowd.drawn.chars = chars;
      G.crowd.drawn.icons = icons;
      // Bubbles only while walking: a dialog has the floor.
      G.crowd.drawn.bubbles = G.mode === 'play' && !G.trans ? crowdBubbles(chars, cam) : [];
    }
  }

  function drawPlayer(cam) {
    const p = G.player;
    const moving = p.t < 1;
    const frame = moving && p.t < 0.5 ? (p.step % 2 ? 1 : 2) : 0;
    bx.fillStyle = 'rgba(26,28,44,0.35)'; bx.fillRect(Math.round(cam.px - cam.cx) + 3, Math.round(cam.py - cam.cy) + 14, 10, 2);
    bx.drawImage(Art.person('player', p.dir, frame), Math.round(cam.px - cam.cx), Math.round(cam.py - cam.cy));
  }

  function drawThing(t, cam) {
    const x = t.x * TS - cam.cx, y = t.y * TS - cam.cy;
    if (t.type === 'npc') {
      bx.fillStyle = 'rgba(26,28,44,0.35)'; bx.fillRect(x + 3, y + 14, 10, 2);
      bx.drawImage(Art.person(t.sprite, t.dir, 0), x, y);
    } else if (t.type === 'lane') {
      // drawn at screen resolution after the world (drawLane)
    } else if (t.type === 'control') {
      drawControl(t, x, y);
    } else if (t.type === 'board') {
      bx.fillStyle = P.ink; bx.fillRect(x, y, t.w * TS, t.h * TS);
      bx.fillStyle = P.sand; bx.fillRect(x + 1, y + 1, t.w * TS - 2, t.h * TS - 2);
      bx.fillStyle = P.dbrown; bx.fillRect(x + 3, y + 3, t.w * TS - 6, t.h * TS - 6);
      const step = (t.h * TS - 6) / t.rows.length;
      t.rows.forEach((r, i) => {
        if (i) { bx.fillStyle = P.sand; bx.fillRect(x + 3, y + 3 + i * step, t.w * TS - 6, 1); }
        Font.draw(bx, r, x + 7, y + 3 + i * step + (step - 7) / 2, 1, P.yellow, null);
        hit((x + 7) * UP, (y + 3 + i * step + (step - 7) / 2) * UP, Font.width(r, 1) * UP, 9 * UP, r, 'board');
      });
    } else if (t.sprite) {
      const spr = Art.OBJ[t.sprite];
      bx.drawImage(spr, x, y + TS - spr.height + (spr.height > TS && t.h > 1 ? (t.h - 1) * TS : 0));
    }
  }


  // ------------------------------------------------------------ controls and lanes
  // A control is a knob, a lever, a pad or a floor spot. Its picture shows
  // its state: a lever's position (lever_0..2), a pad or spot lit when its
  // key is on its `to` (or for a moment after a `fire`), a knob's pointer.
  function drawControl(t, x, y) {
    const k = G.ctl[t.key] || 0, c = (G.L.def.controls || {})[t.key];
    const lit = t.fire ? G.time - (G.fx[t.fire] || -99) < 0.5 : t.to !== undefined && k === t.to;
    // a stepping control shows its state (lever_0..2); one with `to` or
    // `fire` is lit (pad_on) or not
    const spr = t.to === undefined && !t.fire
      ? Art.OBJ[t.sprite + '_' + k] || Art.OBJ[t.sprite]
      : (lit && (Art.OBJ[t.sprite + '_on'] || Art.OBJ[t.sprite + '_2'])) || Art.OBJ[t.sprite];
    if (!spr) return;
    bx.drawImage(spr, x, y + TS - spr.height);
    if (t.sprite === 'knob' && c) {
      const n = Math.max(2, c.states.length), a = (-135 + 270 * (k / (n - 1))) * Math.PI / 180;
      bx.fillStyle = P.magenta;
      for (let r = 0; r <= 3; r++) bx.fillRect(Math.round(x + 8 + Math.sin(a) * r) - 1 + (r ? 0 : 1), Math.round(y + 5 - Math.cos(a) * r), 1, 1);
      for (let i = 0; i < c.states.length; i++) { bx.fillStyle = i <= k ? P.cyan : P.plum; bx.fillRect(x + 3 + i * 2, y + 15, 1, 1); }
    }
    // a glow for a beat after A
    const since = G.time - (t.flash === undefined ? -99 : t.flash);
    if (since < 0.35) { bx.strokeStyle = since < 0.18 ? P.white : P.cyan; bx.lineWidth = 1; bx.strokeRect(x - 0.5, y - 0.5, TS + 1, TS + 1); }
  }

  // Lanes: a strip of time drawn at screen resolution, now at the right
  // edge. Everything in them is made from the clock: the Scion's pulse
  // (FIGURES.tick's 127.9 ms) and a fixed hash per pulse, so the same pulse
  // is always the same plant note, whichever lane draws it.
  const PULSE = 0.1279, WIN = 4;
  const hash = (k) => { let h = (k * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  // The plant's slow signal, 0..1 (a stand-in for the CC drift: seconds long).
  const slow = (t) => 0.5 + 0.32 * Math.sin(t * 0.9) + 0.18 * Math.sin(t * 0.37 + 1.3);
  const CH_COL = { 2: P.magenta, 3: P.cyan, 4: P.yellow };
  function laneKey(t) { return 'lane' + G.L.things.indexOf(t); }
  // smooth lanes: the raw pinch and two followers, sampled every 0.05 s.
  function stepLanes(dt) {
    for (const t of G.L.things) {
      if (t.type !== 'lane' || t.mode !== 'smooth') continue;
      const st = ctlState(t.key) || { v: 0.5 };
      const id = laneKey(t), L = G.lanes[id] || (G.lanes[id] = { raw: st.v, a: st.v, b: st.v, hist: [], acc: 0 });
      const jitter = 0.05 * Math.sin(G.time * 13.1) + 0.04 * Math.sin(G.time * 7.3 + 2) + 0.03 * Math.sin(G.time * 23.7);
      L.raw = Math.max(0, Math.min(1, st.v + jitter));
      L.a += (L.raw - L.a) * (1 - Math.exp(-dt / (t.lagA || 0.5)));
      L.b += (L.raw - L.b) * (1 - Math.exp(-dt / (t.lagB || 2)));
      L.acc += dt;
      while (L.acc >= 0.05) { L.acc -= 0.05; L.hist.push([L.raw, L.a, L.b]); if (L.hist.length > WIN / 0.05) L.hist.shift(); }
    }
  }
  function laneState() {
    const out = {};
    for (const t of G.L.things) if (t.type === 'lane') {
      const k = [].concat(t.key || [])[0], notes = laneNotes(t), L = G.lanes[laneKey(t)];
      const off = notes.filter((n) => n.pulse !== undefined).map((n) => n.t - n.pulse);
      out[t.mode] = { state: k && ctlState(k) ? ctlState(k).label : null, notes: notes.length,
        heard: !t.route || (ctlState(t.route) || {})[t.mode] !== 0,
        offPulse: off.filter((d) => d > 1e-9).length, maxOff: off.length ? Math.max(...off) : 0,
        values: L ? { raw: L.raw, a: L.a, b: L.b } : null };
    }
    return out;
  }
  // The notes a lane holds right now: { t (when it sounds), x 0..1, y 0..1, col, a (alpha) }.
  function laneNotes(t) {
    const now = G.time, out = [];
    const st = (k) => ctlState(k) || {};
    const k0 = Math.floor((now - WIN) / PULSE), k1 = Math.floor(now / PULSE);
    const atX = (tt) => 1 - (now - tt) / WIN;
    if (t.mode === 'pulse' || t.mode === 'raw' || t.mode === 'rig') {
      const p = t.mode === 'pulse' ? st(t.key).p : (t.p || 0.25);
      for (let k = k0; k <= k1; k++) {
        if (hash(k) >= p) continue;
        const tt = k * PULSE, off = t.mode === 'rig' ? 0.4 * slow(tt) : 0;
        if (tt + off > now) continue;
        out.push({ t: tt + off, pulse: tt, x: atX(tt + off), y: 0.25 + 0.5 * hash(k + 7777), col: t.mode === 'rig' ? P.cyan : P.magenta, a: 1 });
      }
    } else if (t.mode === 'arm') {
      const s = st(t.key);
      if (s.on) for (let k = k0; k <= k1; k++) {
        if (hash(k) >= 0.3) continue;
        const tt = k * PULSE, off = 0.4 * slow(tt);
        if (tt + off > now) continue;
        out.push({ t: tt + off, pulse: tt, x: atX(tt + off), y: 0.15 + 0.7 * ((hash(k + 31) * 6) | 0) / 5, col: CH_COL[s.ch] || P.white, a: 1 });
      }
    } else if (t.mode === 'loop') {
      const s = st(t.key), fb = s.fb || 0, loopT = t.loop || 6, P0 = Math.floor(now / loopT);
      const clearT = G.fx.clear || -1e9, duck = now - (G.fx.duck || -99) < 2 ? 0.85 : 1;
      for (let n = 0; n < 60; n++) {
        const q = P0 - n, amp = Math.pow(fb, n) * duck;
        if (q < 0 || (n && amp < 0.04)) break;
        const ka = Math.ceil(q * loopT / PULSE), kb = Math.floor((q + 1) * loopT / PULSE);
        for (let k = ka; k <= kb; k++) {
          const tb = k * PULSE;
          if (tb > now || tb < clearT || hash(k) >= 0.09) continue;
          if (n === 0 && tb < q * loopT) continue;
          out.push({ t: tb, x: (tb - q * loopT) / loopT, y: 0.15 + 0.7 * hash(k + 99), col: n ? P.cyan : P.magenta, a: n ? amp : 1 });
        }
      }
    }
    return out;
  }
  function lanePanel(t, cam) {
    const x = (t.x * TS - cam.cx) * UP, y = (t.y * TS - cam.cy) * UP, w = t.w * TS * UP, h = t.h * TS * UP;
    ctx.fillStyle = P.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.magenta; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    ctx.fillStyle = '#10032a'; ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    if (t.label) { Font.draw(ctx, t.label, x + 20, y + 18, 2, P.white, null); hit(x + 20, y + 18, Font.width(t.label, 2), 18, t.label, 'label'); }
    return { x, y, w, h, px: x + 20, py: y + 48, pw: w - 40, ph: h - 68, label: t.label };
  }
  // The state line, top right, in cyan: what the control is set to.
  function laneCaption(r, text, col) {
    if (!text) return;
    if (!text) return;
    const s = Font.width(text, 2) <= r.w - 80 - Font.width(r.label || '', 2) ? 2 : 1;
    Font.draw(ctx, text, r.x + r.w - 20 - Font.width(text, s), r.y + 18, s, col || P.cyan, null);
  }
  function drawLane(t, cam) {
    const r = lanePanel(t, cam), now = G.time, st = (k) => ctlState(k) || {};
    // dimmed when a route control says this lane is not heard
    const heard = !t.route || st(t.route)[t.mode] !== 0;
    ctx.globalAlpha = heard ? 1 : 0.3;
    try {
      if (t.mode === 'pulse' || t.mode === 'raw' || t.mode === 'rig' || t.mode === 'arm') {
        // the pulse: a thin line every 127.9 ms
        const k0 = Math.ceil((now - WIN) / PULSE), k1 = Math.floor(now / PULSE);
        for (let k = k0; k <= k1; k++) {
          const xx = r.px + Math.round((1 - (now - k * PULSE) / WIN) * r.pw);
          ctx.fillStyle = k % 8 === 0 ? P.slate : P.plum; ctx.fillRect(xx, r.py, 2, r.ph);
        }
        for (const n of laneNotes(t)) {
          const xx = r.px + Math.round(n.x * r.pw), yy = r.py + Math.round(n.y * (r.ph - 24));
          if (n.pulse !== undefined && n.t !== n.pulse) {
            const xp = r.px + Math.round((1 - (now - n.pulse) / WIN) * r.pw);
            ctx.fillStyle = P.slate; ctx.fillRect(xp, yy + 10, Math.max(2, xx - xp), 2);
          }
          ctx.fillStyle = n.col; ctx.fillRect(xx - 4, yy, 10, 24);
          ctx.fillStyle = P.white; ctx.fillRect(xx - 4, yy, 10, 4);
        }
        const s = t.key ? st(t.key) : null;
        laneCaption(r, s ? s.label : (heard ? '' : 'MUTED · ') + (t.caption || ''), s && t.mode === 'arm' && s.ch ? CH_COL[s.ch] : null);
        if (t.mode === 'arm' && s && s.on && s.send !== undefined) {
          // the loop send for this spot, as a bar on the right
          const bh = Math.round(r.ph * s.send);
          ctx.fillStyle = P.plum; ctx.fillRect(r.x + r.w - 36, r.py, 12, r.ph);
          ctx.fillStyle = P.green; ctx.fillRect(r.x + r.w - 36, r.py + r.ph - bh, 12, bh);
        }
      } else if (t.mode === 'loop') {
        const s = st(t.key), loopT = t.loop || 6, head = (now % loopT) / loopT;
        for (const n of laneNotes(t).sort((a, b) => a.a - b.a)) {
          const xx = r.px + Math.round(n.x * r.pw), hh = Math.max(6, Math.round(28 * n.a));
          ctx.globalAlpha = (heard ? 1 : 0.3) * Math.max(0.15, n.a);
          ctx.fillStyle = n.col; ctx.fillRect(xx - 3, r.py + Math.round(n.y * (r.ph - 28)), 8, hh);
        }
        ctx.globalAlpha = heard ? 1 : 0.3;
        ctx.fillStyle = P.white; ctx.fillRect(r.px + Math.round(head * r.pw), r.py - 6, 3, r.ph + 12);
        const flash = now - (G.fx.clear || -99) < 1.5 ? 'CLEAR' : now - (G.fx.duck || -99) < 2 ? 'DUCK' : '';
        laneCaption(r, (flash ? flash + ' · ' : '') + (s.label || ''));
      } else if (t.mode === 'smooth') {
        const L = G.lanes[laneKey(t)], hist = L ? L.hist : [], n = WIN / 0.05;
        const cols = [P.white, P.cyan, P.magenta];
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = cols[c];
          for (let i = 0; i < hist.length; i++) {
            const xx = r.px + Math.round((1 - (hist.length - 1 - i) / n) * r.pw), yy = r.py + Math.round((1 - hist[i][c]) * (r.ph - 8));
            ctx.fillRect(xx - 3, yy, Math.ceil(r.pw / n) + 2, c ? 6 : 3);
          }
        }
        const key = ['RAW', 'LAG ' + (t.lagA || 0.5) + ' S', 'LAG ' + (t.lagB || 2) + ' S'];
        let kx = r.px;
        key.forEach((k, i) => { ctx.fillStyle = cols[i]; ctx.fillRect(kx, r.y + r.h - 34, 14, 14); Font.draw(ctx, k, kx + 22, r.y + r.h - 36, 2, cols[i], null); kx += Font.width(k, 2) + 60; });
        laneCaption(r, st(t.key).label);
      } else if (t.mode === 'light') {
        // the six spot areas round the plant, black and white: the one being
        // played is lit white
        const s = st(t.key), cx = r.px + r.pw / 2, cy = r.py + r.ph / 2 - 6, rx = r.pw * 0.36, ry = r.ph * 0.34;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2, ax = cx + Math.cos(a) * rx, ay = cy + Math.sin(a) * ry;
          const on = s.area === i;
          ctx.fillStyle = on ? P.white : '#2a2a2a'; ctx.fillRect(ax - 34, ay - 16, 68, 32);
          ctx.fillStyle = on ? '#000' : '#8a8a8a'; Font.drawCentered(ctx, String(i + 1), ax, ay - 9, 2, on ? '#000' : '#8a8a8a', null);
        }
        ctx.fillStyle = '#d0d0d0'; ctx.fillRect(cx - 10, cy - 12, 20, 24);
        laneCaption(r, s.label, P.white);
      }
    } finally { ctx.globalAlpha = 1; }
  }

  // A billboard shows a figure as a big number: the number
  // counts up over four seconds with the words held still.
  // A figure with count: true counts even when it is small (a "1"
  // ticks 0 → 1, and holds on 0 until the very end).
  function countText(value, p, force) {
    const m = value.match(/^([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
    if (!m || p >= 1) return value;
    const numStr = m[1], rest = m[2];
    const n = parseFloat(numStr.replace(/,/g, ''));
    const dec = (numStr.split('.')[1] || '').length;
    const counts = force || ((rest === '' || rest[0] === ' ' || rest[0] === '%') && (n >= 10 || dec > 0));
    if (!counts) return value.slice(0, Math.max(1, Math.ceil(value.length * Math.min(1, p * 3))));
    const cur = force && !dec ? Math.floor(n * p) : n * p;
    const s = numStr.includes(',') ? fmt(cur, dec) : cur.toFixed(dec);
    return s + rest;
  }
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  function fitScale(text, maxW, maxS) {
    for (let s = maxS; s >= 2; s--) if (Font.width(text, s) <= maxW) return s;
    return 2;
  }
  // Wrap to at most n lines of `chars`; anything left over ends in "..." so a
  // cut is visible rather than silent.
  function wrapN(text, chars, n) {
    const lines = Font.wrap(text || '', Math.max(1, chars));
    if (lines.length <= n) return lines;
    const out = lines.slice(0, n);
    out[n - 1] = (out[n - 1].length + 3 <= chars ? out[n - 1] : out[n - 1].slice(0, Math.max(0, chars - 3)).trimEnd()) + '...';
    return out;
  }

  function drawBillboard(t, cam) {
    const x = (t.x * TS - cam.cx) * UP, y = (t.y * TS - cam.cy) * UP, w = t.w * TS * UP, h = t.h * TS * UP;
    ctx.fillStyle = P.magenta; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.cyan; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = P.ink; ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    // scanlines, so it reads as a lit screen rather than a hole
    ctx.fillStyle = 'rgba(59,22,112,0.45)';
    for (let yy = y + 8; yy < y + h - 8; yy += 8) ctx.fillRect(x + 8, yy, w - 16, 4);
    // A tally is crowd content: hidden with the crowd, the board goes idle.
    const b0 = G.boards[t.id], live = b0 && b0.tally;
    const st = b0 && !(live && !crowdVisible()) ? b0 : null;
    if (!st) {
      Font.drawCentered(ctx, t.idle || '', x + w / 2, y + h / 2 - 27, 6, P.slate, null);
      hitCentered(t.idle, x + w / 2, y + h / 2 - 27, 6, t.idle, 'idle');
      return;
    }
    if (st.tally) return drawTally(t, st, x, y, w, h);
    const f = itemOf(st.item), p = easeOut(Math.min(1, (G.time - st.t0) / (f.secs || 4)));
    if (st.layout === 'stack') return drawStack(st, f, p, x, y, w, h);
    if (f.split) return drawSplit(f, G.time - st.t0, x, y, w, h);
    const head = st.join && st.prev.length ? st.prev.map((it) => itemOf(it).value).join(st.join) + st.join : '';
    const s = fitScale(head + f.value, w - 80, 8);
    Font.drawCentered(ctx, head + countText(f.value, p, f.count), x + w / 2, y + 40, s, P.yellow, P.plum);
    hitCentered(head + f.value, x + w / 2, y + 40, s, f.value, 'figure');
    // A 3-tile board gets a smaller subtitle, kept clear of the source badge.
    const big = t.h >= 4, room = w - 80 - (big ? 0 : 2 * ((f.src ? Font.width(f.src, 3) + 40 : 0)));
    let ss = big ? 3 : 2, lh = big ? 33 : 24;
    if (big && Font.wrap(f.sub, Math.floor(room / 18)).length > 2) { ss = 2; lh = 24; }
    const subLines = wrapN(f.sub, Math.floor(room / (6 * ss)), 2);
    subLines.forEach((l, i) => {
      Font.drawCentered(ctx, l, x + w / 2, y + 60 + 9 * s + i * lh, ss, P.white, null);
      hitCentered(l, x + w / 2, y + 60 + 9 * s + i * lh, ss, f.sub, 'figure');
    });
    if (f.src) badge(f.src, x + w - 20, y + h - 20 - 36, true);
  }

  // A billboard item: a figure id, or an inline { text, sub } (no source badge).
  function itemOf(it) {
    if (typeof it === 'string') return FIGURES[it] || { value: it, sub: '' };
    return { value: it.text, sub: it.sub || '', src: '', split: it.split, roots: it.roots };
  }

  // layout: 'stack' puts every step shown so far on the board, one row each:
  // the value on the left with its source under it, the words wrapped to two
  // lines on the right. Nothing in a row reaches the next column or row.
  function drawStack(st, f, p, x, y, w, h) {
    const rows = [...st.prev, st.item], n = rows.length, rh = Math.floor((h - 32) / Math.max(3, n));
    const subX = x + w * 0.48, subChars = Math.floor((x + w - 40 - subX) / 12);
    rows.forEach((it, i) => {
      const g = itemOf(it), last = i === n - 1;
      const srcH = g.src ? 22 : 0;
      const s = Math.max(2, Math.min(5, fitScale(g.value, w * 0.48 - 52, 5), Math.floor((rh - 4 - srcH) / 9)));
      const sub = wrapN(g.sub, subChars, 2);
      const valH = 9 * s + srcH, subH = sub.length * 22 - 4;
      const top = y + 16 + i * rh + Math.max(0, (rh - Math.max(valH, subH)) / 2);
      const v = last ? countText(g.value, p, g.count) : g.value;
      Font.draw(ctx, v, x + 40, top, s, P.yellow, P.plum);
      hit(x + 40, top, Font.width(g.value, s), 9 * s, g.value, 'figure');
      if (g.src) Font.draw(ctx, g.src, x + 40, top + 9 * s + 4, 2, P.cyan, null);
      const sy = top + Math.max(0, (valH - subH) / 2);
      sub.forEach((l, k) => {
        Font.draw(ctx, l, subX, sy + k * 22, 2, P.white, null);
        hit(subX, sy + k * 22, Font.width(l, 2), 18, g.sub, 'figure');
      });
    });
  }

  // split: n cuts the word after n letters: it pulls apart, the two roots
  // show under the halves, and it joins again (COMPANION: cum + panis).
  function drawSplit(f, age, x, y, w, h) {
    const k = f.split, a = f.value.slice(0, k), b = f.value.slice(k);
    const s = fitScale(f.value, w - 240, 8);
    const T = 5, u = Math.min(1, Math.max(0, age < 1 ? 0 : age < 2 ? age - 1 : age < 1 + T ? 1 : age < 2 + T ? 2 + T - age : 0));
    const gap = Math.round(easeOut(u) * 160), tw = Font.width(f.value, s);
    // The second half starts one full advance after the first (Font.width
    // leaves off the trailing space, which made COM and PANION touch).
    const x0 = x + (w - tw) / 2, ax = x0 - gap / 2, bx2 = x0 + a.length * Font.ADV * s + gap / 2;
    Font.draw(ctx, a, ax, y + 40, s, P.yellow, P.plum);
    Font.draw(ctx, b, bx2, y + 40, s, P.yellow, P.plum);
    hit(x0, y + 40, tw, 9 * s, f.value, 'figure');
    const roots = (f.roots || []);
    if (u > 0.5 && roots.length === 2) {
      Font.drawCentered(ctx, roots[0], ax + Font.width(a, s) / 2, y + 60 + 9 * s, 3, P.cyan, null);
      Font.drawCentered(ctx, roots[1], bx2 + Font.width(b, s) / 2, y + 60 + 9 * s, 3, P.cyan, null);
    } else {
      // The words wrap to the board: two lines at scale 3, else scale 2.
      let ss = 3;
      if (Font.wrap(f.sub, Math.floor((w - 80) / 18)).length > 2) ss = 2;
      wrapN(f.sub, Math.floor((w - 80) / (6 * ss)), 2).forEach((l, i) => {
        const ly = y + 60 + 9 * s + i * (11 * ss);
        Font.drawCentered(ctx, l, x + w / 2, ly, ss, P.white, null);
        hitCentered(l, x + w / 2, ly, ss, f.sub, 'figure');
      });
    }
  }

  function badge(src, rx, y, alignRight) {
    const s = 3, tw = Font.width(src, s), bw = tw + 20;
    const x = alignRight ? rx - bw : rx;
    ctx.fillStyle = P.plum; ctx.fillRect(x, y, bw, 36);
    Font.draw(ctx, src, x + 10, y + 5, s, P.white, null);
    return bw;
  }

  // ------------------------------------------------------------ text hit boxes
  // Every piece of level text drawn this frame, as a screen rect (1280×800
  // canvas px) and the ORIGINAL string from levels.js it came from (the whole
  // lines[i] entry, not the wrapped or paged part). Edit mode clicks these.
  const HITS = [];
  function hit(x, y, w, h, src, kind) {
    if (EDIT && typeof src === 'string' && src) HITS.push({ x, y, w, h, src, kind });
  }
  function hitCentered(text, cx, y, s, src, kind) { const w = Font.width(text || '', s); hit(cx - w / 2, y, w, 9 * s, src, kind); }
  // A panel drawn over earlier text hides it: drop those hit boxes, so hidden
  // text is neither clickable nor underlined.
  function occlude(x, y, w, h) {
    for (let i = HITS.length - 1; i >= 0; i--) { const t = HITS[i]; if (t.x < x + w && t.x + t.w > x && t.y < y + h && t.y + t.h > y) HITS.splice(i, 1); }
  }

  // ------------------------------------------------------------ render: UI
  // "3" for a chain level, "Q&A" (or the level's `tag`) for an appendix.
  function levelTag(i) { const d = LV[i].def; return d.appendix ? (d.tag || 'Q&A') : String(i + 1); }
  function renderHUD() {
    const L = G.L.def;
    const dialogCard = G.mode === 'dialog' && G.dlg.card;
    if (!dialogCard) {
      const head = `${levelTag(G.level)} · ${L.title}`;
      plate(head, 24, 20, 3, P.white);
      hit(24, 20, Font.width(head, 3), 27, L.title, 'title');
      // The capability stamp belongs to the engine demo, not the talk.
      if (DEMO && L.capability) {
        const cap = `DEMO ${G.level + 1}/${LV.length} · ${L.capability}`;
        plate(cap, SW - 24 - Font.width(cap, 2), 22, 2, P.yellow);
        hit(SW - 24 - Font.width(cap, 2), 22, Font.width(cap, 2), 18, L.capability, 'capability');
        G.stampDrawn = true;
      }
    }
    if (EDIT && !dialogCard) renderPromptPlates();
    if (G.crowd.on && (DEMO || EDIT)) renderCrowdDot();
    if (G.help && G.mode === 'play') renderHelp();
  }

  function keyHint() {
    const own = LV.find((L) => L.def.key !== undefined);
    return `1–${Math.min(9, LV.filter((L) => !L.def.appendix).length)}` + (own ? ` · ${own.def.key} ${own.def.tag || (own.def.appendix ? 'Q&A' : own.def.title)}` : '');
  }
  function renderHelp() {
    const lines = G.touch
      ? ['TOUCH  D-pad walk · A talk / next · B back (hold to run)', '< > buttons: previous / next level · middle button: menu']
      : ['KEYS  arrows or WASD walk · Space or Enter talk · Backspace back · Shift run',
        `LEVELS  E ] PageDown next · Q [ PageUp previous · M menu · ${keyHint()} jump`,
        'PAD  stick walk · A talk · B back/run · RB LB level · Start menu'];
    lines.push(G.touch ? 'this hides after your first talk' : 'H (pad Y) hides this · it also hides after your first talk');
    const w = Math.max(...lines.map((l) => Font.width(l, 2))) + 40, h = lines.length * 26 + 28;
    const x = (SW - w) / 2, y = SH - 24 - h;
    ctx.fillStyle = 'rgba(26,28,44,0.9)'; ctx.fillRect(x, y, w, h); occlude(x, y, w, h);
    ctx.fillStyle = P.yellow; ctx.fillRect(x, y, w, 3);
    lines.forEach((l, i) => Font.draw(ctx, l, x + 20, y + 16 + i * 26, 2, i === lines.length - 1 ? P.silver : P.white, null));
  }

  function renderDialog() {
    const d = G.dlg;
    // The card goes on top, unless the player is up there: then it sits just
    // above the dialog box so neither the speaker nor the player is hidden.
    // It also goes low when a lit billboard is up there (so the card does
    // not hide the board's number), unless that would cover the player.
    const cam = camera();
    if (d.big && crowdVisible() && G.crowd.qr) drawBigQr();
    else if (d.card) {
      const py = (cam.py - cam.cy) * UP, ch = cardHeight(d.card), lowTop = SH - 24 - 180 - 50 - ch;
      const boardLit = G.L.things.some((t) => t.type === 'billboard' && G.boards[t.id] && (t.y * TS - cam.cy) * UP < 16 + ch);
      const playerLow = py + TS * UP > lowTop && py < lowTop + ch;
      renderCard(d.card, G.time - d.cardT0, py < 360 || (boardLit && !playerLow));
    }
    const x = 24, w = SW - 48, h = 180, y = SH - 24 - h;
    ctx.fillStyle = P.ink; ctx.fillRect(x - 4, y - 4, w + 8, h + 8); occlude(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = P.magenta; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.navy; ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
    if (d.name) {
      const nw = Font.width(d.name, 3) + 32;
      ctx.fillStyle = P.ink; ctx.fillRect(x + 20, y - 46, nw + 8, 46); occlude(x + 20, y - 46, nw + 8, 46);
      ctx.fillStyle = P.navy; ctx.fillRect(x + 24, y - 42, nw, 42);
      Font.draw(ctx, d.name, x + 40, y - 34, 3, P.white, null);
      if (!d.crowd) hit(x + 40, y - 34, Font.width(d.name, 3), 27, d.name, 'name');
    }
    const page = d.pages[d.page];
    let budget = Math.floor(d.t * CPS);
    page.forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, budget));
      budget -= line.length + 1;
      Font.draw(ctx, shown, x + 36, y + 30 + i * 44, 4, P.white, null);
      if (!d.crowd) hit(x + 36, y + 30 + i * 44, Font.width(line, 4), 36, d.srcs[d.page], 'dialog');
    });
    if (d.t * CPS >= pageLen(page) && Math.floor(G.time * 2.5) % 2 === 0) {
      const last = d.page === d.pages.length - 1;
      ctx.fillStyle = last ? P.slate : P.cyan;
      const ax = x + w - 48, ay = y + h - 40;
      for (let i = 0; i < 6; i++) ctx.fillRect(ax + i * 2, ay + i * 2, 24 - i * 4, 2);
    }
  }

  function cardLayout(f) {
    const x = 24, w = SW - 48, pad = 28;
    const bw = Font.width(f.src, 3) + 20;
    const s = fitScale(f.value, w - pad * 2, 8);
    const sub = Font.wrap(f.sub, Math.floor((w - pad * 2 - bw - 24) / 18));
    const h = pad + 9 * s + 18 + sub.length * 33 + pad - 6;
    return { x, w, pad, s, sub, h };
  }
  function cardHeight(f) { return cardLayout(f).h; }
  function renderCard(f, age, below) {
    const { x, w, pad, s, sub, h } = cardLayout(f);
    const y = below ? SH - 24 - 180 - 50 - h : 16;
    ctx.fillStyle = P.ink; ctx.fillRect(x - 4, y - 4, w + 8, h + 8); occlude(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = P.navy; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.ink; ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
    Font.draw(ctx, countText(f.value, easeOut(Math.min(1, age / 1.4))), x + pad, y + pad, s, P.yellow, P.plum);
    hit(x + pad, y + pad, Font.width(f.value, s), 9 * s, f.value, 'figure');
    sub.forEach((l, i) => {
      Font.draw(ctx, l, x + pad, y + pad + 9 * s + 18 + i * 33, 3, P.white, null);
      hit(x + pad, y + pad + 9 * s + 18 + i * 33, Font.width(l, 3), 27, f.sub, 'figure');
    });
    badge(f.src, x + w - pad, y + h - pad - 30, true);
  }

  function renderMenu() {
    const m = G.menu;
    const rows = LV.map((l, i) => `${levelTag(i)}  ${l.def.title}`);
    const rh = rows.length > 8 ? 58 : 72, ts = rows.length > 8 ? 3 : 4;
    const x = 140, w = SW - 280, h = 96 + rows.length * rh, y = Math.max(8, (SH - h) / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = P.magenta; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = P.navy; ctx.fillRect(x, y, w, h);
    Font.draw(ctx, 'LEVELS', x + 40, y + 24, 4, P.cyan, null);
    rows.forEach((r, i) => {
      const ry = y + 84 + i * rh;
      const sel = i === m.sel;
      if (sel) { ctx.fillStyle = P.magenta; ctx.fillRect(x + 20, ry - 8, w - 40, rh - 6); Font.draw(ctx, '→', x + 30, ry, ts, P.ink, null); }
      Font.draw(ctx, r, x + 80, ry, ts, sel ? P.ink : P.white, null);
      const sub = LV[i].def.capability || '';
      Font.draw(ctx, sub, x + 80, ry + 11 * ts + 4, 2, sel ? P.ink : P.silver, null);
    });
  }

  function renderTransition() {
    const tr = G.trans, t = tr.t;
    let cover; // 0 = open, 1 = black
    if (t < TR_OUT) cover = t / TR_OUT;
    else if (t < TR_OUT + TR_HOLD) cover = 1;
    else cover = 1 - (t - TR_OUT - TR_HOLD) / TR_IN;
    const bands = 10, bh = SH / bands;
    const entering = t >= TR_OUT;
    for (let i = 0; i < bands; i++) {
      // Staggered bands, snapped to 16 px steps: a pixel-art curtain.
      const local = Math.max(0, Math.min(1, cover * 1.45 - (i % 2 ? 0.2 : 0) - i * 0.025));
      const w = Math.ceil(local * SW / 16) * 16;
      if (!w) continue;
      const fromRight = (tr.dir > 0) !== entering;
      ctx.fillStyle = '#000';
      ctx.fillRect(fromRight ? SW - w : 0, i * bh, w, bh);
      ctx.fillStyle = i % 2 ? P.cyan : P.magenta;
      if (w < SW) ctx.fillRect(fromRight ? SW - w : w - 8, i * bh, 8, bh);
    }
    if (t >= TR_OUT * 0.9 && t < TR_OUT + TR_HOLD + TR_IN * 0.2) {
      const L = LV[tr.to].def;
      const head = `${levelTag(tr.to)} · ${L.title.toUpperCase()}`;
      Font.drawCentered(ctx, head, SW / 2, SH / 2 - 40, 6, P.white, null);
      hitCentered(head, SW / 2, SH / 2 - 40, 6, L.title, 'title');
      if (DEMO && L.capability) Font.drawCentered(ctx, L.capability, SW / 2, SH / 2 + 40, 3, P.yellow, null);
    }
  }

  // The end: white (the level's `endWhite` seconds, default 2), then black.
  function renderEnd() {
    const white = G.L.def.endWhite !== undefined ? G.L.def.endWhite : 2;
    ctx.fillStyle = G.time - G.end.t0 < white ? P.white : '#000';
    ctx.fillRect(0, 0, SW, SH);
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    HITS.length = 0; G.stampDrawn = false;
    G.crowd.drawn = { qr: null, chars: [], bubbles: [], tally: null, dot: false, icons: [] };
    renderWorld();
    renderHUD();
    if (G.mode === 'dialog') renderDialog();
    // Text under an overlay is hidden, so it must not be clickable either.
    if (G.end) { HITS.length = 0; renderEnd(); }
    if (G.mode === 'menu') { HITS.length = 0; renderMenu(); }
    if (G.trans) { HITS.length = 0; renderTransition(); HITS.length = 0; }
    if (G.blackout) HITS.length = 0;
    if (EDIT) Edit.overlay();
    if (G.blackout) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); }
  }

  // ------------------------------------------------------------ main loop
  // Time: a frame's gap is clamped to 0.25 s and run as fixed steps of at
  // most 0.05 s, so at 10 fps a transition or a walk takes the same wall time
  // as at 60. A gap over 1 s (a hidden tab, a laptop asleep) is dropped.
  // One error never stops the loop: it is logged once per message, and the
  // next frame runs anyway.
  const STEP = 0.05, MAX_DT = 0.25;
  let last = null;
  const errorsSeen = new Set();
  function guard(fn) {
    try { fn(); } catch (e) {
      const m = String((e && e.message) || e);
      if (!errorsSeen.has(m)) { errorsSeen.add(m); console.error('[game] ' + m, e); }
      // Never leave a mode without its state.
      if (G.mode === 'dialog' && !G.dlg) G.mode = 'play';
      if (G.mode === 'menu' && !G.menu) G.mode = 'play';
    }
  }
  let frameCount = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    frameCount++;
    let dt = last === null ? 0 : (now - last) / 1000; last = now;
    if (!(dt >= 0) || dt > 1) dt = 0;
    dt = Math.min(dt, MAX_DT);
    guard(pollPad);
    if (G.paused) G.time += dt;
    else {
      let left = dt;
      do { const h = Math.min(STEP, left); G.time += h; guard(() => update(h)); left -= h; } while (left > 1e-6);
    }
    guard(render);
  }

  function levelFromHash() {
    const m = location.hash.match(/level=(\d+)/);
    return m ? Math.max(0, Math.min(LV.length - 1, +m[1] - 1)) : 0;
  }
  addEventListener('hashchange', () => { const i = levelFromHash(); if (i !== G.level) goLevel(i); });

  // Re-read window.LEVELS and re-enter the current level as it was: the player
  // where they stand, every level's boards, sequences, controls and the
  // end kept, and an open dialog reopened on the same text (`focus`, if
  // given, picks the page). Billboards are re-read from the new definitions,
  // so edited inline text shows at once. Used by edit mode after a save, and
  // by the smoke test's bad-data cases.
  function rebind(state, L) {
    if (!state || !L) return;
    for (const [id, b] of Object.entries(state.boards)) {
      const src = b && b.src, t = src && L.things[src.i];
      if (!t) continue;
      let nb = null;
      if (src.start) nb = t.start ? { item: t.start, fig: typeof t.start === 'string' ? t.start : null, prev: [] } : null;
      else {
        let a = actionsOf(t)[src.a];
        if (a && src.then) a = a.then;
        nb = a && boardFor(a, src.k || 0, src);
      }
      if (nb) state.boards[id] = { ...nb, t0: b.t0, src };
    }
  }
  function recompile(focus) {
    const p = G.player, keep = { x: p.x, y: p.y, dir: p.dir, dlg: G.dlg, end: G.end };
    dataErrors.length = 0;
    LV = LEVELS.map(compile);
    loadLevel(Math.min(G.level, LV.length - 1));
    for (const [i, state] of Object.entries(STORE)) if (+i !== G.level) rebind(state, LV[i]);
    rebind(G, G.L);
    const L = G.L;
    const x = Math.max(0, Math.min(L.W - 1, keep.x)), y = Math.max(0, Math.min(L.H - 1, keep.y));
    Object.assign(G.player, { x, y, fx: x, fy: y, t: 1, dir: keep.dir });
    G.end = keep.end;
    const d = keep.dlg, f = d && d.from;
    if (f) {
      const src = L.things[f.i];
      const sq = f.field === 'steps' && src ? actionsOf(src).find((a) => a.do === 'sequence') : null;
      const step = sq && sq.steps[f.step];
      const lines = sq ? step && step.lines : src && src[f.field || 'lines'];
      const card = sq ? step && step.card : d.args.card;
      const cards = f.field === 'lines' && src ? src.cards : null;
      if (src && openDialog({ name: src.name, lines, card, cards, onClose: d.onClose, from: f })) {
        const at = G.dlg.srcs.indexOf(focus);
        setPage(G.dlg, at >= 0 ? at : Math.min(d.page, G.dlg.pages.length - 1));
        G.dlg.t = 999; G.dlg.cardT0 = G.time - 10;
      }
    }
    return dataErrors.slice();
  }


  // ------------------------------------------------------------ edit mode
  // http://127.0.0.1:8790/index.html?edit (node game/edit_server.mjs). Click
  // any level text: the game pauses and a box opens with the whole source
  // string. Enter or clicking away saves, Shift+Enter is a newline, Esc
  // cancels. The server rewrites that one literal in levels.js, and the page
  // reloads levels.js and re-enters the level where the player stands.
  // Dotted yellow underline: draft, not traceable to ../talk_script.md.
  // Dotted red underline: a tell (tells.js). T lists this level's tells.
  // None of this exists on file://: EDIT is false there.
  function makeEdit() {
    const st = { open: null, tracer: null, panel: false, panelKey: '', version: 0, lastMsg: '', hover: null };
    const tellCache = new Map();

    const css = document.createElement('style');
    css.textContent = `
      #edit-box { position: fixed; z-index: 20; display: none; box-sizing: border-box; margin: 0;
        font: 18px/1.35 ui-monospace, Menlo, monospace; color: #1a1c2c; background: #fffbea;
        border: 3px solid #ffcd75; border-radius: 4px; padding: 8px 10px; resize: both;
        -webkit-user-select: text; user-select: text; box-shadow: 0 6px 24px rgba(0,0,0,.6); }
      #edit-msg { position: fixed; z-index: 21; left: 50%; top: 10px; transform: translateX(-50%); max-width: 80vw;
        font: 15px/1.4 ui-monospace, Menlo, monospace; padding: 8px 14px; border-radius: 4px; display: none;
        background: #38b764; color: #fff; cursor: pointer; }
      #edit-msg.err { background: #b13e53; }
      #edit-panel { position: fixed; z-index: 19; right: 8px; top: 8px; width: 440px; max-height: 70vh; overflow: auto;
        font: 13px/1.4 ui-monospace, Menlo, monospace; background: rgba(26,28,44,.94); color: #f4f4f4;
        border: 2px solid #b13e53; padding: 8px 10px; display: none; }
      #edit-panel b { color: #ffcd75; font-weight: normal; } #edit-panel i { color: #ef7d57; font-style: normal; }
      #edit-panel li { margin-bottom: 6px; } #edit-panel ul { padding-left: 16px; margin: 4px 0; }
      #edit-tag { position: fixed; z-index: 19; left: 8px; bottom: 8px; font: 12px ui-monospace, Menlo, monospace;
        color: #ffcd75; background: rgba(26,28,44,.8); padding: 3px 7px; pointer-events: none; }`;
    document.head.appendChild(css);
    const el = (tag, id) => { const e = document.createElement(tag); e.id = id; document.body.appendChild(e); return e; };
    const ta = el('textarea', 'edit-box'), banner = el('div', 'edit-msg'), panel = el('div', 'edit-panel'), tag = el('div', 'edit-tag');
    ta.spellcheck = true;
    tag.textContent = 'EDIT MODE · click text to edit · T tells · yellow = draft, red = tell';
    banner.addEventListener('click', () => { banner.style.display = 'none'; });

    let bannerTimer = null;
    function msg(text, err) {
      st.lastMsg = text;
      banner.textContent = text; banner.className = err ? 'err' : ''; banner.style.display = 'block';
      clearTimeout(bannerTimer);
      if (!err) bannerTimer = setTimeout(() => { banner.style.display = 'none'; }, 4000);
    }

    // tells.js and the script are loaded only here, never on stage.
    const sc = document.createElement('script');
    sc.src = 'tells.js';
    sc.onload = () => {
      fetch('talk_script.md', { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((t) => { st.tracer = window.Tells.makeTracer(t); })
        .catch((e) => msg('talk_script.md not loaded (' + e.message + '): no draft underlines', true));
    };
    document.head.appendChild(sc);

    function toCanvas(e) {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * SW / r.width, y: (e.clientY - r.top) * SH / r.height };
    }
    // Text can be clicked only in play or a dialog: never under the menu, the
    // end, a transition or the blackout.
    const live = () => (G.mode === 'play' || G.mode === 'dialog') && !G.end && !G.trans && !G.blackout;
    function findHit(x, y) {
      if (!live()) return null;
      for (let i = HITS.length - 1; i >= 0; i--) {
        const h = HITS[i];
        if (x >= h.x - 4 && x <= h.x + h.w + 4 && y >= h.y - 4 && y <= h.y + h.h + 4) return h;
      }
      return null;
    }
    const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;
    const isDraft = (h) => !!st.tracer && h.kind !== 'figure' && wordCount(h.src) > 3 && !st.tracer(h.src);
    function tells(src) {
      if (!window.Tells) return [];
      if (!tellCache.has(src)) tellCache.set(src, window.Tells.check(src));
      return tellCache.get(src);
    }
    function describe(h) {
      const out = [h.kind + ': click to edit'];
      if (isDraft(h)) out.push('draft — not your words (not traceable to talk_script.md)');
      for (const t of tells(h.src)) out.push('tell · ' + t.rule + ': ' + t.msg);
      return out.join('\n');
    }

    cv.addEventListener('mousemove', (e) => {
      const p = toCanvas(e), h = findHit(p.x, p.y);
      st.hover = h;
      cv.style.cursor = h ? 'text' : '';
      cv.title = h ? describe(h) : '';
    });
    cv.addEventListener('click', (e) => {
      if (st.open) return;
      const p = toCanvas(e), h = findHit(p.x, p.y);
      if (h) openEditor(h);
    });
    addEventListener('keydown', (e) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') { st.panel = !st.panel; st.panelKey = ''; panel.style.display = st.panel ? 'block' : 'none'; }
    });

    function openEditor(h) {
      st.open = { src: h.src, kind: h.kind, hit: { x: h.x, y: h.y, w: h.w, h: h.h } };
      G.paused = true;
      place(st.open.hit, h.src);
      ta.value = h.src;
      ta.style.display = 'block';
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    // Put the box over the text it edits (again on every resize).
    function place(h, text) {
      const r = cv.getBoundingClientRect(), k = r.width / SW;
      const w = Math.min(innerWidth - 16, Math.max(h.w * k + 24, 480));
      const rows = Math.min(10, Math.max(2, Math.ceil(text.length / Math.max(20, (w - 24) / 11)) + 1));
      const hgt = rows * 24 + 22;
      ta.style.width = w + 'px'; ta.style.height = hgt + 'px';
      ta.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + h.x * k - 12)) + 'px';
      ta.style.top = Math.max(8, Math.min(innerHeight - hgt - 8, r.top + h.y * k - 10)) + 'px';
    }
    addEventListener('resize', () => { if (st.open) place(st.open.hit, ta.value); });
    function closeEditor() {
      st.open = null;
      ta.style.display = 'none';
      if (document.activeElement === ta) ta.blur();
      G.paused = false;
      queue.length = 0; releaseKeys();   // nothing typed leaks into the game
    }
    function commit() {
      if (!st.open) return;
      const old = st.open.src, nv = ta.value;
      closeEditor();
      if (nv !== old) save(old, nv);
    }
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
    });
    ta.addEventListener('keyup', (e) => e.stopPropagation());
    // Clicking elsewhere in the page saves; switching to another window or
    // tab does not (the box is still open when you come back).
    ta.addEventListener('blur', () => { if (document.hidden || !document.hasFocus()) return; commit(); });

    async function save(old, nv) {
      let res, body = {};
      try {
        res = await fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old, new: nv }) });
        body = await res.json().catch(() => ({}));
      } catch (e) { msg('Not saved: ' + e.message + ' (is edit_server.mjs running?)', true); return { ok: false, status: 0, error: e.message }; }
      if (!res.ok) { msg(`Not saved (${res.status}): ${body.error || res.statusText}`, true); return { ok: false, status: res.status, error: body.error }; }
      const missing0 = new Set(Font.missing);
      await reload(nv);
      // Let a frame or two draw the new text, so a glyph the font lacks shows up.
      await new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 400); });
      const glyphs = [...Font.missing].filter((c) => !missing0.has(c));
      const saved = body.unchanged ? 'No change.' : `Saved levels.js line ${body.line}`;
      if (dataErrors.length || glyphs.length) {
        const why = [];
        if (dataErrors.length) why.push(`${dataErrors.length} level data problem(s): ${dataErrors[0]}`);
        if (glyphs.length) why.push(`the font has no glyph for ${glyphs.map((c) => JSON.stringify(c)).join(' ')}`);
        msg(`${saved}, but ${why.join('; ')}. Fix it in levels.js.`, true);
        return { ok: true, status: res.status, line: body.line, problems: dataErrors.slice(), glyphs };
      }
      msg(body.unchanged ? saved : saved + '.');
      return { ok: true, status: res.status, line: body.line };
    }

    function reload(focus) {
      return new Promise((resolve) => {
        for (const s of document.querySelectorAll('script[src]')) if (/(^|\/)levels\.js(\?|$)/.test(s.getAttribute('src'))) s.remove();
        const s = document.createElement('script');
        s.src = 'levels.js?v=' + Date.now();
        s.onload = () => { rebuild(focus); resolve(true); };
        s.onerror = () => { msg('Could not reload levels.js', true); resolve(false); };
        document.body.appendChild(s);
      });
    }

    // Re-validate the deck and re-enter the level: see recompile().
    function rebuild(focus) {
      recompile(focus);
      st.version++;
    }

    function dotted(x, y, w, col) {
      for (let xx = x; xx < x + w; xx += 8) {
        const len = Math.min(5, x + w - xx);
        ctx.fillStyle = P.ink; ctx.fillRect(xx - 1, y - 1, len + 2, 5);   // dark edge: readable on white and on dark
        ctx.fillStyle = col; ctx.fillRect(xx, y, len, 3);
      }
    }
    function refreshPanel() {
      const key = G.level + ':' + st.version + ':' + !!st.tracer + ':' + !!window.Tells;
      if (key === st.panelKey) return;
      st.panelKey = key;
      if (!window.Tells) { panel.textContent = 'tells.js not loaded'; return; }
      const items = window.Tells.levelStrings(G.L.def, FIGURES);
      const res = window.Tells.checkAll(items.map((i) => i.src));
      const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const rows = [];
      items.forEach((it, i) => {
        const draft = isDraft({ src: it.src, kind: it.kind });
        if (!res[i].length && !draft) return;
        const what = res[i].map((r) => `<i>${r.rule}</i> ${esc(r.msg)}`);
        if (draft) what.unshift('<b>draft</b> not traceable to talk_script.md');
        rows.push(`<li>${esc(it.kind)} “${esc(it.src.length > 70 ? it.src.slice(0, 70) + '…' : it.src)}”<br>${what.join('<br>')}</li>`);
      });
      panel.innerHTML = `<div>Level ${G.level + 1}: ${rows.length} flagged · T hides</div><ul>${rows.join('')}</ul>`;
    }

    function overlay() {
      if (!live()) { st.hover = null; cv.style.cursor = ''; cv.title = ''; if (st.panel) refreshPanel(); return; }
      for (const h of HITS) {
        const y = h.y + h.h + 2;
        if (isDraft(h)) dotted(h.x, y, h.w, P.yellow);
        if (tells(h.src).length) dotted(h.x + 4, y + 4, h.w - 4, P.red);
      }
      const h = st.hover;
      if (h && HITS.includes(h)) { ctx.strokeStyle = P.yellow; ctx.lineWidth = 1; ctx.strokeRect(h.x - 3.5, h.y - 3.5, h.w + 7, h.h + 7); }
      if (st.panel) refreshPanel();
    }

    return {
      overlay, save, reload,
      hits: () => HITS.map((h) => ({ ...h, draft: isDraft(h), tells: tells(h.src).map((t) => t.rule) })),
      get open() { return st.open ? { ...st.open, value: ta.value } : null; },
      get lastMsg() { return st.lastMsg; },
      get version() { return st.version; },
      get ready() { return !!st.tracer; },
    };
  }
  const Edit = EDIT ? makeEdit() : null;

  setupTouch();
  G.crowd.drawn = { qr: null, chars: [], bubbles: [], tally: null, dot: false, icons: [] };
  loadLevel(levelFromHash());
  crowdConnect();
  fit();
  requestAnimationFrame(frame);

  // What the crowd client knows and drew last frame (tests, rehearsal).
  function crowdState() {
    const C = G.crowd, D = C.drawn;
    return {
      on: C.on, url: C.url, status: C.status, visible: crowdVisible(), killed: C.killed, localKill: C.localKill,
      room: C.room, link: C.link, qr: C.qr ? C.qr.size : null, prompt: C.prompt, snapshots: C.snapshots,
      people: C.people.length, blurbs: C.blurbs.length, questions: C.questions.length,
      tallies: JSON.parse(JSON.stringify(C.tallies)),
      entry: CW.entry, level: CW.level,
      drawn: { qr: D.qr, bigqr: D.bigqr || null, tally: D.tally, dot: D.dot, bubbles: D.bubbles.slice(), icons: (D.icons || []).slice(),
        chars: D.chars.map((c) => ({ key: c.key, id: c.id, name: c.name, sprite: c.sprite, x: c.x, y: c.y, talks: !!c.lines.length, bubble: !!c.text,
          icon: c.icon, gold: !!c.gold, votes: c.votes, entering: c.w.entering || c.w.wait > 0, moving: c.w.t < 1, rule: c.rule ? c.rule.kind + ':' + c.rule.x : null })) },
    };
  }

  // A small window for the smoke test and for rehearsal from the console.
  window.__game = {
    get state() {
      return {
        level: G.level, mode: G.mode, x: G.player.x, y: G.player.y, dir: G.player.dir, moving: G.player.t < 1,
        trans: !!G.trans,
        dialog: G.dlg ? { name: G.dlg.name, page: G.dlg.page, pages: G.dlg.pages.length, card: G.dlg.cardId } : null,
        ctl: { ...G.ctl }, fx: Object.keys(G.fx), end: G.end ? (G.time - G.end.t0 < (G.L.def.endWhite !== undefined ? G.L.def.endWhite : 2) ? 'white' : 'black') : null,
        seq: { ...G.seq },
        boards: Object.fromEntries(Object.entries(G.boards).map(([k, v]) => [k, v.tally ? 'tally:' + v.tally : typeof v.item === 'string' ? v.item : v.item.text])), lanes: laneState(), blackout: G.blackout, touch: G.touch, help: G.help,
        pad: padName, paused: G.paused, stamp: G.stampDrawn, demo: DEMO, edit: EDIT,
        crowd: crowdState(),
      };
    },
    // TouchDesigner: window.__game.input('left', 1) … window.__game.input('left', 0).
    // Returns false for an unknown action.
    input: hookInput,
    edit: Edit,
    teleport(x, y, dir) { Object.assign(G.player, { x, y, fx: x, fy: y, t: 1, dir: dir || G.player.dir }); },
    problems() { return { data: dataErrors.slice(), glyphs: [...Font.missing], art: Art.warnings.slice() }; },
    // Re-read window.LEVELS in place (tests and rehearsal): returns the data problems.
    recompile: () => recompile(),
    // Frames the loop has run and errors it has caught (the loop must never stop).
    get frames() { return frameCount; },
    errors: () => [...errorsSeen],
  };
})();
