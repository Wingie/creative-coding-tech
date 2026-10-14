---
title: TouchDesigner Performance Rig
slug: touchdesigner-performance-rig
tagline: Hands, a body and a Kinect playing Ableton Live from a Mac
description: >-
  The rig under my live sets. A Kinect v2, MediaPipe hand tracking and
  Wekinator feed TouchDesigner and a Python event bus, which play Ableton Live
  over OSC and MIDI.
language: TouchDesigner / Python
role: Built
year: 2026
order: 21
tech:
  - TouchDesigner
  - TDAbleton
  - Ableton Live
  - Kinect v2
  - MediaPipe
  - Wekinator
  - OSC
  - MIDI
  - Syphon
client: Live performance / personal creative project
videos:
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-09.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-09.jpg
    caption: "A hand in the infrared feed leaves a light trail."
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-11.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-11.jpg
    caption: "The rig with Ableton's mixer on top and an RGB-split effect on the body."
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-13.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-13.jpg
    caption: "The TouchDesigner network, with infrared previews in the nodes."
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-08.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-08.jpg
    caption: "The network the rig runs on."
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-17.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-17.jpg
    caption: "A performer by the cloth screen, with hand tracking on."
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-20.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-20.jpg
    caption: "A performer in infrared, with hand points and bones over her arms."
  - src: https://media.creativecodingtech.com/videos/touchdesigner-performance-rig-21.mp4
    poster: https://media.creativecodingtech.com/videos/hotlink-ok/touchdesigner-performance-rig-21.jpg
    caption: "Arm and hand tracking while Ableton runs."
demos:
  - src: https://media.creativecodingtech.com/videos/demos/touchdesigner-performance-rig.mp4
---

This is the setup I play live sets on. [Echo Garden](/projects/echo-garden/) runs on top of it.

It started from a Windows tutorial project where a Kinect plays Ableton through TouchDesigner. That needs TouchDesigner's Kinect operators, which only ship on Windows. On my Mac the Kinect arrives over Syphon instead, through my [Kinect calibration work](/projects/kinect-projector-calibration/).

Hands come from MediaPipe, through torinmb's TouchDesigner plugin. It runs in a browser and streams hand landmarks back. I mostly use pinch distance, the gap between thumb and index finger, on both hands.

Raw landmarks jitter. Each value goes through a One Euro filter, then a Lag CHOP, then a Math CHOP before it reaches Ableton. TDAbleton maps them onto 7 device racks. I have an 808 set and a dub techno set built this way.

Wekinator handles poses. You show it a few examples and it learns to tell them apart. Its classes crossfade Ableton CCs.

The hard part was ports. A pile of separate scripts fought over the same UDP ports. Now one Python process, the gateway, owns an event bus. Every input publishes to it, every output reads from it, and each port has one owner. Wekinator always sends to 12020.

Note timing skips TouchDesigner. TouchDesigner runs on a 60 fps frame clock, so it would snap every note to a 16.7 ms grid. Notes go from Python straight to Ableton over the IAC MIDI bus. TouchDesigner keeps the slow layer: macros, visuals and the Wekinator training screen.

Some hardware can only have one owner. The Kinect's USB connection is one, and the projector is another. A start script checks first. Is the Syphon app running? Is a projector attached? Who holds the robot arm's port? It also never projects onto the laptop screen.
