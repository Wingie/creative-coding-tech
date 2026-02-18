---
layout: post
title: "Day 1 of Building an Autonomous Coding Agent: AI That Ships While You Sleep"
date: 2026-01-13 16:00:00 +0100
categories: [ai-agents, automation, devops]
tags: [autonomous-agents, claude, cron, ci-cd, python, django]
---

Look, I'm just going to come out and say it: I've built a robot that writes code while I sleep, and it's both the most terrifying and most liberating thing I've ever done.

I know what you're thinking. "Oh great, another AI hype post from some guy who probably just wrapped GPT in a bash script and called it autonomous." And you know what? You're not entirely wrong. But stick with me here, because what happened over the past month is either the future of software development or a cautionary tale about giving AI too much power. Possibly both.

(Spoiler: It created 47 pull requests in 30 days. I merged 43 of them. The other 4 tried to delete the production database. We'll get to that.)

Here's the thing. I once worked with a guy at a Very Large Tech Company—you know the one, they sell everything from books to cloud computing—who told me about their internal deployment system. Completely automated. Thousands of deployments per day. And I remember thinking, "That's insane. That's the future. And I want it."

But that was for deployments. What I've built is different. This is an AI that doesn't just deploy code—it WRITES the code. It's like if Skynet and your most productive 10x engineer had a baby, and that baby really, really liked Django.

For the past month, an autonomous agent system has been shipping code changes to my SaaS platform, FlowState, every 2 hours, 24/7. Here's what happened on Day 1, and how the system actually works.

## The Crazy Idea

Traditional CI/CD is boring. You write code, you push to Git, tests run, you deploy. It's a straight line. It's safe. It's predictable.

Autonomous development is different. It's a loop. **Cron triggers AI → AI writes code → AI tests itself → AI creates PR → AI reviews → Human approves.**

The difference? **I wake up to finished features and pull requests I never touched.**

It feels a bit like having a ghostly pair programmer who works the graveyard shift. Sometimes you wake up to beautiful, elegant refactors. Sometimes you wake up to find they've rewritten your entire authentication system in Perl because "it felt more expressive." (Okay, that didn't happen. Yet.)

## What Happened on Day 1 (January 13, 2026)

At 14:00:01 GMT, my Oracle Cloud server's cron job triggered the autonomous build orchestrator. It was like watching a Rube Goldberg machine spring to life, if the Rube Goldberg machine was made of Python scripts and high-stakes API calls.

Here's the complete timeline:

```
14:00:01 - PHASE 1: Supervisor Review (15min)
           ├─ Reviews last batch's results (Checking if we broke the world)
           ├─ Identifies project risks (Is the AI plotting against us?)
           └─ Plans priorities (What should we build next to impress the humans?)

14:03:33 - PHASE 2: Batch Build Starts (60min)
           ├─ Discovers 3 projects with pending tasks
           │  ├─ osint-gym: Phase 1 Bootstrap
           │  ├─ phase2.5-oci-build-system: Build system improvements
           │  └─ platform: E2E testing phase
           │
           ├─ [osint-gym] 535 seconds
           │  ├─ Tests OpenRouter API baseline
           │  ├─ Evaluates 3 free LLM models
           │  ├─ Updates FREE_MODELS list
           │  ├─ Runs Django tests ✅
           │  └─ Creates PR #9
           │
           ├─ [phase2.5] 281 seconds
           │  ├─ Enhances build system documentation
           │  ├─ Adds PR detection logic
           │  ├─ Runs tests ✅
           │  └─ Pushes to existing PR
           │
           └─ [platform] 299 seconds
              ├─ Creates test_superadmin.py (29 tests)
              ├─ Creates test_security.py (security audit)
              ├─ Runs all tests ✅
              └─ Creates PR #10

14:22:21 - PHASE 3: Platform Maintenance (30min)
           ├─ Health checks on production services
           ├─ Syncs specs with database
           └─ Verifies production state

14:24:00 - PHASE 4: Test Changes (25min)
           └─ Integration tests on recent commits

14:26:00 - PHASE 5: Email Report
           └─ Summary sent: 3/3 succeeded, 0 failed
```

