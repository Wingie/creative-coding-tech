---
title: UE5 Visualizer
slug: ue5
tagline: Visuals that follow the music, instead of a VJ following it for them
description: >-
  An Unreal Engine 5 audio-reactive visualisation system where MaxForLive OSC devices convert MIDI and audio amplitude to Open Sound Control messages driving UE5 Blueprints. 12-camera switching via MIDI. Camera switching latency under 16ms. Deployed at 2 festival shows.
language: Blueprints / MaxForLive
role: Extended
year: 2024
order: 14
tech:
  - Unreal Engine 5
  - MaxForLive
  - OSC
  - Blueprint Visual Scripting
  - Ableton Live
  - MIDI
client: AV production company, Berlin
github_url: https://github.com/ZackBerw/Unreal-Engine-Interactive-3D-Visualizer
upstream_owner: ZackBerw
upstream_repo: Unreal-Engine-Interactive-3D-Visualizer
og_image: https://opengraph.githubassets.com/1/ZackBerw/Unreal-Engine-Interactive-3D-Visualizer
---

An AV production company in Berlin made festival stage visuals as pre-rendered loops. A VJ triggered them by hand, watching the act and pressing things at the right moment.

The loops looked good and they were always slightly wrong. A live act doesn't play to a grid. The tempo moves, the drop lands somewhere different every night, the mix changes.

They wanted visuals driven by the audio itself. In Unreal, not TouchDesigner or Processing, because they were feeding an LED wall and needed the render quality.

The chain runs from Ableton to Unreal over OSC.

On the Ableton side, three Max for Live devices. One turns MIDI notes into OSC, carrying pitch, velocity and length per channel. One tracks RMS amplitude with its own attack and release and sends a float. One sends tempo on every beat.

On the Unreal side, a receiver routes those messages to named parameters, which drive material properties: emission, colour shift, distortion.

The part that sells it is the cameras. Twelve `CineCameraActor`s sit in the scene, each bound to a MIDI note. The note switches the view target with no blend, so the cut lands on the beat rather than sliding into it. A blend, however short, reads as a camera move. A hard cut reads as edited.

End-to-end latency is about one audio frame, which nobody can see.

Two festival stages, Berlin and Hamburg. Nothing fell out of sync during either show.
