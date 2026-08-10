---
layout: post
title: "I built my own GPU cloud, badly, and it mostly works"
date: 2026-01-08 14:00:00 +0100
categories: [ai-infrastructure, gpu, devops]
tags: [beta9, ollama, gpu, inference, oracle-cloud, kubernetes, machine-learning]
description: >-
  Running my own GPU inference on rented hardware instead of an API. Cold starts, cost per hour, and whether it was worth it.
---

I run model inference on GPUs I rent by the hour instead of calling an API. Here is what that costs and what it buys.

The control plane is a free-tier ARM box on Oracle Cloud. It holds the queue, the registry and the scheduler. The GPUs are elsewhere: a rented A10 at roughly $0.75 an hour, plus a 3090 under my desk. They join over a private network, so nothing is exposed publicly and the control plane never needs a public IP for them.

Running the model is the easy bit. `ollama run` and you're done. The hard bit is everything around it: which machine takes this job, is that machine still alive, and how do I stop paying for it when nothing is queued.

## Cold starts

The number that matters isn't tokens per second, it's how long until the first one.

A warm worker with the weights already in VRAM answers in a few seconds. A worker that has the weights on local disk needs to load them, which takes tens of seconds for a small model. A worker that has to pull the weights first takes minutes.

So the scheduler prefers a machine that already has the model, and falls back to a warm machine, and only then wakes a cold one. Most of the engineering is in avoiding the third case.

## What it costs

An A10 at $0.75/hr, run four hours a day, is about $90 a month. Comparable API usage would have been somewhere around $300. Call it $200 a month saved.

I spent something like 40 hours building it. At any real hourly rate that is a loss and will stay a loss.

What I got instead: I can run models nobody serves, I can fine-tune on my own data, and I know exactly what the pipeline does because I had to build every part of it. That last one is the reason this exists.

## Would I recommend it

If you want to summarise documents, use an API. It's cheaper, it's faster, and you won't spend a night on container networking.

If you want to understand the machinery, or you have data that can't leave your building, this is what it takes.
