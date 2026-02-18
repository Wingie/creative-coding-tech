---
title: BookLore
slug: booklore
tagline: A self-hosted Goodreads replacement that owns your reading data completely
description: >-
  BookLore is a full-stack book management and discovery platform with AI-powered recommendations, EPUB auto-indexing, and Google Books API integration. Extended for an independent bookshop chain migrating 12,000 books from scattered drives to a unified catalogue — staff adoption hit 100% in a week.
language: Kotlin / TypeScript
role: Extended
year: 2024
order: 3
tech:
  - Kotlin
  - Spring Boot
  - TypeScript
  - React
  - PostgreSQL
  - Google Books API
  - Docker
client: Independent bookshop chain (NDA)
github_url: https://github.com/wingie/BookLore
og_image: https://opengraph.githubassets.com/1/booklore-app/booklore
screenshot: /assets/img/projects/booklore-demo.gif
---

## The Problem

A four-location independent bookshop chain had accumulated 12,000 books across physical shelves, staff personal drives, a legacy FileMaker database, and a partially-filled Google Sheet. Three staff members had institutional knowledge of the catalogue. When one left, that knowledge left with her.

They'd tried Goodreads — the privacy model wasn't acceptable for a business. They'd tried Calibre — too desktop-centric, no multi-user. They needed something that ran on their own infrastructure, worked for multiple simultaneous users, and didn't require a technical background to operate.

## What We Built

BookLore is a Spring Boot + React application with PostgreSQL persistence. The core extension built for this engagement was the **BookDrop** service: a filesystem watcher that turns a shared network folder into an automatic ingestion pipeline.

Drop an EPUB in the folder → the service detects it, extracts metadata from the file, enriches it via Google Books API, creates a reading entry, assigns it to the correct shelf, and notifies relevant staff — all without anyone touching a UI.

## How It Works

The BookDrop file watcher uses Java's `WatchService` API with a Kotlin coroutine wrapper:

```kotlin
class BookDropService(
    private val watchPath: Path,
    private val bookService: BookService,
    private val googleBooksClient: GoogleBooksClient
) {
    suspend fun watch() = coroutineScope {
        val watcher = watchPath.fileSystem.newWatchService()
        watchPath.register(watcher, ENTRY_CREATE)

        while (isActive) {
            val key = withContext(Dispatchers.IO) { watcher.take() }
            key.pollEvents().forEach { event ->
                val file = watchPath.resolve(event.context() as Path)
                if (file.extension == "epub") {
                    launch { processEpub(file) }
                }
            }
            key.reset()
        }
    }

    private suspend fun processEpub(file: Path) {
        val metadata = EpubMetadataExtractor.extract(file)
        val enriched = googleBooksClient.enrich(metadata)
        bookService.createFromDrop(enriched, file)
    }
}
```

The Google Books enrichment fills in missing ISBN, cover art, author biography, and genre classification. For books that Google Books doesn't recognise (rare, self-published, or very old stock), a fallback OCR pipeline reads the cover image and attempts title/author extraction.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">12k</span>
    <span class="metric__label">books migrated</span>
  </div>
  <div class="metric">
    <span class="metric__value">3 days</span>
    <span class="metric__label">full migration time</span>
  </div>
  <div class="metric">
    <span class="metric__value">100%</span>
    <span class="metric__label">staff adoption (week 1)</span>
  </div>
</div>

The FileMaker export was converted to EPUB-wrapped metadata stubs and fed through BookDrop. 12,000 entries processed in under 72 hours with one staff member monitoring the ingestion queue. The remaining unknowns (about 340 books without ISBNs) were handled via the manual entry UI over the following two weeks.

The client now runs BookLore on a Raspberry Pi 5 in the back office. Staff search, recommend, and track reading across all four locations through a shared web interface. No external dependency, no subscription, no data leaving their building.
