---
title: Serena
slug: serena
tagline: Use the language server the IDE already runs, instead of building a search index
description: >-
  Serena extended with an MCP interface for an internal tooling team, so an AI
  assistant can ask a real language server where a function is called instead of
  guessing from text search.
language: Python
role: Extended
year: 2025
order: 8
tech:
  - Python
  - LSP
  - multilspy
  - MCP
client: Internal tooling team
github_url: https://github.com/oraios/serena
upstream_owner: oraios
upstream_repo: serena
og_image: https://opengraph.githubassets.com/1/oraios/serena
---

Search over a codebase answers "which files mention payment". It doesn't answer "what calls `processRefund`, and do any of those callers skip the audit log".

Embedding search can't answer the second one at all. It matches on words. A caller that reaches the function through `getattr` never mentions its name, so it never comes back in the results.

Every language server already knows the answer. Pyright, rust-analyzer and typescript-language-server all keep a live symbol graph, because that's how your editor does jump-to-definition. So instead of building an index, this wraps the one that's already running.

[Serena](https://github.com/oraios/serena) is Oraios' project. I extended it with an MCP interface for the team's own repositories, using `multilspy` to talk to the language server:

```python
from multilspy import SyncLanguageServer
from multilspy.multilspy_config import MultilspyConfig, Language

async def find_all_references(
    repo_path: str, file_path: str, line: int, character: int
) -> list[Location]:
    config = MultilspyConfig.from_dict({"code_language": Language.PYTHON})
    async with SyncLanguageServer.create(config, repo_path) as lsp:
        return await lsp.request_references(file_path, line, character)
```

That returns every call site across the repository in under 200ms, because the language server is already holding the index in memory.

Thirty tools are exposed to the assistant. The ones that get used: find every call site, jump to a definition across files, list what a file exports, get the call tree in both directions, and read the current errors.

## What it changed

Reviewers can check what a change actually reaches before approving it, which matters most on paths that write to an audit log.

New engineers start with a session asking what a function does, where it's called, and everywhere it touches the database. That used to be a few days of reading.

The team reckoned review cycles halved.
