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

The dashboard triggers agents, shows system health, and exposes internal API endpoints. It's the most privileged page on the platform. I built it, wired it up and deployed at 13:45. At 13:52 I opened it on my phone to check the layout.

It loaded. I wasn't logged in on my phone.

I'd opened it in an incognito tab, where I had no login cookie yet. That's the only reason I found it. I fixed it and deployed at 13:58.

## What I got wrong afterwards

When I first wrote this up I said Django's CSRF protection had limited the damage. It wouldn't have. CSRF stops another site posting on your behalf. It does nothing about someone who can load the page directly, take a valid token from it, and post that.

I also wrote that the exposure was about seven minutes. My own timestamps say thirteen. Seven is the gap between deploying and noticing.

## The cause

The view had no decorator. That's it.

Every other admin view in the project has one. This one was newer. I was excited about what it controlled and forgot what it was. The generated code didn't add a decorator. I didn't notice, because a missing decorator looks like nothing.

The fix is four lines. They were missing for thirteen minutes on the most privileged page in the system because nothing checked. No test asserted that an anonymous request to an admin URL gets a redirect. One does now. It runs over the whole admin URL namespace, so there's no list I have to remember to extend.

Access logs show no traffic in the window other than mine. I believe that and I can't prove it to you.
