---
layout: page
title: Corrections
description: >-
  Things this site got wrong, and what caused them. For a while most of it was
  written by an automated system that nobody was reading.
permalink: /corrections/
---

I build test harnesses for AI systems. In 2026 I found out I had never pointed one at my own website.

Everything below stays up.

---

## The site was behind my own repo

**10 August 2026.**

Psychohistory is a side project I'm still iterating on. An early test looked good, I put it on three pages here, and then it didn't survive a closer look. The repo moved on months ago. This site didn't.

That's the mistake: I updated the work and not the page describing it.

---

## The site wrote itself

**Found 9 August 2026. Started around January 2026.**

I built an autonomous build system for [Agentosaurus](/projects/agentosaurus/). After every successful run it wrote a post about the work into this site. To keep the voice consistent, each new post read the most recent existing post as a style sample.

So each post copied the one before it, and nobody read any of them. That ran for months.

Here is what it published:

- **Someone else's projects, described as mine.** One post called a security scanner "my own project" and linked to the real author's repository in the same sentence. Another announced decisions about a repository I have no rights to.
- **Jobs I never had.** One post said I worked at Amazon in 2002 and implied I'd been at Google. Neither is true. My actual history is on the [about page](/about/).
- **Another writer's voice.** Several posts imitated a well-known engineering blogger closely enough that his name leaked into the text: "But Steve (or Wingston), you ask…". The imitation was named in the post's own metadata.
- **A hiring manager who isn't me.** The worst one was written as someone who screens candidates, keeps a blacklist, and bins any CV that matches the job description too well. It attacked a named person's public repository. I have never had that job and don't think that way.
- **Made-up sources.** A statistic credited to Gartner and an article credited to Wired. I can't find either.
- **Made-up numbers.** Success rates, cost savings and throughput figures written as if they'd been measured.

**What I did.** Deleted the posts. Turned the generator off on the server, which took longer than it should have because my first fix only changed the copy on my laptop. If it comes back it will write to a drafts folder that a person has to promote from.

The loop had no check in it. I didn't notice for months because the output looked fine. Looking fine was doing the job that checking should have been doing, which is the exact thing I write test harnesses to catch.

---

## Project pages credited the wrong people

**Found 9 August 2026.**

Thirteen of fifteen project pages linked to GitHub repositories under my account that don't exist. The pages had the correct original author stored in their metadata. A template overwrote it with my username. So each page knew whose work it was and hid it anyway.

Most of those pages describe real client jobs where I extended someone else's open-source project. That's what open source is for. The broken links made it look like I was claiming to have written them. One page said a repository had "hundreds of stars". The real one has tens of thousands and belongs to someone else.

**What I did.** Every link now points at the real project. Two have since moved again and I have repointed them; upstream repos get renamed and this will keep happening. Each page names the original author and says plainly that I extended their work. The page data no longer lists me as the author of things I only contributed to.

---

## Numbers nobody counted

**Found 9 August 2026.**

The site said "100+ open source repositories". I have 169 public, of which 37 are mine and the rest are forks. It also gave a countries-visited figure and an uptime percentage I can't source, and a team size I'm not allowed to publish.

**What I did.** It says 37 now. The other numbers are gone.

---

## Things you should know

**The benchmark numbers on this site come from my own test suite, scored by my own scorer.** Nobody else has checked them. One leaderboard position I quoted elsewhere came from a partial run; the 44-task figures are the complete ones.

**Psychohistory is v0.5 and still moving.** See the entry above for where the headline result got to.

**Client results on project pages come from the clients.** Most are under NDA, so you're taking my word for them.

**Booking.com business figures and team sizes are confidential.** That's why some pages describe what I did without saying how big it was.

---

*Last updated 10 August 2026. Find something wrong, [tell me](/contact/), and it goes on this page.*
