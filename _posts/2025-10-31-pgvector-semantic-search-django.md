---
layout: post
title: "pgvector Semantic Search: From Zero to 429 Organizations in 40 Minutes"
date: 2025-10-31 14:00:00 +0100
categories: [ai, databases, django]
tags: [pgvector, embeddings, semantic-search, postgresql, django]
---

I needed to search 429 Amsterdam organizations by meaning, not just keywords. "Find organizations focused on youth mental health" should return relevant results even if those exact words don't appear anywhere. Here's how I implemented semantic search with pgvector in Django.

## The Goal

Transform keyword-based search into semantic search:

```
Before: "mental health" → Only matches if those words exist
After:  "mental health" → Matches "psychological support", "wellbeing services", etc.
```

## Architecture Overview

```
User Query
    ↓
Embedding Model (BAAI/bge-small-en-v1.5)
    ↓
384-dimensional vector
    ↓
PostgreSQL pgvector cosine similarity
    ↓
Ranked results
```

## Step 1: Docker Image Selection

**The trap I fell into**: I spent time looking for `pgvector/pgvector:pg15-alpine` because I wanted a smaller image.

**Reality**: Alpine variants don't exist for pgvector. The official tags are:
- `pgvector/pgvector:pg13`
- `pgvector/pgvector:pg14`
- `pgvector/pgvector:pg15` (what I used)
- `pgvector/pgvector:pg16`

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg15  # ~200MB, Debian-based
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Step 2: Django Migrations

Three migrations to set up pgvector:

```python
# Migration 1: Install extension
# 0018_install_pgvector_extension.py
from django.db import migrations

class Migration(migrations.Migration):
    operations = [
        migrations.RunSQL(
            "CREATE EXTENSION IF NOT EXISTS vector;",
            "DROP EXTENSION IF EXISTS vector;"
        ),
    ]
```

```python
# Migration 2: Add vector fields
# 0019_add_vector_embeddings.py
from pgvector.django import VectorField

class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name='organization',
            name='name_embedding',
            field=VectorField(dimensions=384, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='description_embedding',
            field=VectorField(dimensions=384, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='activities_embedding',
            field=VectorField(dimensions=384, null=True),
        ),
    ]
```

```python
# Migration 3: Create HNSW indices for fast search
# 0020_create_vector_indices.py
class Migration(migrations.Migration):
    operations = [
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS org_name_embedding_idx
            ON agentosaurus_organization
            USING hnsw (name_embedding vector_cosine_ops);
            """,
            "DROP INDEX IF EXISTS org_name_embedding_idx;"
        ),
        # Similar for description and activities...
    ]
```

## Step 3: Embedding Service

I chose `BAAI/bge-small-en-v1.5` for the embedding model:
- 384 dimensions (compact)
- Good quality for English text
- Fast inference with sentence-transformers

```python
# embedding_service.py
from sentence_transformers import SentenceTransformer

class OrganizationEmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer('BAAI/bge-small-en-v1.5')

    def generate_embedding(self, text: str) -> list[float]:
        """Generate 384-dim embedding for text."""
        if not text or not text.strip():
            return None
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def embed_organization(self, org):
        """Generate all embeddings for an organization."""
        org.name_embedding = self.generate_embedding(org.name)
        org.description_embedding = self.generate_embedding(org.description)
        org.activities_embedding = self.generate_embedding(
            " ".join(org.activities) if org.activities else ""
        )
        org.save(update_fields=[
            'name_embedding',
            'description_embedding',
            'activities_embedding'
        ])
```

## Step 4: Semantic Search Service

