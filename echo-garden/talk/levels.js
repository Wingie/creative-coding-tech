// levels.js — the deck. Edit this file to change the talk; no engine code needed.
//
// Why a .js file and not .json: browsers refuse to fetch() a local JSON file
// from file://, and the game must open by double-click at the venue. Keep the
// contents JSON-shaped (plain objects, strings, numbers) so it stays data.
//
// "Echo Garden": how the live set works, as a walk along its signal path. One
// room per link in the chain: the plant and the Scion, the two ways into
// Ableton, the arm, the loop, body and hands, light, show day, and your move.
// Every room has something to do: a knob, a lever, pads or spots that drive a
// lane of live notes above them.
//
// Sources: experiments/scion/docs/GATEWAY.md, SCENE_FLOW.md, POSSIBILITIES.md,
// scenes/stations_plantarm.json, and the Set_ArtNotDead_v3 track list
// (tools/als_index.py). Copy: plain voice, no we/our/us, no em dashes. Channel,
// CC and port numbers are fine here: this is for the people running the rig.
// ../talk_script.md is the walk-through script, written from these lines.

window.FIGURES = {
  // verified 2026-10-13: experiments/scion/docs/POSSIBILITIES.md (measured, plant/sessions/2026-08-27-probe)
  tick:     { value: '127.9 MS', sub: 'the Scion\'s own pulse, about eight times a second', src: 'measured · POSSIBILITIES.md' },
  // verified 2026-10-13: experiments/scion/docs/GATEWAY.md and POSSIBILITIES.md card 1
  nudge:    { value: '0-400 MS', sub: 'how far the rig moves a station note off the pulse', src: 'POSSIBILITIES.md card 1' },
  // verified 2026-10-13: experiments/scion/docs/GATEWAY.md section 7 (loop CC map)
  loop_cc:  { value: 'CC30-33', sub: 'channel 16: feedback, send, clear, loop time', src: 'GATEWAY.md' },
  // verified 2026-10-13: experiments/scion/docs/GATEWAY.md ("The gateway clamps feedback at 0.98")
  fb_cap:   { value: '0.98', sub: 'the feedback cap · the usual ride is 20-100 %', src: 'GATEWAY.md' },
  // verified 2026-10-13: the set's TD smoothing (SCENE_FLOW.md, Lag CHOPs per control)
  lags:     { value: '0.5 S AND 2 S', sub: 'the two smoothing lags on pinch and hand height', src: 'TD Lag CHOPs' },
  // verified 2026-10-13: experiments/scion/docs/GATEWAY.md ports table
  wek:      { value: '12020 → 12000', sub: 'Wekinator to the rig, then the rig relays to TouchDesigner', src: 'GATEWAY.md' },
};

// Audience participation (../crowd/): the game connects to the crowd server
// only when this is set or the URL has ?crowd (?crowd=http://host:port picks
// another server). null = off, and the game makes no connection at all.
window.CROWD_URL = null;

