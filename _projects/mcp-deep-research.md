---
title: MCP Deep Research
slug: deep-research
tagline: Policy briefs in 8 minutes. Analysts doing synthesis, not search.
description: >-
  mcp-DEEPwebresearch is a breadth-first deep research MCP server with TF-IDF relevance scoring, Playwright headless browsing, and configurable depth/branching. Extended for a policy research think tank where analysts spent 3 hours per brief just gathering sources.
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
github_url: https://github.com/wingie/mcp-DEEPwebresearch
og_image: https://opengraph.githubassets.com/1/qpd-v/mcp-DEEPwebresearch
---

## The Problem

A policy research think tank publishes briefing documents for government clients on emerging technology regulation, climate policy, and economic analysis. Each brief requires 15–25 cited sources. Finding those sources — distinguishing primary sources from commentary, paywalled content from accessible, relevant from superficially related — was consuming three hours of analyst time per brief before any actual writing began.

The team had tried standard RAG pipelines. The problem was that the sources they needed were on the *web*, not in a pre-indexed corpus. New regulatory filings, parliamentary records, academic preprints — these appeared daily and couldn't be pre-embedded.

## What We Built

A deep research MCP server that performs breadth-first web crawling with relevance scoring at each hop. The server exposes a single primary tool (`deep_research`) that takes a query and returns a structured report with citations.

The key extensions over the base project:

- **Playwright headless browsing** — many policy documents are behind JavaScript-rendered government portals that `fetch` can't access
- **TF-IDF relevance scoring** — extracted page content is scored against the original query before deciding whether to follow outbound links
- **Configurable branching** — `maxDepth=2, maxBranching=3` by default; think tank briefs use `maxDepth=3, maxBranching=4` for comprehensive coverage

## How It Works

The research loop uses a priority queue ordered by TF-IDF relevance score:

```typescript
async function deepResearch(
  query: string,
  config: { maxDepth: number; maxBranching: number }
): Promise<ResearchResult> {
  const visited = new Set<string>();
  const queue = new PriorityQueue<ResearchNode>(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  // Seed with initial search results
  const seedUrls = await searchWeb(query);
  seedUrls.forEach((url) =>
    queue.push({ url, depth: 0, relevanceScore: 1.0 })
  );

  const findings: Finding[] = [];

  while (!queue.isEmpty() && findings.length < 40) {
    const node = queue.pop()!;
    if (visited.has(node.url) || node.depth > config.maxDepth) continue;
    visited.add(node.url);

    // Playwright fetches JS-rendered pages
    const content = await fetchWithPlaywright(node.url);
    const extracted = extractText(content);
    const score = tfidfScore(extracted, query);

    if (score > RELEVANCE_THRESHOLD) {
      findings.push({ url: node.url, content: extracted, score });

      // Only follow links from relevant pages
      const links = extractLinks(content).slice(0, config.maxBranching);
      links.forEach((link) =>
        queue.push({
          url: link,
          depth: node.depth + 1,
          relevanceScore: score * 0.8, // decay per hop
        })
      );
    }
  }

  return synthesise(findings, query);
}
```

The TF-IDF score decay per hop (`score * 0.8`) prevents the crawler from drifting too far from the original query — pages found three hops away from a search result are unlikely to be highly relevant.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">8 min</span>
    <span class="metric__label">draft brief generation</span>
  </div>
  <div class="metric">
    <span class="metric__value">3 hrs</span>
    <span class="metric__label">saved per brief (source gathering)</span>
  </div>
  <div class="metric">
    <span class="metric__value">25+</span>
    <span class="metric__label">citations per brief</span>
  </div>
</div>

Analysts now spend 8 minutes running the research tool and receive a structured draft with cited sources. Their three hours of source gathering is replaced by 30 minutes of fact-checking and synthesis. Brief output per analyst doubled in the first month.

The Playwright integration specifically unlocked European Parliament records and national legislative databases that were previously inaccessible to automated tools — these are now the think tank's most-cited source category.
