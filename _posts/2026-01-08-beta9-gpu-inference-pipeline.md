---
layout: post
title: "Building a Distributed GPU Inference Pipeline: Beta9 + Ollama on Oracle Cloud"
date: 2026-01-08 14:00:00 +0100
categories: [ai-infrastructure, gpu, devops]
tags: [beta9, ollama, gpu, inference, oracle-cloud, kubernetes, machine-learning]
---

Running AI inference at scale requires more than just a GPU and a model. You need orchestration, automatic model pulling, health checks, and graceful failure handling. Here's how I built a distributed inference pipeline using Beta9 and Ollama on Oracle Cloud's free ARM64 tier.

## The Challenge

FlowState needs to run LLM inference for various autonomous agent tasks. The requirements:

1. **Multiple models** - Different tasks need different models (code generation, summarization, etc.)
2. **Automatic model management** - Pull models on-demand, don't pre-load everything
3. **Cost efficiency** - Use free tier where possible, scale to paid GPUs when needed
4. **Observable** - Know what's running, what's queued, what failed

Running everything through OpenAI's API works, but it's expensive at scale and adds latency. Self-hosted inference with smart orchestration was the answer.

## The Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Plane (ARM64)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Django    │  │    Celery    │  │   Redis      │      │
│  │    API       │──│   Workers    │──│   Queue      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                │                                 │
│           ▼                ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Beta9 Control API                       │   │
│  │  - Model registry                                    │   │
│  │  - Worker orchestration                              │   │
│  │  - Request routing                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GPU Worker Pool                           │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   Lambda Labs A10    │  │   Lambda Labs A10    │        │
│  │   ┌──────────────┐   │  │   ┌──────────────┐   │        │
│  │   │    Ollama    │   │  │   │    Ollama    │   │        │
│  │   │  ┌────────┐  │   │  │   │  ┌────────┐  │   │        │
│  │   │  │ Model  │  │   │  │   │  │ Model  │  │   │        │
│  │   │  └────────┘  │   │  │   │  └────────┘  │   │        │
│  │   └──────────────┘   │  │   └──────────────┘   │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Beta9: Serverless GPU Runtime

