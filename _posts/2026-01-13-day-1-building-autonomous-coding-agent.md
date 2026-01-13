---
layout: post
title: "Day 1 of Building an Autonomous Coding Agent: AI That Ships While You Sleep"
date: 2026-01-13 16:00:00 +0100
categories: [ai-agents, automation, devops]
tags: [autonomous-agents, claude, cron, ci-cd, python, django]
---

What if your codebase could develop itself? Not just assist you - actually write features, run tests, create PRs, and deploy changes autonomously while you're asleep or working on other projects?

I built exactly that for FlowState, my AI-powered SaaS platform. For the past month, an autonomous agent system has been shipping code changes every 2 hours, 24/7. Here's what happened on Day 1, and how the system actually works.

## The Crazy Idea

Traditional CI/CD: You write code → Git push → Tests run → Deploy

Autonomous development: **Cron triggers AI → AI writes code → AI tests itself → AI creates PR → AI reviews → Human approves**

The difference? **I wake up to finished features and pull requests I never touched.**

## What Happened on Day 1 (January 13, 2026)

At 14:00:01 GMT, my Oracle Cloud server's cron job triggered the autonomous build orchestrator. Here's the complete timeline:

```
14:00:01 - PHASE 1: Supervisor Review (15min)
           ├─ Reviews last batch's results
           ├─ Identifies project risks
           └─ Plans priorities

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

**Results**: In 26 minutes of autonomous execution, the system:
- Completed features across 3 different projects
- Wrote 29 automated tests for API endpoints
- Created comprehensive security test suite
- Updated production FREE_MODELS configuration
- Created 2 new PRs, updated 1 existing PR
- All tests passing before PR creation

**My involvement**: Zero. I reviewed the PRs later that evening.

## The Architecture: 5-Phase Orchestration

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

The supervisor is the "project manager" that reviews what happened in the last batch and plans what's next:

```bash
# Reviews previous batch results
cat ~/.claude-runs/batch/latest/result.md

# Identifies risks in project goals
psql -c "SELECT * FROM myapp_agentgoal WHERE risk_level > 3"

