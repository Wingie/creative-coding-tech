---
title: Blender MCP
slug: blender
tagline: Six artists waiting two weeks for placeholder models from one person
description: >-
  An indie game studio had six artists and one person who could model. Extending
  Blender MCP let the artists make their own placeholders.
language: Python
role: Extended
year: 2024
order: 11
tech:
  - Python
  - Blender bpy API
  - FastMCP
  - TCP Sockets
  - CSM.ai API
  - Mixamo
client: Indie game studio
github_url: https://github.com/ahujasid/blender-mcp
upstream_owner: ahujasid
upstream_repo: blender-mcp
og_image: https://opengraph.githubassets.com/1/ahujasid/blender-mcp
---

An indie game studio making a 3D action RPG had six artists and one 3D generalist. Every placeholder model went through him. His queue was two weeks long.

So a concept artist who needed a dwarf warrior in heavy plate carrying a two-handed axe waited two weeks to see it in the engine. Environment work waited on geometry. Animation waited on meshes. A second generalist wasn't in the budget.

[Blender MCP](https://github.com/ahujasid/blender-mcp) is Siddharth Ahuja's project. It lets an AI assistant drive Blender. I added two things this studio needed.

**Mesh search from a description.** The text is embedded and matched against CSM.ai's asset library, and the closest mesh comes into Blender as a starting point. Not a final asset. Something to block a scene out with.

**Rigging in one call.** A single tool call rigs the mesh, sends it to Mixamo, pulls an animation back and applies it in the scene.

The addon runs a TCP server inside Blender and executes JSON commands against the `bpy` API. That means the artist keeps talking to it: make the armour more ornate, he's too tall. Each turn is a material tweak or a bone scale.

Placeholders went from a two-week wait to about twenty minutes, made by the artist who wanted them. The generalist went back to the models that ship.