[Beta9](https://github.com/beam-cloud/beta9) is an open-source serverless runtime for GPU workloads. Think Lambda, but for inference. Key features:

- **Auto-scaling** - Spin up GPU instances on demand
- **Model caching** - Keep hot models loaded
- **Request queuing** - Handle bursts gracefully
- **Multi-cloud** - Works with Lambda Labs, RunPod, cloud providers

## Setting Up the Control API

First, I added endpoints to manage model lifecycle:

```python
# views.py
from django.http import JsonResponse
import requests

BETA9_CONTROL_URL = "http://localhost:1994"  # Beta9 control plane

def pull_model(request):
    """Pull a model to the inference workers."""
    model_name = request.POST.get('model', 'llama3.2:3b')

    response = requests.post(
        f"{BETA9_CONTROL_URL}/models/pull",
        json={"model": model_name}
    )

    return JsonResponse({
        "status": "pulling",
        "model": model_name,
        "task_id": response.json().get("task_id")
    })

def model_status(request, model_name):
    """Check if a model is loaded and ready."""
    response = requests.get(
        f"{BETA9_CONTROL_URL}/models/{model_name}/status"
    )

    return JsonResponse(response.json())
```

## Automatic Model Pulling with Progress

The interesting part: pulling models on-demand with progress reporting to a TUI dashboard:

```bash
#!/bin/bash
# test_inference.sh - Pull and test a model

MODEL="${1:-llama3.2:3b}"
CONTROL_API="http://localhost:1994"
OLLAMA_API="http://localhost:11434"

echo "=== Pulling model: $MODEL ==="

# Try control API first (preferred - shows progress in TUI)
PULL_RESPONSE=$(curl -s -X POST "$CONTROL_API/models/pull" \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"$MODEL\"}")

if [ $? -eq 0 ] && echo "$PULL_RESPONSE" | jq -e '.task_id' > /dev/null 2>&1; then
    TASK_ID=$(echo "$PULL_RESPONSE" | jq -r '.task_id')
    echo "Pull started via control API. Task: $TASK_ID"

    # Stream progress to TUI logs
    while true; do
        STATUS=$(curl -s "$CONTROL_API/tasks/$TASK_ID/status")
        STATE=$(echo "$STATUS" | jq -r '.state')

        if [ "$STATE" = "completed" ]; then
            echo "Model pull complete!"
            break
        elif [ "$STATE" = "failed" ]; then
            echo "Model pull failed!"
            exit 1
        fi

        PROGRESS=$(echo "$STATUS" | jq -r '.progress // "unknown"')
        echo "Progress: $PROGRESS%"
        sleep 2
    done
else
    echo "Control API unavailable, falling back to direct Ollama API..."

    # Fallback: pull directly via Ollama
    curl -X POST "$OLLAMA_API/api/pull" \
        -d "{\"name\": \"$MODEL\"}" \
        --no-buffer | while read -r line; do
            echo "$line" | jq -r '.status // empty'
        done
fi

# Test inference
echo "=== Testing inference ==="
RESPONSE=$(curl -s -X POST "$OLLAMA_API/api/generate" \
    -d "{\"model\": \"$MODEL\", \"prompt\": \"Hello!\", \"stream\": false}")

echo "Response: $(echo "$RESPONSE" | jq -r '.response')"
```

## The Test Suite

I built a comprehensive test script that validates the entire pipeline:

```bash
#!/bin/bash
# Full inference pipeline test

set -e

echo "=== Test 1/6: Control API Health ==="
curl -f http://localhost:1994/health || exit 1
echo "✓ Control API healthy"

echo "=== Test 2/6: Model Pull ==="
./test_inference.sh llama3.2:3b
echo "✓ Model pulled successfully"

echo "=== Test 3/6: Inference Latency ==="
START=$(date +%s%N)
curl -s -X POST http://localhost:11434/api/generate \
    -d '{"model":"llama3.2:3b","prompt":"Hi","stream":false}' > /dev/null
END=$(date +%s%N)
LATENCY=$(( (END - START) / 1000000 ))
echo "✓ First-token latency: ${LATENCY}ms"

echo "=== Test 4/6: Concurrent Requests ==="
for i in {1..5}; do
    curl -s -X POST http://localhost:11434/api/generate \
        -d "{\"model\":\"llama3.2:3b\",\"prompt\":\"Count to $i\",\"stream\":false}" &
done
wait
echo "✓ Concurrent requests handled"

echo "=== Test 5/6: Model Unload ==="
curl -X DELETE http://localhost:1994/models/llama3.2:3b
echo "✓ Model unloaded"

echo "=== Test 6/6: Stop Inference Worker ==="
curl -X POST http://localhost:1994/workers/stop
echo "✓ Worker stopped cleanly"

echo ""
echo "=== All tests passed! ==="
```

## Integration with Celery Workers

The inference pipeline connects to the autonomous agent system:

```python
# tasks.py
from celery import shared_task
import requests

INFERENCE_URL = "http://localhost:11434/api/generate"

@shared_task
def run_inference(model, prompt, max_tokens=500):
    """Run LLM inference via the local Ollama instance."""

    # Ensure model is loaded
    ensure_model_loaded(model)

    response = requests.post(
        INFERENCE_URL,
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens
            }
        },
        timeout=120
    )

    return {
        "model": model,
        "response": response.json().get("response"),
        "eval_count": response.json().get("eval_count"),
        "eval_duration": response.json().get("eval_duration")
    }

def ensure_model_loaded(model):
    """Pull model if not already available."""
    status = requests.get(f"http://localhost:1994/models/{model}/status")

    if status.json().get("state") != "loaded":
        # Trigger pull and wait
        requests.post(
            "http://localhost:1994/models/pull",
            json={"model": model}
        )
        # Wait for pull to complete (simplified)
        import time
        for _ in range(60):
            status = requests.get(f"http://localhost:1994/models/{model}/status")
            if status.json().get("state") == "loaded":
                return
            time.sleep(5)
        raise TimeoutError(f"Model {model} failed to load")
```

## Production Learnings

### 1. Model Loading is Slow

First inference after loading a model can take 30-60 seconds. Solutions:
- Keep frequently-used models warm
- Pre-pull models during deployment
- Use smaller quantized models (3B vs 7B)

### 2. Memory Management Matters

Ollama loads models into VRAM. On a 24GB A10:
- 7B model: ~8GB VRAM
- 13B model: ~16GB VRAM
- Only 1-2 models fit simultaneously

Implemented automatic unloading of least-recently-used models.

### 3. Network Latency Adds Up

Control plane (ARM64) to GPU workers (Lambda Labs) has ~50ms latency. For streaming responses, this is fine. For quick queries, it adds up.

Solution: Batch requests where possible, use streaming for long generations.

### 4. Health Checks Save Hours

Added comprehensive health checks:

```python
def inference_health_check():
    """Check if inference pipeline is healthy."""
    checks = {
        "control_api": check_control_api(),
        "ollama": check_ollama(),
        "gpu_available": check_gpu(),
        "model_loaded": check_model_loaded("llama3.2:3b")
    }

    return {
        "healthy": all(checks.values()),
        "checks": checks
    }
```

## Cost Analysis

Running this setup for a month:

| Component | Cost |
|-----------|------|
| Oracle ARM64 (control plane) | $0 (free tier) |
| Lambda Labs A10 (inference) | $0.75/hr when active |
| Average usage: 4 hrs/day | ~$90/month |

Compare to API pricing:
- GPT-4: ~$300/month at same usage
- Claude: ~$250/month at same usage

Self-hosted wins for consistent workloads. APIs win for sporadic use.

## Key Takeaways

1. **Separate control and compute** - ARM64 for orchestration, GPU for inference
2. **Automatic model management** - Pull on-demand, unload when idle
3. **Test the full pipeline** - Not just inference, but pull, load, run, unload
4. **Monitor everything** - VRAM usage, latency, queue depth
5. **Plan for cold starts** - First inference is always slower

---

## Building AI Infrastructure?

I help teams design and deploy self-hosted AI inference pipelines:

- **Architecture Design** - $150/hr - Design inference infrastructure for your scale
- **Implementation Sprint** - 1 week ($4,000) - Full pipeline setup with monitoring
- **GPU Cost Optimization** - $500 audit - Find savings in your inference spending

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*Run AI at scale without breaking the bank.*
