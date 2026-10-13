// sound.js: the pluck and the long echo loop, taken from the replay page (docs/echo-garden-site/replay/replay.js
// initAudio / pluck / setLoopParams), plus two small voices for light and rack-macro messages.
(function () {
  "use strict";
  var A = null;

  function init() {
    if (A) return true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    var ctx = new Ctx();
    var master = ctx.createDynamicsCompressor();
    master.threshold.value = -8; master.knee.value = 0; master.ratio.value = 20;
    master.attack.value = 0.003; master.release.value = 0.25;
    var out = ctx.createGain(); out.gain.value = 0.9;
    master.connect(out); out.connect(ctx.destination);
    var dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(master);
    var send = ctx.createGain(); send.gain.value = 0.8;
    var maxD = 60, delays = [], loopLen = 30;
    try { delays.push(ctx.createDelay(maxD)); } catch (e) { maxD = 1; }
    if (!delays.length) for (var k = 0; k < Math.ceil(loopLen / maxD); k++) delays.push(ctx.createDelay(maxD));
    for (var d = 0; d < delays.length; d++) {
      delays[d].delayTime.value = Math.min(maxD, loopLen / delays.length);
      if (d > 0) delays[d - 1].connect(delays[d]);
    }
    var tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3200; tone.Q.value = 0.3;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120;
    var fb = ctx.createGain(); fb.gain.value = 0;
    var wet = ctx.createGain(); wet.gain.value = 0.75;
    var first = delays[0], last = delays[delays.length - 1];
    send.connect(first); last.connect(tone); tone.connect(hp); hp.connect(fb); fb.connect(first);
    last.connect(wet); wet.connect(master);
    A = { ctx: ctx, dry: dry, send: send, delays: delays, maxD: maxD, fb: fb, wet: wet, loopLen: loopLen };
    return true;
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function pluck(when, pitch, vel, dur, raw) {
    var ctx = A.ctx, f = mtof(pitch), amp = 0.22 * Math.pow(vel / 127, 1.4) * (raw ? 0.45 : 1);
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
  // a light message: a soft glassy chime, sent a little into the loop
  function chime(when, pitch, level) {
    var ctx = A.ctx, f = mtof(pitch + 24), env = ctx.createGain(), amp = 0.05 + 0.08 * level;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(amp, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
    var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    o.connect(env); env.connect(A.dry); env.connect(A.send);
    o.start(when); o.stop(when + 1);
  }
  // a rack-macro message: a filtered low thump whose brightness is the macro value
  function thump(when, val) {
    var ctx = A.ctx, env = ctx.createGain(), o = ctx.createOscillator(), lp = ctx.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.setValueAtTime(110, when); o.frequency.exponentialRampToValueAtTime(55, when + 0.25);
    lp.type = "lowpass"; lp.frequency.value = 200 + 3800 * val; lp.Q.value = 6;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.16, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
    o.connect(lp); lp.connect(env); env.connect(A.dry);
    o.start(when); o.stop(when + 0.45);
  }
  function setLoop(feedback, send, time, on) {
    if (!A) return;
    var now = A.ctx.currentTime;
    A.fb.gain.setTargetAtTime(on ? Math.max(0, Math.min(0.98, feedback)) * 0.92 : 0, now, 0.08);
    A.send.gain.setTargetAtTime(send, now, 0.1);
    var want = Math.max(1, Math.min(time || 30, A.maxD * A.delays.length - 0.01));
    if (Math.abs(want - A.loopLen) > 0.05) {
      A.loopLen = want;
      A.delays.forEach(function (d) { d.delayTime.setValueAtTime(Math.min(A.maxD, want / A.delays.length), now); });
    }
  }
  function clearEcho() {
    if (!A) return;
    var now = A.ctx.currentTime;
    A.wet.gain.cancelScheduledValues(now);
    A.wet.gain.setValueAtTime(0, now);
    A.wet.gain.setTargetAtTime(0.75, now + 1.5, 0.3);
  }
  window.Sound = {
    init: init, pluck: pluck, chime: chime, thump: thump, setLoop: setLoop, clearEcho: clearEcho,
    get ctx() { return A && A.ctx; }
  };
})();
