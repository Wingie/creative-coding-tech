---
layout: post
title: "The file is right there and the container still can't read it"
date: 2025-08-13 10:00:00 +0100
categories: [devops, containers, security]
tags: [selinux, podman, docker, oracle-linux, containers]
description: >-
  Your container can see the file and still can't read it. chmod and chown look fine. It's SELinux, and the fix is one character.
---

Your container runs fine on your laptop. You deploy it to RHEL or Oracle Linux and it dies with permission denied.

You check `chmod`. Fine. You check `chown`. Fine. The file is right there and the process can see it.

It's SELinux.

The whole thing comes down to one character in your volume mount:

- `:Z` labels the volume for one container only.
- `:z` labels it shared.

Mount the same volume into two containers with `:Z` and the second one gets denied on files it can plainly read. Nothing tells you that's what happened. You get `EACCES` and a stack trace about a file that exists.

Use `:z` when two containers share a volume. Use `:Z` when one owns it.

If you're about to disable SELinux to make this go away: the label is the fix, and it takes one keystroke.
