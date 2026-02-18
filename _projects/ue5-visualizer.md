---
title: UE5 Visualizer
slug: ue5
tagline: Genuinely reactive visuals, not pre-rendered loops someone triggers manually
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
github_url: https://github.com/wingie/ue5-visualizer
og_image: https://opengraph.githubassets.com/1/ZackBerw/Unreal-Engine-Interactive-3D-Visualizer
---

## The Problem

An AV production company in Berlin was producing festival stage visuals using pre-rendered loops — carefully crafted animations that VJs triggered manually to match the music. The problem: the loops were disconnected from the actual audio. A live act doesn't play to a grid; tempo changes, drops land differently each night, the mix varies.

The client wanted visuals that were *actually reactive* — not triggered by a human watching the music, but driven by the music itself. And they wanted this inside Unreal Engine 5, not Processing or TouchDesigner, because they needed the rendering quality for LED wall output.

## What We Built

A signal chain from Ableton Live to Unreal Engine 5, driven by MaxForLive devices and Open Sound Control.

**MaxForLive devices (Ableton side):**
- MIDI Note Reactor: converts note pitch, velocity, and duration to OSC messages per channel
- Audio Envelope Extractor: RMS amplitude with configurable attack/release → OSC float
- BPM Clock: sends tempo as OSC float on every beat

**UE5 Blueprint system:**
- OSC Receiver Blueprint: receives all incoming OSC messages, routes to named parameters
- Material Parameter Controller: drives material shader parameters (emission intensity, colour shift, distortion amount) from OSC float values
- Camera Switcher: 12 cameras mapped to MIDI notes C-2 through C-1; note-on triggers instant cut, note-off optionally triggers transition

## How It Works

The MaxForLive audio envelope extractor is the audio bridge. It runs at audio rate, computes RMS amplitude with a configurable smoothing window, and sends the result as an OSC message on every audio buffer:

```javascript
// MaxForLive JavaScript (simplified)
const SMOOTHING_MS = 50;  // attack/release envelope
const OSC_ADDRESS = "/audio/amplitude";

inlets = 1;
outlets = 1;

var rmsBuffer = [];
var smoothedRms = 0;

function signal(amp) {
    rmsBuffer.push(amp * amp);
    if (rmsBuffer.length > 128) rmsBuffer.shift();

    const rms = Math.sqrt(rmsBuffer.reduce((a, b) => a + b, 0) / rmsBuffer.length);
    smoothedRms = smoothedRms * 0.9 + rms * 0.1;  // one-pole smoothing

    sendOSC(OSC_ADDRESS, smoothedRms);
}
```

On the UE5 side, the OSC Receiver Blueprint routes messages to material parameters:

```
Event On OSC Message Received
  → Switch on OSC Address
    "/audio/amplitude" → Set Material Parameter "Emission Intensity" (float)
    "/midi/note"       → Camera Switcher → Select Camera by Note Index
    "/bpm"             → Set Timeline Play Rate
```

The camera switcher maps 12 MIDI notes to 12 pre-placed `CineCameraActor` instances. Note-on triggers an immediate `SetViewTarget` call — no blend, instant cut. The 16ms latency is one audio frame; it's imperceptible and matches the feel of a hardware video switcher.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">2</span>
    <span class="metric__label">festival shows deployed</span>
  </div>
  <div class="metric">
    <span class="metric__value">&lt;16ms</span>
    <span class="metric__label">camera switch latency</span>
  </div>
  <div class="metric">
    <span class="metric__value">0</span>
    <span class="metric__label">sync issues across both shows</span>
  </div>
</div>

Deployed at two outdoor festival stages in Berlin and Hamburg. The visuals ran autonomously once the Ableton set started — no VJ required. The AV director used the 12-camera MIDI note system to direct cuts from the same keyboard controlling other MIDI devices, requiring zero additional crew.

The client noted that audience response was measurably different from pre-rendered visuals — the reactivity creates a perceptible sense of "the visuals are listening to the music" rather than just playing alongside it.
