---
layout: post
title: "Four hours debugging grainy SDXL output on a rented GPU"
date: 2025-08-22 14:00:00 +0100
categories: [ai, gpu, image-generation]
tags: [lambda-labs, sdxl, comfyui, gpu, image-generation, remote-execution]
description: >-
  Renting a GPU to run SDXL, and four hours lost to grainy output that turned out not to be the sampler.
---

You want to generate images.
You *could* buy an H100. It costs as much as a Honda Civic.
Or you could rent one from Lambda Labs for the price of a coffee.
(A very expensive coffee, if you forget to turn it off).

## The Pipeline from Hell

We are chaining together:
1.  **Django** (Python, sensible)
2.  **Celery** (Distributed queues, chaos)
3.  **Lambda Labs API** (The landlord)
4.  **ComfyUI** (Spaghetti nodes)

It is a Rube Goldberg machine for generating waifus.

## The Graininnies

My images looked like they were printed on sandpaper.
Why? **VAE Precision**.
The default VAE runs in `fp16`. It saves memory. It also makes your art look like garbage.
I spent 4 hours debugging "The Graininnies" so you don't have to.
