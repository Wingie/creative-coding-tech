---
title: Ableton MCP
slug: ableton-mcp
tagline: Describe a chord progression. Hear it immediately. No mouse required.
description: >-
  Ableton MCP is a Model Context Protocol integration that lets AI assistants directly control Ableton Live via TCP socket + Python MIDI Remote Scripts. Built for a conservatory music tech lab where students with no DAW experience produced complete arrangements in two hours.
language: Python
role: Extended
year: 2024
order: 5
tech:
  - Python
  - MCP
  - Ableton Live API
  - TCP Sockets
  - MIDI Remote Scripts
  - JSON-RPC
client: Music technology lab, conservatory (NDA)
github_url: https://github.com/wingie/ableton-mcp
og_image: https://opengraph.githubassets.com/1/ahujasid/ableton-mcp
---

## The Problem

A music technology lab at a European conservatory was running workshops for composition students — many of whom had no prior DAW experience. Teaching Ableton Live's interface takes weeks. Teaching chord voicing, arrangement structure, and creative experimentation should take one session.

The bottleneck was the gap between musical intention and technical execution. A student knows they want "a minor 7th chord with an open voicing" — getting that into Ableton requires knowing where clips, MIDI editors, and note input modes are. The lab wanted to eliminate that gap entirely.

## What We Built

Ableton MCP bridges Claude's tool-calling interface to Ableton Live's Python MIDI Remote Scripts via a TCP socket server. The MCP server runs locally, receives JSON commands from Claude, and translates them into Live API calls.

The architecture is deliberately simple: a FastMCP server on one side, a persistent TCP connection to a Python addon running inside Ableton on the other. No external services, no cloud APIs for the audio control path.

## How It Works

The TCP protocol uses newline-delimited JSON. Each command has an `action` field and action-specific parameters:

```python
# Ableton addon: receive commands, execute via Live API
import json
import socket
from _Framework.ControlSurface import ControlSurface

class MCPBridge(ControlSurface):
    def __init__(self, c_instance):
        super().__init__(c_instance)
        self._server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._server.bind(("127.0.0.1", 9000))
        self._server.listen(1)
        self._schedule_message(0, self._accept_connection)

    def _handle_command(self, cmd: dict):
        action = cmd.get("action")

        if action == "create_clip":
            track = self.song.tracks[cmd["track_index"]]
            clip_slot = track.clip_slots[cmd["scene_index"]]
            clip_slot.create_clip(cmd.get("length", 4.0))

        elif action == "add_note":
            # 100ms delay before state-modifying commands
            # avoids Live's undo stack corruption
            self._schedule_message(1, lambda: self._add_note(cmd))

        elif action == "set_tempo":
            self.song.tempo = cmd["bpm"]
```

The 100ms scheduling delay before state-modifying commands (`add_note`, `delete_clip`, `set_volume`) was discovered through testing — Ableton's undo stack would occasionally get corrupted if commands arrived faster than the Live runtime could process them. The delay costs negligible latency in practice.

The MCP server exposes 18 tools covering clip creation, MIDI note placement, tempo/key changes, device parameter control, and session transport.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">3</span>
    <span class="metric__label">workshops delivered</span>
  </div>
  <div class="metric">
    <span class="metric__value">2 hrs</span>
    <span class="metric__label">from zero to arrangement</span>
  </div>
  <div class="metric">
    <span class="metric__value">0</span>
    <span class="metric__label">prerequisite DAW knowledge</span>
  </div>
</div>

Students described chord progressions in plain language ("make it darker, add a sus4 before the resolution"), asked for style variations ("more jazz, less pop"), and had the system render their ideas directly into the Live session. By the end of each two-hour session, every participant had a complete four-bar arrangement with drums, bass, chords, and a lead melody.

The lab is now using the same approach for film scoring workshops, where students control scene-synced cue composition via conversation.
