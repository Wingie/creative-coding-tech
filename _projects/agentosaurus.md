---
title: Agentosaurus
slug: agentosaurus
redirect_from:
  - /projects/flowstate/
tagline: AI agents write most of this platform. Here is everything that went wrong.
description: >-
  A climate research platform where AI agents write most of the code and hand work
  to each other through pull requests. Over a thousand merged in 2026. This page is
  about the failures, because those are the useful part.
language: Python
role: Built
year: 2024
order: 1
tech:
  - Python
  - Django
  - Claude Code
  - systemd
  - k3s
  - llama.cpp
client: Independent research into agentic build systems
repo_private: true
live_url: https://agentosaurus.com
---

For three days in August, my build system ran 64 jobs and reported every one as a success.

None of them did anything. They were hitting a weekly rate limit and dying after four seconds. The log said `COMPLETED: success` each time, because the process exited cleanly. It exited cleanly because it never started.

I only found it because the queue wasn't shrinking.

## What this is

[Agentosaurus](https://agentosaurus.com) finds and checks organisations working on climate. It crawls their sources, compares what they claim against what it can verify, and keeps every raw result so you can trace a conclusion back to where it came from.

AI agents write most of its code. They merged over a thousand pull requests in 2026. It still runs, six times a day on weekdays.

I built it to find out how agents behave when you stop watching each step. Then I stopped watching.

## Agents that talk through pull requests

My agents never message each other. One agent reads the pull requests from the last run, looks at the reviews and the failures, and files a ticket for each problem it finds. Another agent picks up a ticket, works it in its own copy of the repo, and opens a pull request. That pull request is what the first agent reads next time.

The pull request is the message.

I didn't design it this way. My first version had three agents passing turns to each other, holding context the whole time. They kept hitting a twelve minute timeout. Breaking the work into three-minute tasks fixed the timeouts, and it turned out to fix four other things I hadn't been trying to fix. Tasks survive a crash. They can be ordered by priority. You can count how many are done. And every decision an agent made is sitting in a diff that someone can read.

## What went wrong, and what I did about it

**The success signal was really a "didn't crash" signal.** See the top of this page. Now the runner decides pass or fail from machine-set fields only, never from the model's own words, and it exits with a specific code when it hits a rate limit.

**`set -e` without `set -o pipefail` deleted my error handling.** I piped the agent through `tee` to save a log. `tee` succeeds even when the agent fails, so every failure took the success branch. My rate-limit handler and my timeout handler were both unreachable. They had never once run.

**My quota check returned zero when it broke.** Zero percent used and could-not-check looked identical. Six runs logged "could not fetch usage data, proceeding anyway" and then started 45 jobs each. Now a failed check returns nothing and stops the run, and it says so in a log line that doesn't look like a healthy one.

**One threshold, two different rate limits.** The weekly budget sat at 84 to 100 percent for six days while the five-hour budget sat near zero. I was checking both against one number, so it skipped every expensive job for six days while having plenty of room to run.

**My cheap jobs kept my expensive jobs locked out.** The small maintenance agents ran without a quota check. They kept spending from the same weekly budget that was blocking everything else, so it could never recover on its own.

**"Did my branch survive" is the wrong question.** When an agent succeeds it pushes to an existing pull request and deletes its own branch. So success and never-started look the same if you check for the branch. Ask whether the work landed instead.

**Old files fake a fresh result.** The agent writes its report to a file that's tracked in git. A fresh checkout brings the last run's report with it. Every check now has to be told the run's start time, so it can't accidentally read yesterday's answer.

**Never commit what a crashed agent left behind.** It's half-finished and it poisons the pull request. Throw it away. Write down what you threw away, because once I discarded silently and lost six runs of real work.

**A clean merge is where the silent damage is.** One merge quietly rolled a dependency back 358 commits. Both a human and a review bot checked the three things that conflicted. Nobody looked at the one that merged without complaint.

**Letting an agent run the other agents produced nothing.** Five runs, zero completed tasks. I kept the comparison script and the result.

**I am the bottleneck.** At one point 15 pull requests were open and none had merged in four days. Agents produce work at machine speed into a queue that moves at human speed.

## If this sounds familiar

If your agents are reporting success while shipping nothing, or you can't tell the difference between a healthy run and a broken one, I'm happy to talk. I've spent a year finding these the slow way.

[Email me](/contact/).

Same if you have GPUs sitting idle and like the climate work. There's no signup button yet. It's a conversation and a network invite, because the accounting layer isn't built and I want to know what each machine is doing until it is.

## What isn't done

Peer compute accounting, caching between machines, and handling a machine that lies to me: none of it is built. The contribute-a-GPU form on the site is a form. Confidential computing needs hardware I don't have.

The default path still sends inference to a hosted API. Training and 30B-class serving run on my own machines. Embeddings don't yet.
