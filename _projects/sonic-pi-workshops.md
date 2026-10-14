---
title: Sonic Pi Live-Coding Workshops
slug: sonic-pi-workshops
tagline: Making music with code, starting from one note
description: >-
  Workshops where people write music in Sonic Pi, from a first note to their
  own short track, with graded exercises and decks I wrote.
language: Ruby (Sonic Pi)
role: Built
year: 2025
order: 22
tech:
  - Sonic Pi
  - Ruby
  - Ableton Live
  - MIDI
  - OSC
  - Ableton Link
  - reveal.js
client: Creative coding workshops
videos:
  - src: https://media.creativecodingtech.com/videos/sonic-pi-workshops-01.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/sonic-pi-workshops-01.jpg
    caption: "From the intro workshop: first sounds in Sonic Pi."
  - src: https://media.creativecodingtech.com/videos/sonic-pi-workshops-02.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/sonic-pi-workshops-02.jpg
    caption: "From the Ableton workshop: setting up Live to take Sonic Pi's MIDI."
demos:
  - src: https://media.creativecodingtech.com/videos/demos/sonic-pi-intro.mp4
    title: "the intro workshop"
  - src: https://media.creativecodingtech.com/videos/demos/sonic-pi-ableton.mp4
    title: "Sonic Pi with Ableton"
---

Sonic Pi is a free live-coding synth. You type a few lines of Ruby, press run, and it plays. Change the code while it runs and the music changes with it.

The workshop is for all ages and levels. You don't need to have coded or played an instrument. Bring a laptop and headphones, and keep the headphones on until you want to share.

It runs in three stages. Melody Maker covers notes, chords and silence over 9 short files. Drum Machine adds a beat in 6. Major Scale brings in a first scale, swapping samples and repeating loops, in 8. Each file adds one idea to the one before. The first file is two lines: `play :A` and `sleep 1`.

Then comes Your Gig. You pick from a folder of samples and build your own track.

I start with melody and rhythm before anything else. The programming ideas come in as the music needs them.

I wrote seven decks in reveal.js to go with it. They cover an intro to Sonic Pi, Sonic Pi with Ableton, playing live, two on algorithmic drums, a Bach prelude over MIDI, and patterns and rhythm.

The Ableton deck is for people who already know one of the two tools. Sonic Pi sends notes and controller changes to Ableton over MIDI, triggers clips over OSC, and Ableton Link keeps the tempo. It's planned as 8 sessions. One part covers what to do when code breaks or timing drifts in the middle of a set.

You can [read the Ableton and Sonic Pi deck](/assets/workshops/ableton-sonic-pi/). The other workshops I run are on the [facilitation page](/facilitation/).
