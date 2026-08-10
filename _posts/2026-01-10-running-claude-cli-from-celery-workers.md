---
layout: post
title: "Running an AI agent inside a Celery worker inside Docker"
date: 2026-01-10 10:00:00 +0100
categories: [ai-agents, devops, automation]
tags: [claude, celery, docker, python, autonomous-agents, django]
description: >-
  Spawning an AI agent from a Celery worker inside Docker. Node in a Python image, timeouts that don't fire, and a serialisation bug.
---

I run an agent from inside a Celery worker, in Docker. It works. Three things broke on the way and none of them were the model.

**Node inside a Python image.** The agent CLI is a Node package and the worker is a Python image. So the image carries both runtimes, and it is not elegant. The alternative is a second container and a protocol between them, which is more moving parts for the same result.

**The timeout that never fired.** This one cost me a night:

```python
for line in proc.stdout:
    handle(line)
proc.wait(timeout=600)
```

The loop reads until the pipe closes. If the child hangs without writing anything, the loop blocks forever and `wait` is never reached. The timeout is dead code sitting after an infinite loop. You need the timeout on the read, or a reader thread with the timeout on the join.

**Returning the wrong object.** A Celery task has to return something the serialiser can encode. `subprocess.run` gives you a `CompletedProcess`, which JSON cannot encode, so the task raises after the work has already succeeded. You get a failed task and a completed side effect, which is the most annoying combination.

The general lesson is that the failure modes are all in the plumbing. The agent is a subprocess that takes a long time and sometimes doesn't answer. Everything I got wrong, I would also have got wrong wrapping `ffmpeg`.

**Measured later.** These were my impressions at the time. The real figures are on the [Agentosaurus page](/projects/agentosaurus/).
