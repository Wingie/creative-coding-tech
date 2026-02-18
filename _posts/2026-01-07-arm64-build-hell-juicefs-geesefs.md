---
layout: post
title: "ARM64 is the Future (And the Future is Broken)"
date: 2026-01-07 16:00:00 +0100
categories: [devops, arm64, kubernetes]
tags: [arm64, k3s, juicefs, geesefs, oracle-cloud, beta9]
---

They told us ARM64 was the promised land.

"It's cheaper!" they said. "It's more power-efficient!" they said. "Amazon Graviton is 40% faster for 20% less cost!"

What they didn't mention is that **you will spend the rest of your natural life recompiling C libraries.**

I recently decided to deploy Beta9 (a GPU runtime) on Oracle Cloud's Ampere A1 instances. Because I like pain. And because Oracle gives you 4 cores and 24GB of RAM for free, which appeals to my inner cheapskate.

It was a masterclass in what I call **Binary Compatibility Hell.**

## The "Write Once, Run Anywhere" Lie

Java promised "Write Once, Run Anywhere." Go promised "Cross-Compilation is Easy."

 reality promises: "Exec format error."

### Exhibit A: JuiceFS and the GLIBC Mismatch

I needed JuiceFS. The Dockerfile downloaded a pre-built binary. Standard stuff.

```bash
/usr/local/bin/juicefs: /lib/aarch64-linux-gnu/libc.so.6: version `GLIBC_2.32' not found
```

Ah, GLIBC version errors. The classic Linux hazing ritual. The binary wanted GLIBC 2.32. Debian Bullseye has 2.31.

So I had to build it from source. But wait! JuiceFS needs SQLite support, which means `CGO_ENABLED=1`. Which means you need the C toolchain. Which means you are no longer a "Cloud Native Engineer," you are a 1990s SysAdmin trying to get `gcc` to link against the right headers.

I spent 4 hours fixing this. To save $0.04/hour.

### Exhibit B: GeeseFS and the Silent Architecture Failure

The script downloaded GeeseFS. It ran fine.

```
exec format error
```

It downloaded the AMD64 binary. Because of course it did. The script didn't check `uname -m`. It just assumed you were on Intel, like a civilized person.

## The Bitnami Trap

I used the Bitnami Redis chart. Pinned to a specific tag.
Result: `404 Not Found`.
Why? because Bitnami rotates tags faster than a startup pivots.

If you pin versions, you break when they delete the tag. If you use `:latest`, you break when they change the API.
**There is no winning move.**

## The Solution (If You Can Call It That)

I fixed it. It works now.
But my `Dockerfile` looks like a crime scene. It has `sed` commands patching URLs. It has multi-stage builds just to compile a filesystem driver.

The moral of the story?
ARM64 is great. The cloud is cheap.
But you pay for it with your sanity.

**[Read the Gory Details (If You Masochistically Enjoy Makefiles)](/devops/arm64/kubernetes/2026/01/07/arm64-build-hell-juicefs-geesefs.html)**
