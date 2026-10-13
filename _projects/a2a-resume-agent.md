---
title: a2aResumeAgent
slug: a2a-resume-agent
tagline: A Java agent server that drives a browser and answers over MCP
description: >-
  A Spring Boot agent framework with its own MCP JSON-RPC server and
  Playwright browser automation, built on my rewrite of Tools4AI.
language: Java
role: Built
year: 2025
order: 23
tech:
  - Java
  - Spring Boot
  - MCP
  - JSON-RPC
  - Playwright
  - PostgreSQL
  - Redis
  - Neo4j
  - Docker
client: Personal project
github_url: https://github.com/Wingie/a2aResumeAgent
---

I wanted to see how far an agent framework could go in Java and Spring Boot.

It started from Vishal Mysore's [Tools4AI](https://github.com/vishalmysore/Tools4AI), a Java library that turns annotated methods into tools an AI model can call. Some of its design choices I'd have made differently, and subclassing couldn't get around them. So I rewrote it inside the project as a2acore. Rewriting it was also how I learned how it works.

a2acore runs its own MCP server. MCP is the protocol Claude Desktop and other clients use to call tools. Requests arrive as JSON-RPC on one endpoint. `tools/list` returns what's available, and `tools/call` runs one.

The app on top has 9 tools. Three drive a browser with Playwright and return text, a screenshot, or a screenshot URL. Two search LinkedIn and capture a screenshot. One makes memes picked by mood, and one lists the moods. One returns my CV and projects, so an MCP client can ask about my work. The last looks up food-safety guidance on tastebeforeyouwaste.org.

PostgreSQL stores the data and Redis caches it. Neo4j keeps a graph for analytics. Everything runs in Docker on Playwright's Java image.

Multi-step browsing keeps one browser session alive across steps. The meme tool returned grey backgrounds until I switched to template names memegen actually has.

While the agent works, you can watch its reasoning stream in a live log in the web app.
