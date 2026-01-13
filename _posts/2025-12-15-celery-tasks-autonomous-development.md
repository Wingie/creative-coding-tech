---
layout: post
title: "Building an Autonomous Development System with Celery and Claude"
date: 2025-12-15 11:00:00 +0100
categories: [ai-agents, automation, python]
tags: [celery, claude, autonomous-agents, django, python, devops]
---

What if your codebase could fix its own bugs, write its own tests, and deploy itself - all while you sleep? I've been building exactly that: an autonomous development system powered by Celery task queues and Claude AI agents.

After three months of iteration, here's what works, what doesn't, and how to build your own.

## The Vision

Traditional CI/CD: code changes trigger predefined pipelines. Autonomous development: AI agents decide what needs to happen and do it.

```
Traditional:
  Push → Build → Test → Deploy (fixed pipeline)

Autonomous:
  Event → Agent Analyzes → Agent Decides → Agent Acts → Agent Verifies
```

The difference is agency. Instead of "run these tests," it's "figure out what's broken and fix it."

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Event Sources                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ GitHub  │  │ Sentry  │  │ Cron    │  │ Slack   │        │
│  │ Webhook │  │ Alert   │  │ Schedule│  │ Command │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Django Event Router                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  def route_event(event_type, payload):               │   │
│  │      task = TASK_MAPPING.get(event_type)            │   │
│  │      task.delay(payload)                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Redis Queue                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ critical │  │   high   │  │  medium  │  │   low    │   │
│  │  queue   │  │  queue   │  │  queue   │  │  queue   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Celery Workers                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @shared_task                                        │   │
│  │  def autonomous_bug_fix(error_context):              │   │
│  │      # 1. Analyze error                             │   │
│  │      # 2. Search codebase for cause                 │   │
│  │      # 3. Generate fix                              │   │
│  │      # 4. Run tests                                 │   │
│  │      # 5. Create PR or report                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Celery Tasks

### 1. Bug Investigation Agent

```python
# tasks.py
from celery import shared_task
from .claude_runner import run_agent
from .models import AgentExecution, BugReport

@shared_task(bind=True, queue='high')
def investigate_bug(self, error_id):
    """
    Autonomous bug investigation.

    Triggered by: Sentry alerts, error logs, user reports
    Actions: Analyze, search code, identify root cause, propose fix
    """
    execution = AgentExecution.objects.create(
        task_id=self.request.id,
        agent_type='bug_investigation',
        status='running'
    )

    try:
        # Get error context
        error = BugReport.objects.get(id=error_id)

        # Run the investigation agent
        result = run_agent(
            script='investigate_bugs.ai',
            context={
                'error_message': error.message,
                'stack_trace': error.stack_trace,
                'affected_file': error.file_path,
                'frequency': error.occurrence_count,
                'first_seen': str(error.first_seen),
            },
            timeout=600  # 10 minutes max
        )

        # Parse agent findings
        if result['success']:
            error.root_cause = result.get('root_cause')
            error.proposed_fix = result.get('fix')
            error.confidence = result.get('confidence', 0)
            error.status = 'investigated'
            error.save()

            # If high confidence, trigger fix attempt
            if error.confidence > 0.8:
                attempt_bug_fix.delay(error_id)

        execution.status = 'completed'
        execution.result = result

    except Exception as e:
        execution.status = 'failed'
        execution.error = str(e)
        raise
    finally:
        execution.save()

    return result
```

### 2. Automated Fix Attempt

