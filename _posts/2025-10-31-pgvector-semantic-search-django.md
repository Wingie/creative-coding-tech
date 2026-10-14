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

I started on Alpine because the image is small. pgvector needs a compiler and the usual build packages. By the time I'd added them, the image wasn't small any more. I moved to the Debian-based Postgres image and stopped fighting it.

The migration adds a `vector(384)` field, and it needs an index too. Without one, every query scans the table.

I used HNSW. It builds a graph that's fast to search, and the whole graph has to sit in memory. Measure how much memory it takes on your own data before the table grows.

Once it ran, it did the thing. Type "I am sad" and you get the crisis support line. Its text never says "sad". The model has seen enough text to place those two near each other.
