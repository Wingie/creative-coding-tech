---
title: MCP PDF Tools
slug: pdf-tools
tagline: 800 regulatory PDFs a month, and someone has to open all of them
description: >-
  A compliance team gets 800 regulatory PDFs a month and has to work out which
  ones matter. European regulators name their annexes predictably, which turned
  out to be the useful part.
language: Python
role: Extended
year: 2025
order: 12
tech:
  - Python
  - pdfplumber
  - MCP
  - fuzzy matching
  - PyPDF2
  - regex
client: Regulatory compliance team, fintech (NDA)
github_url: https://github.com/hanweg/mcp-pdf-tools
upstream_owner: hanweg
upstream_repo: mcp-pdf-tools
og_image: https://opengraph.githubassets.com/1/hanweg/mcp-pdf-tools
---

Regulatory guidance arrives whether you want it or not. Updated frameworks, national implementations of EU directives, technical standards from the EBA and ESMA. About 800 documents a month land on a compliance team of four, and somebody has to open each one to find out whether it matters to them at all.

Their job is working out which ones affect which of the company's products, in which countries. Before any of that, somebody has to open each document and read enough to know whether it matters at all. Four analysts, 200 documents each per month.

[MCP PDF Tools](https://github.com/hanweg/mcp-pdf-tools) is hanweg's project. I extended it for this triage.

The tool that did the work finds related documents. Give it one PDF and it ranks the rest of the directory against it, so an analyst sees the dozen most related out of 800 instead of scrolling a folder.

What makes that work on this particular corpus is the filenames. European regulators are consistent: a document and its annexes and its corrections share a stem, with `-Annex-I` or `-Corrigendum` appended. Match on the stem and you pull a whole regulatory thread together in one go, which is what an analyst actually wants. Pure text similarity misses it, because an annex often shares very little language with the document it belongs to.

There's also directory-wide pattern search, which they use for questions nobody planned for. Which of our filings mention DORA Article 28. That takes seconds across the whole archive.

Weekly triage dropped from most of a working day to about two hours.

*Those are the client's numbers, not mine.*
