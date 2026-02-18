---
title: FlowState
slug: flowstate
tagline: Multi-agent presentation system that writes and updates its own slides in real time
description: >-
  FlowState is a distributed multi-agent orchestration system where a Manager, Updater, and Research agent collaborate in real time — one presenting, one rewriting slides on the fly, one gathering live data. Built for a European media production company that needed interactive, self-updating presentations.
language: Python
role: Built
year: 2024
order: 1
tech:
  - Python
  - AutoGen
  - Celery
  - Redis
  - OpenAI API
  - WebSocket
client: European media production company (NDA)
github_url: https://github.com/wingie/FlowState
og_image: https://opengraph.githubassets.com/1/wingie/FlowState
---

## The Problem

A European media production company was producing live broadcast events where presenters needed to respond to breaking developments mid-show. Their existing workflow required a separate slide operator, a researcher, and a presenter — three people in constant radio contact, prone to miscommunication under pressure.

They needed a single system where the presenter could talk, and the slides would update themselves based on what was being said.

## What We Built

FlowState is a three-agent loop built on Microsoft's AutoGen framework:

- **Manager Agent** — monitors the conversation, decides when new research is needed or slides need updating
- **Research Agent** — pulls live data from APIs and web sources on demand
- **Updater Agent** — rewrites or regenerates specific slide sections without interrupting the presentation flow

The agents run as Celery workers, communicating via Redis pub/sub. A WebSocket layer pushes diffs to the frontend presentation in real time.

## How It Works

The key architectural decision was using AutoGen's `GroupChatManager` with a custom `speaker_selection_func` — rather than round-robin, the manager uses a scoring function to decide which agent should act next:

```python
def speaker_selection_func(last_speaker, groupchat):
    messages = groupchat.messages
    last_msg = messages[-1]["content"] if messages else ""

    # Research trigger: presenter mentioned a statistic or claim
    if any(kw in last_msg.lower() for kw in ["according to", "studies show", "data"]):
        return research_agent

    # Update trigger: significant new information arrived
    if last_speaker == research_agent and len(last_msg) > 200:
        return updater_agent

    # Default: return to manager for routing decision
    return manager_agent
```

The Updater agent receives a structured diff instruction rather than regenerating the whole deck:

```python
@updater_agent.register_for_execution()
def patch_slide(slide_index: int, section: str, new_content: str) -> str:
    """Replace a specific section of a slide without touching the rest."""
    deck = load_deck()
    deck["slides"][slide_index][section] = new_content
    broadcast_patch(slide_index, section, new_content)
    return f"Slide {slide_index} [{section}] updated."
```

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">80%</span>
    <span class="metric__label">less prep time</span>
  </div>
  <div class="metric">
    <span class="metric__value">3→1</span>
    <span class="metric__label">operators needed</span>
  </div>
  <div class="metric">
    <span class="metric__value">&lt;2s</span>
    <span class="metric__label">slide update latency</span>
  </div>
</div>

Deployed at two live broadcast events. The presenting team went from three-person radio coordination to a single operator managing the entire flow. Live demos became genuinely interactive — the system responded to audience questions mid-session and updated context slides on the fly.

The client subsequently used the agent loop pattern for automated post-production summaries, feeding recorded session transcripts through the same pipeline to generate structured recap decks without human involvement.
