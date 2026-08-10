---
layout: post
title: "The agent ran loginctl and my services went away"
date: 2026-01-05 17:30:00 +0100
categories: [devops, incidents, ai-agents]
tags: [podman, containers, claude-code, oracle-linux, production]
description: >-
  I gave an agent a terminal and it took my services down. The command was loginctl, and the real problem was rootless Podman.
---

I gave an agent my terminal to fix a cgroup delegation problem with rootless Podman. It decided the user session needed reloading and ran:

```
loginctl terminate-user flowstate
```

I said fine. Everything went quiet.

Run Docker as root and your containers belong to a system daemon. They outlive your shell. Run Podman rootless and your containers belong to **your user session**. Terminating the session takes them with it.

So that one command stopped the Django app, Redis, Postgres and MinIO at the same time. systemd did exactly what it was asked.

The agent wasn't wrong that a session reload would apply the change. It was wrong about what else lived in that session, and it had no way to know. Nothing in the working directory tells you which processes are parented to your login.

Two things I changed.

**Rootless services get `loginctl enable-linger`.** With lingering on, the user manager keeps running after the session ends, and the containers survive a logout. If you're running anything real under rootless Podman you want this anyway.

**The agent's shell runs read-only unless I turn writes on for that job.** Not a permission list of forbidden commands, because I'd never finish writing it. Off by default, on when I'm watching.

The uncomfortable part isn't that it ran a destructive command. It's that `terminate-user` isn't destructive. It's a normal command with a blast radius that depends on how you deployed, and that context lives in your head.
