---
title: MCP Deep Research
slug: deep-research
tagline: Three hours of finding sources before anyone writes anything
description: >-
  A think tank was spending three hours per briefing just finding sources.
  Extending a research crawler with a real browser and per-hop scoring cut it
  to minutes.
language: TypeScript
role: Extended
year: 2025
order: 10
tech:
  - TypeScript
  - Playwright
  - MCP
  - TF-IDF
  - Cheerio
  - Node.js
client: Policy research think tank
github_url: https://github.com/qpd-v/mcp-DEEPwebresearch
upstream_owner: qpd-v
upstream_repo: mcp-DEEPwebresearch
og_image: https://opengraph.githubassets.com/1/qpd-v/mcp-DEEPwebresearch
---

Three hours of every brief went on finding sources. Not reading them. Finding them.

The think tank writes briefings for government clients, and each one needs fifteen to twenty-five citations. The work is telling a primary source from commentary, working out what's paywalled, discarding things that only look relevant.

They'd tried a standard RAG setup and it didn't fit. The sources they need are on the open web, not in a corpus you can index in advance. New regulatory filings, parliamentary records and preprints appear daily.

[MCP Deep Research](https://github.com/qpd-v/mcp-DEEPwebresearch) is qpd-v's project: a crawler that searches, follows links, and scores what it finds. I extended it for their sources.

**A real browser.** Many government portals render their documents with JavaScript, so a plain HTTP fetch gets an empty page. Playwright drives a headless browser instead. That's what unlocked European Parliament records and several national legislative databases, which are now the sources they cite most.

**Scoring before following.** Each page is scored against the original question before the crawler decides whether to follow its links. A priority queue works through the best ones first.

**A decay per hop.** Each step away from the starting point multiplies the score by 0.8. Without that, the crawler wanders. Three hops from a search result you are usually reading something adjacent to a thing that was adjacent to the topic.

They run it wider than the default, three hops deep and four branches, because a briefing wants coverage more than speed.

Source-gathering went from three hours to eight minutes. The analysts spend that time on the brief instead.
