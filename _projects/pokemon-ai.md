---
title: LLM Pokémon Red
slug: pokemon-ai
tagline: Can a vision model play a game that explains nothing?
description: >-
  Can a vision model play a 1996 Game Boy game that explains nothing? Upscaling
  the frame and giving it a notepad were the two changes that mattered.
language: Python
role: Built
year: 2024
order: 2
tech:
  - Python
  - Claude Vision API
  - PIL
  - PyBoy (Game Boy emulator)
  - Tool calling
client: Internal R&D / capability benchmarking
github_url: https://github.com/wingie/claude-plays-pokemon
og_image: https://opengraph.githubassets.com/1/wingie/claude-plays-pokemon
screenshot: /assets/img/projects/pokemon-ai.png
---

Benchmarks like MMLU and HumanEval test one thing at a time. Recall a fact. Write a function. Solve a maths problem.

None of them test whether a model can hold onto something over hours, track a world that changes every frame, and plan when nothing tells it what its options are.

Pokémon Red is a Game Boy RPG from 1996. No tooltips, no hints, no accessibility layer. Pixels and rules you have to work out by looking.

So: can a vision model play it?

The agent runs on PyBoy with a vision model in the loop. Two parts made the difference.

**Upscaling the frame.** The Game Boy renders 160x144. Sent straight to a vision model, that's close to useless. Upscaling to 480x432 and pushing the contrast first is the single change that moved it from flailing to playing. The model isn't bad at seeing. It was being handed a thumbnail.

**A notepad it writes itself.** The model keeps a markdown file of where it's been, what it's carrying, which paths are blocked, and which plans have already failed. Each turn it gets the current frame and its own notes. Without that it walks into the same wall for an hour, because nothing on screen tells it that it already tried this.

On top of those, a small state machine tracks the current goal, so the prompt says get the starter, or beat Brock, rather than leaving it to work out what it should be doing from first principles.

It got seven gym badges over about forty hours of play, with nobody touching the controls and no save-state reloads.

The interesting failures were spatial. It reads a scene fine. It struggles to know it's been in this room before, from a different door.
