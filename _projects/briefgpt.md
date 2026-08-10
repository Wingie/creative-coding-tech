---
title: BriefGPT
slug: briefgpt
tagline: 500-page patent reviews, on a machine with no internet
description: >-
  An IP law firm can't send client documents to any cloud service. So the model runs
  on a machine with no internet, and clusters each patent before summarising it.
language: Python
role: Extended
year: 2023
order: 6
tech:
  - Python
  - LangChain
  - LlamaCpp
  - Instructor
  - K-means clustering
  - FAISS
  - Sentence Transformers
client: IP law firm (NDA, Europe)
github_url: https://github.com/e-johnstonn/BriefGPT
upstream_owner: e-johnstonn
upstream_repo: BriefGPT
og_image: https://opengraph.githubassets.com/1/e-johnstonn/BriefGPT
---

The contracts said no client document goes to a third-party cloud service. That rules out OpenAI, Anthropic and Google, which is most of the options.

The firm reviews patent applications for multinational clients.

So the analysts read the applications themselves. Four hundred to six hundred pages each, producing a structured brief covering prior art, claim scope, jurisdiction and filing strategy. Four to six hours per brief, six analysts, a growing caseload.

[BriefGPT](https://github.com/e-johnstonn/BriefGPT) is Ethan Johnston's project. I extended it to run entirely offline.

**A local model.** Mistral-7B-Instruct quantised to 4-bit through LlamaCpp, on a workstation GPU. The machine doesn't need a network connection at all, which turned out to matter during confidential proceedings where they can't have one.

**Clustering before summarising.** This is the part that made it work. A 500-page patent is mostly repetition: boilerplate legal language, restated claims, dense technical description. Chunk it in order and you summarise the same thing nine times. Instead the pipeline embeds the document, clusters those embeddings, and summarises a representative chunk from each cluster. You get the distinct parts of the document instead of a walk through it.

**A fixed output shape.** Instructor enforces a Pydantic schema, so every brief has the same fields even coming out of a small local model. That's what let them automate the steps afterwards.

Review time went from around four hours to around forty-five minutes. Six analysts were using it within a day.

*Their figures.*
