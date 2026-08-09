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

[Agentosaurus](https://agentosaurus.com) writes most of its own code. Over a thousand pull requests merged in 2026, opened by agents that coordinate with each other exclusively through code review. What they're building is a search engine for organisations working on climate.

The product side finds and analyses organisations working on the UN Sustainable Development Goals and runs ESG due diligence on them — crawling sources, checking claims across them, keeping every per-source result so a conclusion can be traced back to what produced it. It's built as an EU-sovereign OSINT pipeline, which mostly means the audit trail is the feature and the report is the by-product.

The build side is the experiment: I wanted to know how agentic build flows behave when you stop supervising each step, so I stopped.

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

### Contribute compute

The climate analysis is the workload I most want more GPU for, and the rig is idle most of the night. If you have hardware sitting unused, I'll get it running on SDG organisation discovery and ESG verification.

Onboarding today is a conversation and a Tailscale invite — deliberately, while the accounting layer is being built. I'd rather hand-run the first dozen contributors and know exactly what each node did than ship a self-serve button that can't answer that.

**[Get in touch →](/contact/)**

## What's next

**Peer compute accounting.** Routing between nodes works. Content-addressed caching, per-node resource accounting and adversarial-node handling are the current build — the things that turn a private mesh into something strangers can safely join.

**Attested execution.** The design targets GPU trusted execution environments, so a contributed node can run a model without its operator seeing the weights or the data. Waiting on hardware that supports it.

**Moving more of the loop off hosted APIs.** Training and 30B-class inference already run on my own machines. The default inference path and the embedding layer don't yet. I know precisely which workloads I can move and what each costs to move — which is the useful form of that answer, and more than most people running a sovereignty argument can tell you.

One deliberate subtraction: the platform's contribution ledger was designed with a token, and I took it out. It records entitlement to run compute, nothing tradeable, no wallet, no exchange value — which keeps it clear of MiCA and securities exposure entirely. Cheaper to remove the feature than to defend it.

The first architecture I built for this — three agents in a fixed choreography, passing turns to each other — didn't work, and the code that decided who spoke next now sits in the repo unreferenced. The second one is the PR loop above, which came out of the wreckage of the first. That's generally how I find the right answer: by being wrong in a way that leaves evidence.

I audit all of this against the code and publish the results, because an autonomous system will report success indefinitely if nobody checks. Knowing which parts are load-bearing and which are scaffolding is the entire skill.
