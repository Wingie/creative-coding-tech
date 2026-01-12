---
layout: post
title: "Building an OSINT Webcam Scanner with Django + Celery + AI"
date: 2025-12-27 12:00:00 +0100
categories: [osint, security, django]
tags: [osint, network-scanning, django, celery, ai, nmap, computer-vision]
---

I built CamSniff - an OSINT tool that discovers network cameras, captures thumbnails, and uses AI to categorize what they're showing. Here's the architecture and implementation.

## What It Does

1. **Network Discovery**: Scan IP ranges for devices with open camera ports
2. **Thumbnail Capture**: Extract frames from discovered streams
3. **AI Categorization**: Classify scenes (traffic, parking, nature, etc.)
4. **Credential Testing**: Check for default passwords (authorized testing only)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Django Admin                          │
│              (Scan management, results view)             │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Celery Tasks                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ run_scan    │  │ capture_     │  │ categorize_    │  │
│  │             │→ │ thumbnails   │→ │ images         │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                External Services                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ nmap/masscan│  │ ffmpeg       │  │ Lambda Labs    │  │
│  │ (discovery) │  │ (capture)    │  │ ComfyUI (AI)   │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Django Models

```python
# models.py
from django.db import models

class Scan(models.Model):
    """A network scan job."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    target = models.CharField(max_length=255)  # IP range or CIDR
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    hosts_found = models.IntegerField(default=0)
    created_by = models.ForeignKey('auth.User', on_delete=models.CASCADE)


class Host(models.Model):
    """A discovered network host."""
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name='hosts')
    ip_address = models.GenericIPAddressField()
    hostname = models.CharField(max_length=255, blank=True)
    open_ports = models.JSONField(default=list)
    device_type = models.CharField(max_length=100, blank=True)
    manufacturer = models.CharField(max_length=100, blank=True)
    last_seen = models.DateTimeField(auto_now=True)


class Thumbnail(models.Model):
    """Captured frame from a camera stream."""
    host = models.ForeignKey(Host, on_delete=models.CASCADE, related_name='thumbnails')
    image = models.ImageField(upload_to='thumbnails/')
    stream_url = models.URLField()
    captured_at = models.DateTimeField(auto_now_add=True)
    width = models.IntegerField(null=True)
    height = models.IntegerField(null=True)


class Category(models.Model):
    """AI-assigned category for a thumbnail."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)


class ThumbnailCategory(models.Model):
    """Many-to-many with confidence score."""
    thumbnail = models.ForeignKey(Thumbnail, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    confidence = models.FloatField()  # 0.0 to 1.0


class Credential(models.Model):
    """Tested credential for a host."""
    host = models.ForeignKey(Host, on_delete=models.CASCADE, related_name='credentials')
    username = models.CharField(max_length=100)
    password = models.CharField(max_length=100)
    protocol = models.CharField(max_length=20)  # http, rtsp, etc.
    is_valid = models.BooleanField(default=False)
    tested_at = models.DateTimeField(auto_now=True)
```

## Celery Tasks

