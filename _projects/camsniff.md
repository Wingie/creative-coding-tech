---
title: CamSniff
slug: camsniff
tagline: 500 cameras, 12 sites, four contractors, and no inventory
description: >-
  Twelve sites, roughly 500 cameras, and no inventory. Extending CamSniff with
  per-site profiles made a two-day audit window workable.
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
github_url: https://github.com/John0n1/CamSniff
upstream_owner: John0n1
upstream_repo: CamSniff
og_image: https://opengraph.githubassets.com/1/John0n1/CamSniff
---

Nobody had a list of the cameras.

Twelve sites, roughly 500 of them, installed over seven years by four different integrators using whatever hardware was cheap that year. A security consultancy was auditing the lot. Nobody knew which cameras still had factory passwords, or which were reachable from outside the management VLAN.

The work was authorised in writing: a signed scope of work and a letter of authorisation from the client's CISO. The audit had a two-day on-site window.

[CamSniff](https://github.com/John0n1/CamSniff) is John0n1's scanner. I extended it with per-site profiles.

The profile holds each site's network layout, the vendor OUI ranges present there, and the RTSP path patterns those vendors use. Camera vendors put their streams at predictable paths, and the MAC address prefix tells you the vendor before you've touched the camera. So instead of trying every known path against every device, it tries the handful that vendor actually uses.

Scanning is graded by how loud you're willing to be:

| Mode | Nmap timing | Credentials tried |
|---|---|---|
| stealth+ | T1 | 8 most common |
| stealth | T2 | 24 vendor defaults |
| normal | T3 | 48 |
| aggressive | T4 | 72 |
| war | T5 | 96 |

On a live site you start at the top of that table. A camera network shared with building management is not somewhere to open with T5.

Cameras with factory credentials turned up at nine of the twelve sites. The oldest of those had been installed in 2017. Everything found was fixed before the engagement ended, and the client now runs the same scan quarterly with a read-only profile.
