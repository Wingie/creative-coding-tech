---
title: SYNTHesized
slug: synthesized
tagline: 89 SuperCollider files. 35 kick variations. Every sound provably generated.
description: >-
  SYNTHesized is a complete synthwave album where every sound is synthesised from first principles in SuperCollider — no samples, no loops. 35+ kick variations at synthesis level, Karplus-Strong string modelling, FM bass, and a mix_master.scd orchestrating the full song form. Submitted as academic project.
language: SuperCollider
role: Extended
year: 2023
order: 15
tech:
  - SuperCollider
  - SynthDef
  - Karplus-Strong synthesis
  - FM synthesis
  - Envelope modelling
  - Algorithmic composition
client: Academic music composition group (7 composers)
github_url: https://github.com/wingie/synthesized
og_image: https://opengraph.githubassets.com/1/nikolaStanojkovski/SYNTHesized
---

## The Problem

A group of seven composition students at a music technology programme had a project constraint: the final submission had to be a complete original work where every sound element was demonstrably generated — not sampled, not taken from a sample library, not loop-based. Every kick drum, every synth pad, every string hit had to be traceable to a synthesis algorithm running in real time.

The challenge wasn't the constraint — it was the depth it required. It's easy to make *a* kick drum in SuperCollider. Making 35 distinctly different kick drums, each with documented synthesis parameters, each serving a different arrangement context, is a different project entirely.

## What We Built

89 SuperCollider `.scd` files organised into a synthesis library and a composition layer. The synthesis library defines `SynthDef` patterns for each sound category; the composition layer (`mix_master.scd`) loads the library and drives the full song form via pattern sequencers.

The kick drum variations alone span four synthesis approaches:
- **Sine model** — single oscillator with exponential pitch sweep and amplitude envelope
- **Transient + body** — separate percussive attack (bandpass noise burst) layered with pitched sustain
- **FM kick** — modulator oscillator driving carrier frequency, creating metallic/clicky character
- **Physical model** — damped resonator simulating membrane physics

## How It Works

Each kick variation is a distinct `SynthDef` with exposed parameters. Here's the sine model approach:

```supercollider
SynthDef(\kick_sine, {
    |out = 0, freq = 60, pitchDecay = 0.05, ampDecay = 0.4, amp = 1|

    // Pitch sweep: start high, decay to fundamental
    var pitchEnv = EnvGen.kr(
        Env([freq * 4, freq], [pitchDecay], \exp)
    );

    // Amplitude envelope: fast attack, exponential decay
    var ampEnv = EnvGen.kr(
        Env.perc(0.001, ampDecay, amp, -8),
        doneAction: Done.freeSelf
    );

    var osc = SinOsc.ar(pitchEnv) * ampEnv;

    // Subtle saturation for weight
    var saturated = (osc * 3).tanh * 0.33;

    Out.ar(out, saturated ! 2)
}).add;
```

The 35 variations explore the parameter space: longer pitch decay for "thud" character, shorter for "click", higher starting ratio for "electronic", physical model for "acoustic room", FM modulation for "metallic industrial". Each is documented with its synthesis parameters and intended arrangement context.

The `mix_master.scd` orchestrates everything using SuperCollider's `Pbind` pattern system:

```supercollider
// Example: 4-bar drum pattern
Pdef(\drums,
    Ppar([
        // Kick on 1 and 3
        Pbind(
            \instrument, \kick_sine,
            \dur, Pseq([1, 1, 1, 1], inf),
            \freq, 55,
            \amp, Pseq([1, 0.7, 0.9, 0.7], inf)
        ),
        // Snare on 2 and 4
        Pbind(
            \instrument, \snare_noise,
            \dur, Pseq([1, 1, 1, 1], inf) / 2,
            \amp, Pseq([0, 0.8, 0, 0.8, 0, 0.75, 0, 0.8], inf)
        ),
    ])
).play;
```

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">89</span>
    <span class="metric__label">SuperCollider files</span>
  </div>
  <div class="metric">
    <span class="metric__value">35+</span>
    <span class="metric__label">kick drum variations</span>
  </div>
  <div class="metric">
    <span class="metric__value">100%</span>
    <span class="metric__label">provably synthesised (no samples)</span>
  </div>
</div>

The full album consists of six tracks in synthwave style — pulsing bass, arpeggiated leads, pad textures, layered drums — all rendered live from SuperCollider patterns. The academic submission included a technical appendix mapping every audible element in the final mix to its `SynthDef` and parameter values.

The Karplus-Strong string model running at synthesis time for every plucked string hit was the examiner's highlight: the physical model creates subtle variations in each note attack that sample-based synthesis can't replicate without extensive programming.

The project was submitted by all seven group members but the SuperCollider implementation and synthesis library were built primarily as a solo contribution, shared as a learning resource for the group.
