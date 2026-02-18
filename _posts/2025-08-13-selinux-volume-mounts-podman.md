---
layout: post
title: "SELinux is Why Your Container is Broken (And Why You Should Keep It On)"
date: 2025-08-13 10:00:00 +0100
categories: [devops, containers, security]
tags: [selinux, podman, docker, oracle-linux, containers]
---

You have a container. It runs fine on your laptop.
You deploy it to RHEL/Oracle Linux.
It crashes. `Permission Denied`.
You check `chmod`. It's fine.
You check `chown`. It's fine.

**It's SELinux.** It's always SELinux.

## The Tale of Two Colons

The difference between a working database and a 3am outage was one character:
`:z` vs `:Z`.

- `:Z` (Capital Z): "This is MY volume. Touch it and die."
- `:z` (Little z): "We can share."

If you mount the same volume into two containers with `:Z`, SELinux will shoot the second container in the head.
It won't tell you why. It will just kill it.

**[Learn the Difference](/devops/containers/security/2025/08/13/selinux-volume-mounts-podman.html)**
