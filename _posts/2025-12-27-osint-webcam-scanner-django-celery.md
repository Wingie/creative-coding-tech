---
layout: post
title: "The Internet of Things is a Surveillance State (And I'm the Admin)"
date: 2025-12-27 12:00:00 +0100
categories: [osint, security, django]
tags: [osint, network-scanning, django, celery, ai, nmap, computer-vision]
---

I built a tool called **CamSniff**.

It sounds cute. Like "DogSniff." It is not cute.

It is a machine that scans IP ranges for open RTSP ports, captures screenshots, and uses AI to categorize them.
In plain English: **It finds insecure webcams and tells me what they are looking at.**

Why did I build this?
1. For security research (obviously).
2. To prove a point: **The "S" in IoT stands for Security.**

## The Architecture of Snooping

The stack is a classic Django + Celery setup, but turned evil.

**Nmap** is the bloodhound. It sniffs for port 554 (RTSP).
**FFmpeg** is the photographer. It grabs a frame.
**ComfyUI (AI)** is the analyst. It looks at the pixelated mess and says "That's a parking lot" or "That's a very messy server room."

## What I Found (Don't Panic, It's Public Data)

I scanned a few (authorized!) ranges.
I found:
- Parking lots. So many parking lots.
- Lobbies of office buildings where nobody works anymore.
- A fish tank.
- A 3D printer failing to print a Benchy.

## The Horror of Default Credentials

The scariest part isn't the open ports. It's the default credentials.
`admin / admin`
`root / 12345`
`service / service`

We are building a digital panopticon, and we are securing it with the equivalent of a "Please Do Not Enter" sticky note.

## The Code

If you want to see how the sausage is made (or how the privacy is violated), the code is below.
It uses Celery to parallelize the scanning because the internet is big and single-threaded Python is slow.

**[View the Source Code (For Education Only!)](/osint/security/django/2025/12/27/osint-webcam-scanner-django-celery.html)**
