---
layout: post
title: "How I Accidentally Built My Own Cloud GPU Cloud (And Why You Shouldn't)"
date: 2026-01-08 14:00:00 +0100
categories: [ai-infrastructure, gpu, devops]
tags: [beta9, ollama, gpu, inference, oracle-cloud, kubernetes, machine-learning]
---

There is a fundamental law of software engineering that states: **"Every sufficiently complex distributed system contains an ad-hoc, informally-specified, bug-ridden implementation of half of AWS."**

I recently fell victim to this law.

I wanted to run some AI models. Just some simple LLM inference. I could have used OpenAI. I could have used Anthropic. I could have used any of the 500 startups appearing every day that promise "Serverless AI."

But no. I decided to build my own distributed GPU inference pipeline. Because apparently, I hate myself and I love debugging race conditions.

## The "Why" (Or, The Justification for Madness)

A friend at a Huge Social Network (let's call them "BookFace") once told me, "At our scale, electricity is cheaper than API calls."

Now, I am not at BookFace scale. I am at "running a blog from my basement" scale. But the principle stuck with me.

1.  **APIs are expensive.** If you're running autonomous agents 24/7, paying per token is a delightful way to bankrupt yourself.
2.  **Latency sucks.** Round-tripping to San Francisco for every thought adds up.
3.  **Control.** I want to run *weird* models. The unaligned ones. The quantized ones. The ones named after obscure wizards.

So I decided to glue together **Beta9** (serverless runtime), **Ollama** (model runner), and **Oracle Cloud** (free ARM servers) into a monstrosity that I call, affectionately, **The Grid**.

## The Architecture: A Rube Goldberg Machine for Math

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Plane (ARM64)                     │
│  (The Brains - Running on Free Tier because I'm cheap)      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Django    │  │    Celery    │  │   Redis      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    GPU Worker Pool                           │
│  (The brawn - Burning money at $0.75/hr)                    │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   Lambda Labs A10    │  │   Lambda Labs A10    │        │
│  │   (Ollama inside)    │  │   (Ollama inside)    │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

The concept is simple: The Control Plane (which is free) tells the Worker Pool (which costs money) to do math. When there is no math to do, the Worker Pool shuts down.

It sounds elegant. In practice, it's like trying to herd cats that charge you by the hour.

## Beta9: The Glue

I'm using [Beta9](https://github.com/beam-cloud/beta9). It's basically "Lambda for GPUs." It handles the boring part of spinning up containers and routing requests.

Think of it as Kubernetes for people who have friends and want to keep them.

## The Code: Duct Tape and Dreams

The hardest part isn't running the model. Ollama makes that trivial (`ollama run llama3`). The hard part is **orchestration**.

I wrote a Django view that acts as the traffic cop:

```python
def pull_model(request):
    """
    Please, Mr. GPU, would you kindly download 4GB of weights?
    """
    # ... calls Beta9 control plane ...
```

And a shell script that talks to the TUI (Text User Interface) because I am a hipster who loves terminals.

```bash
#!/bin/bash
# test_inference.sh
# The "poke it with a stick" script

# ... extensive curl commands and jq parsing ...
# ... because nothing says "modern AI" like parsing JSON in bash ...
```

## The "Cold Start" Problem (Physics is a Bitch)

Here is something the "Serverless AI" marketing brochures don't tell you: **Loading models takes time.**

You can't just beam 15GB of floats into VRAM instantly. The speed of light (and PCIe bandwidth) is a harsh mistress.

When a fresh worker starts up:
1.  Boot container: 5s
2.  Download model: 30s (if cached) to 10m (if not)
3.  Load into VRAM: 5-10s

So my "Serverless" function has a 45-second latency on the first hit.

**My Solution:** Pre-warming. I keep the most popular models loaded. Yes, this costs money. No, there is no magic fix.

## The Cost: Was It Worth It?

**Oracle ARM64 Control Plane**: $0. (Thank you, Larry Ellison.)
**Lambda Labs A10**: $0.75/hr.

If I run this 4 hours a day, it costs me **~$90/month**.

Comparable API usage would be ~$300/month.

So, I am saving $210/month.

However, I spent approximately 40 hours building this system. If I value my time at anything above minimum wage, I am deeply in the red.

But that's not the point. The point is that *I own the means of production*. I can run unrestricted Llama 3 anytime I want. I can fine-tune on my own data. I am the captain of my own ship, even if that ship is held together by Python scripts and bash hacks.

## Lessons Learned

1.  **VRAM is the new Gold.** Managing 24GB of VRAM is an art form. You have to unload models aggressively.
2.  **Network Latency Matters.** My control plane is in Ashburn. My GPUs are... somewhere else. The latency is real.
3.  **Health Checks Save Lives.** If a GPU falls over in the woods and nobody logs it, does it still cost $0.75/hr? Yes. Yes it does.

## Should You Do This?

**Probably not.**

If you just want to summarize text, use an API. It's cheaper, faster, and you won't have to debug container networking at 3 AM.

But if you want to understand how the sausage is made—or if you simply enjoy the sweet, sweet suffering of distributed systems engineering—then godspeed.

---

## Need Help Burning Money on GPUs?

I offer consulting for people who hate money and love Kubernetes:

- **Architecture Design** - $150/hr
- **Implementation Sprint** - 1 week ($4,000)
- **GPU Cost Optimization** - $500 audit

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Come for the AI, stay for the CUDA errors.*
