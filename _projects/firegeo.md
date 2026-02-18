---
title: FireGEO
slug: firegeo
tagline: Real-time wildfire geospatial monitoring shipped as a paying product in 7 weeks
description: >-
  FireGEO is a wildfire monitoring platform with Server-Sent Events streaming, usage-based billing, and Drizzle ORM JSONB storage. Extended for a climate data startup that needed a product around their satellite data feeds — shipped to paying customers in week seven.
language: TypeScript / Next.js
role: Extended
year: 2024
order: 4
tech:
  - TypeScript
  - Next.js
  - Drizzle ORM
  - PostgreSQL
  - Server-Sent Events
  - Stripe
  - Vercel
client: Climate data startup (NDA)
github_url: https://github.com/wingie/FireGEO
og_image: https://opengraph.githubassets.com/1/mendableai/firegeo
---

## The Problem

A climate data startup had been processing satellite imagery feeds for two years, building a rich dataset of historical wildfire perimeters, spread velocity, and atmospheric conditions. They had the data science side solved. They did not have a product.

They'd tried building a dashboard in-house — it stalled at the "how do we charge for this" problem. They needed a working product with billing, user accounts, and a live data view in six weeks. The technical constraint was that their analysis pipeline could take 30–90 seconds per query; the UI had to feel responsive regardless.

## What We Built

FireGEO extended an existing open-source wildfire monitoring scaffold into a full SaaS product. The key additions:

- **SSE streaming layer** — analysis results stream to the client progressively as they're computed, so users see partial results within 2 seconds even if the full computation takes 90 seconds
- **Credit-debit billing** — credits are reserved at request start, deducted on completion, refunded on error; Stripe webhooks reconcile account balances
- **JSONB result storage** — Drizzle ORM stores heterogeneous analysis outputs (perimeter polygons, spread vectors, risk scores) as typed JSONB, indexed for fast retrieval

## How It Works

The SSE route handler is the core piece. It reserves credits upfront, streams analysis chunks, then either commits or refunds:

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const userId = await getUserId(req);

  // Reserve credits before starting (never let analysis run unpaid)
  const reservation = await reserveCredits(userId, ANALYSIS_COST);
  if (!reservation.ok) {
    return new Response("Insufficient credits", { status: 402 });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // Run analysis in background, stream results
  runFireAnalysis(query)
    .on("chunk", (chunk) => send({ type: "chunk", data: chunk }))
    .on("complete", async (result) => {
      await commitCredits(reservation.id);
      await storeResult(userId, query, result);
      send({ type: "complete", result });
      writer.close();
    })
    .on("error", async (err) => {
      await refundCredits(reservation.id);
      send({ type: "error", message: err.message });
      writer.close();
    });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">7 wks</span>
    <span class="metric__label">to first paying customer</span>
  </div>
  <div class="metric">
    <span class="metric__value">$0</span>
    <span class="metric__label">revenue risk from billing</span>
  </div>
  <div class="metric">
    <span class="metric__value">&lt;2s</span>
    <span class="metric__label">time to first byte</span>
  </div>
</div>

The credit-reserve-then-commit model meant zero revenue risk from partial or errored analyses. The SSE streaming meant the product felt fast even on a 90-second analysis — users saw fire perimeter outlines populating the map in real time, which became the product's defining demo moment.

The startup used the billing architecture as a template for a second product line six months later.
