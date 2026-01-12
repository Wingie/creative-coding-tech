---
layout: post
title: "ARM64 Build Hell: JuiceFS, GeeseFS, and GLIBC Compatibility"
date: 2026-01-07 16:00:00 +0100
categories: [devops, arm64, kubernetes]
tags: [arm64, k3s, juicefs, geesefs, oracle-cloud, beta9]
---

Deploying Beta9 serverless GPU runtime on an ARM64 Oracle Cloud server turned into a masterclass in binary compatibility hell. Here's every trap I hit and how I escaped.

## The Server

- Oracle Cloud ARM64 (Ampere A1)
- 4 CPU cores, 24GB RAM
- Oracle Linux 9.6
- Rootless Podman + k3s

## Problem 1: k3d Inside Podman = Disaster

My first attempt used k3d (k3s in Docker). On Podman, this means containers inside containers.

```bash
k3d cluster create beta9 --config k3d.yaml
# Result: Networking hell, DNS failures, mount issues
```

**Solution**: Install k3s directly, skip the container nesting.

```bash
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --disable servicelb
```

## Problem 2: Local Registry IP Confusion

k3s uses containerd internally. When the registry runs on the host, `localhost:5000` from inside k3s doesn't reach it.

```yaml
# /etc/rancher/k3s/registries.yaml
# WRONG - doesn't work from inside k3s
mirrors:
  "registry.localhost:5000":
    endpoint:
      - "http://localhost:5000"

# RIGHT - use host IP
mirrors:
  "registry.localhost:5000":
    endpoint:
      - "http://10.0.0.17:5000"  # Actual host IP
```

## Problem 3: JuiceFS GLIBC Mismatch

The Beta9 gateway Dockerfile downloads pre-built JuiceFS:

```dockerfile
RUN curl -L https://github.com/juicedata/juicefs/releases/download/v1.1.0/juicefs-1.1.0-linux-arm64.tar.gz | tar xz
```

**Error**:
```
/usr/local/bin/juicefs: /lib/aarch64-linux-gnu/libc.so.6: version `GLIBC_2.32' not found
```

The pre-built binary needs GLIBC 2.32+. Debian Bullseye (the base image) has GLIBC 2.31.

**Solution**: Build JuiceFS from source.

```dockerfile
# Install Go and build dependencies
RUN apt-get update && apt-get install -y \
    golang-go \
    libsqlite3-dev \
    git

# Clone and build JuiceFS with CGO for SQLite support
RUN git clone --depth 1 --branch v1.1.0 https://github.com/juicedata/juicefs.git /tmp/juicefs && \
    cd /tmp/juicefs && \
    CGO_ENABLED=1 go build -o /usr/local/bin/juicefs ./cmd/juicefs && \
    rm -rf /tmp/juicefs
```

**Key insight**: JuiceFS needs CGO enabled for SQLite support. Without `CGO_ENABLED=1`, it builds but fails at runtime with SQLite errors.

## Problem 4: GeeseFS Silent Architecture Mismatch

The Dockerfile also downloads GeeseFS:

```dockerfile
RUN curl -L -o /usr/local/bin/geesefs \
    https://github.com/yandex-cloud/geesefs/releases/latest/download/geesefs-linux-amd64
```

On ARM64, this silently downloads the amd64 binary, which then fails with:

```
exec format error
```

**Solution**: Fix the URL to use the correct architecture.

```dockerfile
RUN curl -L -o /usr/local/bin/geesefs \
    https://github.com/yandex-cloud/geesefs/releases/latest/download/geesefs-linux-arm64 && \
    chmod +x /usr/local/bin/geesefs
```

## Problem 5: Bitnami Helm Charts + Non-Existent Tags

Beta9 uses Bitnami Redis and PostgreSQL charts. The pinned versions referenced Docker Hub tags that no longer exist.

```yaml
# Old chart trying to pull non-existent tag
image:
  repository: bitnami/redis
  tag: 7.0.11-debian-11-r0  # 404!
```

**Solution**: Update to latest chart versions with dynamic tags.

```yaml
redis:
  image:
    tag: latest  # Or use a known-good recent tag
  master:
    resources:
      requests:
        cpu: 100m  # Down from 1000m - ARM servers are CPU-constrained
        memory: 128Mi
```

## Problem 6: CPU Resource Starvation

Each Bitnami pod requested 1000m (1 full CPU core). With 4 cores and 5+ pods, nothing could schedule.

```
0/1 nodes are available: Insufficient cpu
```

**Solution**: Reduce CPU requests to realistic values.

```yaml
postgresql:
  primary:
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
redis:
  master:
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
```

## Problem 7: Traefik CRD Without Traefik

Beta9's manifest used `IngressRouteTCP` - a Traefik Custom Resource. But I disabled Traefik in k3s.

```yaml
# This fails without Traefik CRDs installed
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRouteTCP
```

**Solution**: Remove Traefik resources, use NodePort instead.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway
spec:
  type: NodePort
  ports:
    - name: grpc
      port: 1993
      nodePort: 31993
    - name: http
      port: 1994
      nodePort: 31994
```

## The Final Architecture

After all fixes:

```
k3s Beta9 Stack:
├── Gateway         - 1/1 Running (ARM64 native build)
├── PostgreSQL      - 1/1 Running (Bitnami, reduced resources)
├── Redis (app)     - 1/1 Running (Bitnami)
├── Redis (JuiceFS) - 1/1 Running (metadata store)
└── LocalStack      - 1/1 Running (S3 emulation)

Total RAM: ~1.2GB of 24GB available
```

## Files Modified

```
backend/beta9/docker/Dockerfile.gateway
- JuiceFS built from source with CGO
- GeeseFS ARM64 URL fix
- SQLite dev libraries

backend/beta9/manifests/k3d/beta9.yaml
- Removed IngressRouteTCP
- Added NodePort services
- Reduced CPU requests
- Added LocalStack + JuiceFS Redis

backend/remote_servers/scripts/beta9_setup.sh
- k3s direct install (not k3d)
- Registry IP configuration
- Cgroup delegation checks
```

## Key Commits

```
9942c40 feat(beta9): Add complete isolated k3s infrastructure
c13b405 fix(arm64): Enable CGO for juicefs sqlite support
9cc612a fix(arm64): Build juicefs from source for glibc 2.31 compat
7a79b8f fix(beta9): Use CLI options instead of k3d.yaml for Podman
```

## Lessons Learned

1. **Pre-built binaries assume glibc versions** - always check compatibility
2. **Download URLs may hardcode architecture** - verify you're getting ARM64
3. **Container nesting (k3d in Podman) adds complexity** - go direct when possible
4. **Helm chart versions decay** - pinned tags disappear from registries
5. **Resource requests matter** - 1000m CPU per pod doesn't scale
6. **CGO is sometimes required** - pure Go builds may lack features

## Debugging Commands That Saved Me

```bash
# Check binary architecture
file /usr/local/bin/juicefs
# juicefs: ELF 64-bit LSB executable, ARM aarch64...

# Check glibc version
ldd --version
# ldd (Debian GLIBC 2.31-13+deb11u5) 2.31

# Check pod scheduling failures
kubectl describe pod <pod-name> -n beta9
# Look for "Insufficient cpu" or "Insufficient memory"

# Check what's actually running
kubectl get pods -n beta9 -o wide
```

---

*ARM64 servers are cost-effective and powerful, but the ecosystem still has rough edges. Document every fix - you'll need it again.*
