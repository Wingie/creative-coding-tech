---
title: SYNTHesized
slug: synthesized
tagline: Thirty-five kick drums, none of them a sample
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
github_url: https://github.com/nikolaStanojkovski/SYNTHesized
upstream_owner: nikolaStanojkovski
upstream_repo: SYNTHesized
og_image: https://opengraph.githubassets.com/1/nikolaStanojkovski/SYNTHesized
---

Seven composition students had a rule for their final submission: every sound had to be generated, and you had to be able to show how. No samples, no libraries, no loops. Every kick, pad and string hit traceable to an algorithm running in real time.

Making a kick drum in SuperCollider is easy. Making thirty-five that are actually different from each other, each documented, each doing a different job in the arrangement, is not the same task.

That grew into 89 `.scd` files: a synthesis library, and a composition layer that loads it and drives the song through pattern sequencers.

The kicks alone use four different approaches, because you can't get that much variety out of one:

- **Sine with a pitch sweep.** One oscillator, exponential drop, amplitude envelope. The classic.
- **Transient plus body.** A filtered noise burst for the attack, layered with a pitched sustain. Lets you tune click and weight separately.
- **FM.** A modulator driving the carrier frequency. Metallic, clicky, cuts through a busy mix.
- **Physical model.** A damped resonator standing in for a drum membrane. Least predictable, most alive.

Each one is a `SynthDef` with its parameters exposed, so the composition layer can play the same kick five different ways.

Six tracks came out of it. It was submitted by all seven of us, though the SuperCollider library was mostly my part, and it's shared with the group as a reference.
