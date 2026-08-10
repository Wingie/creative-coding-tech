---
title: Ableton MCP
slug: ableton-mcp
tagline: Students who'd never opened a DAW, writing music in one session
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
github_url: https://github.com/ahujasid/ableton-mcp
upstream_owner: ahujasid
upstream_repo: ableton-mcp
og_image: https://opengraph.githubassets.com/1/ahujasid/ableton-mcp
---

Teaching Ableton's interface takes weeks. Teaching chord voicing and arrangement should take an afternoon.

A music technology lab at a European conservatory was spending its workshops on the first thing. Most of their composition students had never opened a DAW.

A student knows they want a minor 7th with an open voicing. Getting that into Ableton means knowing where clips live, how the MIDI editor works, and which note input mode you're in. The lab wanted that gap gone.

[Ableton MCP](https://github.com/ahujasid/ableton-mcp) is Siddharth Ahuja's project. It connects an AI assistant to Live's Python remote scripts over a local socket. I extended it for the lab's teaching setup.

The design is dull on purpose. An MCP server on one side, a persistent TCP connection to an addon running inside Ableton on the other, newline-delimited JSON between them. Nothing goes to a cloud service. About eighteen tools cover clips, notes, tempo and key, device parameters and transport.

## The one interesting bug

Anything that changes state waits 100ms before it fires.

I found that by breaking it. Send commands faster than the Live runtime handles them and the undo stack corrupts. Not a crash, which would have been easier. Undo just starts doing the wrong thing, and you don't notice until you need it.

100ms is far too slow for anything real-time and completely invisible to a person talking to an assistant. Nobody types that fast.

## What happened

Three workshops. Students had a four-bar arrangement by the end of a two-hour session, with no prior Ableton knowledge. The lab has since used the same setup for film scoring, where students write cues against a scene by describing them.
