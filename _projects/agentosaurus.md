---
title: Agentosaurus
slug: agentosaurus
redirect_from:
  - /projects/flowstate/
tagline: Multi-agent orchestration where the pull request is the message bus — pointed at climate and ESG work
description: >-
  Agentosaurus is a sustainability organisation discovery and ESG due-diligence platform that builds itself. Claude Code agents coordinate through pull requests rather than shared memory — a supervisor reviews PRs and files tasks, builders work them in isolated worktrees, and the review is the channel. Over 1,000 PRs merged in 2026, running on self-hosted GPUs. Looking for compute contributions.
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
client: Independent research — agentic build systems, ESG intelligence, sovereign compute
repo_private: true
live_url: https://agentosaurus.com
---

## What it's for

[Agentosaurus](https://agentosaurus.com) finds and analyses organisations working on the UN Sustainable Development Goals, and runs ESG due diligence on them — crawling sources, verifying claims across them, and producing reports with an audit trail back to the raw data. The compliance side is built as an EU-sovereign OSINT pipeline: entity, multi-source analysis, per-source raw results retained so a conclusion can be traced to what produced it.

That's the work. The second thing going on is that **the platform builds itself**, and I've been using it to find out how agentic build flows behave when you actually let them run.

## Pull requests as the message bus

The interesting architectural decision is how the agents talk to each other. They don't share memory, and they don't message each other directly. **They communicate through pull requests.**

A supervisor agent reads the PRs from the previous run — the diffs, the review comments, what passed and what didn't — and files one issue per problem it finds. Builder agents pick up whatever is ready, work a single task scoped to a few minutes in an isolated git worktree, and open a PR. That PR becomes the next supervisor's input.

```
supervisor reads PR reviews  →  files one task per issue
builder claims a ready task  →  isolated worktree  →  gates  →  opens PR
                            ↑                                     │
                            └─────────────────────────────────────┘
```

This falls out of a constraint rather than a whiteboard. The earlier design had long-running agents holding context and timing out at twelve minutes; the notes on the migration list the reasons plainly — granular tasks, tasks that survive a crash, priority ordering, and progress you can actually count. Making the PR the channel gets you all four for free, because the PR is already durable, already reviewable, already ordered, and already the thing a human would look at.

It also means the system is legible. Every decision an agent made is sitting in a diff with a review attached. When it goes wrong you read it the same way you'd read a colleague's work.

The runner is unsentimental about what counts as done:

```python
# No PR found — DO NOT mark as completed
```

Nothing merges without passing Django system checks, the test suite, a merge-conflict check, lint, a performance check and a security check. Runs fire six times a day on weekday systemd timers, deliberately scheduled around working hours — the timer file still carries the comment from the morning deploy that took production down.

**Over 1,000 pull requests merged in 2026**, most machine-authored on branches, and it's still running — the most recent landed today.

Most of the code is not the clever part. It's the lock file, the quota check, the disk guard, the rate-limit preflight, the signal handlers that stop agents becoming zombies, and the collector for worktrees left behind by crashed runs. Agent prompts are executable files via a small `claude-run` interpreter that is read-only unless a run explicitly opts into writes.

## Compute, and why I self-host it

A k3s control plane on an ARM64 box hosts a [Beta9](https://github.com/beam-cloud/beta9) gateway, Redis, Postgres and a private registry. GPU workers join over a private Tailscale network. Inference is served locally by llama.cpp, training runs in an Unsloth CUDA container, and retrieval uses pgvector inside my own Postgres.

Partly that's cost. Mostly it's the argument [psychohistory](/research/) makes in theory — that concentrating AI capability in a handful of providers has a price — and this is where that stops being an argument and becomes a bill.

To keep the agent loop cheap enough to run six times a day, I fine-tuned a model to drive it: a QLoRA adapter on Gemma 4 E4B, 42M trainable parameters, 35 minutes on a single RTX 3090, quantised to GGUF and served at 117 tokens/sec in 5.6 GB of VRAM. On a 44-task harness it went from **23.3% to 33.0%**, with tool-emission at 78.8%. The [evaluation harness](/research/) that produced those numbers is the more interesting artifact.

### Looking for compute

The platform is climate work and it is idle most of the night. If you have GPUs sitting unused and you'd like them pointed at sustainability analysis rather than nothing, I'd like to hear from you — [get in touch](/contact/).

Being straight about the state of it: the contribution flow is a form and a plan, not a working mesh. My own audit scores peer discovery and routing at 50%, and the content-addressed cache registry, per-peer resource accounting, cross-peer migration and adversarial-node handling at **0%**. Right now a contribution means a conversation and a Tailscale invite, not a self-serve button.

## What isn't finished

The presentation system this started as is now a legacy demo — its three-agent choreography was built, then abandoned for a simpler two-agent chat, and the custom speaker-selection function is dead code nothing calls. Beta9 is scored *operational, 40% complete*. Confidential computing is a plan gated on hardware I don't have. Several apps are one-commit experiments. The token ledger is mid-rewrite, deliberately stripped of anything tradeable to stay clear of MiCA.

And the honest limit on sovereignty: the default inference path still falls back to hosted APIs, and embeddings aren't local yet. Own-hardware is a capability I can switch on for a workload — not a property of the whole system.

I keep that list because the project is partly about what happens when nobody is checking. An autonomous system will report success indefinitely if you let it. The audits are what make the rest worth believing.
