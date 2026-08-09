---
title: Hybrid DJ Set
slug: hybrid-dj
tagline: A second performer that doesn't need feeding, paying, or persuading
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
github_url: https://github.com/MikeMorenoDSP/Hybrid-DJ-Set
upstream_owner: MikeMorenoDSP
upstream_repo: Hybrid-DJ-Set
og_image: https://opengraph.githubassets.com/1/MikeMorenoDSP/Hybrid-DJ-Set
---

A DJ set is selection and mixing. You pick from records that exist, and the craft is in sequencing, transitions and where you take the energy.

Adding live playing on top usually means adding a person. A keyboardist, a drummer, someone on Ableton. That means rehearsal, splitting the fee, and one more thing to go wrong on stage.

I wanted to know whether the accompaniment could generate itself: in time, in key, and left alone once it starts.

This is built on [MikeMorenoDSP's Hybrid DJ Set](https://github.com/MikeMorenoDSP/Hybrid-DJ-Set), a Pure Data patch collection driven by MIDI clock.

Mixxx sends clock and beat markers. Pure Data works out tempo, beat position and bar count from that, so everything downstream stays locked to the record that's actually playing.

Then it listens to the mix itself, split into three bands. Sub-bass energy drives how busy the kick pattern is. Mids drive the melodic parts. Highs drive the generative percussion. So when a track drops, the generated material drops with it, without me touching anything.

The part that makes it usable live is the key detection. A phase vocoder estimates the key of whatever is playing, and everything generated gets quantised into that scale. Random note choice stays consonant with the record. Get this wrong and it's immediately, obviously wrong to everyone in the room.

Rhythms come from a Euclidean sequencer, which spreads a number of hits as evenly as possible across a bar. Mathematically regular, and it doesn't sound like a metronome.

Timing is the whole game here. At 140 BPM, ten milliseconds of drift is audible.

Played four events, from about 80 people to about 400.
