---
layout: post
title: "Lambda Labs GPU Pipelines: Remote SDXL Image Generation"
date: 2025-08-22 14:00:00 +0100
categories: [ai, gpu, image-generation]
tags: [lambda-labs, sdxl, comfyui, gpu, image-generation, remote-execution]
---

Running SDXL image generation on remote Lambda Labs GPUs, orchestrated from a Django application. Here's how I built the pipeline and debugged "the graininnies."

## The Architecture

```
Django App (OCI Server)
    │
    ▼
Celery Task Queue
    │
    ▼
Lambda Labs API
    │
    ▼
GPU Instance (A10/A100)
    │
    ▼
ComfyUI Workflow Execution
    │
    ▼
Generated Images → MinIO Storage
```

## Why Lambda Labs?

- **On-demand GPUs**: No maintaining expensive hardware
- **Pay per use**: ~$0.50-2/hour for A10/A100
- **API access**: Programmatic instance management
- **Pre-built images**: ComfyUI ready to go

## ComfyUI Workflow Setup

ComfyUI uses JSON workflow files. Here's a simplified SDXL workflow:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 42,
      "steps": 25,
      "cfg": 7.5,
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 1.0,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "sd_xl_base_1.0.safetensors"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "A vibrant neon-lit street scene in Tokyo at night",
      "clip": ["4", 1]
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "blurry, low quality, distorted",
      "clip": ["4", 1]
    }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "generated",
      "images": ["8", 0]
    }
  }
}
```

## Remote Execution Script

```python
# execute_workflow.py
import requests
import json
import time
import os
from pathlib import Path

class ComfyUIClient:
    def __init__(self, host: str, port: int = 8188):
        self.base_url = f"http://{host}:{port}"

    def queue_prompt(self, workflow: dict) -> str:
        """Queue a workflow and return the prompt ID."""
        response = requests.post(
            f"{self.base_url}/prompt",
            json={"prompt": workflow}
        )
        return response.json()['prompt_id']

    def get_history(self, prompt_id: str) -> dict:
        """Get execution history for a prompt."""
        response = requests.get(f"{self.base_url}/history/{prompt_id}")
        return response.json()

    def wait_for_completion(self, prompt_id: str, timeout: int = 300) -> dict:
        """Poll until workflow completes."""
        start = time.time()
        while time.time() - start < timeout:
            history = self.get_history(prompt_id)
            if prompt_id in history:
                return history[prompt_id]
            time.sleep(2)
        raise TimeoutError(f"Workflow {prompt_id} timed out")

    def download_image(self, filename: str, subfolder: str = "") -> bytes:
        """Download generated image."""
        params = {"filename": filename, "subfolder": subfolder, "type": "output"}
        response = requests.get(f"{self.base_url}/view", params=params)
        return response.content

    def generate(self, workflow: dict, output_dir: Path) -> list[Path]:
        """Execute workflow and download all outputs."""
        prompt_id = self.queue_prompt(workflow)
        print(f"Queued prompt: {prompt_id}")

        result = self.wait_for_completion(prompt_id)
        outputs = result.get('outputs', {})

        saved_files = []
        for node_id, node_output in outputs.items():
            if 'images' in node_output:
                for img in node_output['images']:
                    image_data = self.download_image(
                        img['filename'],
                        img.get('subfolder', '')
                    )
                    output_path = output_dir / img['filename']
                    output_path.write_bytes(image_data)
                    saved_files.append(output_path)
                    print(f"Saved: {output_path}")

        return saved_files
```

## Django Integration

```python
# tasks.py
from celery import shared_task
from django.conf import settings
import json

@shared_task
def generate_image(prompt: str, negative_prompt: str = "", **kwargs):
    """Generate image using remote ComfyUI."""
    from .comfyui_client import ComfyUIClient

    # Load base workflow
    workflow_path = Path(__file__).parent / 'workflows' / 'sdxl_base.json'
    workflow = json.loads(workflow_path.read_text())

    # Inject prompts
    workflow['6']['inputs']['text'] = prompt
    workflow['7']['inputs']['text'] = negative_prompt or "blurry, low quality"

    # Override settings
    if 'seed' in kwargs:
        workflow['3']['inputs']['seed'] = kwargs['seed']
    if 'steps' in kwargs:
        workflow['3']['inputs']['steps'] = kwargs['steps']

    # Connect to Lambda Labs instance
    client = ComfyUIClient(
        host=settings.LAMBDA_COMFYUI_HOST,
        port=settings.LAMBDA_COMFYUI_PORT
    )

    output_dir = Path(settings.MEDIA_ROOT) / 'generated'
    output_dir.mkdir(exist_ok=True)

    images = client.generate(workflow, output_dir)
    return [str(p) for p in images]
```

## Lambda Labs Instance Management

```python
# lambda_manager.py
import requests
import time

