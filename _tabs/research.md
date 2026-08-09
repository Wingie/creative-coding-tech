---
layout: page
title: Research
icon: fas fa-flask
order: 2
description: >-
  Independent research on measuring what AI systems actually do — a canary-gated
  evaluation harness, a three-year programme on forecasting collective dynamics
  with a published dual-use policy, and work on evaluation integrity.
---

Three years of unpaid work on testing AI systems. Some of it worked. A fair amount didn't, and that's written down too.

Everything below is unfunded and unreviewed. Where a claim hasn't been tested, it says so — that's the point, not a disclaimer. Things this site has gotten wrong live on the [corrections page](/corrections/).

---

## Canary-gated evaluation

A benchmark can only tell you something if a model can't fake its way through it. The usual failure is quiet: the model produces a confident, well-formatted answer without ever looking at the data, and the scorer rewards it.

So the tasks are **filesystem-gated** and each run plants a fresh random token in the data:

```
CANARY_56eab21d1c9581f
```

The only way to emit that token is to have actually run `Read`, `Grep` or `Bash` against the files. No canary in the output means the model didn't look — which makes a hallucinated answer structurally unscoreable rather than merely wrong. Scoring weights process alongside output: tool use 25%, grounding 25%, task completion 25%, efficiency 15%, verbosity 10%.

**The harness scores the agent, not just the model.** Seven pluggable executors run the same 44 tasks against the same weights, and the results are not the same. One run of a single fine-tuned model across three harnesses scored 47.8%, 46.6% and 44.2% — and the third scored **0 out of 3 canaries**, because the model had been trained on `read_file.path` while that harness passes `Read.file_path`. Same weights, same GPU, different agent. That's a result about evaluation methodology, not about the model.

**It found bugs in itself, which is the part I'd point at.** An adversarial audit of my own scorer turned up two that mattered: it was scoring a competing executor 0.0 on real shell calls because its tool vocabulary differed from the one the rubric was written in; and it was *rewarding zero-work runs* — one-turn timeouts with no tool calls at all were scoring 0.95 on efficiency, inflating every failure by roughly 14% of the weighted total. Both are fixed. Both had been silently flattering the results.

An extension turns the canaries into a **provenance oracle**. HMAC-keyed canaries share the wire format of the plain ones, so the scorer needs no changes, but they can be re-derived from a key and a probe id. Held-back probes then answer a question you otherwise can't ask a set of weights:

| Observation | Conclusion |
|---|---|
| High match on public ids | Model has seen the public dataset |
| ~0% on held-back ids | Model was **not** trained on our private canaries |
| High match on held-back ids | Model was trained on our weights or data |

Built inside [Agentosaurus](/projects/agentosaurus/), where it's used to benchmark models and to steer fine-tuning. Twenty-two models have been through it.

*Caveat worth stating: these numbers are reproducible in my harness, scored by my scorer. They are not authoritative, and one widely-quoted leaderboard placement was provisional on a partial run.*

---

## Psychohistory

A three-year programme asking whether collective human behaviour can be forecast the way weather is — and, more usefully, marking exactly where it can't.

The paper argues that social systems hold *partial, conditional* analogues of the three properties that make numerical weather prediction work, and assembles them into a regime-aware specification with a stated boundary of failure. It is v0.5, in review, and the README leads with what has **not** been shown.

- One prediction has a **sealed pre-registered pass**: dynamic N_eff collapse, 9 of 12 cascades beating their own block-label shuffle, binomial *p* = 1.7×10⁻⁷, threshold frozen before the data was harvested.
- The bifurcation-mix conjecture is **refuted**. Conservation at basket scale is **contradicted**. Early warning is a *partial* positive that can't separate endogenous from exogenous. Those are in the README, not a footnote.
- Four forecasting falsifiers remain **pending a compute run** — blocked on hardware, not data.

The module I care most about is the **steering envelope**: a hazard law treating control-loss risk as deployment velocity over steering capacity, validated out-of-sample on road safety, aviation and a macrohistory panel — with AI as an explicit domain, using frontier-compute growth as velocity and policy plus **evaluation-institution counts** as capacity. It refuses to fit an outcome model, because no AI outcome data exists yet.

`ETHICS.md` publishes the dual-use split rather than gesturing at it: the monitor and early-warning components are released; the optimal-intervention solver, the susceptible-block targeting objective and per-individual targeting artifacts are **withheld and named as withheld**. It sets four binding conditions for any control use — an externally-authored, revisable objective; contemporaneously-disclosed intervention logs; mandatory separation of monitor from controller; and a human chooser outside the machine. It also notes that an objective "laundered through pretrained model weights" still counts as part of the auditable objective.

The packaged tool enforces that policy: it declines control-synthesis and manipulation requests. Policy in an artifact, not just in prose.

**[Read the paper and the test results →](https://wingie.github.io/psychohistory/)** · [source](https://github.com/Wingie/psychohistory)

---

## Evaluation integrity

A separate harness, currently private, built to test architectural claims about mixture-of-experts models — and built specifically because an independent build-readiness audit of its own specification came back negative.

Its useful half needs no GPU. Pre-registration that **refuses post-hoc sealing**, deriving run ordering from git ancestry rather than trusting the seal document. A lock file that stops the evaluation bar moving between the run and the report. Held-out leak filters that ban substring and hand-rolled-regex detection as unsound. Named falsifiers for corpus overlap. A capability gate scoring agentic tool selection against recorded ground truth. 533 tests, all runnable on any machine, so a referee can check the correctness layer without renting hardware.

The headline GPU run is reported as a **null result**: the router's gradient measured exactly `0.000e+00`, meaning the experiment ran the dense baseline twice. Earlier routing-entropy figures are retracted in the README as a four-sample artifact, and a throughput claim is corrected to a gradient-checkpointing effect. Work in progress — the multi-tower track is still iterating.

---

## Writing

**AI Security Risks: A Comprehensive Guide for LLM Systems** — 34 chapters on prompt injection, data poisoning, invisible data leaks, multi-agent vulnerabilities, supply-chain compromise, trust verification, immutable training and regulatory compliance. Self-published and unreviewed.

[Read it →](https://github.com/Wingie/risk_using_llms)

---

Currently studying toward the IAPP AI Governance Professional certification.