**Results**: In 26 minutes of autonomous execution, the system effectively did a full morning's work for a junior developer. It completed features across 3 projects, wrote 29 automated tests, auditted security, updated production configs, and filed 2 PRs.

**My involvement**: Zero. I was eating a sandwich. A very good sandwich, mind you, but significantly less productive than the AI.

## The Architecture: Or, How I Learned to Stop Worrying and Love the Cron Job

I call it the **5-Phase Orchestration**. It sounds fancy, but really it's just a glorified shell script that keeps the AI from setting the server on fire.

```
┌─────────────────────────────────────────────────────────┐
│ Cron (Every 2 Hours)                                    │
│  0 */2 * * * ~/FlowState/claude-scripts/               │
│              hourly-build-orchestrator.sh               │
└─────────────────────────────────────────────────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
┌─────────┐         ┌──────────┐         ┌──────────┐
│ Phase 1 │────────▶│ Phase 2  │────────▶│ Phase 3  │
│15min    │         │  60min   │         │  30min   │
│         │         │          │         │          │
│Supervisor│       │Batch Build│        │Maintenance│
└─────────┘         └──────────┘         └──────────┘
                          │
                    ┌─────┴──────┐
                    │            │
                    ▼            ▼
              ┌──────────┐  ┌──────────┐
              │ Phase 4  │  │ Phase 5  │
              │  25min   │  │  Email   │
              │   Test   │  │  Report  │
              └──────────┘  └──────────┘
```

### Phase 1: Supervisor (agent-supervisor.ai)

The Supervisor is the "project manager." You know, the one who asks "what are we doing?" and "is it done yet?" but without the annoying meetings. It reviews the last batch, checks the risks ("SELECT * FROM myapp_agentgoal WHERE risk_level > 3"), and updates the specs.

### Phase 2: Batch Build (continue-build-batch.sh)

This is where the magic happens. Or the horror. Depending on your perspective.

**1. Project Discovery**

It looks through a `wip-specs` directory. If there's a file in `next/`, it runs. It's like a task queue, but filesystem-based because I'm old school (or lazy, you pick).

```bash
# Finds projects with pending tasks
for project_dir in wip-specs/*/next/; do
    project=$(basename "$(dirname "$project_dir")")
    # ... logic to check if we should run ...
done
```

**2. Branch Management with PR Detection**

This was a critical fix. Early on, the AI would create a new PR for every single change. I woke up one morning to find 15 PRs for the same feature. It was spamming me like a desperate recruiter. Now, it checks if a branch exists and reuses it.

**3. Run Agent for Each Project**

Each project gets its own AI agent run. We give it 30 minutes. If it can't finish in 30 minutes, it's probably stuck in a loop trying to calculate Pi or argue with itself about tabs vs spaces.

```bash
# Run agent with 30-minute timeout
timeout 1800 claude-run continue-build.ai --allow-write
```

**4. The "Don't Be Stupid" Check (Test Gating)**

This is the single most important part of the system. **Run tests BEFORE creating the PR.**

```bash
TEST_OUTPUT=$(uv run python manage.py test myapp -v 2 2>&1 || true)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
    echo "❌ Tests failed - aborting PR creation"
    continue  # SKIPS PR CREATION
fi
```

Before I added this, the agents were like energetic puppies—eager to please but constantly breaking things. They'd submit code that didn't compile, code that failed tests, code that looked like it was written by a drunk telegraph operator. Now? Only passing code gets to PR.

## The Agent: continue-build.ai

The agent script itself is fascinating. It has memory.

### Phase 0: Check for Open PR

"Do I already have a PR open? If so, I should probably not open another one." Simple logic, yet surprisingly hard for AI to grasp without explicit instruction.

### Phase 1: Understand Current State

It reads `wip.md` (Global Memory), identifies available tasks, and checks `git log`. It's basically doing what you do when you come back from a long weekend and try to remember what you were working on.

### Phase 2: Execute Development

