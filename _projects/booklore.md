---
title: BookLore
slug: booklore
tagline: Three people knew the catalogue. One of them left.
description: >-
  A four-shop bookshop chain had 12,000 books spread across a legacy database, a
  Google Sheet, staff laptops and three people's memories. Extending BookLore gave
  them one catalogue running on their own hardware.
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
github_url: https://github.com/booklore-app/booklore
upstream_owner: booklore-app
upstream_repo: booklore
og_image: https://opengraph.githubassets.com/1/booklore-app/booklore
screenshot: /assets/img/projects/booklore-demo.gif
---

Four shops, about 12,000 books. The record of where they were lived in an old FileMaker database, a Google Sheet, staff laptops, and three people's heads. Then one of those three left.

They'd looked at Goodreads and didn't want a business catalogue living on someone else's platform. They'd looked at Calibre and found it built for one person on one desktop. They wanted something on their own hardware, usable by several people at once, run by staff who don't think of themselves as technical.

[BookLore](https://github.com/booklore-app/booklore) is the BookLore project's work: Spring Boot, React, Postgres. What I built for this job was the ingestion side.

Drop an EPUB into a shared network folder and it turns up in the catalogue. A `WatchService` watcher picks the file up, reads whatever metadata it has, fills the gaps from Google Books, files it on the right shelf and tells the staff who need to know. Nobody opens a UI.

Google Books doesn't recognise everything. Rare stock, self-published and very old books come back empty. Those fall through to OCR on the cover image, which gets title and author right often enough to be worth having.

The migration ran over three days. It runs on a Raspberry Pi 5 in the back office, so nothing leaves the building and there's no subscription.
