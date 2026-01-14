---
layout: post
title: "SQL Was Hard, So We Invented Vectors (Now It's Impossible)"
date: 2025-10-31 14:00:00 +0100
categories: [ai, databases, django]
tags: [pgvector, embeddings, semantic-search, postgresql, django]
---

I had a simple problem. I wanted to search for "mental health" and find "psychological support."
In the old days, we called this "using a thesaurus."
Today, we call it **High-Dimensional Vector Space Embeddings**.

Because why use a simple solution when you can use a 384-dimensional floating point array?

## The Vector Promise

The promise is magic. You feed text into a Black Box (the Model), it spits out a list of numbers (the Embedding), and then you use Math (Cosine Similarity) to find things that "mean" the same thing.

## The Reality: Docker Hell

First, you have to find a Docker image.
I thought: "I'll use Alpine. It's small."
Postgres said: "LOL."
`pgvector` doesn't build on Alpine easily. You have to use Debian. Your container is now 500MB larger. You are sad.

## The Reality: The Migration

Then you have to migrate your database.
You aren't just adding a column. You are adding `vector(384)`.
And you need an index. not a B-Tree. An **HNSW** index (Hierarchical Navigable Small World).
It sounds like a theme park ride. It acts like a memory hog.

## The 40-Minute Miracle

But... it does work.
After fighting Docker, fighting migrations, and fighting the embedding service... I embedded 429 organizations in 40 minutes.
And the search results?
They are... eerie.
I type "I am sad" and it finds "Crisis Support Hotline."
Maybe the machines *do* understand us. Or maybe it's just linear algebra masquerading as empathy.

**[Read the Full Code (If You Like Math)](/ai/databases/django/2025/10/31/pgvector-semantic-search-django.html)**
