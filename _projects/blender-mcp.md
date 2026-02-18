---
title: Blender MCP
slug: blender
tagline: Concept to placeholder 3D asset in 20 minutes. Artists unblocked.
description: >-
  blender-mcp is a Model Context Protocol bridge for Blender — text descriptions become 3D scenes via Claude → FastMCP → TCP socket → bpy API. Extended for an indie game studio with six artists and one 3D generalist who was a constant bottleneck.
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
github_url: https://github.com/wingie/blender-mcp
og_image: https://opengraph.githubassets.com/1/CommonSenseMachines/blender-mcp
---

## The Problem

An indie game studio making a 3D action RPG had six artists and one 3D generalist. The generalist was the bottleneck. When a concept artist needed a placeholder character model — "a dwarf warrior with heavy plate armour, stocky proportions, carrying a two-handed axe" — they had to wait for the generalist's queue to clear. That queue was two weeks long.

Concept art was piling up. Environmental designs were blocked waiting for geometry. Animation couldn't start without meshes. The studio didn't have the budget to hire a second generalist.

## What We Built

Blender MCP extended with two additions specific to the studio's pipeline:

1. **CSM.ai mesh retrieval** — text descriptions are vectorised and searched against CSM.ai's 3D asset library; the closest-matching mesh is imported into Blender as a starting point
2. **Mixamo animation retargeting** — once a character mesh is in Blender, a single tool call rigs it, uploads to Mixamo, retrieves an animation, and applies it back to the scene

The pipeline: `Claude describes scene → FastMCP server → TCP socket → Blender addon → bpy API`.

## How It Works

The Blender addon runs a persistent TCP socket server inside the application. Commands arrive as JSON and execute against the `bpy` API — Blender's Python scripting interface:

```python
# Blender addon: command handler
def execute_command(cmd: dict) -> dict:
    action = cmd["action"]

    if action == "import_csm_mesh":
        # Query CSM.ai for closest mesh to text description
        mesh_url = csm_search(cmd["description"])
        bpy.ops.import_scene.gltf(filepath=download_temp(mesh_url))
        obj = bpy.context.selected_objects[0]
        return {"status": "ok", "object_name": obj.name}

    elif action == "apply_mixamo_rig":
        obj_name = cmd["object_name"]
        obj = bpy.data.objects[obj_name]

        # Export, rig via Mixamo API, reimport
        export_path = export_for_mixamo(obj)
        rigged_path = mixamo_auto_rig(export_path)
        bpy.ops.import_scene.fbx(filepath=rigged_path)

        return {"status": "ok", "rigged_object": rigged_path}

    elif action == "set_material":
        obj = bpy.data.objects[cmd["object_name"]]
        mat = bpy.data.materials.new(name=cmd["material_name"])
        mat.use_nodes = True

        # Set base colour from hex
        colour = hex_to_rgba(cmd["colour"])
        mat.node_tree.nodes["Principled BSDF"].inputs[0].default_value = colour
        obj.data.materials.append(mat)

        return {"status": "ok"}
```

The conversation loop lets Claude iterate: "make the armour more ornate" → material parameter adjustments; "he's too tall" → scale transform on specific bones.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">20 min</span>
    <span class="metric__label">concept to placeholder (was 2 days)</span>
  </div>
  <div class="metric">
    <span class="metric__value">6</span>
    <span class="metric__label">artists now self-sufficient for placeholders</span>
  </div>
  <div class="metric">
    <span class="metric__value">2 wks</span>
    <span class="metric__label">generalist queue cleared</span>
  </div>
</div>

Concept artists describe what they need in plain language. Twenty minutes later they have an animated placeholder in their scene. The generalist's queue cleared within two weeks as the high-volume, low-complexity requests moved to the AI pipeline.

The generalist now focuses exclusively on hero assets — characters and objects that need custom topology, hand-painted textures, and technical artistry. Quality improved while throughput increased.