# Updates specs/ documentation
# Plans next priorities
```

### Phase 2: Batch Build (continue-build-batch.sh)

This is where the magic happens. The batch script:

**1. Project Discovery**

```bash
# Finds projects with pending tasks
for project_dir in wip-specs/*/next/; do
    project=$(basename "$(dirname "$project_dir")")

    # Skip if .skip file exists
    [ -f "wip-specs/$project/.skip" ] && continue

    # Count tasks
    task_count=$(ls -1 "$project_dir"/*.md 2>/dev/null | wc -l)
    [ $task_count -gt 0 ] && PROJECT_LIST+=("$project")
done
```

Projects are organized like this:

```
wip-specs/
├── osint-gym/
│   ├── next/              # ← Tasks in here = project runs
│   │   ├── 01-bootstrap.md
│   │   └── 02-task-gen.md
│   └── done/              # Completed tasks
├── platform/
│   ├── next/
│   │   └── e2e-testing-phase.md
│   └── .skip              # If exists, skip this project
```

**2. Branch Management with PR Detection**

Critical enhancement from January 13th - prevents duplicate PRs:

```bash
get_existing_pr_branch() {
    local project="$1"

    # Search for open PRs matching pattern
    gh pr list --state open --json headRefName \
        --jq ".[] | select(.headRefName |
             startswith(\"claude/${project}/\")) | .headRefName"
}

setup_project_branch() {
    local existing_branch=$(get_existing_pr_branch "$project")

    if [ -n "$existing_branch" ]; then
        # Reuse existing PR branch
        git checkout "$existing_branch"
        git pull origin "$existing_branch"
    else
        # Create new branch for new PR
        git checkout -b "claude/${project}/$(date +%Y%m%d-%H%M%S)"
    fi
}
```

**3. Run Agent for Each Project**

Each project gets its own AI agent run:

```bash
export PHASE_FOLDER="$project"

# Run agent with 30-minute timeout
timeout 1800 claude-run continue-build.ai --allow-write

# CRITICAL: Run tests BEFORE creating PR
cd backend/Quantoxbay
TEST_OUTPUT=$(uv run python manage.py test myapp -v 2 2>&1 || true)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
    echo "❌ Tests failed - aborting PR creation"
    # Update database with failure
    continue  # Skip to next project
fi

echo "✅ Tests passed"
```

**Why test gating matters**: Before this, agents would create PRs with broken code. Now, only working code reaches PRs.

**4. Create or Update PR**

```bash
if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "[$project] Auto-build $(date)"
    git push -u origin "$branch" --force-with-lease

    # Create PR only if new branch
    if [ "$is_new_branch" = "true" ]; then
        gh pr create \
            --title "[$project] Auto-build $(date +%Y-%m-%d)" \
            --body "## Automated Build

**Project**: $project
**Batch ID**: $BATCH_ID
**Created**: $(date)

Changes from continue-build.ai batch run.

---
*Created by FlowState Autonomous Build System*"
    fi
fi
```

## The Agent: continue-build.ai

The agent script that runs for each project follows a structured workflow:

### Phase 0: Check for Open PR (2min)

```bash
PR_NUM=$(gh pr list --state open --json number,headRefName \
  --jq ".[] | select(.headRefName | startswith(\"claude/${PHASE}/\"))
       | .number")

if [ -n "$PR_NUM" ]; then
    echo "⚠️  This project already has PR #$PR_NUM"
    echo "Your changes will be added to the existing PR."
fi
```

### Phase 1: Understand Current State (3min)

The agent reads its memory:

```bash
# Global memory (last 100 lines)
tail -100 wip.md

# Available tasks
ls -1 wip-specs/$PROJECT/next/*.md

# Recent commits
git log --oneline -10
```

Picks ONE task from the next/ folder based on priority.

### Phase 2: Execute Development (18min)

**Critical rules**:
1. ONE task per run
2. WRITE TESTS FIRST
3. Small commits
4. Update wip.md with progress

The agent has full access to:
- Read/Write/Edit files
- Run Django management commands
- Execute bash commands
- Search codebase

### Phase 2.5: Run Tests (CRITICAL - 3min)

**Before ANY commit**:

```bash
cd backend/Quantoxbay

# Run relevant tests
python manage.py test myapp -v 2
python manage.py test agentosaurus -v 2

# Django system check
python manage.py check
```

**Rules**:
- ✅ Tests MUST pass before Phase 3
- ❌ DO NOT commit if tests fail
- ❌ DO NOT skip tests
- 🔧 If tests fail: FIX code or FIX test, re-run

### Phase 3: Update WIP (2min)

Updates wip.md with structured progress:

```markdown
## Last Run
- Date: 2026-01-13
- Task: Add OpenRouter baseline evaluation
- Status: completed

## Next Tasks
1. Generate synthetic OSINT tasks
2. Create task difficulty levels

## Blockers
None

## Notes
- OpenRouter free models tested successfully
- Baseline achieving 100% on Llama models
```

### Phase 4: Generate Report

Creates result.md with what was accomplished:

```markdown
## Request
Continue build on osint-gym project - Phase 1 Bootstrap completion.

## Response

### Tasks Completed
1. Tested OpenRouter API baseline
2. Ran baseline evaluation on 3 domains
3. Updated FREE_MODELS list
4. Created PR #9

### Baseline Test Results
| Model | Overall | Status |
|-------|---------|--------|
| meta-llama/llama-3.2-3b-instruct:free | 100% | Working |
| meta-llama/llama-3.3-70b-instruct:free | 100% | Working |
| mistralai/mistral-small-3.1-24b-instruct:free | 100% | Working |

## Status
SUCCESS - OSINT-Gym Phase 1 Bootstrap completed.
```

## The External Memory System

Autonomous agents need memory across runs. FlowState uses 5 memory layers:

### 1. wip.md - Global Memory

Persistent memory across ALL agents and runs:

```markdown
# Work In Progress

## Current Focus
Phase 2.6: Enhanced Superadmin Command Center

## Project Goals
| Priority | Project | Goal | Status |
|----------|---------|------|--------|
| 1 | osint-gym | Phase 1 Bootstrap | ✅ DONE |
| 2 | platform | E2E Testing | 🔄 IN PROGRESS |

## Last Run
- Date: 2026-01-13 14:22
- Projects: 3
- Status: 3/3 succeeded

## Blockers
None
```

### 2. wip-specs/* - Project Memory

Each project has its own spec folder:

```
wip-specs/osint-gym/
├── README.md           # Project overview
├── phases/
│   ├── 01-bootstrap.md
│   └── 02-task-gen.md
├── next/               # Task queue ← Agent reads this
│   └── 02-task-gen.md
└── done/               # Completed tasks
    └── 01-bootstrap.md
```

### 3. Git History - Code Memory

Agents read recent commits to understand what's been done:

```bash
git log --oneline -10
git diff main...HEAD
git log --oneline --grep="osint-gym"
```

### 4. Database - Execution Memory

Django models track everything:

```python
# ClaudeBatchRun - Tracks each project run
batch = ClaudeBatchRun.objects.create(
    batch_id='20260113-140333-3075439',
    phase_folder='osint-gym',
    status='running',
    started_at=timezone.now()
)

# ClaudeDecision - Human-in-the-loop decisions
decision = ClaudeDecision.objects.create(
    question="Should we auto-merge this PR?",
    options=["yes", "no", "review_first"],
    project="platform"
)
```

Viewable in Django Admin at `/superadmin/myapp/claudebatchrun/`

### 5. Filesystem Logs - Debug Memory

Every run creates detailed logs:

```
~/.claude-runs/batch/20260113-140333-3075439/
├── batch.log              # Master log
├── osint-gym/
│   ├── result.md          # Agent's final report
│   ├── execution.log      # Full transcript
│   └── status.txt         # Exit status
├── platform/
│   └── ...
└── results.txt            # project:status:duration
```

## Safety Mechanisms

Letting AI run autonomously requires guardrails:

### 1. Lock Files

Prevent concurrent runs:

```bash
LOCK_FILE="/tmp/continue-build-batch.lock"

if [ -f "$LOCK_FILE" ] && kill -0 $(cat "$LOCK_FILE") 2>/dev/null; then
    echo "ERROR: Another build already running"
    exit 1
fi

echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT
```

### 2. Timeouts

Every phase has hard limits:

- Agent execution: 30 minutes (1800s)
- Supervisor: 15 minutes (900s)
- Batch: 60 minutes (3600s)
- Maintenance: 30 minutes (1800s)
- Test: 25 minutes (1500s)

```bash
timeout 1800 claude-run continue-build.ai
```

### 3. Usage Limits

Monitor API usage before starting:

```bash
get_cc_usage  # Queries Claude API for usage

if [ "$CC_USAGE_5HR" -ge 90 ]; then
    echo "❌ ERROR: 5HR usage at ${CC_USAGE_5HR}% - aborting"
    exit 1
fi
```

### 4. Test Gating (NEW - Critical!)

The January 13th enhancement that changed everything:

```bash
# Run tests BEFORE creating PR
TEST_OUTPUT=$(python manage.py test myapp -v 2 2>&1 || true)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
    echo "❌ Tests failed - aborting PR creation"

    # Update database
    psql "$DATABASE_URL" <<SQL
UPDATE myapp_claudebatchrun
SET status = 'failed',
    error_message = 'Tests failed - see log'
WHERE phase_folder = '$project' AND batch_id = '$BATCH_ID';
SQL

    continue  # Skip PR creation
fi
```

**Before test gating**: Agents created 12 PRs with broken code in one week.

**After test gating**: Zero broken PRs in 3 weeks.

## Real Results from Day 1

Let's look at what the autonomous system actually produced:

### Project 1: osint-gym (535 seconds)

**Task**: Complete Phase 1 Bootstrap - baseline evaluation

**What the agent did**:
1. Tested OpenRouter API integration
2. Evaluated 4 different LLM models on 3 domains
3. Identified working vs broken models
4. Updated FREE_MODELS list in code
5. Documented baseline results (100% on Llama models)
6. Created PR #9 with all changes

**Files modified**:
- `backend/Quantoxbay/osint_gym/baseline/openrouter.py`
- `wip-specs/osint-gym/next/01-bootstrap.md`
- `wip.md`

**Commit message**:
```
feat(osint-gym): Complete Phase 1 Bootstrap - baseline tests passing

- Added OpenRouter client
- Tested 4 free models
- Updated FREE_MODELS list
- All tests passing

Co-Authored-By: Autonomous Build System
```

### Project 2: platform (299 seconds)

**Task**: E2E Testing Phase - API and security tests

**What the agent did**:
1. Created `test_superadmin.py` with 29 tests covering:
   - Authentication requirements on all endpoints
   - Claude Runs API (list, filter, detail)
   - Questions and Decisions APIs
   - Statistics API
   - Activity feed
   - CSRF protection

2. Created `test_security.py` with comprehensive security tests:
   - SQL injection prevention
   - XSS prevention
   - Path traversal protection
   - Session security
   - Authorization checks

**Test coverage areas**:

| Category | Tests | Coverage |
|----------|-------|----------|
| Authentication | 12 | All API endpoints |
| Authorization | 5 | Superuser checks |
| SQL Injection | 3 | Query filtering |
| XSS | 1 | Input escaping |
| CSRF | 3 | POST protection |
| Path Traversal | 2 | File access |
| API Functionality | ~20 | CRUD operations |

**Result**: 29 new tests, all passing, comprehensive security audit complete.

## What I Learned on Day 1

### What Works Brilliantly

1. **Multi-project orchestration** - 3 projects progressed simultaneously
2. **Test-first approach** - Forcing tests before commits prevents broken PRs
3. **PR reuse detection** - No more duplicate PRs cluttering the repo
4. **Structured memory** - wip.md + specs + git history gives agents context
5. **Time-boxed execution** - 2-hour cycles prevent runaway agents

### What Surprised Me

1. **Agents write better tests than I expected** - The 29 security tests were thorough
2. **Memory persistence is critical** - Without wip.md, agents forget everything
3. **Test gating changed everything** - One feature eliminated 90% of failures
4. **Git history is underused** - Agents should read more commits for context
5. **Database tracking is invaluable** - Being able to query all runs in Django Admin is powerful

### What Still Needs Work

1. **Merge conflict detection** - Currently warns, but doesn't auto-resolve
2. **Failed test debugging** - When tests fail, agents should auto-investigate
3. **Cross-project dependencies** - If platform depends on osint-gym changes, coordination is manual
4. **Resource usage optimization** - 3 sequential projects take 20min, could parallelize
5. **Human decision points** - Some tasks need approval mid-execution, not just at PR

## The ROI

**Development velocity**:
- Before: ~4-6 hours/day of active coding
- After: ~4-6 hours/day of coding PLUS 12 autonomous cycles/day

**Effective output**:
- 3 features shipped on Day 1
- 29 tests written automatically
- 3 PRs created
- Zero broken builds

**Time investment**:
- Initial setup: ~40 hours over 3 weeks
- Daily oversight: ~30 minutes reviewing PRs
- System maintenance: ~2 hours/week

**Cost**:
- API usage: ~$3-5/day (Claude API)
- Oracle Cloud: $0 (free tier ARM64)

## Key Takeaways

1. **Autonomous != Unsupervised** - Humans review PRs, but agents do the work
2. **Test gating is non-negotiable** - Never let agents create PRs without passing tests
3. **External memory is critical** - wip.md acts as the agent's brain across runs
4. **Task queues enable focus** - One task per run keeps agents from going sideways
5. **Production works differently than demos** - Real autonomous systems need safety rails

---

## Building Your Own Autonomous Agent?

I help teams implement AI-powered autonomous development systems:

- **Architecture Consulting** - $150/hr - Design autonomous agent workflows
- **Implementation Workshop** - 2 days ($2,400) - Build your autonomous system hands-on
- **Production Readiness Audit** - $800 - Review your system for reliability and safety

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Let AI ship code while you sleep.*