```python
# semantic_search.py
from pgvector.django import CosineDistance
from django.db.models import F, Value
from django.db.models.functions import Greatest

class SemanticSearchService:
    def __init__(self):
        self.embedding_service = OrganizationEmbeddingService()

    def search(self, query: str, limit: int = 20):
        """Hybrid search combining semantic + keyword matching."""
        query_embedding = self.embedding_service.generate_embedding(query)

        # Semantic search across all three fields
        results = Organization.objects.annotate(
            name_distance=CosineDistance('name_embedding', query_embedding),
            desc_distance=CosineDistance('description_embedding', query_embedding),
            activities_distance=CosineDistance('activities_embedding', query_embedding),
        ).annotate(
            # Take the best (lowest) distance across fields
            best_distance=Greatest(
                1 - F('name_distance'),
                1 - F('desc_distance'),
                1 - F('activities_distance'),
            )
        ).filter(
            best_distance__gt=0.3  # Minimum similarity threshold
        ).order_by('-best_distance')[:limit]

        return results
```

## Step 5: Management Command

```python
# management/commands/generate_embeddings.py
from django.core.management.base import BaseCommand
from agentosaurus.models import Organization
from agentosaurus.embedding_service import OrganizationEmbeddingService

class Command(BaseCommand):
    help = 'Generate embeddings for all organizations'

    def handle(self, *args, **options):
        service = OrganizationEmbeddingService()
        orgs = Organization.objects.filter(name_embedding__isnull=True)

        total = orgs.count()
        for i, org in enumerate(orgs):
            service.embed_organization(org)
            self.stdout.write(f"[{i+1}/{total}] {org.name}")
```

## Performance Numbers

Running on Docker with PostgreSQL 15 + pgvector:

| Metric | Value |
|--------|-------|
| Organizations | 429 |
| Embedding time per org | 5-10 seconds |
| Total embedding time | ~40 minutes |
| Query time (with HNSW) | <100ms |
| Vector dimensions | 384 |
| Index type | HNSW (cosine) |

## The Hybrid Approach

Pure semantic search can miss obvious keyword matches. I combine both:

```python
def hybrid_search(self, query: str, limit: int = 20):
    # Semantic results
    semantic_results = self.semantic_search(query, limit=limit*2)

    # Keyword results (fallback)
    keyword_results = Organization.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:limit]

    # Merge and deduplicate, semantic first
    seen = set()
    final = []
    for org in list(semantic_results) + list(keyword_results):
        if org.id not in seen:
            seen.add(org.id)
            final.append(org)
        if len(final) >= limit:
            break
    return final
```

## Celery Background Tasks

Embedding new organizations happens in the background:

```python
# tasks.py
from celery import shared_task

@shared_task
def generate_organization_embeddings(org_id: int):
    """Background task to embed a single organization."""
    from agentosaurus.models import Organization
    from agentosaurus.embedding_service import OrganizationEmbeddingService

    org = Organization.objects.get(id=org_id)
    service = OrganizationEmbeddingService()
    service.embed_organization(org)

@shared_task
def batch_generate_embeddings():
    """Weekly task to embed any missing organizations."""
    from agentosaurus.models import Organization

    orgs = Organization.objects.filter(name_embedding__isnull=True)
    for org in orgs:
        generate_organization_embeddings.delay(org.id)
```

## Files Created

```
backend/Quantoxbay/agentosaurus/
├── migrations/
│   ├── 0018_install_pgvector_extension.py
│   ├── 0019_add_vector_embeddings.py
│   └── 0020_create_vector_indices.py
├── embedding_service.py
├── semantic_search.py
└── management/commands/
    └── generate_embeddings.py
```

## Key Learnings

1. **No Alpine images for pgvector** - don't waste time looking
2. **HNSW indices are essential** - without them, queries scan all vectors
3. **384 dimensions is plenty** - larger models aren't always better
4. **Hybrid search wins** - combine semantic + keyword for best results
5. **Background embedding** - don't block web requests with model inference

## What's Next

- Add re-ranking with cross-encoder models
- Implement query expansion for better recall
- Cache frequent query embeddings in Redis

---

*Semantic search transforms how users interact with your data. Instead of guessing keywords, they can describe what they're looking for in natural language.*
