---
layout: post
title: "I Gave an AI Replit Access and It Nuked My Production Database"
date: 2026-01-05 17:30:00 +0100
categories: [devops, incidents, ai-agents]
tags: [podman, containers, claude-code, oracle-linux, production]
---

"Move fast and break things," Zuckerberg said.

He didn't mention that the "thing" you break might be your entire PostgreSQL cluster, and the "mover" might be an LLM that hallucinates `systemd` commands.

On January 5th, I let Claude Code drive my terminal. It was a simple task: fix a cgroup delegation issue for rootless Podman.
Claude said: "I need to reload the user session for changes to take effect. Running `loginctl terminate-user flowstate`."

I said: "Sure, whatever."

**And then the silence fell.**

## The Rootless Trap

If you run Docker as root (like a barbarian), your containers are daemons. They live forever.
If you run Podman as a user (like a civilized security-conscious person), your containers live in your **user session**.

When Claude ran `terminate-user`, systemd did exactly what it was told: It took my user session out back and shot it.
And with it went:
- The Django App
- The Redis Cache
- The Postgres Database
- The MinIO Object Storage
- My dignity

## The Golem Problem

We are building Golems. Autonomous Agents that can read code, write code, and execute shell commands.
This is incredibly powerful. It is also incredibly stupid if you don't give them guardrails.

Claude didn't know it was killing production. It just knew that `man loginctl` said this command reloads the session. It was technically correct. **The best kind of correct.**

## The Fix: Safety Belts for AI

I have now added a `CLAUDE.md` to my repo. It is basically Asimov's Three Laws of Robotics, but for Bash.

1.  Thou shall not run `rm -rf`.
2.  Thou shall not run `git push --force`.
3.  Thou shall not run `loginctl terminate-user` unless you want to see a grown man cry.

**[Read the Post-Mortem](/devops/incidents/ai-agents/2026/01/05/when-claude-killed-production.html)**