```python
# tasks.py
from celery import shared_task
from django.utils import timezone
import subprocess
import json

@shared_task(bind=True)
def run_scan(self, scan_id: int):
    """Execute network scan using nmap/masscan."""
    from .models import Scan, Host

    scan = Scan.objects.get(id=scan_id)
    scan.status = 'running'
    scan.started_at = timezone.now()
    scan.save()

    try:
        # Run nmap with camera-related ports
        result = subprocess.run([
            'nmap', '-sV', '-p',
            '80,443,554,8080,8554,37777,34567',  # Common camera ports
            '--open', '-oX', '-',
            scan.target
        ], capture_output=True, text=True, timeout=3600)

        hosts = parse_nmap_xml(result.stdout)

        for host_data in hosts:
            host = Host.objects.create(
                scan=scan,
                ip_address=host_data['ip'],
                hostname=host_data.get('hostname', ''),
                open_ports=host_data['ports'],
                device_type=host_data.get('device_type', ''),
            )
            # Queue thumbnail capture for each host
            capture_thumbnails.delay(host.id)

        scan.hosts_found = len(hosts)
        scan.status = 'completed'

    except Exception as e:
        scan.status = 'failed'
        raise

    finally:
        scan.completed_at = timezone.now()
        scan.save()


@shared_task
def capture_thumbnails(host_id: int):
    """Capture frames from camera streams."""
    from .models import Host, Thumbnail
    from .services.scanner import CameraScanner

    host = Host.objects.get(id=host_id)
    scanner = CameraScanner()

    for port in host.open_ports:
        stream_urls = scanner.probe_streams(host.ip_address, port)

        for url in stream_urls:
            try:
                image_path = scanner.capture_frame(url)
                if image_path:
                    thumb = Thumbnail.objects.create(
                        host=host,
                        stream_url=url,
                    )
                    thumb.image.save(f'{host.ip_address}_{port}.jpg', open(image_path, 'rb'))

                    # Queue AI categorization
                    categorize_thumbnail.delay(thumb.id)

            except Exception as e:
                continue


@shared_task
def categorize_thumbnail(thumbnail_id: int):
    """Use AI to categorize thumbnail content."""
    from .models import Thumbnail, Category, ThumbnailCategory
    from .services.categorizer import AICategorizersvc = AICategorizer()

    thumb = Thumbnail.objects.get(id=thumbnail_id)
    categories = svc.categorize(thumb.image.path)

    for cat_name, confidence in categories.items():
        category, _ = Category.objects.get_or_create(name=cat_name)
        ThumbnailCategory.objects.create(
            thumbnail=thumb,
            category=category,
            confidence=confidence
        )
```

## Scanner Service

```python
# services/scanner.py
import subprocess
import tempfile
from pathlib import Path

class CameraScanner:
    # Common RTSP paths to probe
    RTSP_PATHS = [
        '/live/ch0',
        '/live/ch1',
        '/cam/realmonitor',
        '/h264/ch1/main/av_stream',
        '/Streaming/Channels/1',
        '/video1',
        '/video.mjpg',
    ]

    def probe_streams(self, ip: str, port: int) -> list[str]:
        """Find valid stream URLs on a host."""
        valid_urls = []

        # Try RTSP
        if port in [554, 8554]:
            for path in self.RTSP_PATHS:
                url = f"rtsp://{ip}:{port}{path}"
                if self._test_rtsp(url):
                    valid_urls.append(url)

        # Try HTTP/MJPEG
        if port in [80, 8080, 443]:
            for path in ['/video.mjpg', '/mjpg/video.mjpg', '/cgi-bin/mjpg']:
                protocol = 'https' if port == 443 else 'http'
                url = f"{protocol}://{ip}:{port}{path}"
                if self._test_http(url):
                    valid_urls.append(url)

        return valid_urls

    def _test_rtsp(self, url: str, timeout: int = 5) -> bool:
        """Test if RTSP URL is accessible."""
        try:
            result = subprocess.run(
                ['ffprobe', '-v', 'quiet', '-rtsp_transport', 'tcp',
                 '-i', url, '-show_entries', 'stream=codec_type'],
                timeout=timeout,
                capture_output=True
            )
            return result.returncode == 0
        except:
            return False

    def capture_frame(self, url: str) -> str | None:
        """Capture a single frame from stream."""
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            output_path = f.name

        try:
            subprocess.run([
                'ffmpeg', '-y',
                '-rtsp_transport', 'tcp',
                '-i', url,
                '-frames:v', '1',
                '-q:v', '2',
                output_path
            ], timeout=30, capture_output=True, check=True)

            return output_path if Path(output_path).exists() else None

        except:
            return None
```

## AI Categorization Service

