---
title: FireGEO
slug: firegeo
tagline: Their analysis took 90 seconds. The page had to feel fast anyway.
description: >-
  A climate data startup had two years of wildfire data and no product. The hard
  parts were making a 90-second analysis feel responsive, and making the billing
  survive a request that dies halfway through.
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
github_url: https://github.com/mendableai/firegeo
upstream_owner: mendableai
upstream_repo: firegeo
og_image: https://opengraph.githubassets.com/1/mendableai/firegeo
---

A climate data startup had spent two years processing satellite imagery. They had wildfire perimeters, spread velocity, atmospheric conditions. What they didn't have was anything a customer could pay for.

They'd tried building a dashboard themselves and got stuck on billing.

Two things made this awkward. Their analysis took 30 to 90 seconds per query, and nobody waits 90 seconds looking at a spinner. And if you charge per query, you have to decide what happens when a query dies at second 70.

[FireGEO](https://github.com/mendableai/firegeo) is Mendable's project. I built the product layer on it.

**Results stream as they arrive.** The page shows something within about two seconds and fills in from there. The analysis still takes 90 seconds. It stops feeling like it.

**Credits are reserved, then committed or refunded.** Charge at the start, settle at the end, refund if it fails. Stripe webhooks reconcile the balance so the two systems can't drift apart.

**Results are stored as typed JSONB** through Drizzle. Perimeter polygons, spread vectors and risk scores don't share a shape, and forcing them into one table was going to hurt later.

They asked for six weeks. It took seven, and they had a paying customer at the end of it.
