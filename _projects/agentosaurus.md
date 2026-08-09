---
title: Agentosaurus
slug: agentosaurus
redirect_from:
  - /projects/flowstate/
tagline: A Django platform that builds itself, and an honest ledger of which parts don't work yet
description: >-
  Agentosaurus is independent research into how agentic software-build flows behave in practice. Claude Code agents run on a schedule in isolated git worktrees, pass test, lint, performance and security gates, and open pull requests — 1,000+ merged in 2026. Underneath it is a self-hosted GPU stack, and alongside it a 44-task evaluation harness used to fine-tune a 4B model that drives the same agent loop.
language: Python
role: Built
year: 2024
order: 1
tech:
  - Python
  - Django
  - Claude Code
  - Celery
  - systemd
  - k3s
  - Beta9
  - Tailscale
  - llama.cpp
  - Unsloth
  - pgvector
client: Independent research — agentic build systems and AI power concentration
repo_private: true
live_url: https://agentosaurus.com
---

## Why

I wanted to know how agentic software-build flows actually behave, so I built some and let them run. Not a thesis — a workshop. FlowState was the first attempt; it has since grown into roughly fifteen Django apps under [agentosaurus.com](https://agentosaurus.com), each a different way of asking the same question: how much of building software can a system do on its own, and where exactly does it break?

Running it on my own hardware answered a second question I had been treating as separate. [Psychohistory](https://wingie.github.io/psychohistory/) argues in theory about what concentrating AI capability in a few providers costs. This is where that stops being an argument and becomes a bill — own GPUs, own orchestration, own weights, and a very clear view of which parts I still can't do without someone else's API.

## The build loop

Six runs a day on weekdays, triggered by systemd timers rather than cron, deliberately scheduled around working hours. The timer file carries its own scar tissue:

```ini
# Removed 08:00 slot: caused prod outage on 2026-04-17 (FlowState-t8a8) —
# morning deployments overlap with investor/demo activity. Build takes ~18min,
# restarting containers at 08:20 during business hours is unacceptable.
OnCalendar=Mon,Tue,Wed,Thu,Fri *-*-* 20:00:00 Europe/Amsterdam
```

Each run moves through phases: clean up worktrees, observe what the last run did, let a supervisor agent decide what matters, generate task prompts, build, maintain, test, report, tidy up. Models are tiered by what the phase is worth — Opus supervises, Sonnet builds, Haiku writes the retrospective.

Every task gets its own **git worktree**, so agents working in parallel can't collide. Work is sourced from a Beads issue tracker, scoped deliberately small — one task, three to five minutes. Before anything becomes a pull request it has to survive Django system checks, the test suite, a merge-conflict check, lint, a performance check and a security check. And the runner is blunt about what counts as success:

```python
# No PR found — DO NOT mark as completed
```

Most of the code is not the clever part. It's the `fcntl` lock, the API-quota check, the disk-space guard, the GitHub rate-limit preflight, the SIGTERM handlers that stop agents becoming zombies, the watchdog around critical sections, and the garbage collector for worktrees left behind by crashed runs. That accretion is the evidence it has actually been running rather than demoing.

**Result so far: over 1,000 pull requests merged in 2026**, most authored by machine on branches. It is still running — the most recent commit landed today.

## claude-run

The piece I like most is the smallest. `claude-run` is a shebang interpreter, so an agent prompt is an executable file:

```bash
#!/usr/bin/env claude-run
```

It is **read-only by default**. Write access is opt-in per invocation with `--allow-write`; without it the agent gets a curated allowlist — `Read`, `Grep`, `Glob`, `WebFetch`, and a narrow set of shell commands. Making the dangerous mode the explicit one, rather than the default, is most of the safety story.

## What it runs on

A k3s control plane on an Oracle ARM64 box hosts a [Beta9](https://github.com/beam-cloud/beta9) gateway, Redis, Postgres and a private container registry. GPU workers — a Mac and an RTX 3090 — join over a private Tailscale network. Inference is served locally by llama.cpp; training runs in an Unsloth CUDA container; retrieval uses pgvector inside my own Postgres.

I keep a written audit of that stack, and it does not flatter it. Beta9 is scored *operational, 40% complete*. Peer discovery and routing, 50%. Content-addressed cache registry, per-peer resource accounting, cross-peer cache migration, adversarial-node handling: **0%**. The "contribute a GPU" form on the site is a form — submitting it triggers no handshake and no registration. The audit's own summary is that this is "four weeks of wiring what's already there, not greenfield."

**The honest limit on sovereignty:** the default inference path still falls back to hosted APIs, and embeddings aren't local yet. Running on my own hardware is a capability I can switch on for a given workload — not a property of the whole system. Anyone claiming otherwise about a stack this size is guessing.

## Training a model to drive the loop

The agents need a model that emits real tool calls rather than talking about tools. So I fine-tuned one: a QLoRA adapter on Gemma 4 E4B, 42M trainable parameters, 78 steps over three epochs, 35 minutes on a single RTX 3090. Merged to bf16, quantised to GGUF on CPU, served at 117 tokens/sec in 5.6 GB of VRAM.

Measured on a 44-task harness, it went from **23.3% to 33.0% overall**, with tool-emission at 78.8%. That is a small model doing a job people usually rent a large one for. It is also nowhere near solved — the dominant failure is a circuit breaker tripping after three consecutive empty tool inputs.

The harness that produced those numbers is the more interesting artifact, and it has [its own page](/research/).

## What isn't finished

The presentation system this project started as is now a legacy demo — its three-agent choreography was built, then abandoned for a simpler two-agent chat, and the custom speaker-selection function is dead code that nothing calls. The peer GPU mesh doesn't exist beyond a form. Confidential computing is a plan gated on hardware I don't have. Several apps are one-commit experiments. The token ledger is mid-rewrite, deliberately stripped of anything tradeable to stay clear of MiCA.

I keep that list because the project is partly about what happens when nobody is checking. An autonomous system will happily report success forever if you let it. The audits are the part that makes the rest trustworthy.
