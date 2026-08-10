---
layout: page
title: Research
icon: fas fa-flask
order: 2
description: >-
  Unpaid research on AI systems. Proving what data a model was trained on,
  training small models on one GPU, and asking whether crowd behaviour can be
  forecast.
---

Three years of unpaid work on testing AI systems. What worked and what didn't are both in the repos.

---

## Proving what a model was trained on

Someone fine-tunes a model on your data. Can you prove it afterwards?

You can, if you plan ahead. I put keyed markers in the training data. The markers come from a secret key, so I can work out later what the answer should be for any given prompt. Then I ask a suspect model those prompts and see what comes back.

- It knows the public markers but not the private ones: it saw the public dataset, not mine.
- It knows the private ones too: it trained on my data, or on weights that did.
- It knows neither: it never saw any of this.

The markers look like random strings, so nothing downstream needs changing to handle them, and nobody reading the training data can pick them out without the key.

This gets more useful as models get passed around and fine-tuned by people you'll never meet. Right now, if someone trains on a dataset they shouldn't have, there's usually no way to show it.

---

## A test suite for agents

Different work, same repository.

Most benchmarks score the answer. This one scores the working: did the agent pick the right tools, are its claims backed by what those tools returned, did it finish the job. Marks split across tool use, grounding, completion, efficiency and how much it waffles.

Twenty-two models have been through it on 44 tasks.

The useful finding was about the test, not the models. I ran one fine-tuned model through three different agent frameworks. Same weights, same GPU. It scored 47.8%, 46.6% and 44.2%. The third failed a check the other two passed, because the model had been trained to call `read_file.path` and that framework passes `Read.file_path`. Change the wrapper, get a different agent.

It also found two bugs in itself. It was scoring a rival framework zero on real shell commands, because that framework names its tools differently and my scorer only knew mine. And it was rewarding runs that did nothing: a one-turn timeout with no tool calls scored 0.95 for efficiency, which quietly inflated every failure. Both fixed.

My suite, my scorer.

---

## LOGOS: making a small model better at agent work

I'm running continued pretraining on one RTX 3090, with a new mixture-of-towers architecture.

**Where it stands: training on agentic trajectories does increase capability.** Recordings of agents doing real work, fed back in as training data, make the model better at that work. The multi-tower training improves it further.

I want to take this to Chinchilla scale, which means training on about twenty tokens for every parameter in the model. That's the ratio where the compute is spent well. One consumer GPU won't get near it.

**If you have compute sitting idle and this sounds interesting, [email me](/contact/).**

The harness is built so somebody else can check it. Most of it runs without a GPU, so you don't need to rent hardware to audit the method. Scoring rules are locked before a run. Held-out data is filtered.

The repository is private for now.

---

## Psychohistory

Three years asking whether you can forecast crowd behaviour the way you forecast weather. Still going, nothing finished.

Some of it holds up, some of it didn't, and both are in the repo. An early test looked good until I measured something I'd assumed. The next version is pre-registered and waiting on data, so there's no number to quote yet.

The part I still find useful is a model of how fast you can deploy something before you lose control of it: risk as speed divided by your capacity to steer. I tested it against road safety, aviation and 150 years of financial crises, and it holds up out of sample. Pointed at AI, the speed is compute growth and the steering capacity counts things like how many institutions exist to evaluate models. It refuses to predict an outcome, because there isn't any outcome data yet.

`ETHICS.md` says what I'm releasing and what I'm keeping back. The monitoring parts are public. The parts that would help someone target and manipulate a group are not, and I list those by name so you know what's missing.

It sets four conditions for anyone using this to steer anything. Someone outside writes the goal and can change it. Every intervention gets logged as it happens. Whoever watches is not whoever acts. A person makes the final call.

The tool that ships with it turns down requests to design manipulation campaigns.

**[Read the paper and the test results](https://wingie.github.io/psychohistory/)** · [source](https://github.com/Wingie/psychohistory)

---

## A book on AI security

34 chapters on how AI systems get attacked. Prompt injection, poisoned training data, leaking things it shouldn't know, multi-agent systems turning on each other, supply chain, and what regulators are going to want.

[Read it](https://github.com/Wingie/risk_using_llms)

---

Studying for the IAPP AI governance certificate.
