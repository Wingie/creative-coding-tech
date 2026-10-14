---
layout: post
title: "Agents that ship code overnight, and the test gate that never ran"
date: 2026-01-13 16:00:00 +0100
categories: [ai-agents, automation, devops]
tags: [autonomous-agents, claude, cron, ci-cd, python, django]
description: >-
  Cron-driven agents that plan, write, test and open pull requests without me. Including the test gate that never ran.
---

An agent has been shipping code to my platform on a schedule for a month. It plans, writes, tests and opens pull requests. I merge them in the morning.

Here's how the loop works, and where it was broken.

## The loop

A cron job wakes a supervisor. It reads the pull requests from the last run, along with their reviews and any failures, and files one ticket per problem it finds.

Builder agents take a ticket each, work in their own git worktree, and open a pull request. That PR is what the next supervisor reads. The agents never talk to each other directly. Everything goes through code review. Reviews are saved, they're in order, and I'd read them anyway.

Tasks are scoped to a few minutes. Long-running agents kept hitting a twelve-minute timeout, and smaller tasks fixed it. It turned out to solve three other things at once. Tasks survive a crash. They can be prioritised. You can count them.

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

The original had `|| true` inside the command substitution. That forces an exit status of zero whatever the tests did. So `TEST_EXIT` was always 0, and the check never fired once.

I called this the most important part of the system. The version I shipped couldn't fail, and I didn't notice for weeks. From the outside, a gate that always passes looks the same as one that works. The only sign is that nothing ever gets blocked, and that reads as good news.

If you build one of these, test the gate by feeding it something that should fail. Watch it stop.

## What else was worth doing

**Each task gets its own worktree.** If two agents touch the same file, you get a merge conflict. Neither can corrupt the other's checkout.

**Never commit what a crashed agent left behind.** It's half-finished and it breaks the PR. Throw it away, but write down what you threw away. I discarded silently once and lost six runs of real work.

**I am the bottleneck.** At one point fifteen PRs were open and none had merged in four days.

**Measured later.** The numbers I quoted for this system when I first wrote it up were my impressions. The measured figures are on the [Agentosaurus page](/projects/agentosaurus/), including 64 runs logged as success that did nothing.
