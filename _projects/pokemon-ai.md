---
title: LLM Pokémon Red
slug: pokemon-ai
tagline: A vision-language model plays a 1996 game with no hints and its own memory
description: >-
  An autonomous AI agent that plays Pokémon Red using only a vision-language model and a self-maintained markdown notepad. Built as an internal capability benchmark to expose spatial reasoning failure modes that standard datasets miss entirely.
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

## The Problem

Standard LLM benchmarks — MMLU, HumanEval, GSM8K — test isolated capabilities: knowledge retrieval, code generation, math reasoning. They don't test whether a model can reason *across time*, maintain context about state that changes frame-by-frame, and plan ahead when the environment doesn't give you explicit affordances.

Pokémon Red is a 1996 Game Boy RPG. No tooltips. No accessibility helpers. Just pixels and game logic that the model has to infer from visual history.

The question: can a vision model actually *play* it?

## What We Built

A fully autonomous agent loop built on PyBoy (Game Boy emulator) + Claude's vision API:

1. **Frame capture** — the emulator renders each frame; a PIL pipeline upscales 160×144 → 480×432 and boosts contrast for the vision model
2. **Notepad memory** — the model maintains a markdown file (`memory.md`) where it records map locations, items collected, blocked paths, and failed strategies
3. **Tool calling loop** — the model receives the frame and its own notepad, then calls tools like `press_button`, `read_dialog`, `update_memory`
4. **Curriculum planner** — a lightweight state machine tracks high-level goals (get starter → beat Brock → reach Cerulean City) and injects them into the prompt

## How It Works

The image enhancement pipeline is the first thing that made a real difference:

```python
def enhance_frame(raw_frame: PIL.Image) -> PIL.Image:
    # 3x upscale with nearest-neighbor to preserve pixel art
    frame = raw_frame.resize(
        (raw_frame.width * 3, raw_frame.height * 3),
        PIL.Image.NEAREST
    )
    # Boost contrast for the vision model
    enhancer = ImageEnhance.Contrast(frame)
    frame = enhancer.enhance(1.8)
    return frame
```

The model's self-maintained notepad is the second critical piece. Rather than relying on conversation history (which would blow the context window after 20 minutes), the model writes structured updates:

```markdown
## Current location
Route 1, heading north. Last known position: just south of Viridian City entrance.

## Inventory
- Potion x2
- Pokéball x5
- Pokedex

## Blocked paths
- Dark cave north of town: need HM Flash (not obtained)

## Failed strategies
- Trying to use Bulbasaur against Brock's Onix: rock is resistant to grass. Need Pidgey.
```

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">7</span>
    <span class="metric__label">gym badges obtained autonomously</span>
  </div>
  <div class="metric">
    <span class="metric__value">3</span>
    <span class="metric__label">spatial failure modes identified</span>
  </div>
  <div class="metric">
    <span class="metric__value">0</span>
    <span class="metric__label">human interventions</span>
  </div>
</div>

The benchmark revealed specific, reproducible failure modes that standard datasets don't surface: the model consistently misjudges relative position when exiting buildings (the screen transitions don't give clear cardinal direction cues), struggles with inventory management across long sessions, and occasionally loops in areas with visually similar tiles.

These failure modes were documented and fed back into evaluation work. The project showed that long-horizon spatial reasoning — not just perception — is the hard problem for current vision models.
