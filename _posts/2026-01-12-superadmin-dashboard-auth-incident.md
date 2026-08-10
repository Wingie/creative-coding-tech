---
layout: post
title: "I shipped an admin dashboard with no authentication"
date: 2026-01-12 15:00:00 +0100
categories: [security, incidents, ai-agents]
tags: [django, authentication, security, claude, ai-agents, production]
description: >-
  I shipped an admin dashboard to production with no authentication and found it thirteen minutes later. Including the part I got wrong about CSRF.
---

I shipped an admin dashboard to production with no authentication on it. It was live for thirteen minutes.

The dashboard triggers agents, shows system health, and exposes internal API endpoints. It is the most privileged surface in the platform. I built it, wired it up, deployed at 13:45, and opened it on my phone at 13:52 to check the layout.

It loaded. I wasn't logged in on my phone.

I had opened it in an incognito tab because I hadn't set up the login cookie there yet, which is the only reason I found it. Fixed and deployed at 13:58.

## What I got wrong afterwards

When I first wrote this up I said Django's CSRF protection had limited the damage. It wouldn't have. CSRF stops another site posting on your behalf. It does nothing about someone who can load the page directly, take a valid token from it, and post that. The thing I thanked wasn't helping.

I also wrote that the exposure was about seven minutes. My own timestamps say thirteen. Seven is the gap between deploying and noticing.

## The actual cause

The view had no decorator. That's it.

Every other admin view in the project has one. This one was newer, and I'd built it in a rush of enthusiasm about the thing it controlled rather than the thing it was. The generated scaffolding didn't add one and I didn't notice it missing, because a missing decorator looks like nothing.

The fix is four lines. The interesting question is why four lines were absent for thirteen minutes on the highest-privilege page in the system, and the answer is that nothing checked. There was no test asserting that an anonymous request to an admin URL gets a redirect. There is now, and it runs over the whole admin URL namespace rather than a list I have to remember to extend.

Access logs show no traffic in the window other than mine. I believe that and I can't prove it to you.
