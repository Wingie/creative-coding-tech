// node check.js  -- 5 simulated minutes per time block, through the tick check.
// Raw plant pulse must read "stuck to the tick"; anything bent off the tick must read free.
var fs = require("fs"), path = require("path"), vm = require("vm");
global.window = global;
["data/probe.js", "data/stations.js"].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, f), "utf8"));
});
var SIM = require("./sim.js");
var MIN = +(process.argv[2] || 5), ok = true;

function run(w, plant) {
  var world = new SIM.World({ plant: plant, probe: global.PROBE, stations: global.STATIONS });
  world.ctl.motion = 0.5; world.ctl.close = 0.7;
  var eng = new SIM.Engine(w, world, 5);
  eng.keep = 1e9;
  for (var t = 0.1; t <= MIN * 60; t += 0.1) eng.feed(world.advance(t));
  return eng;
}
console.log("valid wirings:", SIM.allWirings().length);
var cases = [
  { w: { src: ["pulse"], time: "tick", shape: "pitch", dest: "projection" }, want: "stuck", raw: true },
  { w: { src: ["pulse", "level"], time: "tick", shape: "pitch", dest: "notes" }, want: "stuck" },
  { w: { src: ["pulse", "touch"], time: "bend", shape: "pitch", dest: "notes" }, want: "free" },
  { w: { src: ["pulse", "drift"], time: "bend", shape: "light", dest: "projection" }, want: "free" },
  { w: { src: ["pulse", "touch"], time: "gate", shape: "pitch", dest: "notes" }, want: "stuck" },
  { w: { src: ["level"], time: "density", shape: "pitch", dest: "notes" }, want: "free" },
  { w: { src: ["pulse", "drift"], time: "stretch", shape: "pitch", dest: "notes" }, want: "free" },
  { w: { src: ["pulse"], time: "ornament", shape: "light", dest: "projection" }, want: "stuck" },
  { w: { src: ["motion"], time: "bend", shape: "fb", dest: "loop" }, want: "free" }
];
["recorded", "simulated"].forEach(function (plant) {
  cases.forEach(function (c) {
    var e = run(c.w, plant);
    var raw = e.raw.map(function (r) { return r[0]; });
    var pl = e.played.map(function (r) { return r[0]; }).sort(function (a, b) { return a - b; });
    var tr = SIM.combTest(raw, 60, 1), tp = SIM.combTest(pl, 60, 2);
    var got = tp.stuck ? "stuck" : "free";
    var pass = got === c.want && (c.w.src[0] !== "pulse" || tr.stuck);
    ok = ok && pass;
    console.log((pass ? "PASS " : "FAIL ") + plant.padEnd(9) + " " + SIM.key(c.w).padEnd(38) +
      " raw n " + String(raw.length).padStart(4) + " R " + (tr.R || 0).toFixed(3) + " (p99 " + (tr.p99 || 0).toFixed(3) + ")" +
      "  played n " + String(pl.length).padStart(4) + " R " + (tp.R || 0).toFixed(3) + " (p99 " + (tp.p99 || 0).toFixed(3) + ") " + got);
  });
});
console.log(ok ? "check OK" : "check FAIL");
process.exit(ok ? 0 : 1);
