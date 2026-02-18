---
layout: post
title: "The Inception Architecture: Running AI Agents Inside Celery Workers Inside Docker"
date: 2026-01-10 10:00:00 +0100
categories: [ai-agents, devops, automation]
tags: [claude, celery, docker, python, autonomous-agents, django]
---

You know that scene in *The Matrix Reloaded* where Agent Smith copies himself a thousand times and creates a small army of suited men to fight Neo? 

Well, I built that. Except instead of fighting Keanu Reeves, my army of agents is fighting bugs in my codebase. And instead of sleek suits, they're wearing Docker containers.

I call it the **Task Queue Singularity**. What if your background workers didn't just resize images or send emails? What if they could *think*? What if your task queue was actually a hive mind of AI developers, waiting for a signal to swarm your repository and fix typos?

It sounds cool. It also sounds overly complicated. And honestly, it is. But it works, and it's running in production right now. Here is how (and why) I shoved Claude CLI into a Celery worker.

## The Problem: Dumb Workers

Traditional task queues are dumb. I don't mean that as an insult; I mean they are deterministic.

```python
# Traditional Celery Task
def process_order(order_id):
    order = Order.objects.get(id=order_id)
    order.ship_it() # Does exactly one thing
```

This is fine for sending password reset emails. But frankly, it's boring. I wanted a worker that could look at a stack trace and say, "Huh, that looks like a NullPointerException in the formatting library," and then *go fix it*.

To do that, you need an Agent. And to run an Agent, you need an environment. And because we live in the timeline where JavaScript won the CLI wars, the tool I need (`claude-run`) is a Node.js application.

So now I have a Python Django application, running a Celery worker, trying to spawn a Node.js process, to talk to an LLM API, to write Python code.

It's effectively a turducken of programming languages.

## The Architecture: Or, "Yo Dawg, I Heard You Like Containers"

A friend of mine who works at AWS (let's call him "Bezos's Ghost") once told me that Lambda functions are just Docker containers that start really fast. He said, "Eventually, everything will just be a container inside a container inside a container, all the way down to the metal."

I took that personally.

```
┌─────────────────────────────────────────────────────────┐
│                     Django Backend                       │
│  (The "Manager" who shouts orders)                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Redis Queue                          │
│  (The Purgatory where tasks wait to die)                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Celery Worker Container                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  @shared_task                                    │   │
│  │  def run_claude_agent():                         │   │
│  │      # Spawns a child process                    │   │
│  │      subprocess.run(["claude-run", ...])         │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Claude CLI Process (Node.js)                    │   │
│  │  - "I am Agent Smith #42"                        │   │
│  │  - Reads/Writes Codebase                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The beauty of this is that the Celery worker provides the *infrastructure* (retries, logging, monitoring), and the Claude CLI provides the *intelligence*.

## The Build from Hell

Getting this to work requires a Dockerfile that is essentially a crime against purity. We need Python (for Django/Celery) AND Node.js (for Claude) AND git (for the agent to commit crimes) ALL in the same image.

```dockerfile
FROM python:3.11-slim

# "Just install everything," they said. "It'll be fine," they said.
RUN apt-get update && apt-get install -y git curl

# Install Node.js because the best Python tools are written in JS now apparently
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install the Brain
RUN npm install -g @anthropic-ai/claude-code
```

Does this make the image larger? Yes. Do I care? No. Storage is cheap; my time spent debugging why `npm` isn't found is expensive.

## The Code: Where the Magic/Horror Happens

Here is the actual Python code that spawns the AI. It's surprisingly simple, which is usually a sign that it will break in catastrophic ways later.

```python
@shared_task(bind=True, max_retries=3)
def run_claude_agent(self, script_name, context=None):
    """
    Spawns a sentient child process. Good luck.
    """
    # ... setup paths ...

    cmd = [
        'claude-run',
        '--allow-write', # DANGER ZONE
        script_path
    ]
    
    # Inject context variables. This is how we tell the AI 
    # "Fix THIS bug," not just "Fix A bug."
    env = os.environ.copy()
    if context:
        for k, v in context.items():
            env[f'CLAUDE_CONTEXT_{k.upper()}'] = str(v)

    # Run it. 10 minute timeout because sometimes AI gets philosophical
    # and forgets to exit.
    result = subprocess.run(cmd, timeout=600)
    
    return result
```

## "Example" Scripts (The Instruction Manuals)

The `.ai` scripts are basically just prompts saved to files. 

```bash
#!/usr/bin/env -S claude-run --allow-write

# investigate_bugs.ai
# Goal: Find out why I'm a bad programmer.

You are a bug investigation agent. 
1. Read the error: $CLAUDE_CONTEXT_ERROR
2. Find the file.
3. Fix it.
4. Don't break anything else (Optional).
```

## Production Reality Check

I've been running this for 3 weeks. Here is what I've learned from letting autonomous agents run wild in my infrastructure.

### 1. Resources are NOT infinite
AI agents are heavy. They think hard. When you spin up 50 of them, your server fans start to sound like a jet engine taking off. I had to limit the concurrency in docker-compose or my poor ARM server would melt through the floor.

### 2. Timeouts are Mandatory
Sometimes the agent gets stuck. It happens. It gets into a loop where it tries to read a file, decides it needs to read *another* file, and eventually tries to read the entire internet. You need a hard timeout (`task_time_limit`). Kill it with fire if it takes too long.

### 3. Security Sandboxing
I run this with `--allow-write`. That is terrifying. It's like giving a toddler a sharpie and telling them not to draw on the walls. I try to limit the damage by mounting only specific directories, but let's be real: if the AI wants to delete my `requirements.txt`, I can't really stop it.

## The Results

- **47 autonomous bug investigations.** (31 fixed. 16 confident hallucinations.)
- **12 automated deployments.** (All successful, amazingly.)
- **Cost**: ~$0.50 per run.

Is it worth it? 

Well, yesterday I was sleeping, and an error triggered an agent. The agent investigated, found a typo in a serializer, wrote a test case, fixed the typo, and pushed a branch.

I woke up, merged the PR, and felt like a god.

So yes. It's worth it. Even if I did have to install Node.js in my Python container.

---

## Want to Build the Borg?

I help teams integrate AI agents into their infrastructure. If you want to create your own army of autonomous workers:

- **Architecture Consulting** - $150/hr
- **Implementation Workshop** - Full day ($1,400)
- **Production Audit** - $500

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*We are the Borg. Your bugs will be assimilated.*
