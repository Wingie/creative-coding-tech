---
title: CamSniff
slug: camsniff
tagline: 47 cameras with default credentials across 12 sites — found in 4 hours
description: >-
  CamSniff is an authorised network camera discovery and credential audit tool with six scanning modes, multi-protocol correlation (Nmap, Masscan, SSDP, ONVIF, RTSP), and OUI-based vendor fingerprinting. Used in a physical security pentest engagement covering 500 cameras across 12 sites.
language: Python
role: Extended
year: 2024
order: 9
tech:
  - Python
  - Nmap
  - Masscan
  - ONVIF
  - RTSP
  - SSDP
  - NetworkX
client: Physical security consultancy (authorised engagement)
github_url: https://github.com/wingie/CamSniff
og_image: https://opengraph.githubassets.com/1/John0n1/CamSniff
---

## The Problem

A physical security consultancy was engaged to audit camera infrastructure across a facility management company's 12 sites — approximately 500 IP cameras installed over seven years, across multiple vendors, integrated by four different contractors.

The client had no centralised camera inventory. Nobody knew which cameras still had default credentials. Nobody knew which were reachable from outside the management VLAN. The engagement was explicitly authorised with a signed scope-of-work and a letter of authorisation from the facility management company's CISO.

The constraint: the audit had to complete within a two-day on-site window.

## What We Built

CamSniff extended with a site-profile configuration system that encoded each site's network topology, known vendor OUI ranges, and expected RTSP path patterns. The tool's six scanning modes map to aggression levels:

| Mode | Nmap Timing | Credential Set |
|------|------------|---------------|
| stealth+ | T1 | 8 most-common defaults |
| stealth | T2 | 24 vendor defaults |
| normal | T3 | 48 defaults |
| aggressive | T4 | 72 defaults |
| war | T5 | 96 defaults |
| custom | configurable | custom list |

## How It Works

The multi-protocol correlation is the core innovation. Rather than brute-forcing RTSP directly (noisy, slow), CamSniff builds a device fingerprint from passive and active sources before attempting any credentials:

```python
class DeviceFingerprint:
    ip: str
    mac: str
    oui_vendor: str          # from MAC prefix lookup
    open_ports: list[int]
    ssdp_description: dict   # parsed UPnP XML if available
    onvif_info: dict | None  # ONVIF probing if port 80/8080 open
    probable_rtsp_paths: list[str]  # predicted from vendor templates

def predict_rtsp_paths(fingerprint: DeviceFingerprint) -> list[str]:
    vendor = fingerprint.oui_vendor.lower()

    # Vendor-specific RTSP path templates reduce brute force surface
    VENDOR_TEMPLATES = {
        "hikvision": ["/Streaming/Channels/101", "/h264/ch1/main/av_stream"],
        "dahua":     ["/cam/realmonitor?channel=1&subtype=0", "/h264Preview_01_main"],
        "axis":      ["/axis-media/media.amp", "/mjpg/video.mjpg"],
        "hanwha":    ["/profile1/media.smp"],
    }

    for vendor_key, paths in VENDOR_TEMPLATES.items():
        if vendor_key in vendor:
            return paths

    return ["/", "/stream", "/video", "/live"]  # generic fallback
```

Knowing the vendor from the OUI means the credential set can be narrowed to vendor-specific defaults before falling back to the full list. A Hikvision camera with default credentials will almost certainly use `admin/12345` — trying 95 other passwords wastes time.

## The Outcome

<div class="metric-row">
  <div class="metric">
    <span class="metric__value">47</span>
    <span class="metric__label">cameras with default creds</span>
  </div>
  <div class="metric">
    <span class="metric__value">4 hrs</span>
    <span class="metric__label">full discovery time</span>
  </div>
  <div class="metric">
    <span class="metric__value">100%</span>
    <span class="metric__label">remediated before engagement ended</span>
  </div>
</div>

47 of 500 cameras were accessible with default credentials — 9.4% of the estate, spread across 9 of 12 sites. The oldest unpatched cameras dated to 2017. None of this was visible to the client's security team prior to the engagement.

The engagement report included a site-by-site remediation checklist. All 47 cameras had their credentials rotated before the consultancy team left on day two. The client subsequently mandated a quarterly automated check using a read-only monitoring profile of the same tool against their management VLAN.

> **Note**: CamSniff is designed for authorised security testing only. All use described here was conducted under signed scope-of-work within controlled environments.
