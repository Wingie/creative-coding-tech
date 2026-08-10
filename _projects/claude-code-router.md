---
title: Claude Code Router
slug: router
tagline: A $40k monthly bill, and nobody wanted to change how they worked
description: >-
  Fifteen engineers, $40k a month on one model for everything from autocomplete to
  architecture. A proxy routes each request to the cheapest model that can handle
  it, with no change to how anyone works.
language: TypeScript
role: Extended
year: 2025
order: 7
tech:
  - TypeScript
  - Fastify
  - Node.js
  - Ollama
  - DeepSeek API
  - Gemini API
  - Anthropic API
client: AI developer tools startup
github_url: https://github.com/musistudio/claude-code-router
upstream_owner: musistudio
upstream_repo: claude-code-router
og_image: https://opengraph.githubassets.com/1/musistudio/claude-code-router
---

$40,000 a month, for fifteen engineers using one tool.

It was working. That was the problem. Nobody wanted to give it up.

Almost all of that went to one model doing everything: autocomplete, architectural reasoning, and background lint checks nobody reads.

They knew they were overpaying. They also didn't want to change anything, because Claude Code had become how they worked. So the requirement was that no engineer should have to type anything different.

[Claude Code Router](https://github.com/musistudio/claude-code-router) is musistudio's project, a proxy that sits between the tool and the API. I set it up with their routing rules.

An engineer points `ANTHROPIC_BASE_URL` at `localhost:3456` once and forgets about it. The proxy reads the system prompt and the messages, works out what kind of task it is, and sends it to the cheapest model that can handle it. The response comes back in the format Claude Code expects, so nothing downstream notices.

No UI, no config file for engineers to manage, nothing new to learn.

Background jobs went to a local model, which is where most of the saving came from. Their monthly spend went from $40,000 to about $14,000. Setup took an afternoon.

*Those are the client's figures.*
