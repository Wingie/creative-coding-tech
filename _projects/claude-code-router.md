---
title: Claude Code Router
slug: router
tagline: 65% Claude Code cost reduction. Zero workflow changes. Deployed over lunch.
description: >-
  Claude Code Router is a Fastify proxy on port 3456 that intercepts all Claude Code requests and routes them to the optimal model — background tasks to local Ollama, reasoning to DeepSeek-R1, long context to Gemini 2.5 Pro. Extended for an AI dev tools startup running $40k/month in Claude Code spend.
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
github_url: https://github.com/wingie/claude-code-router
og_image: https://opengraph.githubassets.com/1/musistudio/claude-code-router
---

## The Problem

An AI developer tools startup had standardised their engineering workflow around Claude Code. Fifteen engineers using it daily. The results were good. The bill was not.

$40,000 per month. Nearly all of it on Claude Sonnet — used for everything from quick autocomplete to complex architectural reasoning to running background lint checks. The team knew they were over-spending but didn't want to change their workflow: Claude Code had become how they worked.

The constraint was simple: whatever the solution, engineers should not change a single keystroke.

## What We Built

A transparent proxy server that sits between Claude Code and Anthropic's API. Engineers point their `ANTHROPIC_BASE_URL` at `http://localhost:3456` and forget about it. The proxy reads each request, classifies the task, routes to the cheapest capable model, and returns a response in the same format Claude Code expects.

No UI. No config file for engineers to manage. No new tools to learn.

## How It Works

The Fastify server intercepts all requests on `:3456`. The routing logic reads the `system` prompt and `messages` array from each request to classify the task:

```typescript
interface RouterConfig {
  rules: RoutingRule[];
  providers: Record<string, ProviderConfig>;
}

type TaskClass = "background" | "think" | "longContext" | "default";

function classifyRequest(body: AnthropicRequest): TaskClass {
  const system = body.system ?? "";
  const lastMessage = body.messages.at(-1)?.content ?? "";
  const totalTokens = estimateTokens(body.messages);

  // Background tasks: no reasoning needed, use local model
  if (/lint|format|type.?check|import|whitespace/i.test(system)) {
    return "background";
  }

  // Explicit reasoning requests
  if (/think|reason|explain|architect|design|tradeoff/i.test(lastMessage)) {
    return "think";
  }

  // Large context window needed (>60k tokens estimated)
  if (totalTokens > 60_000) {
    return "longContext";
  }

  return "default";
}

const ROUTES: Record<TaskClass, string> = {
  background: "ollama/qwen2.5-coder:7b",   // Free, local
  think:      "deepseek/deepseek-r1",        // Strong reasoning, cheap
  longContext: "google/gemini-2.5-pro",      // 1M token window
  default:    "anthropic/claude-sonnet-4-5", // Baseline for everything else
};
```

Each provider has a custom transformer that converts the Anthropic request format to the target provider's API format and normalises the response back:

```typescript
class OllamaTransformer implements ProviderTransformer {
  async transform(req: AnthropicRequest): Promise<OllamaRequest> {
    return {
      model: req.model.replace("ollama/", ""),
      messages: req.messages,
      stream: req.stream ?? false,
      options: { num_ctx: 32768 },
    };
  }
  async normaliseResponse(res: OllamaResponse): Promise<AnthropicResponse> {
    /* ... format back to Anthropic shape */
  }
}
```

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">65%</span>
    <span class="metric__label">cost reduction</span>
  </div>
  <div class="metric">
    <span class="metric__value">$0</span>
    <span class="metric__label">workflow change cost</span>
  </div>
  <div class="metric">
    <span class="metric__value">1 hr</span>
    <span class="metric__label">deployment time</span>
  </div>
</div>

Monthly Claude Code spend dropped from $40k to ~$14k in the first month. Background routing to local Ollama (running on a Mac Mini in the office) accounted for 40% of the saving alone. Engineers reported zero perceptible quality difference on their daily tasks.

The proxy config now has a staging vs. production mode: in staging, expensive requests are routed to cheaper models by default; in production, the full Anthropic model is used for anything user-facing. This alone reduced their staging environment costs to near-zero.
