---
title: MCP PDF Tools
slug: pdf-tools
tagline: 800 regulatory PDFs a month. Jurisdiction matching in seconds, not half a day.
description: >-
  mcp-pdf-tools is a PDF processing MCP server with content extraction, text-pattern matching across directories, fuzzy filename matching, and ordered merge. Extended for a fintech compliance team where 20 analyst-hours of weekly document triage dropped to 2.
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
github_url: https://github.com/wingie/mcp-pdf-tools
og_image: https://opengraph.githubassets.com/1/hanweg/mcp-pdf-tools
---

## The Problem

A fintech company's regulatory compliance team receives approximately 800 PDF documents per month: regulatory guidance, updated frameworks, national transpositions of EU directives, EBA/ESMA technical standards. Their job is to identify which documents actually affect the company's products in which jurisdictions.

Before any analysis happens, someone has to read enough of each document to know whether it's relevant. With 800 documents and a team of four analysts, that's 200 documents per person per month. At 15 minutes per initial scan, that's 50 analyst-hours per week just on triage.

## What We Built

An MCP server with four primary tools targeting the triage workflow:

- **`extract-pdf-content`** — full text extraction with page-level segmentation and metadata
- **`find-related-pdfs`** — given a target PDF, finds semantically and textually related documents in a directory
- **`search-pdf-directory`** — regex/pattern search across hundreds of PDFs simultaneously
- **`merge-pdfs-ordered`** — assembles multiple PDFs in a specified order with optional cover page

The `find-related-pdfs` tool is the triage accelerator. It extracts key terms from the target document, then ranks the directory by relevance — analysts see the 12 most-related documents out of 800 in seconds.

## How It Works

The relevance matching combines text pattern extraction with substring overlap scoring:

```python
def find_related_pdfs(
    target_pdf: str,
    search_directory: str,
    max_results: int = 10
) -> list[RelatedDocument]:
    # Extract key regulatory terms from target
    target_text = extract_text(target_pdf)
    target_terms = extract_regulatory_terms(target_text)

    results = []
    for pdf_path in iter_pdfs(search_directory):
        try:
            candidate_text = extract_text(pdf_path, max_pages=5)  # header pages
            score = compute_relevance(target_terms, candidate_text, pdf_path)
            results.append(RelatedDocument(path=pdf_path, score=score))
        except Exception:
            continue  # malformed PDFs are common in regulatory archives

    return sorted(results, key=lambda r: r.score, reverse=True)[:max_results]

def compute_relevance(
    terms: list[str],
    candidate_text: str,
    candidate_path: str
) -> float:
    # Text overlap score
    term_hits = sum(1 for t in terms if t.lower() in candidate_text.lower())
    text_score = term_hits / max(len(terms), 1)

    # Filename similarity (regulators often number related documents)
    filename_score = fuzzy_filename_match(
        Path(target_path).stem, Path(candidate_path).stem
    )

    return 0.7 * text_score + 0.3 * filename_score
```

The filename fuzzy matching handles a common regulatory pattern: the EBA often publishes `EBA-GL-2024-01.pdf`, `EBA-GL-2024-01-Annex-I.pdf`, `EBA-GL-2024-01-Corrigendum.pdf` as related documents. The fuzzy match catches these without requiring the analyst to know the naming convention.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">2 hrs</span>
    <span class="metric__label">weekly triage (was 20hrs)</span>
  </div>
  <div class="metric">
    <span class="metric__value">800</span>
    <span class="metric__label">PDFs processed monthly</span>
  </div>
  <div class="metric">
    <span class="metric__value">90%</span>
    <span class="metric__label">triage time reduction</span>
  </div>
</div>

The compliance team now runs `find-related-pdfs` against each new regulatory publication and receives a ranked list of existing documents in their archive that it relates to. This gives them instant regulatory lineage — "this EBA opinion updates these three previous guidelines" — without manual cross-referencing.

The `search-pdf-directory` tool was unexpectedly useful for answering internal queries: "which of our regulatory filings mention DORA Article 28?" returns results across the full archive in under 30 seconds.
