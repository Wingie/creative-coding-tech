---
layout: post
title: "The -S Flag That Fixed My Linux Scripts: env Shebang Compatibility"
date: 2026-01-09 09:00:00 +0100
categories: [devops, linux, scripting]
tags: [bash, linux, macos, shebang, oracle-linux, cross-platform]
---

My AI scripts worked perfectly on macOS. They failed completely on Oracle Linux. The fix was one character: `-S`.

## The Problem

I had a collection of AI agent scripts that use a custom runner:

```bash
#!/usr/bin/env claude-run --allow-write

# Rest of the script...
```

On my Mac, these executed perfectly. On my Oracle Cloud ARM64 server running Oracle Linux 9, I got:

```
/usr/bin/env: 'claude-run --allow-write': No such file or directory
```

Wait, what? `claude-run` was definitely in the PATH. I could run it directly. Why couldn't `env` find it?

## The Root Cause

Here's what's happening:

**On macOS (BSD env):**
```bash
#!/usr/bin/env claude-run --allow-write
```
BSD's `env` splits the argument string at spaces automatically. It runs `env` with two arguments: `claude-run` and `--allow-write`. Works great.

**On Linux (GNU env):**
```bash
#!/usr/bin/env claude-run --allow-write
```
GNU's `env` treats `claude-run --allow-write` as a **single argument** - the name of the command to run. It looks for a binary literally named `claude-run --allow-write` (spaces included). Doesn't exist. Fails.

This is a fundamental difference in how `env` interprets shebang arguments between BSD (macOS, FreeBSD) and GNU (Linux).

## The Fix

GNU coreutils `env` (version 8.30+) added the `-S` flag specifically to handle this:

```bash
#!/usr/bin/env -S claude-run --allow-write
```

The `-S` flag tells `env` to **split the string** into separate arguments, just like BSD does by default.

## Before and After

Every script needed updating:

```bash
# Before (macOS only)
#!/usr/bin/env claude-run --allow-write

# After (cross-platform)
#!/usr/bin/env -S claude-run --allow-write
```

For my FlowState project, that meant updating 10 AI scripts:

```
claude-scripts/agent-supervisor.ai
claude-scripts/cleanup-server.ai
claude-scripts/continue-build.ai
claude-scripts/deploy-agento.ai
claude-scripts/deploy-beta9.ai
claude-scripts/investigate_bugs.ai
claude-scripts/platform-maintenance.ai
claude-scripts/test-beta9-health.ai
claude-scripts/test-end-to-end.ai
claude-scripts/test-registry-auth.ai
```

One-liner to fix them all:

```bash
sed -i 's|#!/usr/bin/env |#!/usr/bin/env -S |g' claude-scripts/*.ai
```

## Compatibility Notes

### -S Flag Support

| System | env version | -S support |
|--------|-------------|------------|
| Oracle Linux 9 | 8.32 | Yes |
| Ubuntu 20.04+ | 8.30+ | Yes |
| Debian 10+ | 8.30+ | Yes |
| CentOS 8+ | 8.30+ | Yes |
| Alpine 3.12+ | 8.32+ | Yes |
| macOS | BSD env | N/A (splits by default) |

For older Linux systems (CentOS 7, Ubuntu 18.04), you might need a wrapper script instead.

### Fallback for Old Systems

If you need to support systems without `-S`:

```bash
#!/bin/bash
# wrapper.sh - Cross-platform script launcher
exec claude-run --allow-write "$@"
```

Then your shebang becomes:
```bash
#!/usr/bin/env bash
# Your script content, knowing bash works everywhere
```

## Why This Matters

If you're deploying scripts across different systems:

1. **CI/CD pipelines** often run on Linux even if you develop on Mac
2. **Docker containers** are almost always Linux-based
3. **Cloud servers** (AWS, GCP, Oracle Cloud) default to Linux
4. **ARM servers** like Ampere A1 instances run Oracle Linux or Ubuntu

A script that works locally but fails in production is worse than one that fails everywhere. At least consistent failure is debuggable.

## The Deeper Lesson

This bug wasted 45 minutes because the error message was misleading:

```
No such file or directory: 'claude-run --allow-write'
```

I assumed `claude-run` wasn't installed or wasn't in PATH. I checked PATH. I reinstalled. I added explicit paths. Nothing worked.

The actual problem was the **space being interpreted as part of the filename**, not an argument separator. The error message didn't hint at this.

When debugging cross-platform issues:
1. **Check the fundamentals** - How does this work differently on each platform?
2. **Read the man pages** - `man env` on Linux vs macOS shows the difference
3. **Test on target platform early** - Don't wait until deployment to discover issues

## Quick Reference

```bash
# Simple command (no args) - works everywhere
#!/usr/bin/env python3

# Command with arguments - needs -S on Linux
#!/usr/bin/env -S python3 -u

# Multiple arguments - -S handles them all
#!/usr/bin/env -S node --experimental-modules --no-warnings

# Your custom runner with flags
#!/usr/bin/env -S claude-run --allow-write --allow-read
```

## Key Takeaways

1. **Use `-S` when passing arguments** in env shebangs for Linux compatibility
2. **BSD and GNU env behave differently** - test on both platforms
3. **Error messages can be misleading** - "file not found" might mean argument parsing failed
4. **One character fixes can waste hours** - document these gotchas for your team

---

## Cross-Platform DevOps Giving You Trouble?

I help teams build infrastructure that works consistently across environments:

- **Cross-Platform Audit** - $300 flat - I'll review your scripts and configs for compatibility issues
- **DevOps Consulting** - $150/hr - CI/CD, containerization, multi-platform deployment
- **Team Training** - Custom workshops on Linux fundamentals and shell scripting

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Stop debugging platform differences. Start shipping.*
