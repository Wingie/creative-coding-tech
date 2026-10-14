---
layout: post
title: "Four hours debugging grainy SDXL output on a rented GPU"
date: 2025-08-22 14:00:00 +0100
categories: [ai, gpu, image-generation]
tags: [lambda-labs, sdxl, comfyui, gpu, image-generation, remote-execution]
description: >-
  Renting a GPU to run SDXL, and four hours lost to grainy output. The cause was the VAE running in fp16.
---

I rented a GPU to run SDXL instead of buying one. Django queues the job, Celery runs it, the GPU box runs ComfyUI, images come back.

Then every image came out looking like it had been printed on sandpaper.

I spent four hours on it. I checked the sampler, the step count and the CFG scale. I ran the same prompt at a dozen settings and got a dozen grainy pictures.

It was the VAE running in fp16.

SDXL's default VAE overflows at half precision. Most people describe black or blown-out images, which is why `sdxl-vae-fp16-fix` exists. Partial overflow shows up as noise across the whole frame instead. That looks like a sampler problem, so that's where you go looking.

Switch the VAE to fp32, or use the fixed fp16 one. The memory cost is small next to the model.

You also pay for every hour the box is up, including the ones you forget about. A box left running overnight costs more than the images are worth.