class LambdaLabsManager:
    BASE_URL = "https://cloud.lambdalabs.com/api/v1"

    def __init__(self, api_key: str):
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def list_instances(self) -> list:
        """List all running instances."""
        response = requests.get(
            f"{self.BASE_URL}/instances",
            headers=self.headers
        )
        return response.json()['data']

    def launch_instance(
        self,
        instance_type: str = "gpu_1x_a10",
        region: str = "us-west-1",
        ssh_key_name: str = "default"
    ) -> dict:
        """Launch a new GPU instance."""
        response = requests.post(
            f"{self.BASE_URL}/instance-operations/launch",
            headers=self.headers,
            json={
                "instance_type_name": instance_type,
                "region_name": region,
                "ssh_key_names": [ssh_key_name],
            }
        )
        return response.json()['data']['instance_ids'][0]

    def terminate_instance(self, instance_id: str):
        """Terminate an instance."""
        requests.post(
            f"{self.BASE_URL}/instance-operations/terminate",
            headers=self.headers,
            json={"instance_ids": [instance_id]}
        )

    def wait_for_ready(self, instance_id: str, timeout: int = 600) -> str:
        """Wait for instance to be ready, return IP."""
        start = time.time()
        while time.time() - start < timeout:
            instances = self.list_instances()
            for inst in instances:
                if inst['id'] == instance_id:
                    if inst['status'] == 'active':
                        return inst['ip']
            time.sleep(10)
        raise TimeoutError("Instance failed to start")
```

## Fixing "The Graininnies"

My generated images had a grainy, noisy quality. Debugging this took several iterations:

### Problem 1: VAE Precision

The default VAE was running in fp16, causing noise:

```json
{
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "sd_xl_base_1.0.safetensors"
    }
  },
  "10": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "sdxl_vae.safetensors"
    }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["3", 0],
      "vae": ["10", 0]  // Use dedicated VAE, not from checkpoint
    }
  }
}
```

### Problem 2: CFG Scale Too High

CFG (Classifier-Free Guidance) above 8-9 introduces artifacts:

```python
# Before: cfg = 12 (too high, grainy)
# After: cfg = 7.5 (balanced)
workflow['3']['inputs']['cfg'] = 7.5
```

### Problem 3: Wrong Sampler

Some samplers are noisier than others:

```python
# Grainy: euler, dpm_2
# Clean: euler_ancestral, dpmpp_2m_sde
workflow['3']['inputs']['sampler_name'] = 'dpmpp_2m_sde'
workflow['3']['inputs']['scheduler'] = 'karras'
```

### Problem 4: Insufficient Steps

Too few denoising steps leave noise:

```python
# Before: steps = 15 (fast but noisy)
# After: steps = 30 (clean results)
workflow['3']['inputs']['steps'] = 30
```

## Batch Generation Script

```python
# run_scenarios.py
import json
from pathlib import Path
from execute_workflow import ComfyUIClient

def run_batch(scenarios_file: str, output_dir: str):
    """Run multiple prompts from a JSON scenarios file."""
    scenarios = json.loads(Path(scenarios_file).read_text())
    client = ComfyUIClient(host="your-lambda-ip")
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    base_workflow = json.loads(Path('sdxl_base.json').read_text())

    for i, scenario in enumerate(scenarios):
        print(f"\n[{i+1}/{len(scenarios)}] {scenario['name']}")

        workflow = base_workflow.copy()
        workflow['6']['inputs']['text'] = scenario['prompt']
        workflow['7']['inputs']['text'] = scenario.get('negative', '')

        if 'seed' in scenario:
            workflow['3']['inputs']['seed'] = scenario['seed']

        try:
            images = client.generate(workflow, output_path)
            print(f"  Generated: {[p.name for p in images]}")
        except Exception as e:
            print(f"  Failed: {e}")

if __name__ == '__main__':
    run_batch('scenarios_portrait_instagrams_sdxl.json', './outputs')
```

## Cost Optimization

```python
# Auto-terminate after batch completes
@shared_task
def generate_batch_and_cleanup(prompts: list[str]):
    """Generate images then terminate instance."""
    manager = LambdaLabsManager(settings.LAMBDA_API_KEY)

    # Launch instance
    instance_id = manager.launch_instance()
    ip = manager.wait_for_ready(instance_id)

    try:
        client = ComfyUIClient(host=ip)

        # Wait for ComfyUI to start
        time.sleep(60)

        for prompt in prompts:
            generate_image(prompt)

    finally:
        # Always terminate to avoid charges
        manager.terminate_instance(instance_id)
```

## Startup Script for Lambda Instance

```bash
#!/bin/bash
# lambda_qwen_docker.sh - Run on Lambda instance startup

# Install ComfyUI
cd /home/ubuntu
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Create venv and install deps
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install xformers  # For memory efficiency

# Download SDXL model
cd models/checkpoints
wget https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors

# Download VAE
cd ../vae
wget https://huggingface.co/stabilityai/sdxl-vae/resolve/main/sdxl_vae.safetensors

# Start ComfyUI with API access
cd /home/ubuntu/ComfyUI
python main.py --listen 0.0.0.0 --port 8188
```

## Key Learnings

1. **VAE matters** - Use dedicated SDXL VAE for cleaner images
2. **CFG sweet spot** - 7-8 for SDXL, higher adds noise
3. **Sampler selection** - dpmpp_2m_sde + karras scheduler = clean
4. **Always terminate** - Lambda charges by the hour, auto-cleanup is essential
5. **Batch efficiently** - Launch once, generate many, then terminate

---

*Remote GPU execution opens up AI image generation without owning expensive hardware. The key is efficient orchestration and knowing when to terminate.*