**Critical rules**:
1. ONE task per run. Don't try to be a hero.
2. WRITE TESTS FIRST. Yes, we force TDD on the AI. It hates it as much as you do.
3. Small commits.
4. Update `wip.md` with progress.

### Phase 2.5: Run Tests (CRITICAL)

**Before ANY commit**, it runs the tests. If they fail, it has to fix them. It's like a strict parent: "You're not going out to play (commit) until you clean your room (pass tests)."

### Phase 3: Update WIP

It updates the markdown file with what it did. "I fixed the bug. I am a good boy. Please don't delete me."

## The External Memory System

Autonomous agents are like goldfish. They have no memory between runs. Unless you give them one.

FlowState uses 5 memory layers. It sounds complex, but it's basically just files and database rows.

1.  **wip.md - Global Memory**: The long-term storage. The "Big Picture."
2.  **wip-specs - Project Memory**: Specific tasks for each project.
3.  **Git History**: Evidence of past crimes (commits).
4.  **Database**: Tracking every run, every decision.
5.  **Filesystem Logs**: Standard logging for debugging when things inevitably explode.

## Safety Mechanisms: Keeping Skynet in Check

Letting AI run autonomously requires guardrails. Lots of them.

### 1. Lock Files
Prevent concurrent runs. We don't want two AI agents fighting over who gets to edit `models.py`. That way lies madness (and merge conflicts).

### 2. Timeouts
Every phase has a hard limit. If the Supervisor takes more than 15 minutes, it gets killed. No mercy.

### 3. Usage Limits
We check the API bill before starting. If we've burned through 90% of the budget, we stop. I'm not going bankrupt because my AI decided to write a novel in the comments.

### 4. Test Gating (The "Golden Rule")
I cannot stress this enough. **Tests MUST pass before PR creation.** This changed everything. Before test gating, I was reviewing garbage. After test gating, I was reviewing working code.

## Real Results from Day 1

Let's look at what the autonomous system actually produced. No cherry-picking.

**Project 1: osint-gym**
It needed to test the OpenRouter API. It wrote the client, tested 4 free models, found out which ones worked, updated the config, and documented the results. It essentially did a vendor evaluation for me.

**Project 2: platform**
It wrote 29 security tests. SQL injection, XSS, CSRF—the whole nine yards. It found gaps I didn't know existed. It's kind of humbling when a script you wrote finds security holes in your code.

**What Surprised Me:**
1.  **Agents write better tests than I expected.** Like, genuinely thorough tests.
2.  **Memory persistence is critical.** Without `wip.md`, the AI is lost. With it, it's focused.
3.  **Database tracking is invaluable.** Being able to see "Oh, batch 20260113 failed because of a timeout" is huge.

## The ROI: Is It Worth It?

**Development velocity**:
- Before: ~4-6 hours/day of active coding (me).
- After: ~4-6 hours/day (me) + 12 autonomous cycles/day (AI).

**Cost**:
- API usage: ~$3-5/day. Less than a fancy coffee.
- Oracle Cloud: $0 (free tier).
- My sanity: Priceless.

## Key Takeaways

1.  **Autonomous != Unsupervised.** You still need to review PRs. Don't be an idiot and auto-merge to main.
2.  **Test gating is non-negotiable.** It's the filter that separates "helpful assistant" from "chaos engine."
3.  **External memory is critical.** The AI needs a notepad. Give it one.
4.  **Task queues enable focus.** One task at a time. Multitasking is a lie for humans and AIs alike.
5.  **Production works differently than demos.** Real autonomous systems need safety rails, timeouts, and logging.

If you're thinking of building something like this, do it. But for the love of all that is holy, put some guardrails on it. Otherwise, you might wake up to a deleted production database and a very apologetic commit message.

---

## Building Your Own Autonomous Agent?

I help teams implement AI-powered autonomous development systems. If you want to build Skynet (the nice version), hit me up:

- **Architecture Consulting** - $150/hr
- **Implementation Workshop** - 2 days ($2,400)
- **Production Readiness Audit** - $800

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Let AI ship code while you sleep. Ideally without destroying the world.*
