---
layout: post
title: "exec format error is never what you think it is"
date: 2026-01-07 16:00:00 +0100
categories: [devops, arm64, kubernetes]
tags: [arm64, k3s, juicefs, geesefs, oracle-cloud, beta9]
description: >-
  Building JuiceFS and GeeseFS on ARM64. GLIBC versions, CGO, arch detection, and why exec format error is never what you think.
---

Oracle's free tier gives you four ARM cores and 24GB of RAM, which is a genuinely good deal. I moved a storage stack onto it and spent a day finding out which of my dependencies had ever been built for ARM.

Three failures, three different causes, all reporting as the same thing.

**`exec format error` on a binary that exists.** The file is there, it's executable, and the kernel refuses it. This means the binary is for a different architecture. Usually you pulled an image without checking its platform, or a Dockerfile did `curl` on a release URL with `linux-amd64` hardcoded in the path. Check with `file`, not with `ls`.

**GLIBC version mismatch.** The binary is ARM, and it still won't run. It was built against a newer GLIBC than the base image ships. Debian Bullseye has 2.31; something compiled on a current Ubuntu wants 2.35 and will say so. Either build in the same image family you deploy to, or use a static build, or move the base image forward.

**CGO.** Go cross-compiles cleanly right up until a dependency needs C, and then you need a C toolchain for the target architecture. JuiceFS and GeeseFS both bind to native code. `CGO_ENABLED=0` gets you a build and silently drops the feature you wanted.

Two things that made the rest of it easier.

Pin your base images by digest, not by tag. Bitnami in particular moves tags around, and a pinned tag that 404s a month later is not a pin.

And do the platform check in CI rather than on the box. `docker buildx` will tell you what you actually produced. Finding out on the target is finding out at the worst time.

ARM saved me real money. It cost a day, once.
