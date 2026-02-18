---
title: Serena
slug: serena
tagline: LSP-powered code intelligence — because RAG over a codebase is guesswork
description: >-
  Serena is an AI coding agent with Language Server Protocol-based symbol retrieval, finding all references to any function across 200k lines in milliseconds. Extended for an internal tooling team where code review cycle time halved and junior engineer onboarding became 3x faster.
language: Python
role: Extended
year: 2025
order: 8
tech:
  - Python
  - LSP (Language Server Protocol)
  - multilspy
  - MCP
  - Tree-sitter
  - semantic search
client: Internal tooling team
github_url: https://github.com/wingie/serena
og_image: https://opengraph.githubassets.com/1/oraios/serena
---

## The Problem

The internal tooling team at Booking.com manages a codebase of roughly 200,000 lines across 15 microservices. When a new engineer joins a service team, getting them to the point where they can confidently make changes typically takes two to three weeks of pairing sessions.

The bottleneck isn't understanding the domain — it's understanding the *code topology*: where functions are defined, what calls what, which interfaces are stable versus internal, which patterns are idiomatic versus legacy. Standard RAG over a codebase answers "find files that mention payment" — it doesn't answer "show me everything that calls `processRefund` and whether any of those callers bypass the audit log."

## What We Built

Serena extended with a custom MCP interface for the team's specific codebases. The key insight driving the extension: **Language Server Protocol already has this information**. Every modern LSP server — Pyright, rust-analyzer, typescript-language-server — maintains a full symbol graph. Instead of building a custom indexer, Serena wraps the existing LSP via `multilspy`.

## How It Works

The `multilspy` abstraction starts a language server, sends LSP requests, and returns structured results — without the engineer needing to interact with the protocol directly:

```python
from multilspy import SyncLanguageServer
from multilspy.multilspy_config import MultilspyConfig, Language

async def find_all_references(
    repo_path: str, file_path: str, line: int, character: int
) -> list[Location]:
    config = MultilspyConfig.from_dict({"code_language": Language.PYTHON})
    async with SyncLanguageServer.create(config, repo_path) as lsp:
        refs = await lsp.request_references(file_path, line, character)
        return refs
```

This returns every call site for a function across the entire repository in under 200ms — the LSP server keeps a live index. Compare this to embedding-based search, which would miss callers in files that don't use the function name literally (e.g., dynamic dispatch via `getattr`).

The 30-tool MCP interface exposed to Claude includes:

- `find_references` — all call sites for a symbol
- `get_definition` — jump to definition, cross-file
- `list_symbols_in_file` — full outline of a file's public interface
- `search_codebase` — text + semantic combined search with relevance scoring
- `get_call_hierarchy` — incoming and outgoing call tree for a function
- `check_diagnostics` — current LSP errors/warnings for a file

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">50%</span>
    <span class="metric__label">review cycle time reduction</span>
  </div>
  <div class="metric">
    <span class="metric__value">3×</span>
    <span class="metric__label">faster junior onboarding</span>
  </div>
  <div class="metric">
    <span class="metric__value">&lt;200ms</span>
    <span class="metric__label">cross-repo symbol lookup</span>
  </div>
</div>

Code review changed from "I'm not sure what this touches" to "I can see everything this call site reaches". Reviewers use the `get_call_hierarchy` tool to verify that new changes don't unintentionally modify audit-sensitive paths.

Junior engineers onboarding to a new service now start with a Serena session: "explain what processOrder does, show me where it's called, and list every place it writes to the database." This gives them a working mental model in one session that previously took days of reading.
