---
title: Hybrid DJ Set
slug: hybrid-dj
tagline: A DJ set that generates its own accompaniment, in key, in sync, without a second performer
description: >-
  Hybrid DJ Set is a live performance system where Mixxx MIDI clock drives Pure Data patches — a three-band crossover feeds FM synthesis, Karplus-Strong physical modelling, and a generative drum sequencer. Performed live at 4 events; audiences consistently couldn't distinguish generated from sampled.
language: Pure Data / Max/MSP
role: Built
year: 2023
order: 13
tech:
  - Pure Data
  - Mixxx
  - MIDI
  - FM Synthesis
  - Karplus-Strong
  - OSC
  - Ableton Link
client: Live performance / personal creative project
github_url: https://github.com/wingie/hybrid-dj-set
og_image: https://opengraph.githubassets.com/1/MikeMorenoDSP/Hybrid-DJ-Set
---

## The Problem

Standard DJ sets are selection and mixing. The DJ chooses from a pre-existing library; the creativity is in sequencing, transition, and energy management. Adding live synthesis usually means a second performer — a keyboardist, a live drummer, an Ableton operator — which adds logistics, ego management, and technical complexity.

The question was whether a solo DJ could have *generated* accompaniment that sounds like a second performer — responsive to tempo and key changes in the DJ set, but running autonomously once started.

## What We Built

A Pure Data patch ecosystem with 16 sub-patches, driven by MIDI clock from Mixxx. The signal flow:

1. **Mixxx** sends MIDI clock and beat markers via MIDI Out
2. **PD clock receiver** derives tempo, beat position, and bar count
3. **Three-band crossover** analyses the incoming DJ mix audio:
   - Sub-bass energy → feeds kick drum pattern intensity
   - Mid energy → feeds melodic synthesis activity level
   - High energy → feeds generative percussion complexity
4. **Key detector** (phase vocoder-based) estimates the current key of the playing track
5. **Synthesis engines** receive tempo + key + energy envelope and generate accordingly

## How It Works

The Karplus-Strong string synthesis patch is the melodic backbone. It generates plucked string textures that stay in the detected key of the DJ track:

```puredata
#N canvas;
# Karplus-Strong string synthesis — simplified representation

# Delay line length = sample rate / fundamental frequency
[/ 44100]          ; divide sample rate by target freq
[round~]           ; round to nearest sample
[delwrite~ string-buf 2048]

# Excitation: short noise burst on each trigger
[noise~]
[*~ 0]             ; gain controlled by envelope
[line~]            ; smooth envelope

# Feedback with low-pass filtering (string damping model)
[delread~ string-buf]
[lop~ 3000]        ; low pass for high-freq damping
[*~ 0.995]         ; feedback coefficient (just below 1)
```

The key detection feeds a scale quantiser — every generated note is snapped to the current detected scale before being sent to synthesis. This means even random melodic generation stays consonant with whatever the DJ is playing.

The generative drum sequencer uses a Euclidean rhythm algorithm: for a given `n` beats across `k` steps, it distributes them maximally evenly. This creates rhythmic patterns that are mathematically regular but perceptually interesting.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">4</span>
    <span class="metric__label">live events</span>
  </div>
  <div class="metric">
    <span class="metric__value">1</span>
    <span class="metric__label">performer required</span>
  </div>
  <div class="metric">
    <span class="metric__value">0</span>
    <span class="metric__label">audience members who guessed it was generated</span>
  </div>
</div>

Performed at four events ranging from 80 to 400 people. Post-show conversations revealed that audiences consistently assumed there was a live synth player offstage. The three-band reactivity — the generated elements responding dynamically to the energy of the DJ mix — was the key to making it sound organic rather than looped.

The system is deliberately not Ableton-based. Pure Data runs headlessly, costs nothing, and has essentially zero latency on the MIDI clock sync. This matters in a live context where a 10ms drift becomes audible at 140 BPM.