```python
@shared_task(bind=True, queue='medium')
def attempt_bug_fix(self, error_id):
    """
    Attempt to automatically fix a bug.

    Safety: Creates branch, runs tests, requires human approval for merge
    """
    error = BugReport.objects.get(id=error_id)

    if not error.proposed_fix:
        return {'status': 'skipped', 'reason': 'no proposed fix'}

    # Create a fix branch
    branch_name = f"auto-fix/{error.id}-{slugify(error.message)[:30]}"

    result = run_agent(
        script='apply_fix.ai',
        context={
            'branch_name': branch_name,
            'file_path': error.affected_file,
            'proposed_fix': error.proposed_fix,
            'test_command': 'pytest tests/',
        },
        timeout=900  # 15 minutes
    )

    if result['success'] and result.get('tests_passed'):
        # Create PR for human review
        pr_url = create_pull_request(
            branch=branch_name,
            title=f"[Auto-Fix] {error.message[:50]}",
            body=f"""
## Automated Bug Fix

**Error**: {error.message}
**Root Cause**: {error.root_cause}
**Confidence**: {error.confidence * 100:.0f}%

### Changes Made
{result.get('changes_summary')}

### Test Results
All tests passing.

---
*This PR was created automatically by the FlowState autonomous development system.*
*Please review carefully before merging.*
            """,
            labels=['auto-fix', 'needs-review']
        )

        error.pr_url = pr_url
        error.status = 'fix_pending_review'
        error.save()

        # Notify team
        notify_team.delay(
            channel='#auto-fixes',
            message=f"🤖 Auto-fix PR created: {pr_url}"
        )

    return result
```

### 3. Continuous Code Review

```python
@shared_task(queue='low')
def continuous_code_review(pr_number):
    """
    AI-powered code review on every PR.

    Triggered by: GitHub PR webhook
    Actions: Review code, suggest improvements, check for issues
    """
    pr = fetch_pull_request(pr_number)

    result = run_agent(
        script='review_pr.ai',
        context={
            'pr_number': pr_number,
            'title': pr['title'],
            'description': pr['body'],
            'diff': pr['diff'],
            'files_changed': pr['files'],
        },
        timeout=300
    )

    if result['success']:
        # Post review comments
        for comment in result.get('comments', []):
            post_pr_comment(
                pr_number=pr_number,
                file=comment['file'],
                line=comment['line'],
                body=comment['suggestion']
            )

        # Post summary
        post_pr_comment(
            pr_number=pr_number,
            body=f"""
## 🤖 AI Code Review

{result.get('summary')}

### Suggestions
{format_suggestions(result.get('suggestions', []))}

### Risk Assessment
{result.get('risk_level', 'Unknown')}

---
*Automated review by FlowState. Human review still required.*
            """
        )

    return result
```

### 4. Scheduled Maintenance

```python
from celery.schedules import crontab

# celery.py - Beat schedule
app.conf.beat_schedule = {
    'daily-health-check': {
        'task': 'myapp.tasks.daily_health_check',
        'schedule': crontab(hour=6, minute=0),  # 6 AM daily
    },
    'weekly-dependency-audit': {
        'task': 'myapp.tasks.audit_dependencies',
        'schedule': crontab(day_of_week=1, hour=3),  # Monday 3 AM
    },
    'monthly-security-scan': {
        'task': 'myapp.tasks.security_scan',
        'schedule': crontab(day_of_month=1, hour=2),  # 1st of month
    },
}

@shared_task
def daily_health_check():
    """
    Daily autonomous health check.

    Actions: Check services, verify integrations, report issues
    """
    checks = [
        ('database', check_database_health),
        ('cache', check_redis_health),
        ('storage', check_minio_health),
        ('api', check_api_endpoints),
        ('workers', check_celery_workers),
    ]

    results = {}
    issues = []

    for name, check_fn in checks:
        try:
            result = check_fn()
            results[name] = result
            if not result['healthy']:
                issues.append({
                    'component': name,
                    'issue': result.get('error'),
                    'severity': result.get('severity', 'medium')
                })
        except Exception as e:
            results[name] = {'healthy': False, 'error': str(e)}
            issues.append({
                'component': name,
                'issue': str(e),
                'severity': 'high'
            })

    # If issues found, trigger investigation
    for issue in issues:
        if issue['severity'] == 'high':
            investigate_health_issue.delay(issue)

    # Store results
    HealthCheck.objects.create(
        results=results,
        issues_found=len(issues),
        status='healthy' if not issues else 'degraded'
    )

    return {'healthy': len(issues) == 0, 'issues': issues}
```

## The Agent Runner

Central to the system is a wrapper that executes Claude agents:

