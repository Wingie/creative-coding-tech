---
layout: page
title: Corrections
description: >-
  A standing record of things this site got wrong — including a period when most
  of it was written by an automated system with no human in the loop, and what
  that produced.
permalink: /corrections/
---

This page exists because I run research on whether we can measure what AI systems actually do, and in 2026 I found out the hard way that I wasn't measuring my own.

Everything below stays up. Dated, specific, and named by the kind of mistake rather than the surface error.

---

## The site wrote itself, and drifted

**Found: 9 August 2026. Cause introduced: around January 2026.**

I built an autonomous build system for [Agentosaurus](/projects/agentosaurus/). One of its conveniences was a devlog: after every successful run, it wrote a post about the work into this site's `_posts/` directory. To keep a consistent voice, each new post sampled the most recent existing post as a style reference.

That last detail is the whole failure. Each post imitated the one before it, with nobody reading the output. It's a feedback loop with no measurement in it — the exact failure mode I write about in evaluation harnesses, running unnoticed in my own repository for months.

**What it produced,** all of which was live on this site:

- **Borrowed authorship.** Posts describing open-source projects belonging to other people in the first person — "my own security scanner project", linking to the real author's repository in the same sentence. One went further and announced governance decisions about a repo I have no rights to.
- **Invented employment history.** A post claimed I worked at Amazon in 2002 and implied a stint at Google. Neither is true. My actual history is on the [about page](/about/) and has never included either.
- **A borrowed persona.** Several posts were written in an imitation of another well-known engineering writer, to the point that his name leaked into the text — "But Steve (or Wingston), you ask…" — and the imitation was named in the post metadata.
- **A hiring manager I am not.** The worst one was written in the voice of someone who screens candidates, keeps a blacklist, and discards résumés that match a job description too well. It criticised a named individual's public repository by name. I have never held that role and don't hold those views.
- **Fabricated citations.** A specific statistic attributed to Gartner and an article attributed to Wired, neither of which I can source.
- **Invented metrics.** Success rates, cost savings and throughput figures presented as measurements, generated rather than recorded.

**What I changed.** The four worst posts are unpublished. The devlog generator is disabled at the source. If I bring it back it will write to a drafts directory that a human promotes from, because the mechanism was never the problem — publishing without review was.

**The type of mistake:** building a generation loop with no verification step, and then not checking it because it was producing plausible-looking output. Plausibility was doing the work that verification should have been doing. That's the same error I built canary tokens to catch in other people's models.

---

## Project pages misattributed the work

**Found: 9 August 2026.**

Fourteen of fifteen project pages linked to GitHub repositories under my account that do not exist. The pages had recorded the correct upstream author in their metadata, and a templating step overwrote it with my username. So the pages simultaneously knew and hid whose work it was.

Several described real client engagements where I extended someone else's open-source project — which is what open source is for — but the broken links made it look like authorship. One page claimed a repository had "hundreds of stars"; the real upstream has 2,890, and it isn't mine.

**What I changed.** Every link now points at the real upstream, verified resolving. Each page carries a visible credit naming the original author and stating plainly that I extended their work. The structured data no longer lists me as author of projects I contributed to.

**The type of mistake:** letting a template write a field that carried a factual claim, and not checking the output because the input had been right.

---

## Numbers that were never counted

**Found: 9 August 2026.**

The site claimed "100+ open source repositories". The real figure is 169 public, of which 37 are my own work rather than forks. It also carried a countries-visited figure and an uptime percentage I can't source, and a team headcount that I can't publish anyway.

**What I changed.** 37 original repositories, which is the number I can defend. The others are gone rather than adjusted.

**The type of mistake:** round numbers that sound right and were never derived from anything.

---

## Standing caveats

Not errors — limits I'd rather state than have you discover.

**Benchmark results on this site are reproducible in my harness, scored by my scorer.** They aren't externally validated and shouldn't be treated as authoritative. One leaderboard placement I've quoted elsewhere was based on a partial run; the 44-task figures are the complete ones.

**The psychohistory paper is v0.5 and in review.** One prediction has a sealed pre-registered pass. Several sub-claims are refuted or contradicted, and that's in the repository README, not buried. The forecasting claims remain conjecture pending a compute run.

**Client outcome figures on project pages come from the engagements themselves** and are mostly under NDA, so you're taking my word for them. Where I could publish a verifiable artifact instead, I have.

**Booking.com business metrics and team sizes are confidential.** Where a page describes scope without numbers, that's why.

---

*Last updated 9 August 2026. If you find something wrong here, [tell me](/contact/) and it goes on this page.*
