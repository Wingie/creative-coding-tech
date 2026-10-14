// atlas.js — sprite-sheet cells that would replace art.js's drawing.
//
// Echo Garden draws everything in code (art.js): the synthwave sky, sun, floor
// grid, people and gear. This file ships empty on purpose. It stays because
// the edit server's /save-atlas still knows its shape, and a sheet can be
// mapped back in later without engine changes.
window.ATLAS = {
  sheets: {},
  tiles: {},
  procedural: [' ', '*', '^', 'n', 'Y', 'T', 'M', 'K', '#', '=', 'D'],
  sprites: {},
};
