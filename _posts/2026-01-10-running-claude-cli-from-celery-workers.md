---
layout: post
title: "Running Claude CLI from Celery Workers: Autonomous AI Agents in Production"
date: 2026-01-10 10:00:00 +0100
categories: [ai-agents, devops, automation]
tags: [claude, celery, docker, python, autonomous-agents, django]
---

What if your Celery workers could spawn AI agents to investigate bugs, deploy code, or write documentation - all triggered by a simple task queue message? That's exactly what I built for FlowState, and it's been running in production for weeks.

Here's how to run Claude CLI from containerized Celery workers.

## The Vision

Traditional Celery tasks do predictable work: send emails, process images, update databases. But what if tasks could think?

```python
# Instead of this:
@shared_task
def process_order(order_id):
    order = Order.objects.get(id=order_id)
    # ... 50 lines of deterministic logic

# What about this:
@shared_task
def investigate_bug(error_message, stack_trace):
    # AI agent reads logs, checks code, proposes fix
    return claude_run("investigate_bugs.ai", context={
        "error": error_message,
        "trace": stack_trace
    })
```

The second approach lets an AI agent decide what to do based on the actual problem. It can search codebases, read documentation, even run tests to verify its hypotheses.

## The Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Django Backend                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API View: trigger_agent_task()                  │   │
│  │  → my_task.delay(agent_name, context)           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Redis Queue                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Celery Worker Container                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  @shared_task                                    │   │
│  │  def run_claude_agent(script, context):          │   │
│  │      subprocess.run([                            │   │
│  │          "claude-run", "--allow-write",          │   │
│  │          f"claude-scripts/{script}"              │   │
│  │      ])                                          │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Claude CLI Process                              │   │
│  │  - Reads script instructions                     │   │
│  │  - Accesses codebase                            │   │
│  │  - Makes API calls                              │   │
│  │  - Writes results                               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Setting Up the Docker Image

The key is installing Claude CLI in your Docker image:

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required for Claude CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app
WORKDIR /app

# Claude CLI needs a home directory for config
ENV HOME=/app
```

## Docker Compose Configuration

Mount the necessary credentials and scripts:

```yaml
# docker-compose.yml
services:
  celery-worker:
    build: .
    command: celery -A myproject worker -l info
    volumes:
      # Mount Claude credentials
      - ~/.claude:/app/.claude:ro
      # Mount your AI scripts
      - ./claude-scripts:/app/claude-scripts:ro
      # Mount the codebase (so Claude can read it)
      - ./backend:/app/backend:ro
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CELERY_BROKER_URL=redis://redis:6379/0
    depends_on:
      - redis
```

## The Celery Task

Here's the task that spawns Claude agents:

```python
# tasks.py
import subprocess
import os
from celery import shared_task
from django.conf import settings

@shared_task(bind=True, max_retries=3)
def run_claude_agent(self, script_name, context=None):
    """
    Execute a Claude AI script as a Celery task.

    Args:
        script_name: Name of the script in claude-scripts/
        context: Optional dict of context to pass to the agent
    """
    # Determine paths based on environment
    if os.path.exists('/app/claude-scripts'):
        # Running in Docker
        scripts_dir = '/app/claude-scripts'
    else:
        # Running locally (Mac development)
        scripts_dir = os.path.join(settings.BASE_DIR, 'claude-scripts')

    script_path = os.path.join(scripts_dir, script_name)

    if not os.path.exists(script_path):
        raise FileNotFoundError(f"Script not found: {script_path}")

    # Build the command
    cmd = [
        'claude-run',
        '--allow-write',
        '--allow-read',
        script_path
    ]

    # Add context as environment variables
    env = os.environ.copy()
    if context:
        for key, value in context.items():
            env[f'CLAUDE_CONTEXT_{key.upper()}'] = str(value)

    # Execute the agent
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
            timeout=600  # 10 minute timeout
        )

        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'script': script_name
        }

    except subprocess.TimeoutExpired:
        self.retry(countdown=60)
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'script': script_name
        }
