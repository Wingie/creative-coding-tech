---
title: Laser Desk
slug: laser-desk
tagline: A robot arm laser that a Kinect aims, so the art lands on the card you put down
description: >-
  A Rotrics DexArm with a laser head, aimed by a Kinect looking down at the
  desk. Put a card down, and the desk finds it, fits art inside it, traces the
  edges with a 1% beam, then burns.
language: Python
role: Built
year: 2026
order: 24
tech:
  - Rotrics DexArm
  - Kinect v2
  - Python
  - OpenCV
  - G-code
client: Personal project, part of the Echo Garden rig
videos:
  - src: https://media.creativecodingtech.com/videos/laser-desk-18.mp4
    poster: https://media.creativecodingtech.com/videos/laser-desk-18.jpg
    caption: "The desk finds the card, fits a portrait inside it and keeps clear of the printed text."
  - src: https://media.creativecodingtech.com/videos/laser-desk-19.mp4
    poster: https://media.creativecodingtech.com/videos/laser-desk-19.jpg
    caption: "Calibrating the surface. The arm camera sees the desk in the corner."
demos:
  - src: https://media.creativecodingtech.com/videos/demos/laser-desk.mp4
---

I wanted to put any small object on the desk and have the arm's laser draw on it. The hard part is knowing where the object is in the arm's own millimetres.

A Kinect looks down at the desk. The desk finds the card in the colour feed and maps it to arm coordinates. Then it fits line or stipple art inside the card, clear of any printed text.

Before it burns, it checks. The laser runs the outline at 1% power and the Kinect photographs each corner. If the trace sits where it should, the burn goes ahead.

## Calibration

The arm parks at each point of a grid and fires a 1% beam. The Kinect finds the glow. The first fit was a flat plane, accurate to 0.33 mm.

A 3 mm card sits off the board, so a flat fit puts it in the wrong place. I replaced it with a full camera model. A raised card that measured 57 mm now measures 52.75 mm, the same as a flat one.

With the pen module fitted, it calibrates with ink instead of a beam. The pen draws 12 small circles and one photo finds them all. That makes calibrating every session quick.

## Keeping the beam off

The arm's own app moves the art on every load, and its pause leaves the laser on. So the desk drives the arm over serial with the same G-code. Every path ends with the laser off.

A review found 4 ways the beam could stay on or the arm could go somewhere unplanned. Each one now has a test that reproduces it. STOP works even if a settings file is broken, and a burn refuses to run if the card was swapped after the fit.

It's part of the same rig as [Echo Garden](/projects/echo-garden/) and uses the same [Kinect setup](/projects/kinect-projector-calibration/) work.
