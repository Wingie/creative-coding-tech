---
layout: post
title: "Vector search in Django with pgvector, and what the index costs you"
date: 2025-10-31 14:00:00 +0100
categories: [ai, databases, django]
tags: [pgvector, embeddings, semantic-search, postgresql, django]
description: >-
  Adding vector search to a Django app with pgvector and an HNSW index, and why to check its memory use.
---

I wanted a search that finds "psychological support" when someone types "mental health". You do that by turning text into a list of numbers and measuring the distance between lists.

Getting it working in Django took longer than the search itself.

**Alpine.** I started there because the image is small. pgvector needs a compiler and the usual build packages, and by the time I had them the image wasn't small any more. I went to the Debian-based Postgres image and stopped fighting it.

**The migration needs an index too.** You're adding a `vector(384)` field. Without an index, every query scans the table.

**Use HNSW, and check its memory use.** It builds a graph that is fast to search. The whole graph has to sit in memory. Measure how much on your own data before the table grows.

Once it ran, it did the thing. Type "I am sad" and it returns the crisis support line, which nowhere in its text says "sad".

The model has seen enough text to know those two live near each other. It has no idea what either one means.