```

## Example AI Scripts

The magic happens in your `.ai` scripts. These are Claude Code instructions that define what the agent should do:

```bash
#!/usr/bin/env -S claude-run --allow-write

# investigate_bugs.ai
# Autonomous bug investigation agent

You are a bug investigation agent. Your job is to:

1. Read the error message from $CLAUDE_CONTEXT_ERROR
2. Analyze the stack trace from $CLAUDE_CONTEXT_TRACE
3. Search the codebase for the relevant files
4. Identify the root cause
5. Propose a fix (but don't apply it without approval)

Start by examining the error and understanding what went wrong.
Then trace through the code to find where the error originates.
Document your findings in a structured report.
```

```bash
#!/usr/bin/env -S claude-run --allow-write

# deploy-staging.ai
# Automated staging deployment agent

You are a deployment agent. Your job is to:

1. Run the test suite
2. If tests pass, build the Docker images
3. Push to the staging registry
4. Update the staging environment
5. Verify the deployment with health checks

Only proceed with deployment if all tests pass.
Report any failures immediately.
```

## Triggering Agents from Django

Now you can spawn AI agents from anywhere in your Django app:

```python
# views.py
from django.http import JsonResponse
from .tasks import run_claude_agent

def trigger_bug_investigation(request):
    error_message = request.POST.get('error')
    stack_trace = request.POST.get('trace')

    task = run_claude_agent.delay(
        'investigate_bugs.ai',
        context={
            'error': error_message,
            'trace': stack_trace
        }
    )

    return JsonResponse({
        'task_id': task.id,
        'status': 'queued'
    })
```

## Production Considerations

### 1. Resource Limits

AI agents can be resource-intensive. Set limits:

```yaml
# docker-compose.yml
celery-worker:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
```

### 2. Timeout Handling

Agents might run for minutes. Configure Celery appropriately:

```python
# celery.py
app.conf.update(
    task_time_limit=900,  # 15 minutes hard limit
    task_soft_time_limit=600,  # 10 minutes soft limit
)
```

### 3. Logging and Monitoring

Track agent executions:

```python
@shared_task(bind=True)
def run_claude_agent(self, script_name, context=None):
    from .models import AgentExecution

    execution = AgentExecution.objects.create(
        script=script_name,
        context=context,
        status='running',
        task_id=self.request.id
    )

    try:
        result = # ... run the agent
        execution.status = 'completed' if result['success'] else 'failed'
        execution.output = result
        execution.save()
        return result
    except Exception as e:
        execution.status = 'error'
        execution.error = str(e)
        execution.save()
        raise
```

### 4. Security Sandboxing

Don't give agents unlimited access:

```python
cmd = [
    'claude-run',
    '--allow-read',  # Read-only by default
    # Only allow writes to specific directories
    '--allow-write=/app/output',
    '--deny-network',  # No network unless explicitly needed
    script_path
]
```

## Real-World Results

After running this system for 3 weeks:

- **47 autonomous bug investigations** - 31 correctly identified root causes
- **12 automated deployments** - All successful
- **8 documentation updates** - Generated from code changes
- **Average agent runtime**: 3.2 minutes
- **Cost**: ~$0.50-2.00 per agent execution

The ROI is significant. A bug investigation that might take a developer 30 minutes to research gets a solid head start from the agent in under 5 minutes.

## Key Takeaways

1. **Claude CLI runs great in Docker** - Just install Node.js and the npm package
2. **Mount credentials carefully** - Read-only mounts prevent accidental overwrites
3. **Environment-aware paths** - Detect Docker vs local and adjust accordingly
4. **Timeout everything** - AI agents can hang; always have a kill switch
5. **Log extensively** - You need visibility into what agents are doing

---

## Want to Build Autonomous AI Systems?

I help teams integrate AI agents into their infrastructure safely and effectively:

- **Architecture Consulting** - $150/hr - Design autonomous agent systems that scale
- **Implementation Workshop** - Full day ($1,400) - Hands-on training for your team
- **Production Audit** - $500 - Security and reliability review of your AI agent setup

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Let's build AI systems that work while you sleep.*
