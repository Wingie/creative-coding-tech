---
layout: post
title: "Four hours debugging grainy SDXL output on a rented GPU"
date: 2025-08-22 14:00:00 +0100
categories: [ai, gpu, image-generation]
tags: [lambda-labs, sdxl, comfyui, gpu, image-generation, remote-execution]
description: >-
  Renting a GPU to run SDXL, and four hours lost to grainy output that turned out not to be the sampler.
---

I rented a GPU to run SDXL rather than buying one. Django queues the job, Celery runs it, the GPU box runs ComfyUI, images come back.

Then every image came out looking like it had been printed on sandpaper.

I spent four hours on it. I checked the sampler. I checked the step count. I checked the CFG scale. I regenerated the same prompt at a dozen settings and got a dozen grainy pictures.

It was the VAE running in fp16.

SDXL's default VAE overflows at half precision. The usual symptom people describe is black or blown-out images, which is why `sdxl-vae-fp16-fix` exists, but partial overflow shows up as noise across the whole frame. It looks like a sampler problem, so that's where you go looking.

Switch the VAE to fp32, or use the fixed fp16 one. The memory cost is small next to the model.

The other thing worth knowing: bill by the hour means bill by the hour. A box you forgot to stop overnight costs more than the images were worth.
