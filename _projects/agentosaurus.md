---
title: Agentosaurus
slug: agentosaurus
redirect_from:
  - /projects/flowstate/
tagline: An autonomous AI build system, self-hosted end to end
description: >-
  FlowState / Agentosaurus is an independent research project: a multi-agent orchestration system and a self-hosted GPU stack that runs training and 30B-class inference on my own hardware. It is the practical arm of the same question psychohistory asks in theory — what concentrating AI capability costs, and what it takes to not depend on it.
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
client: Independent research — autonomous build systems and AI power concentration
repo_private: true
live_url: https://agentosaurus.com
---


## Why

I wanted to find out how agentic software-build flows actually work in practice, so
I built some and ran them. Not a thesis — a workshop. FlowState was the first
attempt; it has since grown into several projects under
[agentosaurus.com](https://agentosaurus.com), each one a different way of asking the
same question: how much of building software can a system do on its own, and where
does it break?

Running it myself, on my own hardware, turned out to answer a second question I had
been treating separately. [Psychohistory](https://wingie.github.io/psychohistory/)
argues in theory about what concentrating AI capability in a handful of providers
costs. Agentosaurus is where that stops being an argument and becomes a bill — own
GPUs, own orchestration, own weights, and a very clear view of exactly which parts I
still can't do without someone else's API.

## What It Does

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

## Status

Independent research, ongoing. The stack currently runs multi-agent orchestration
over a self-hosted Beta9 gateway, with GPU workers joined over a private Tailscale
network and inference served locally from llama.cpp. Fine-tuned adapters trained on
this rig are published on Hugging Face.

Honest limit: the default inference path still falls back to hosted APIs
(Fireworks, OpenRouter) and embeddings are not yet local. Sovereignty here is a
capability I can switch on for a workload, not a property of the whole system.
