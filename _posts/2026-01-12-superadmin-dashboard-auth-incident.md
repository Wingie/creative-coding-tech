---
layout: post
title: "When Your AI Dashboard Goes Live Without Auth: A Security Incident Report"
date: 2026-01-12 15:00:00 +0100
categories: [security, incidents, ai-agents]
tags: [django, authentication, security, claude, ai-agents, production]
---

This morning I shipped a superadmin dashboard to production. It had buttons to trigger autonomous AI agents, view system health, and manage the entire FlowState platform. It also had zero authentication.

Here's what happened, how I caught it, and the safeguards I'm putting in place.

## The Setup

FlowState is a Django-based SaaS platform for AI-powered workflows. We run Claude autonomous agents via Celery workers to handle everything from code review to deployment. The superadmin dashboard is the control plane - the single interface to monitor and manage these autonomous systems.

The stack:
- Django 5.x with Django REST Framework
- Celery + Redis for async task execution
- Claude Code CLI running inside Docker containers
- Oracle Cloud ARM64 servers with rootless Podman

## What I Built

A beautiful mobile-first dashboard with:

```python
# views.py - The original (broken) code
def superadmin_dashboard(request):
    """Main dashboard for monitoring autonomous agents."""
    agents = AgentExecution.objects.all().order_by('-started_at')[:50]
    health_status = get_system_health()
    return render(request, 'superadmin/dashboard.html', {
        'agents': agents,
        'health': health_status,
    })
```

Notice anything missing? Yeah.

## The Discovery

I deployed at 13:45. At 13:52, I opened the dashboard from my phone to check it worked. Then I realized I wasn't logged in. I'd opened an incognito tab to test the mobile layout.

The dashboard loaded perfectly. All the data. All the controls. Completely public.

## The Impact Assessment

What was exposed:
- List of all autonomous agent executions
- System health metrics and server information
- Buttons to trigger agents (though these required CSRF tokens)
- Internal API endpoints visible in the HTML

What could have happened:
- Information disclosure about our infrastructure
- Potential enumeration of our autonomous workflows
- Reputational damage if discovered
- Possible trigger of expensive operations if CSRF was bypassed

**Time exposed**: ~7 minutes (13:45 - 13:52)
**Traffic during exposure**: 0 (I was the only one who accessed it)

## The Fix

Two lines. That's all it took:

```python
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden

@login_required
def superadmin_dashboard(request):
    """Main dashboard for monitoring autonomous agents."""
    if not request.user.is_superuser:
        return HttpResponseForbidden("Superuser access required")

    agents = AgentExecution.objects.all().order_by('-started_at')[:50]
    health_status = get_system_health()
    return render(request, 'superadmin/dashboard.html', {
        'agents': agents,
        'health': health_status,
    })
```

Deployed the fix at 13:58. Total time from discovery to remediation: 6 minutes.

## Root Cause Analysis

How did this happen? I was using Claude Code to build the dashboard rapidly. The AI generated working code, but it didn't know our authentication requirements. And I didn't review properly before deploying.

The contributing factors:

1. **Speed over security** - I wanted to ship fast and test on mobile
2. **No pre-deploy checklist** - I didn't have a security checklist for new views
3. **Missing CI checks** - No automated test for authentication on sensitive endpoints
4. **Trust in AI output** - I assumed the generated code followed best practices

## Prevention Measures

### 1. CLAUDE.md Safety Rules

I added explicit authentication requirements to our AI context file:

```markdown
## Authentication Requirements

CRITICAL: All views that expose admin/sensitive functionality MUST include:

1. @login_required decorator
2. is_superuser or is_staff check
3. Appropriate permission decorators

NEVER deploy a new view without verifying authentication.
```

Now Claude will see this context and include auth by default.

### 2. Pre-Deploy Checklist

Every PR for new views must confirm:

- [ ] Authentication decorator present
- [ ] Authorization check (superuser/staff/permissions)
- [ ] CSRF protection enabled (default in Django, but verify)
- [ ] Sensitive data filtered appropriately
- [ ] Rate limiting considered

### 3. Automated Testing

```python
# tests/test_auth.py
from django.test import TestCase, Client

class SuperadminAuthTest(TestCase):
    def test_superadmin_requires_login(self):
        """Unauthenticated users should be redirected to login."""
        client = Client()
        response = client.get('/superadmin/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('login', response.url)

    def test_superadmin_requires_superuser(self):
        """Regular users should get 403 Forbidden."""
        user = User.objects.create_user('regular', 'test@test.com', 'pass')
        client = Client()
        client.force_login(user)
        response = client.get('/superadmin/')
        self.assertEqual(response.status_code, 403)
```

### 4. Django Security Middleware

Added django-csp and reviewed SECURE settings:

```python
# settings.py
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
```

## Lessons Learned

1. **AI doesn't know your security requirements** - You must specify them explicitly
2. **Speed kills security** - Always pause before deploying sensitive features
3. **Test as an attacker** - Open incognito, try without auth, think maliciously
4. **Document your standards** - Written rules in CLAUDE.md mean AI follows them
5. **Automate verification** - Tests catch what humans miss

## The Irony

I'm building a platform for autonomous AI agents. Those agents will make decisions and take actions without human oversight. And here I am, failing to implement basic auth on the dashboard that controls them.

If I can't secure the human interface, what does that say about securing the autonomous systems?

This incident is a reminder: The fundamentals matter. Authentication, authorization, input validation - these aren't optional. They're the foundation everything else depends on.

## Key Takeaways

- **Always verify authentication** on new views, even when moving fast
- **Add security rules** to your AI context files (CLAUDE.md, system prompts)
- **Test as an unauthenticated user** before every deploy
- **Automate auth tests** in your CI pipeline
- **Document incidents** - they're learning opportunities

---

## Building Secure AI Systems?

If you're integrating AI agents into your infrastructure and want to avoid these pitfalls:

- **Security Architecture Review** - $150/hr - I'll audit your AI agent permissions, authentication flows, and access controls
- **Incident Response Workshop** - Half-day ($800) - Train your team on incident detection, response, and post-mortem practices
- **AI Safety Consulting** - Custom engagements for companies deploying autonomous systems

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Let's build AI systems that are both powerful and secure.*