```python
# services/categorizer.py
import requests
import base64

class AICategorizer:
    """Categorize images using Lambda Labs ComfyUI."""

    CATEGORIES = [
        'traffic', 'parking', 'entrance', 'lobby',
        'warehouse', 'retail', 'nature', 'residential',
        'industrial', 'office', 'unknown'
    ]

    def __init__(self):
        self.api_url = os.environ.get('LAMBDA_COMFYUI_URL')

    def categorize(self, image_path: str) -> dict[str, float]:
        """Return category -> confidence mapping."""

        with open(image_path, 'rb') as f:
            image_b64 = base64.b64encode(f.read()).decode()

        prompt = f"""Analyze this security camera image.
        Categorize it as ONE of: {', '.join(self.CATEGORIES)}

        Return JSON: {{"category": "...", "confidence": 0.0-1.0}}
        """

        response = requests.post(
            f"{self.api_url}/api/v1/vision",
            json={
                "image": image_b64,
                "prompt": prompt,
            },
            timeout=30
        )

        result = response.json()
        return {result['category']: result['confidence']}
```

## Django Admin

```python
# admin.py
from django.contrib import admin
from django.utils.html import format_html
from .models import Scan, Host, Thumbnail, Category

@admin.register(Scan)
class ScanAdmin(admin.ModelAdmin):
    list_display = ['target', 'status', 'hosts_found', 'started_at', 'created_by']
    list_filter = ['status', 'created_by']
    actions = ['run_selected_scans']

    def run_selected_scans(self, request, queryset):
        from .tasks import run_scan
        for scan in queryset.filter(status='pending'):
            run_scan.delay(scan.id)
        self.message_user(request, f"Started {queryset.count()} scans")


@admin.register(Host)
class HostAdmin(admin.ModelAdmin):
    list_display = ['ip_address', 'hostname', 'device_type', 'port_list', 'thumbnail_count']
    list_filter = ['device_type', 'scan']
    search_fields = ['ip_address', 'hostname']

    def port_list(self, obj):
        return ', '.join(map(str, obj.open_ports))

    def thumbnail_count(self, obj):
        return obj.thumbnails.count()


@admin.register(Thumbnail)
class ThumbnailAdmin(admin.ModelAdmin):
    list_display = ['host', 'preview', 'categories_display', 'captured_at']
    list_filter = ['thumbnailcategory__category']

    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100"/>', obj.image.url)
        return "-"

    def categories_display(self, obj):
        cats = obj.thumbnailcategory_set.all()
        return ', '.join(f"{tc.category.name} ({tc.confidence:.0%})" for tc in cats)
```

## Docker Dependencies

```dockerfile
# Added to Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    masscan \
    tshark \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

## REST API

```python
# views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Scan, Host, Thumbnail
from .serializers import ScanSerializer, HostSerializer, ThumbnailSerializer
from .tasks import run_scan

class ScanViewSet(viewsets.ModelViewSet):
    queryset = Scan.objects.all()
    serializer_class = ScanSerializer

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        scan = self.get_object()
        if scan.status == 'pending':
            run_scan.delay(scan.id)
            return Response({'status': 'started'})
        return Response(
            {'error': 'Scan already started'},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        scan = self.get_object()
        hosts = scan.hosts.prefetch_related('thumbnails', 'credentials')
        return Response(HostSerializer(hosts, many=True).data)
```

## Management Command

```python
# management/commands/run_scan.py
from django.core.management.base import BaseCommand
from camsniff.models import Scan
from camsniff.tasks import run_scan

class Command(BaseCommand):
    help = 'Run a network scan'

    def add_arguments(self, parser):
        parser.add_argument('target', help='IP range or CIDR to scan')

    def handle(self, *args, **options):
        scan = Scan.objects.create(
            target=options['target'],
            created_by_id=1  # Admin user
        )
        run_scan.delay(scan.id)
        self.stdout.write(f"Scan {scan.id} queued for {options['target']}")
```

## Ethical Considerations

This tool is for **authorized security testing only**:

- Only scan networks you own or have written permission to test
- Credential testing must be authorized
- Respect privacy laws in your jurisdiction
- Use responsibly for security research and penetration testing

---

*Network reconnaissance tools are powerful. Use them ethically, document your authorization, and help secure systems rather than exploit them.*
