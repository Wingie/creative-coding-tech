---
layout: post
title: "The 'Nuke' Option and the Protocol Soup of Death"
date: 2026-01-14 09:00:00 +0100
categories: [security, rant, engineering]
tags: [camsniff, IoT, security-theatre, protocols, complexity, yegge-style]
---

I recently took a tour through the git history of my own security scanner project, [CamSniff](https://github.com/John0n1/CamSniff), and I found something that made me stop and stare at my monitor for a solid five minutes.

It was a commit message. A simple, honest, terrifying commit message:

**["Refactor scanning modes: add 'nuke'"](https://github.com/John0n1/CamSniff/commit/a1fa05e1)**

And I thought: *Yes. This is it. This is the current state of computer security.*

We have passed the point of "scanning". We gave up on "probing" years ago. We are now in the era of "nuking". Because when you are staring down the barrel of an IoT device running a web server from 2003 with default credentials and a protocol stack that looks like it was designed by a committee of drunk badgers, "nuke" is the only logical response.

### The Protocol Soup of Death

The reason we need a "nuke" option is that the landscape we are trying to secure is a fundamentally broken hellscape of incompatible standards.

Look at another commit from the same repo:

**["Add CoAP build and scanning Integration"](https://github.com/John0n1/CamSniff/commit/d19c5937)**

[CoAP](https://coap.technology/). Constrained Application Protocol.

Ideally, CoAP is a lovely, lightweight protocol for small devices. In reality, it is yet another ingredient in the Protocol Soup of Death. We have RTSP for video, which never works the same way twice. We have [ONVIF](https://www.onvif.org/), which is an acronym that stands for "Oh No, Video Is F***ed". We have HTTP, HTTPS, MQTT, and a thousand proprietary protocols running on port 8000.

And `CamSniff`—my poor, beleaguered child—is trying to talk to all of them.

It’s not software engineering anymore. It’s diplomacy. It’s negotiating a hostage release with a toaster.

### The MAX_CREDENTIALS Fallacy

Buried deep in the source code of any security scanner is a constant. In CamSniff, it looks something like this:

`#define MAX_CREDENTIALS 100`

This constant is the physical manifestation of our collective failure. It represents the hope that if we just try "admin/admin", "root/1234", and ninety-eight other combinations, we will get in. And the sad part is: *we usually do*.

We are building sophisticated, multi-threaded, asynchronous scanning engines, wrapping them in [Docker](https://www.docker.com/) containers, orchestrating them with [Kubernetes](https://kubernetes.io/), and piping the output into [Elasticsearch](https://www.elastic.co/) dashboards.

But under the hood? It’s just `while (try_password())`.

We are building skyscrapers on a foundation of mud and default passwords.

### The Security Tool Identity Crisis

Every security tool eventually has an identity crisis. It starts as a script. "I'll just check for open ports," it says. Innocent. Helpful.

Then you add feature requests.

*   "Can it check for weak passwords?"
*   "Can it grab a screenshot?"
*   "Can it parse the RTSP stream?"
*   "Can it support CoAP?"
*   "Can it brew coffee?"

And suddenly, your 50-line Python script is now a 50,000-line C++ monstrosity with a `Makefile` that looks like the necronomicon. It’s no longer a tool; it’s a platform. It's a lifestyle.

And that’s when you add the "nuke" option.

Because you realize that the only way to be sure secure against a cheap IP camera from a vendor that ceased to exist three years ago is to fundamentally burn the network to the ground and start over.

### Conclusion

If you are writing security tools today, I salute you. You are the janitors of the internet, cleaning up a mess you didn't make, using tools that are barely adequate for the job.

But do me a favor. When you write your next tool, just skip the "scan" mode. Go straight to "nuke". It’s what we all want anyway.
