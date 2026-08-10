---
layout: post
title: "Agents that ship code overnight, and the test gate that never ran"
date: 2026-01-13 16:00:00 +0100
categories: [ai-agents, automation, devops]
tags: [autonomous-agents, claude, cron, ci-cd, python, django]
description: >-
  Cron-driven agents that plan, write, test and open pull requests without me. Including the test gate that never actually ran.
---

An agent has been shipping code to my platform every two hours for a month. It plans, writes, tests and opens pull requests. I merge them in the morning.

This is what the loop looks like and where it was quietly broken.

## The loop

A cron job wakes a supervisor. It reads the pull requests from the last run, along with their reviews and any failures, and files one ticket per problem it finds.

Builder agents take a ticket each, work in their own git worktree, and open a pull request. That PR is what the next supervisor reads. The agents never talk to each other directly. Everything goes through code review, which is durable, ordered, and already the thing a human would look at.

Tasks are scoped to a few minutes. That wasn't a design principle, it was a consequence: long-running agents kept hitting a twelve-minute timeout, and breaking the work up was the fix. It turned out to solve three other things at once. Tasks survive a crash. They can be prioritised. You can count them.

## The gate that never ran

Before any PR is opened, the work has to pass Django's checks, the test suite, a merge-conflict check, lint, and a security pass.

That was the theory. The shell was this:

```bash
TEST_OUTPUT=$(uv run python manage.py test myapp -v 2 2>&1)
TEST_EXIT=$?
if [ $TEST_EXIT -ne 0 ]; then
    echo "Tests failed, skipping PR"
    continue
fi
```

The original had `|| true` inside the command substitution. That forces an exit status of zero regardless of what the tests did, so `TEST_EXIT` was always 0 and the check never fired once. Not rarely. Never.

I called this the most important part of the system while shipping a version of it that couldn't fail. It went unnoticed for weeks, because a gate that always passes and a gate that works look identical from the outside. The only signal is that nothing ever gets blocked, and "nothing ever gets blocked" reads as good news.

If you build one of these, test the gate by feeding it something that should fail. Watch it stop. Otherwise you don't have a gate, you have a log line.

## What else was worth doing

**Isolation is per-task, not per-agent.** Each task gets its own worktree. Two agents touching the same file is a merge conflict rather than a corrupted checkout.

**Never commit what a crashed agent left behind.** It's half-finished and it poisons the PR. Throw it away, but write down what you threw away. I discarded silently once and lost six runs of real work.

**The queue is human-shaped at the far end.** Agents produce at machine speed into a review process that moves at my speed. At one point fifteen PRs were open and none had merged in four days. That's the real ceiling.

**Measured later.** The numbers I quoted for this system when I first wrote it up were my impressions. The measured figures are on the [Agentosaurus page](/projects/agentosaurus/), including the part where three months of logs read 100% success and that turned out to be false.