```python
# claude_runner.py
import subprocess
import json
import os
from typing import Dict, Any, Optional

def run_agent(
    script: str,
    context: Dict[str, Any],
    timeout: int = 300,
    allow_write: bool = True
) -> Dict[str, Any]:
    """
    Execute a Claude AI agent script.

    Args:
        script: Name of the .ai script in claude-scripts/
        context: Dict of context variables to pass
        timeout: Max execution time in seconds
        allow_write: Whether agent can modify files

    Returns:
        Dict with success status and agent output
    """
    scripts_dir = os.environ.get('CLAUDE_SCRIPTS_DIR', 'claude-scripts')
    script_path = os.path.join(scripts_dir, script)

    if not os.path.exists(script_path):
        raise FileNotFoundError(f"Agent script not found: {script_path}")

    # Build command
    cmd = ['claude-run']
    if allow_write:
        cmd.append('--allow-write')
    cmd.extend(['--allow-read', script_path])

    # Set up environment with context
    env = os.environ.copy()
    env['CLAUDE_CONTEXT'] = json.dumps(context)
    for key, value in context.items():
        env[f'CLAUDE_CTX_{key.upper()}'] = str(value)

    # Execute
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
            cwd=os.environ.get('PROJECT_ROOT', '.')
        )

        # Parse output
        output = parse_agent_output(result.stdout)

        return {
            'success': result.returncode == 0,
            'output': output,
            'stdout': result.stdout,
            'stderr': result.stderr,
            **output  # Spread parsed fields
        }

    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': f'Agent timed out after {timeout}s',
            'timeout': True
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def parse_agent_output(stdout: str) -> Dict[str, Any]:
    """Parse structured output from agent."""
    output = {}

    # Look for JSON blocks
    import re
    json_match = re.search(r'```json\n(.*?)\n```', stdout, re.DOTALL)
    if json_match:
        try:
            output = json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Look for key: value pairs
    for line in stdout.split('\n'):
        if ':' in line and not line.startswith(' '):
            key, _, value = line.partition(':')
            key = key.strip().lower().replace(' ', '_')
            output[key] = value.strip()

    return output
```

## Lessons Learned

### What Works Well

1. **Bug investigation** - AI is great at reading stack traces and finding root causes
2. **Code review** - Catches obvious issues, suggests improvements
3. **Documentation generation** - Auto-generates docs from code changes
4. **Test generation** - Creates reasonable test cases for new functions

### What Doesn't Work (Yet)

1. **Complex refactoring** - Multi-file changes are error-prone
2. **UI/UX decisions** - AI lacks visual context
3. **Performance optimization** - Needs profiling data it can't easily access
4. **Security fixes** - Too risky without human review

### Critical Safety Rules

```python
# NEVER let agents do these autonomously:
FORBIDDEN_ACTIONS = [
    'git push --force',
    'DROP TABLE',
    'rm -rf /',
    'kubectl delete namespace production',
    'merge to main without review',
]

# ALWAYS require human approval for:
REQUIRES_APPROVAL = [
    'database migrations',
    'production deployments',
    'security-related changes',
    'changes to authentication',
    'dependency updates',
]
```

## Metrics After 3 Months

| Metric | Value |
|--------|-------|
| Bugs investigated | 234 |
| Root causes correctly identified | 187 (80%) |
| Auto-fix PRs created | 67 |
| Auto-fix PRs merged | 41 (61%) |
| Code reviews performed | 412 |
| Useful suggestions | ~3.2 per PR |
| Developer time saved | ~15 hrs/week |
| False positives | 12% |

## Key Takeaways

1. **Start with investigation, not action** - Let AI analyze before it changes
2. **Always require human review** for actual code changes
3. **Structured output** - Train agents to output parseable formats
4. **Timeout everything** - AI can get stuck in loops
5. **Log extensively** - You need audit trails for autonomous actions
6. **Queue prioritization** - Not all tasks are equally urgent

---

## Building Autonomous Development Systems?

I help teams implement AI-powered development workflows:

- **System Design** - $150/hr - Architecture for autonomous agents
- **Implementation Workshop** - 2 days ($2,400) - Build your own system hands-on
- **Safety Audit** - $800 - Review your autonomous system for risks

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Let AI handle the tedious work. Focus on what matters.*
