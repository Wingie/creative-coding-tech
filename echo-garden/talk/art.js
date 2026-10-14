// art.js — palette, tiles, people and objects, all drawn in code.
//
// The look is synthwave: a deep violet sky with stars, a striped sun, wire
// mountains on the horizon, and a neon floor grid that runs to a vanishing
// point. Nothing is loaded: every tile and sprite is painted here into small
// canvases, so the game works from file:// with no image files at all. The
// renderer copies them nearest-neighbour, ×4.
//
// window.ATLAS (atlas.js) is still read, so a sheet can be mapped back in
// later, but it ships empty.
(function () {
  'use strict';

  // The palette, under the role names the engine uses.
  const P = {
    ink: '#0b0221', plum: '#3b1670', red: '#ff5c7a', orange: '#ff8c3a',
    yellow: '#ffe14d', lime: '#39ff9f', green: '#2bd47f', teal: '#1b6b8a',
    navy: '#150536', blue: '#2a0a52', sky: '#7a5cff', cyan: '#22e6ff',
    white: '#f4e9ff', silver: '#a38cc8', slate: '#5a3f8c', dark: '#1a0840',
    brown: '#8a3a6a', dbrown: '#4a1f4a', sand: '#c8a2ff', skin: '#ffcba9',
    brick: '#ff2b8a', cream: '#fce2ca', magenta: '#ff2bd6', sun: '#ffb238',
  };

  const warnings = []; // read by the smoke test

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }

  // Small deterministic RNG so the art is identical on every run.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Paint a sprite from rows of palette letters ('.' = transparent).
  function paintRows(x, rows, map, ox = 0, oy = 0, name = '?') {
    rows.forEach((r, y) => {
      if (r.length !== rows[0].length) warnings.push(`sprite ${name} row ${y} is ${r.length} wide`);
      for (let i = 0; i < r.length; i++) {
        const col = map[r[i]];
        if (col) { x.fillStyle = col; x.fillRect(ox + i, oy + y, 1, 1); }
      }
    });
  }

  function R(x, col, px, py, w, h) { x.fillStyle = col; x.fillRect(px, py, w, h); }

  // ---------------------------------------------------------------- tiles
  function makeTile(fn, seed) { const [c, x] = canvas(16, 16); fn(x, rng(seed)); return c; }

  function sky(x, r) {
    R(x, P.ink, 0, 0, 16, 16);
    for (let i = 0; i < 3; i++) R(x, r() < 0.3 ? P.cyan : P.silver, (r() * 16) | 0, (r() * 16) | 0, 1, 1);
    if (r() < 0.25) { const sx = 2 + ((r() * 12) | 0), sy = 2 + ((r() * 12) | 0); R(x, P.white, sx, sy, 1, 1); R(x, P.slate, sx - 1, sy, 1, 1); R(x, P.slate, sx + 1, sy, 1, 1); }
  }
  // The low sky: violet bands that warm toward the horizon.
  const BANDS = ['#1d0641', '#25084c', '#2f0a56', '#3b0c5e', '#4a0f66', '#5c126c', '#701671', '#861a74'];
  function lowSky(x) { BANDS.forEach((c, i) => R(x, c, 0, i * 2, 16, 2)); }
  // Wire mountains on the low sky, a cyan ridge line.
  function mountains(x, r) {
    lowSky(x);
    let h = 6 + ((r() * 6) | 0);
    for (let i = 0; i < 16; i++) {
      h = Math.max(3, Math.min(13, h + ((r() * 3) | 0) - 1));
      R(x, P.navy, i, 16 - h, 1, h); R(x, P.cyan, i, 16 - h, 1, 1);
      if (i % 4 === 0) R(x, P.teal, i, 17 - h, 1, h - 1);
    }
  }
  // A city of lit windows on the low sky.
  function skyline(x, r) {
    lowSky(x);
    let px = 0;
    while (px < 16) {
      const w = 3 + ((r() * 3) | 0), h = 5 + ((r() * 9) | 0);
      R(x, P.ink, px, 16 - h, w, h);
      for (let wy = 17 - h; wy < 15; wy += 2) for (let wx = px + 1; wx < px + w - 1; wx += 2) if (r() < 0.4) R(x, r() < 0.5 ? P.magenta : P.cyan, wx, wy, 1, 1);
      px += w + 1;
    }
  }
  // The billboard bed (the engine draws the board itself over it).
  function board(x) { R(x, P.dark, 0, 0, 16, 16); R(x, P.plum, 0, 15, 16, 1); }
  // A neon palm against the sky.
  const PALM = [
    '..mm.....mm.....', '.m..mm.mm..mm...', 'm.....mm.....m..', '....mmmmmm......', '...m..mm..mm....', '..m...k.....m...',
    '......k.........', '......k.........', '.......k........', '.......k........', '.......k........', '.......k........',
    '.......k........', '......kk........', '......kk........', '.....kkkk.......',
  ];
  function palm(x, r) { lowSky(x); paintRows(x, PALM, { m: P.magenta, k: P.ink }, 0, 0, 'palm'); }
  // A rack of gear: knobs and LEDs (decor, solid).
  function rack(x, r) {
    R(x, P.ink, 0, 0, 16, 16); R(x, P.plum, 1, 1, 14, 14); R(x, P.dark, 2, 2, 12, 5); R(x, P.dark, 2, 9, 12, 5);
    for (let i = 0; i < 4; i++) { R(x, r() < 0.5 ? P.cyan : P.magenta, 3 + i * 3, 3, 1, 1); R(x, P.silver, 3 + i * 3, 11, 2, 2); }
  }
  // A neon gate: the way out of a room.
  function gate(x) {
    R(x, P.ink, 0, 0, 16, 16);
    R(x, P.magenta, 1, 0, 2, 16); R(x, P.magenta, 13, 0, 2, 16); R(x, P.magenta, 1, 0, 14, 2);
    R(x, '#5c126c', 3, 2, 10, 14); R(x, '#861a74', 4, 3, 8, 13);
    for (let y = 4; y < 16; y += 3) R(x, P.cyan, 5, y, 6, 1);
  }

  const LEGEND = {
    ' ': { name: 'void', solid: true, draw: (x) => R(x, '#000', 0, 0, 16, 16) },
    '*': { name: 'night sky', solid: true, draw: sky },
    '^': { name: 'low sky', solid: true, draw: lowSky },
    'n': { name: 'wire mountains', solid: true, draw: mountains },
    'Y': { name: 'skyline', solid: true, draw: skyline },
    'T': { name: 'neon palm', solid: true, draw: palm },
    'M': { name: 'board / billboard', solid: true, draw: board },
    'K': { name: 'rack of gear', solid: true, draw: rack },
    '#': { name: 'neon floor grid', floor: true, draw: (x) => R(x, P.ink, 0, 0, 16, 16) },
    '=': { name: 'signal path', floor: true, path: true, draw: (x) => R(x, P.ink, 0, 0, 16, 16) },
    'D': { name: 'gate', draw: gate },
  };

  // Pre-render 3 variants per tile.
  const TILES = {};
  let seed = 1;
  for (const [ch, def] of Object.entries(LEGEND)) {
    const variants = [];
    for (let v = 0; v < 3; v++) variants.push(makeTile(def.draw, seed++ * 7919));
    TILES[ch] = variants;
  }

  // ---------------------------------------------------------------- the floor grid
  // Art.tileAt(map, x, y) draws the floor as one perspective grid: lines run
  // from a vanishing point above the room's centre, and the cross lines get
  // further apart toward the viewer. Each 16×16 cell is cut from that one
  // picture and cached, so the engine still draws tile by tile.
  const floorCache = new Map();
  const isFloor = (c) => !!(c && LEGEND[c] && LEGEND[c].floor);
  function floorTop(map) {
    for (let y = 0; y < map.length; y++) if ([...map[y]].some(isFloor)) return y;
    return 0;
  }
  function gridCell(map, x, y) {
    const top = floorTop(map), rows = map.length - top, W = map[0].length;
    const ch = map[y][x], path = LEGEND[ch].path;
    const key = `${W}|${rows}|${y - top}|${x}|${path ? 1 : 0}`;
    if (floorCache.has(key)) return floorCache.get(key);
    const [c, cx] = canvas(16, 16);
    const Y0 = 0, H = rows * 16, VX = W * 8, VY = -24;   // vanishing point, in floor pixels
    const gy = (y - top) * 16, gx = x * 16;
    for (let py = 0; py < 16; py++) {
      const fy = gy + py;                 // 0 at the horizon
      const depth = (fy - VY) / (H - VY); // 0 far … 1 near
      // background: a faint glow at the horizon
      cx.fillStyle = fy < 4 ? '#3b0c5e' : fy < 10 ? '#1d0641' : P.ink;
      cx.fillRect(0, py, 16, 1);
      // cross lines: evenly spaced in 1/depth
      const z = 1 / depth, zf = 1 / ((fy + 1 - VY) / (H - VY));
      if (Math.floor(z * 2.2) !== Math.floor(zf * 2.2) || fy === Y0) { cx.fillStyle = fy < 8 ? P.plum : P.magenta; cx.fillRect(0, py, 16, 1); }
      // long lines: through the vanishing point, 24 px apart at the bottom
      for (let k = -12; k <= 12; k++) {
        const bxp = VX + k * 24;
        const lx = VX + (bxp - VX) * depth;
        const px = Math.round(lx) - gx;
        if (px >= 0 && px < 16) { cx.fillStyle = Math.abs(k) % 4 === 0 ? P.cyan : P.magenta; cx.fillRect(px, py, 1, 1); }
      }
    }
    if (path) {
      // the signal path: a cable of light down the middle of the walkway
      R(cx, 'rgba(255,43,214,0.18)', 0, 3, 16, 10);
      R(cx, P.magenta, 0, 7, 16, 2); R(cx, P.white, 0, 7, 16, 1);
      R(cx, P.cyan, (x * 5) % 16, 7, 2, 1);
    }
    floorCache.set(key, c);
    return c;
  }
  function tileAt(map, x, y) {
    const ch = map[y] && map[y][x];
    return isFloor(ch) ? gridCell(map, x, y) : null;
  }

  // ---------------------------------------------------------------- people
  // One 16×16 body template, recoloured per character. Letters:
  // k outline, h hair, s skin, c jacket, p trousers, o shoes, e eyes, v visor.
  const HEAD = {
    down: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...',
      '...khsssssshk...', '...kvvvvvvvvk...', '...kssssssssk...', '....kssssssk....'],
    up: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...',
      '...khhhhhhhhk...', '...khhhhhhhhk...', '...kshhhhhhsk...', '....kssssssk....'],
    side: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...',
      '...khhhhsssssk..', '...khhhsvvvvvk..', '...khhsssssssk..', '....kssssssk....'],
  };
  const BODY = {
    down: ['...kcccccccck...', '..kcclcccclcck..', '..ksccccccccsk..', '...kppppppppk...', '...kpppkkpppk...'],
    up: ['...kcccccccck...', '..kcccccccccck..', '..ksccccccccsk..', '...kppppppppk...', '...kpppkkpppk...'],
    side: ['....kccccccck...', '....kcclccclk...', '....kcccsccck...', '....kppppppk....', '....kppppppk....'],
  };
  const LEGS = {
    down: [['...kppk..kppk...', '...kook..kook...'], ['...kppk...kpk...', '...kook...kk....'], ['...kpk...kppk...', '....kk...kook...']],
    side: [['.....kppppk.....', '.....koook......'], ['....kpk..kpk....', '...kok....kok...'], ['....kpk..kpk....', '...kok....kok...']],
  };
  LEGS.up = LEGS.down;

  // h hair, s skin, c jacket, l jacket trim (neon), p trousers, v visor or eyes.
  const PEOPLE = {
    player: { h: P.magenta, s: P.skin, c: P.navy, l: P.cyan, p: P.ink, v: P.cyan },
    performer: { h: P.ink, s: '#c68863', c: P.white, l: P.magenta, p: P.dark, v: P.ink },
    dancer: { h: P.yellow, s: P.skin, c: P.magenta, l: P.white, p: P.ink, v: P.ink },
    tech: { h: P.cyan, s: '#a8705a', c: P.dark, l: P.lime, p: P.plum, v: P.magenta },
    operator: { h: P.white, s: P.skin, c: P.plum, l: P.yellow, p: P.ink, v: P.cyan },
    guest1: { h: P.sky, s: '#c68863', c: P.teal, l: P.cyan, p: P.ink, v: P.ink },
    guest2: { h: P.orange, s: P.skin, c: P.brown, l: P.magenta, p: P.dark, v: P.ink },
    guest3: { h: P.ink, s: '#8d5a45', c: P.blue, l: P.sky, p: P.slate, v: P.ink },
    guest4: { h: P.lime, s: P.skin, c: P.ink, l: P.lime, p: P.plum, v: P.lime },
  };

  // person(kind, dir, frame) -> 16×16 canvas. dir: down/up/left/right.
  const personCache = new Map();
  function person(kind, dir, frame) {
    const key = kind + dir + frame;
    if (personCache.has(key)) return personCache.get(key);
    const pal = PEOPLE[kind] || PEOPLE.player;
    const d = dir === 'left' || dir === 'right' ? 'side' : dir;
    const legs = LEGS[d][d === 'side' ? (frame ? 1 : 0) : frame];
    const rows = [...HEAD[d], ...BODY[d], ...legs];
    const map = { k: P.ink, h: pal.h, s: pal.s, c: pal.c, l: pal.l, p: pal.p, o: P.ink, v: pal.v };
    const [c, x] = canvas(16, 16);
    paintRows(x, rows, map, 0, 0, 'person-' + kind);
    let out = c;
    if (dir === 'left') {
      const [f, fx] = canvas(16, 16);
      fx.translate(16, 0); fx.scale(-1, 1); fx.drawImage(c, 0, 0);
      out = f;
    }
    personCache.set(key, out);
    return out;
  }

  // ---------------------------------------------------------------- objects
  function sprite(w, h, fn) { const [c, x] = canvas(w, h); fn(x); return c; }

  // The striped sun, 48×48: gold at the top to hot pink, cut by dark bands
  // that get thicker toward the horizon.
  const SUNC = ['#fff16b', '#ffd24a', '#ffb238', '#ff8c3a', '#ff6a4a', '#ff4a6a', '#ff2b8a'];
  function sun(x) {
    const r = 22, cx = 24, cy = 24;
    for (let y = 0; y < 48; y++) {
      const dy = y - cy + 0.5, half = Math.sqrt(Math.max(0, r * r - dy * dy));
      if (!half) continue;
      const band = Math.min(SUNC.length - 1, Math.floor((y / 48) * SUNC.length));
      const cut = y > 22 && ((y - 22) % 6) < 1 + Math.floor((y - 22) / 8);
      if (cut) continue;
      R(x, SUNC[band], Math.round(cx - half), y, Math.round(half * 2), 1);
    }
  }
  // A knob on a stand; the engine draws the pointer for the current value.
  function knobBase(x) {
    paintRows(x, [
      '................', '.....kkkkkk.....', '....kssssssk....', '...ksSSSSSSsk...', '...ksSkkkkSsk...', '...ksSkkkkSsk...',
      '...ksSSSSSSsk...', '....kssssssk....', '.....kkkkkk.....', '......kpk.......', '......kpk.......', '.....kpppk......',
      '....kkkkkkk.....', '...kcmcmcmck....', '...kkkkkkkkk....', '................',
    ], { k: P.ink, s: P.silver, S: P.slate, p: P.plum, c: P.cyan, m: P.magenta }, 0, 0, 'knob');
  }
  // A lever: three positions, 0 left, 1 up, 2 right.
  function lever(pos) {
    return sprite(16, 16, (x) => {
      const top = [[4, 3], [7, 2], [10, 3]][pos], mid = [[5, 6], [7, 6], [9, 6]][pos];
      R(x, P.silver, mid[0], mid[1], 2, 5); R(x, P.silver, top[0] + 1, top[1] + 2, 2, 3);
      R(x, P.ink, top[0] - 1, top[1] - 1, 5, 5); R(x, P.magenta, top[0], top[1], 3, 3); R(x, P.white, top[0], top[1], 1, 1);
      R(x, P.ink, 2, 10, 12, 5); R(x, P.plum, 3, 11, 10, 3); R(x, P.cyan, 4 + pos * 3, 12, 2, 1);
    });
  }
  // A drum pad, dark or lit.
  function pad(on, col) {
    return sprite(16, 16, (x) => {
      R(x, P.ink, 1, 4, 14, 11); R(x, P.dark, 2, 5, 12, 9);
      R(x, on ? col : P.plum, 3, 6, 10, 7); if (on) R(x, P.white, 4, 7, 8, 1);
      R(x, P.slate, 2, 14, 12, 1);
    });
  }
  // A touch spot on the floor round the plant: a ring, or a ring lit white.
  function spot(on) {
    return sprite(16, 16, (x) => {
      const ring = on ? P.white : P.cyan;
      R(x, ring, 4, 6, 8, 1); R(x, ring, 4, 13, 8, 1); R(x, ring, 2, 8, 1, 4); R(x, ring, 13, 8, 1, 4);
      R(x, ring, 3, 7, 1, 1); R(x, ring, 12, 7, 1, 1); R(x, ring, 3, 12, 1, 1); R(x, ring, 12, 12, 1, 1);
      if (on) R(x, '#d8d0e8', 4, 7, 8, 6);
    });
  }
  // A status lamp on a post.
  function lamp(col) {
    return sprite(16, 16, (x) => {
      R(x, P.slate, 7, 7, 2, 8); R(x, P.slate, 4, 14, 8, 2);
      R(x, P.ink, 4, 1, 8, 7); R(x, col, 5, 2, 6, 5); R(x, P.white, 6, 3, 2, 1);
    });
  }

  const OBJ = {
    sun: sprite(48, 48, sun),
    // The plant in its pot, with the Scion's two electrode clips.
    plant: sprite(16, 32, (x) => paintRows(x, [
      '................', '.......g........', '......glg.......', '..g...glg...g...', '.glg..glg..glg..', '.glgg.glg.gglg..',
      '..glggglggglg...', '...gllglglllg...', '....gglglgg.....', '..gg..glg..gg...', '.glgg.glg.gglg..', '..ggglglglgg....',
      '.....gglgg......', '......glg.......', '..c...glg...c...', '..c....g....c...', '..c....g....c...', '..cc...g...cc...',
      '...c...g...c....', '...cc..g..cc....', '....kkkkkkkk....', '...kmmmmmmmmk...', '...kMMMMMMMMk...', '....kmmmmmmk....',
      '....kmmmmmmk....', '....kmmmmmmk....', '....kmmmmmmk....', '.....kmmmmk.....', '.....kkkkkk.....', '................',
      '................', '................',
    ], { g: P.green, l: P.lime, c: P.cyan, k: P.ink, m: P.plum, M: P.magenta }, 0, 0, 'plant')),
    // The Pocket Scion: a small box with a pulse light.
    scion: sprite(16, 16, (x) => {
      R(x, P.ink, 2, 5, 12, 10); R(x, P.white, 3, 6, 10, 8); R(x, P.silver, 3, 12, 10, 2);
      R(x, P.green, 5, 8, 2, 2); R(x, P.magenta, 9, 8, 2, 2); R(x, P.cyan, 3, 4, 1, 2); R(x, P.cyan, 12, 4, 1, 2);
    }),
    // The laptop running Ableton: clip slots in rows.
    laptop: sprite(16, 16, (x) => {
      R(x, P.ink, 1, 2, 14, 10); R(x, P.dark, 2, 3, 12, 8);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) R(x, [P.magenta, P.cyan, P.yellow, P.lime][(i + j) % 4], 3 + i * 3, 4 + j * 2, 2, 1);
      R(x, P.ink, 0, 12, 16, 3); R(x, P.silver, 1, 12, 14, 2);
    }),
    // A speaker cabinet.
    speaker: sprite(16, 32, (x) => {
      R(x, P.ink, 2, 4, 12, 28); R(x, P.dark, 3, 5, 10, 26);
      R(x, P.plum, 5, 8, 6, 6); R(x, P.magenta, 7, 10, 2, 2); R(x, P.plum, 4, 17, 8, 8); R(x, P.cyan, 7, 20, 2, 2);
    }),
    // A reel-to-reel tape deck: the loop.
    tape: sprite(16, 16, (x) => {
      R(x, P.ink, 0, 3, 16, 12); R(x, P.dark, 1, 4, 14, 10);
      for (const cx of [4, 11]) { R(x, P.silver, cx - 3, 5, 6, 6); R(x, P.ink, cx - 1, 7, 2, 2); }
      R(x, P.magenta, 1, 12, 14, 1); R(x, P.cyan, 6, 13, 4, 1);
    }),
    // The Rotrics arm: a base, two links and an electrode tip, 16 × 32.
    arm: sprite(16, 32, (x) => paintRows(x, [
      '................', '................', '................', '................', '........kkk.....', '.......kwwwk....',
      '......kwwkwk....', '.....kwwk.kk....', '....kwwk..kck...', '...kwwk...kck...', '..kwwk.....k....', '..kwwk..........',
      '..kwwk..........', '..kwwk..........', '..kwwwk.........', '...kwwk.........', '....kwwk........', '.....kwwk.......',
      '......kwwk......', '.......kwwk.....', '.......kwwk.....', '.......kwwk.....', '.......kwwk.....', '.......kwwk.....',
      '.....kkkkkkk....', '....kssssssk....', '...kmmmmmmmmk...', '...kwwwwwwwwk...', '...kssssssssk...', '...kkkkkkkkkk...',
      '................', '................',
    ], { k: P.ink, w: P.white, s: P.silver, c: P.cyan, m: P.magenta }, 0, 0, 'arm')),
    // The Kinect: a bar on a stand with three lenses.
    kinect: sprite(16, 16, (x) => {
      R(x, P.silver, 1, 4, 14, 5); R(x, P.dark, 2, 5, 12, 3); R(x, P.red, 4, 6, 1, 1); R(x, P.cyan, 7, 6, 2, 1); R(x, P.sky, 11, 6, 1, 1);
      R(x, P.slate, 7, 9, 2, 5); R(x, P.slate, 4, 14, 8, 2);
    }),
    // A webcam on a clip (MediaPipe).
    camera: sprite(16, 16, (x) => {
      R(x, P.ink, 4, 3, 8, 7); R(x, P.silver, 5, 4, 6, 5); R(x, P.ink, 7, 5, 2, 2); R(x, P.cyan, 7, 5, 1, 1);
      R(x, P.ink, 7, 10, 2, 4); R(x, P.ink, 5, 14, 6, 2);
    }),
    // An open hand (the pinch).
    hand: sprite(16, 16, (x) => paintRows(x, [
      '................', '.....k.k.k......', '....kskskskk....', '....ksksksksk...', '....kssssssks...', '.k..ksssssssk...',
      'ksk.ksssssssk...', '.kskssssssssk...', '..kssssssssk....', '...ksssssssk....', '....kssssssk....', '....kccccck.....',
      '....kccccck.....', '....kkkkkkk.....', '................', '................',
    ], { k: P.ink, s: P.skin, c: P.magenta }, 0, 0, 'hand')),
    // The laptop running Wekinator: a screen of sliders.
    wek: sprite(16, 16, (x) => {
      R(x, P.ink, 1, 2, 14, 10); R(x, P.dark, 2, 3, 12, 8);
      for (let i = 0; i < 4; i++) { R(x, P.slate, 3, 4 + i * 2, 10, 1); R(x, P.lime, 3, 4 + i * 2, 3 + i * 2, 1); }
      R(x, P.ink, 0, 12, 16, 3); R(x, P.silver, 1, 12, 14, 2);
    }),
    // The projector, lens to the right.
    projector: sprite(16, 16, (x) => {
      R(x, P.ink, 1, 5, 14, 8); R(x, P.white, 2, 6, 12, 6); R(x, P.silver, 2, 10, 12, 2);
      R(x, P.ink, 10, 6, 4, 4); R(x, P.cyan, 11, 7, 2, 2); R(x, P.ink, 3, 13, 2, 2); R(x, P.ink, 11, 13, 2, 2);
    }),
    // A neon sign on a post.
    sign: sprite(16, 16, (x) => {
      R(x, P.ink, 7, 9, 2, 7); R(x, P.ink, 1, 1, 14, 9); R(x, P.magenta, 2, 2, 12, 7); R(x, P.dark, 3, 3, 10, 5);
      R(x, P.cyan, 4, 4, 8, 1); R(x, P.cyan, 4, 6, 6, 1);
    }),
    // A note pinned up (the Q&A's questions left behind).
    poster: sprite(16, 16, (x) => {
      R(x, P.ink, 2, 1, 12, 13); R(x, P.white, 3, 2, 10, 11); R(x, P.magenta, 7, 1, 2, 2);
      R(x, P.cyan, 4, 4, 8, 2); R(x, P.slate, 4, 7, 8, 1); R(x, P.slate, 4, 9, 6, 1); R(x, P.slate, 4, 11, 7, 1);
    }),
    // A portal: a door to another page.
    portal: sprite(16, 32, (x) => {
      R(x, P.ink, 1, 2, 14, 30); R(x, P.cyan, 2, 3, 12, 28); R(x, P.ink, 4, 5, 8, 26);
      for (let y = 7; y < 31; y += 4) R(x, '#5c126c', 5, y, 6, 2);
      R(x, P.magenta, 5, 9, 6, 1); R(x, P.white, 7, 1, 2, 2);
    }),
    knob: sprite(16, 16, knobBase),
    lever: lever(1), lever_0: lever(0), lever_1: lever(1), lever_2: lever(2),
    pad: pad(false), pad_on: pad(true, P.magenta),
    pad_red: pad(false), pad_red_on: pad(true, P.red),
    spot: spot(false), spot_on: spot(true),
    lamp_ok: lamp(P.lime), lamp_part: lamp(P.yellow), lamp_no: lamp(P.red),
  };

  window.Art = {
    P, TILES, LEGEND, OBJ, PEOPLE, person, canvas, rng, R, warnings, tileAt,
    atlas: window.ATLAS || null, images: {},
    loading: () => 0,
    ready: () => true,
  };
})();
