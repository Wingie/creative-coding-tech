---
title: BriefGPT
slug: briefgpt
tagline: 500-page patent applications. No cloud APIs. 45 minutes instead of 4 hours.
description: >-
  BriefGPT is a document intelligence platform with K-means clustering on embeddings, local LLM support via LlamaCpp, and structured brief extraction. Deployed for an IP law firm in Europe where client documents couldn't touch external APIs — analyst review time cut from 4 hours to 45 minutes per document.
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
github_url: https://github.com/wingie/BriefGPT
og_image: https://opengraph.githubassets.com/1/e-johnstonn/BriefGPT
---

## The Problem

A European intellectual property law firm handling patent applications for multinational clients faced a particular constraint: client documents were covered by strict confidentiality agreements that explicitly prohibited processing by third-party cloud services. OpenAI, Anthropic, Google — all off the table.

Their analysts were reading 400–600 page patent applications manually, producing structured review briefs that covered prior art, claim scope, jurisdictional considerations, and filing strategy. Each brief took four to six hours. With six analysts and a growing caseload, they had a throughput problem.

## What We Built

BriefGPT extended with a fully offline LLM pipeline. The key changes over the base project:

- **Local LLM mode** via LlamaCpp with Mistral-7B-Instruct quantised to 4-bit — runs on a workstation GPU, no internet required
- **K-means document segmentation** — rather than naive chunk-by-chunk processing, the pipeline clusters document embeddings first, then summarises representative chunks from each cluster
- **Structured extraction** via Instructor — enforces strict Pydantic output schemas so every brief has the same fields, enabling downstream automation

## How It Works

The clustering step is what separates useful summaries from noise. A 500-page patent has repetitive claim language, boilerplate legal text, and dense technical descriptions — naive chunking treats them all equally. K-means finds the conceptually distinct regions:

```python
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
import numpy as np

def cluster_document(chunks: list[str], n_clusters: int = 12) -> list[str]:
    """Return the most representative chunk from each conceptual cluster."""
    encoder = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = encoder.encode(chunks, show_progress_bar=False)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(embeddings)

    representative_chunks = []
    for cluster_id in range(n_clusters):
        # Find chunk closest to cluster centroid
        cluster_mask = kmeans.labels_ == cluster_id
        cluster_embeddings = embeddings[cluster_mask]
        centroid = kmeans.cluster_centers_[cluster_id]
        distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
        best_idx = np.where(cluster_mask)[0][distances.argmin()]
        representative_chunks.append(chunks[best_idx])

    return representative_chunks
```

The Instructor integration enforces structured output even from the local model:

```python
import instructor
from llama_cpp import Llama
from pydantic import BaseModel

class PatentBrief(BaseModel):
    primary_claims: list[str]
    prior_art_risks: list[str]
    jurisdictions_recommended: list[str]
    filing_urgency: Literal["high", "medium", "low"]
    key_differentiators: str

llm = Llama(model_path="mistral-7b-instruct.Q4_K_M.gguf", n_gpu_layers=35)
client = instructor.patch(llm.create_chat_completion)
```

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">45 min</span>
    <span class="metric__label">avg review time (was 4h)</span>
  </div>
  <div class="metric">
    <span class="metric__value">100%</span>
    <span class="metric__label">data stays on-premises</span>
  </div>
  <div class="metric">
    <span class="metric__value">6</span>
    <span class="metric__label">analysts onboarded in 1 day</span>
  </div>
</div>

Analysts now use the brief as a starting point rather than writing from scratch. The structured output — consistent field names and formats — also fed a downstream Excel report generator that previously required manual copying. The firm estimated 1.5 FTE hours saved per analyst per day.

The local LLM setup has an additional benefit the firm didn't anticipate: the system works with no internet connection, which is occasionally required during confidential proceedings.
