---
layout: post
title: "Celery workers that read a Sentry error and open a pull request"
date: 2025-12-15 11:00:00 +0100
categories: [ai-agents, automation, python]
tags: [celery, claude, autonomous-agents, django, python, devops]
description: >-
  Celery workers that read a Sentry error, ask a model for a fix, run the tests and open a pull request. What it gets right and what it invents.
---

I wanted to know how much of a bug fix could happen without me. So I wired Sentry to Celery to an agent.

An error arrives in Sentry. A Celery task picks up the stack trace, hands it to a model with the relevant source, gets a patch back, runs the tests, and opens a pull request if they pass.

That part works. It's maybe forty lines of glue.

What it gets right is the boring class of bug: a missing None check, an unhandled key, an off-by-one in a slice. Small, local, and fully described by the stack trace. Those are also the bugs I least want to spend an evening on, so the trade is good.

What it gets wrong is more interesting. The common failure isn't a bad patch, it's a confident patch for a problem it has misread. It imports a module that doesn't exist. It fixes the symptom at the throw site when the real fault is two frames up. Both look fine until the tests run, which is why the tests are in the loop and why nothing merges without them.

The thing I'd tell anyone building this: the value is in the gate, not the generation. Generating a plausible patch is easy now. Knowing whether to keep it is the whole job, and if your gate has a hole in it you'll find out weeks later.

**Measured later.** These were my impressions at the time. The real figures are on the [Agentosaurus page](/projects/agentosaurus/).