window.LEVELS = [
  // ------------------------------------------------------------------ 1  The plant and the Scion
  {
    id: 'plant',
    title: 'The plant and the Scion',
    capability: 'KNOB · PULSE LANE',
    // The lane above is the Scion's pulse: a line every 127.9 ms. A note can
    // only land on a line. The knob is the threshold.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^YY^^^^^^^^^^^^^^^^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      '===================D',
      '####################',
    ],
    spawn: { x: 1, y: 10, dir: 'right' },
    labels: [{ x: 8.5, y: 8.1, text: 'THRESHOLD' }, { x: 18.5, y: 9.2, text: 'EXIT →' }],
    prompt: { id: 'plant_sound', text: 'What should the plant play?' },
    controls: {
      thr: { start: 1, states: [
        { label: 'LOW THRESHOLD · MOST PULSES PLAY', p: 0.7 },
        { label: 'MID THRESHOLD', p: 0.35 },
        { label: 'HIGH THRESHOLD · FEW NOTES', p: 0.1 },
      ] },
    },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, start: { text: 'ECHO GARDEN', sub: 'how the live set works, one room at a time' } },
      { type: 'lane', mode: 'pulse', key: 'thr', label: 'THE PULSE', x: 1, y: 5, w: 14, h: 3 },
      { type: 'object', sprite: 'sun', x: 16, y: 5, w: 3, h: 3 },
      { type: 'object', sprite: 'plant', x: 3, y: 9, name: 'THE PLANT', lines: [
        'The plant is wired to a Pocket Scion by two clips.',
        'The Scion reads the plant and turns what it reads into MIDI.',
      ] },
      { type: 'object', sprite: 'scion', x: 5, y: 9, name: 'POCKET SCION', action: { do: 'bignum', board: 'board', fig: 'tick' }, lines: [
        'The Scion has its own pulse, about eight times a second.',
        'A note can only come out on a pulse. The lines in the lane are the pulse.',
      ] },
      { type: 'control', sprite: 'knob', key: 'thr', x: 8, y: 9, name: 'THRESHOLD' },
      { type: 'sign', sprite: 'sign', x: 11, y: 9, name: 'TURN THE KNOB',
        action: { do: 'show', board: 'board', item: { text: 'THE THRESHOLD', sub: 'how many pulses become notes' } }, lines: [
        'The threshold sets how many pulses become notes.',
        'Turn it up and the notes thin out. Turn it down and they fill the pulse.',
      ] },
      { type: 'npc', sprite: 'performer', x: 14, y: 9, dir: 'down', name: 'THE PLAYER', lines: [
        'Everything after this room starts from these notes and their pulse.',
      ] },
      { type: 'door', x: 19, y: 10, to: 'next' },
      // Crowd mode only: the join code, over the sun.
      { type: 'qr', x: 16, y: 5, w: 3, h: 3, name: 'JOIN IN', lines: [
        'Scan the code to join from your phone, and say what the plant should play.',
      ] },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ 2  Two ways into Ableton
  {
    id: 'ableton',
    title: 'Two ways into Ableton',
    capability: 'LEVER · TWO LANES',
    // Left lane: track Chord 4 takes the Scion in raw, so its notes sit on the
    // pulse. Right lane: the same notes through the rig, nudged off it.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^^^^^^^^^^^^^^^^^^^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D==================D',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [{ x: 9.5, y: 8.1, text: 'HEAR' }, { x: 18.5, y: 9.2, text: 'EXIT →' }],
    controls: {
      route: { start: 1, states: [
        { label: 'HEAR: RAW', raw: 1, rig: 0 },
        { label: 'HEAR: BOTH', raw: 1, rig: 1 },
        { label: 'HEAR: STATIONS', raw: 0, rig: 1 },
      ] },
    },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'TWO WAYS INTO ABLETON' },
      { type: 'lane', mode: 'raw', route: 'route', label: 'CHORD 4 · RAW', caption: 'ON THE PULSE', x: 1, y: 5, w: 9, h: 3 },
      { type: 'lane', mode: 'rig', route: 'route', label: 'IAC CH 2-4', caption: 'NUDGED OFF IT', x: 10, y: 5, w: 9, h: 3 },
      { type: 'object', sprite: 'laptop', x: 3, y: 9, name: 'THE RAW LAYER',
        action: { do: 'show', board: 'board', item: { text: 'THE RAW LAYER', sub: 'track Chord Four takes the Scion straight in' } }, lines: [
        'Track Chord 4 takes the Scion straight in, so its notes stay on the pulse.',
        'This is how the last show was played.',
      ] },
      { type: 'object', sprite: 'scion', x: 6, y: 9, name: 'SAME NOTES', lines: [
        'Both lanes get the same plant notes, and only their timing differs.',
      ] },
      { type: 'control', sprite: 'lever', key: 'route', x: 9, y: 9, name: 'HEAR' },
      { type: 'object', sprite: 'laptop', x: 12, y: 9, name: 'THE STATION TRACKS', action: { do: 'bignum', board: 'board', fig: 'nudge' }, lines: [
        'The station tracks listen on IAC channels 2 to 4, and their notes come through the rig.',
        'The rig nudges each note 0 to 400 ms off the pulse, using the plant\'s own slow signals.',
      ] },
      { type: 'npc', sprite: 'tech', x: 15, y: 9, dir: 'down', name: 'IS IT TESTED?',
        action: { do: 'show', board: 'board', item: { text: 'BUILT, TESTED IN SIMULATION', sub: 'the station path has not been played live yet' } }, lines: [
        'The rig part is built, but so far it is only tested in simulation.',
      ] },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      { type: 'door', x: 19, y: 10, to: 'next' },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ 3  The arm
  {
    id: 'arm',
    title: 'The arm',
    capability: 'SIX SPOTS · LIFT LEVER · NOTE LANE',
    // Six touch spots in a ring round the plant (seed values from
    // scenes/stations_plantarm.json). A on a spot = the arm touches there.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^^^^^^^^^^^^^^^YY^^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D==================D',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [{ x: 15.5, y: 8.1, text: 'LIFT' }, { x: 18.5, y: 9.2, text: 'EXIT →' }],
    controls: {
      arm: { start: 0, states: [
        { label: 'LIFTED · NO NOTES', on: 0 },
        { label: 'EAST · CH 2 · NOTES 50-62', on: 1, ch: 2, send: 0.8 },
        { label: 'NORTH-EAST · CH 3 · NOTES 55-67', on: 1, ch: 3, send: 0.7 },
        { label: 'NORTH-WEST · CH 4 · NOTES 57-69', on: 1, ch: 4, send: 0.9 },
        { label: 'WEST · CH 2 · NOTES 62-72', on: 1, ch: 2, send: 0.6 },
        { label: 'SOUTH-WEST · CH 3 · NOTES 45-57', on: 1, ch: 3, send: 1 },
        { label: 'SOUTH-EAST · CH 4 · NOTES 60-72', on: 1, ch: 4, send: 0.5 },
      ] },
    },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'THE ARM' },
      { type: 'lane', mode: 'arm', key: 'arm', label: 'NOTES · LOOP SEND', x: 1, y: 5, w: 14, h: 3 },
      { type: 'object', sprite: 'sun', x: 16, y: 5, w: 3, h: 3 },
      { type: 'sign', sprite: 'sign', x: 3, y: 9, name: 'SIX SPOTS',
        action: { do: 'show', board: 'board', item: { text: 'SIX SPOTS ROUND THE PLANT', sub: 'each spot sets pitch set, channel and loop send' } }, lines: [
        'The arm has six spots round the plant. Walk to one and press A to touch it.',
        'Each spot sets the notes\' pitch set, their channel, and how much goes into the loop.',
        'The green bar on the right is that loop send.',
      ] },
      { type: 'object', sprite: 'plant', x: 9, y: 9, name: 'THE PLANT', lines: [
        'Touching a spot is predicted to close the plant\'s circuit and start the notes, but that is not tested yet.',
        'Lifting the arm stops them.',
      ] },
      { type: 'control', sprite: 'spot', key: 'arm', to: 1, x: 11, y: 9, name: 'EAST' },
      { type: 'control', sprite: 'spot', key: 'arm', to: 2, x: 10, y: 8, name: 'NORTH-EAST' },
      { type: 'control', sprite: 'spot', key: 'arm', to: 3, x: 8, y: 8, name: 'NORTH-WEST' },
      { type: 'control', sprite: 'spot', key: 'arm', to: 4, x: 7, y: 9, name: 'WEST' },
      { type: 'control', sprite: 'spot', key: 'arm', to: 5, x: 8, y: 10, name: 'SOUTH-WEST' },
      { type: 'control', sprite: 'spot', key: 'arm', to: 6, x: 10, y: 10, name: 'SOUTH-EAST' },
      { type: 'object', sprite: 'arm', x: 13, y: 9, name: 'THE ARM', lines: [
        'A Rotrics arm. These spots are seed values, taught again for each room.',
      ] },
      { type: 'control', sprite: 'lever', key: 'arm', to: 0, x: 15, y: 9, name: 'LIFT' },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      { type: 'door', x: 19, y: 10, to: 'next' },
      { type: 'crowd', x: 13, y: 11, w: 6, h: 1, max: 6 },
    ],
  },

  // ------------------------------------------------------------------ 4  The loop
  {
    id: 'loop',
    title: 'The loop',
    capability: 'KNOB · THREE PADS · LOOP LANE',
    // Frippertronics: each pass the old notes come round again at the
    // feedback level. The white line is the tape head.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^^^YY^^^^^^^^^^^^^^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D==================D',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [{ x: 5.5, y: 8.1, text: 'FEEDBACK' }, { x: 8.5, y: 8.1, text: 'DUCK' }, { x: 11.5, y: 8.1, text: 'CLEAR' }, { x: 14.5, y: 8.1, text: 'PANIC' }, { x: 18.5, y: 9.2, text: 'EXIT →' }],
    controls: {
      fb: { start: 2, states: [
        { label: 'PANIC · FEEDBACK 0', fb: 0 },
        { label: 'FEEDBACK 20 %', fb: 0.2 },
        { label: 'FEEDBACK 50 %', fb: 0.5 },
        { label: 'FEEDBACK 80 %', fb: 0.8 },
        { label: 'FEEDBACK 98 % · THE CAP', fb: 0.98 },
      ] },
    },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'THE LOOP' },
      { type: 'lane', mode: 'loop', key: 'fb', loop: 6, label: 'TAPE LOOP', x: 1, y: 5, w: 14, h: 3 },
      { type: 'object', sprite: 'sun', x: 16, y: 5, w: 3, h: 3 },
      { type: 'object', sprite: 'tape', x: 2, y: 9, name: 'THE LOOP',
        action: { do: 'show', board: 'board', item: { text: 'FRIPPERTRONICS', sub: 'a tape delay into ValhallaSupermassive on return G' } }, lines: [
        'A Frippertronics-style tape delay, into ValhallaSupermassive on return G.',
        'Each pass, the old notes come round again at the feedback level.',
      ] },
      { type: 'control', sprite: 'knob', key: 'fb', cycle: [1, 2, 3, 4], x: 5, y: 9, name: 'FEEDBACK' },
      { type: 'control', sprite: 'pad', fire: 'duck', x: 8, y: 9, name: 'DUCK' },
      { type: 'control', sprite: 'pad', fire: 'clear', x: 11, y: 9, name: 'CLEAR' },
      { type: 'control', sprite: 'pad_red', key: 'fb', to: 0, x: 14, y: 9, name: 'PANIC' },
      { type: 'sign', sprite: 'sign', x: 16, y: 9, name: 'CHANNEL 16', action: { do: 'bignum', board: 'board', fig: 'loop_cc' }, cards: [null, 'fb_cap'], lines: [
        'Feedback, send, clear and loop time come in on channel 16, CC30 to CC33, and are ridden live.',
        'Feedback is capped at 0.98. The usual ride is 20 to 100 %.',
        'The pads duck the loop or clear it. Panic sends all notes off and sets feedback to 0.',
      ] },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      { type: 'door', x: 19, y: 10, to: 'next' },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ 5  Body and hands
  {
    id: 'body',
    title: 'Body and hands',
    capability: 'PINCH CONTROL · SMOOTHING LANE',
    // A on the hand opens or closes the pinch; the lane shows the raw value
    // and the two smoothed ones catching up.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^YY^^^^^^^^^^^^^^^^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D==================D',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [{ x: 6.5, y: 8.1, text: 'PINCH' }, { x: 18.5, y: 9.2, text: 'EXIT →' }],
    controls: {
      pinch: { start: 0, states: [
        { label: 'HAND OPEN', v: 0.8 },
        { label: 'PINCHED', v: 0.2 },
      ] },
    },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'BODY AND HANDS' },
      { type: 'lane', mode: 'smooth', key: 'pinch', label: 'PINCH DISTANCE', x: 1, y: 5, w: 14, h: 3 },
      { type: 'object', sprite: 'sun', x: 16, y: 5, w: 3, h: 3 },
      { type: 'object', sprite: 'camera', x: 3, y: 9, name: 'MEDIAPIPE', action: { do: 'bignum', board: 'board', fig: 'lags' }, lines: [
        'MediaPipe reads the hands: pinch distance and hand height.',
        'Both are smoothed, with a 0.5 s lag and a 2 s lag, and drive rack macros through TDAbleton.',
      ] },
      { type: 'control', sprite: 'hand', key: 'pinch', x: 6, y: 9, name: 'PINCH' },
      { type: 'object', sprite: 'kinect', x: 9, y: 9, name: 'KINECT',
        action: { do: 'show', board: 'board', item: { text: 'DISTANCE RIDES FEEDBACK', sub: 'how far the body is from the Kinect, into the loop' } }, lines: [
        'The Kinect reads how far away the body is, and that distance rides the loop feedback.',
      ] },
      { type: 'object', sprite: 'wek', x: 12, y: 9, name: 'WEKINATOR', action: { do: 'bignum', board: 'board', fig: 'wek' }, lines: [
        'Wekinator sends to port 12020, and the rig relays it to TouchDesigner on 12000.',
      ] },
      { type: 'npc', sprite: 'dancer', x: 15, y: 9, dir: 'down', name: 'THE DANCER', lines: [
        'The body steering the arm is still being tried.',
      ] },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      { type: 'door', x: 19, y: 10, to: 'next' },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ 6  Light
  {
    id: 'light',
    title: 'Light',
    capability: 'SIX PADS · LIMN AREAS',
    // A on a numbered spot plays it; the projection lights that spot's area,
    // black and white.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^^^^^^^^^^^^^^^^YY^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D==================D',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [
      { x: 5.5, y: 8.1, text: '1' }, { x: 7.5, y: 8.1, text: '2' }, { x: 9.5, y: 8.1, text: '3' },
      { x: 11.5, y: 8.1, text: '4' }, { x: 13.5, y: 8.1, text: '5' }, { x: 15.5, y: 8.1, text: '6' },
      { x: 18.5, y: 9.2, text: 'EXIT →' },
    ],
    controls: {
      spot: { start: 0, states: [
        { label: 'NO SPOT PLAYED', area: -1 },
        { label: 'SPOT 1 LIT', area: 0 }, { label: 'SPOT 2 LIT', area: 1 }, { label: 'SPOT 3 LIT', area: 2 },
        { label: 'SPOT 4 LIT', area: 3 }, { label: 'SPOT 5 LIT', area: 4 }, { label: 'SPOT 6 LIT', area: 5 },
      ] },
    },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'LIGHT' },
      { type: 'lane', mode: 'light', key: 'spot', label: 'LIMN AREAS', x: 1, y: 5, w: 14, h: 3 },
      { type: 'object', sprite: 'sun', x: 16, y: 5, w: 3, h: 3 },
      { type: 'object', sprite: 'projector', x: 2, y: 9, name: 'PROJECTOR',
        action: { do: 'show', board: 'board', item: { text: 'LIGHT FOLLOWS THE PLAY', sub: 'the spot being played is lit · black and white' } }, lines: [
        'The projection lights the spot being played, through Limn areas.',
        'The set\'s look is black and white.',
      ] },
      { type: 'control', sprite: 'spot', key: 'spot', to: 1, x: 5, y: 9, name: 'SPOT 1' },
      { type: 'control', sprite: 'spot', key: 'spot', to: 2, x: 7, y: 9, name: 'SPOT 2' },
      { type: 'control', sprite: 'spot', key: 'spot', to: 3, x: 9, y: 9, name: 'SPOT 3' },
      { type: 'control', sprite: 'spot', key: 'spot', to: 4, x: 11, y: 9, name: 'SPOT 4' },
      { type: 'control', sprite: 'spot', key: 'spot', to: 5, x: 13, y: 9, name: 'SPOT 5' },
      { type: 'control', sprite: 'spot', key: 'spot', to: 6, x: 15, y: 9, name: 'SPOT 6' },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      { type: 'door', x: 19, y: 10, to: 'next' },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ 7  Show day
  {
    id: 'showday',
    title: 'Show day',
    capability: 'STATUS LAMPS · ONE PER CALIBRATION',
    // What has to be calibrated in each new room. Lamps: green = solved,
    // yellow = partial, red = not solved (SCENE_FLOW.md, 2026-10-13).
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^YYY^^^^^^^YYY^^^^^^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D==================D',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [{ x: 18.5, y: 9.2, text: 'EXIT →' }],
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'SHOW DAY' },
      { type: 'object', sprite: 'sun', x: 16, y: 5, w: 3, h: 3 },
      { type: 'object', sprite: 'lamp_ok', x: 2, y: 9, name: 'PROMAP SCAN',
        action: { do: 'show', board: 'board', item: { text: 'PROMAP SCAN · SOLVED', sub: 'projector pixels to camera pixels' } }, lines: [
        'The structured-light scan: solved.',
      ] },
      { type: 'object', sprite: 'lamp_part', x: 4, y: 9, name: 'PROCAM',
        action: { do: 'show', board: 'board', item: { text: 'PROCAM · PARTIAL', sub: 'the projector solved as a camera' } }, lines: [
        'Procam: partial. Proven on hardware, but it still refuses on flat sets.',
      ] },
      { type: 'object', sprite: 'lamp_part', x: 6, y: 9, name: 'LIMN',
        action: { do: 'show', board: 'board', item: { text: 'LIMN · PARTIAL', sub: 'the light areas lined up on the room' } }, lines: [
        'Limn alignment: partial.',
      ] },
      { type: 'object', sprite: 'lamp_part', x: 8, y: 9, name: 'ARM TOUCH POINTS',
        action: { do: 'show', board: 'board', item: { text: 'ARM TOUCH POINTS · PARTIAL', sub: 'the six spots, taught again per room' } }, lines: [
        'Arm touch points: partial. The contact itself is still unmeasured.',
      ] },
      { type: 'object', sprite: 'lamp_no', x: 10, y: 9, name: 'MEDIAPIPE NUMBERS',
        action: { do: 'show', board: 'board', item: { text: 'MEDIAPIPE NUMBERS · NOT SOLVED', sub: 'tuned by hand inside each file' } }, lines: [
        'MediaPipe numbers: not solved. Today they are tuned by hand.',
      ] },
      { type: 'object', sprite: 'lamp_no', x: 12, y: 9, name: 'RACKS TO EFFECTS',
        action: { do: 'show', board: 'board', item: { text: 'RACKS TO TD EFFECTS · NOT SOLVED', sub: 'Ableton macros to TouchDesigner ranges' } }, lines: [
        'Ableton racks to TD effects: not solved. The ranges are typed into TD by hand.',
      ] },
      { type: 'object', sprite: 'lamp_no', x: 14, y: 9, name: 'SMOOTHING',
        action: { do: 'show', board: 'board', item: { text: 'SMOOTHING · NOT SOLVED', sub: 'how each control eases in and out' } }, lines: [
        'Smoothing per control: not solved.',
      ] },
      { type: 'npc', sprite: 'operator', x: 16, y: 9, dir: 'down', name: 'THE CHECKLIST', lines: [
        'Every new room needs these again. So far only the scan is solved.',
      ] },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      { type: 'door', x: 19, y: 10, to: 'next' },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ 8  Your move (the last chain level)
  {
    id: 'yourmove',
    title: 'Your move',
    capability: 'CHAIN RECAP · LINKS · END TO BLACK',
    endWhite: 2,
    // The chain once more, link by link, then two doors out to the site's
    // replay and ideas pages. On file:// (the stage) they only show the address.
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^YY^^^^^^^^^^^^^^YY^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '####################',
      'D===================',
      '####################',
    ],
    spawn: { x: 2, y: 10, dir: 'right' },
    labels: [{ x: 10.5, y: 11.2, text: 'REPLAY' }, { x: 13.5, y: 11.2, text: 'IDEAS' }],
    prompt: { id: 'try_next', text: 'What should be tried live next?', choices: ['Arm touch start', 'Station nudge', 'Body steers arm', 'Smoothing'] },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, idle: 'YOUR MOVE' },
      { type: 'object', sprite: 'sun', x: 8, y: 5, w: 3, h: 3 },
      { type: 'sign', sprite: 'sign', x: 3, y: 9, name: 'THE CHAIN',
        action: { do: 'sequence', board: 'board', join: ' → ', steps: [
          { item: { text: 'PLANT', sub: 'the Scion reads it, notes on its pulse' }, lines: ['The plant, through the Scion. Notes only on its pulse.'] },
          { item: { text: 'ABLETON', sub: 'raw on Chord Four, or nudged through the rig' }, lines: ['Into Ableton, raw on Chord 4 or nudged through the stations.'] },
          { item: { text: 'ARM', sub: 'a touched spot picks notes, channel and send' }, lines: ['The arm picks the spot, and the spot picks the notes.'] },
          { item: { text: 'LOOP', sub: 'tape delay into Valhalla, ridden on channel sixteen' }, lines: ['The loop holds it, ridden live.'] },
          { item: { text: 'BODY', sub: 'hands drive macros, distance rides feedback' }, lines: ['Hands and body ride the macros and the feedback.'] },
          { item: { text: 'LIGHT', sub: 'the spot being played is lit' }, lines: ['And the light follows the spot.'] },
        ] } },
      // Crowd mode only: A puts the room's vote on the board, live.
      { type: 'sign', sprite: 'sign', crowd: true, x: 6, y: 9, name: 'THE ROOM VOTES', action: { do: 'tally', prompt: 'try_next', board: 'board' } },
      { type: 'object', sprite: 'portal', x: 10, y: 9, name: 'REPLAY',
        action: { do: 'link', href: '../replay/', board: 'board', item: { text: 'THE REPLAY', sub: 'a recorded set, played back on the site' } }, lines: [
        'The replay page plays back a recorded set.',
      ] },
      { type: 'object', sprite: 'portal', x: 13, y: 9, name: 'IDEAS',
        action: { do: 'link', href: '../ideas/', board: 'board', item: { text: 'THE IDEAS', sub: 'what the set could do next' } }, lines: [
        'The ideas page tries out what the set could do next.',
      ] },
      // A shows the closing words, A again: white, then black, held until the operator acts.
      { type: 'object', sprite: 'plant', x: 16, y: 9, name: 'ECHO GARDEN',
        action: { do: 'sequence', board: 'board', steps: [{ item: { text: 'THANK YOU', sub: 'Echo Garden · questions next' } }], then: { do: 'end' } } },
      { type: 'door', x: 0, y: 10, to: 'prev' },
      // Crowd mode only: the join code, so late phones can still vote.
      { type: 'qr', x: 16, y: 5, w: 3, h: 3, name: 'JOIN IN', lines: [
        'Scan the code to join and vote. There is room to ask a question for afterwards too.',
      ] },
      { type: 'crowd', x: 2, y: 11, w: 16, h: 1, max: 12 },
    ],
  },

  // ------------------------------------------------------------------ Q&A  key 0, after the talk
  {
    id: 'qa',
    title: 'Questions',
    capability: 'APPENDIX: MENU OR KEY 0 · QUESTION QUEUE',
    appendix: true,
    key: '0',
    tag: 'Q&A',
    map: [
      '********************',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '*MMMMMMMMMMMMMMMMMM*',
      '^YYY^^^^^^^^^^^^^YY^',
      'T^^^^^^^^^^^^^^^^^^T',
      'nnnnnnnnnnnnnnnnnnnn',
      '####################',
      '====================',
      '####################',
      '####################',
    ],
    spawn: { x: 3, y: 9, dir: 'right' },
    things: [
      { type: 'billboard', id: 'board', x: 1, y: 1, w: 18, h: 4, start: { text: 'QUESTIONS', sub: 'scan the code to ask one from your phone' } },
      { type: 'object', sprite: 'sun', x: 6, y: 5, w: 3, h: 3 },
      { type: 'npc', sprite: 'tech', x: 2, y: 8, dir: 'down', name: 'WHERE THE DOCS ARE',
        action: { do: 'show', board: 'board', item: { text: 'THE RIG DOCS', sub: 'in the docs folder next to this game' } }, lines: [
        'The rig is written up in GATEWAY.md, SCENE_FLOW.md and POSSIBILITIES.md.',
      ] },
      { type: 'sign', sprite: 'sign', x: 12, y: 8, name: 'ART CREDITS', lines: [
        'Everything on screen is drawn in code. The phone characters are the Cozy Farm Lite farmer by Bramble & Byte (CC-BY 4.0).',
      ] },
      // Crowd mode only: questions whose askers have left the room, pinned as a note. A reads them.
      { type: 'sign', sprite: 'poster', crowd: true, x: 16, y: 8, name: 'LEFT BEHIND', action: { do: 'leftbehind' }, lines: ['No questions left behind.'] },
      // Crowd mode only: the join code, where the phones ask from.
      { type: 'qr', x: 13, y: 5, w: 3, h: 3, name: 'ASK A QUESTION', lines: [
        'Scan the code, pick a name and ask from your phone, then vote up the ones you want answered.',
      ] },
      // Crowd mode only: the room's questions, most votes first, then pinned, then newest. A reads one.
      { type: 'crowd', source: 'questions', x: 1, y: 10, w: 18, h: 1, max: 16 },
    ],
  },
];
