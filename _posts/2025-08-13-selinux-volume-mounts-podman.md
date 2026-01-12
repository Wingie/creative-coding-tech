---
layout: post
title: "SELinux Volume Mounts: The :Z vs :z Mystery That Cost Me Hours"
date: 2025-08-13 10:00:00 +0100
categories: [devops, containers, security]
tags: [selinux, podman, docker, oracle-linux, containers]
---

Django was throwing 500 errors. The logs showed permission denied on `/var/lib/postgresql/data`. The database container was running fine. What was going on?

After hours of debugging, the culprit was a single character: `:Z` vs `:z` in my volume mounts.

## The Setup

- Oracle Linux 9 (SELinux enforcing)
- Rootless Podman with docker-compose compatibility
- Django + PostgreSQL + Redis + Celery stack

## The Symptom

Django couldn't connect to PostgreSQL. The database logs showed nothing wrong. PostgreSQL was accepting connections. But Django kept failing:

```
django.db.utils.OperationalError: could not connect to server
```

Digging deeper, I found permission errors in the Django container trying to read shared volumes.

## SELinux Context Labels

On SELinux systems, every file has a security context. Containers run in their own context. By default, a container can't access files with the host's context.

```bash
# Check file context
ls -Z /var/lib/containers/storage/volumes/
# system_u:object_r:container_file_t:s0 postgres_data
```

Podman/Docker volume mount options control how SELinux labels are applied:

| Option | Meaning | Use Case |
|--------|---------|----------|
| `:z` | Shared label | Multiple containers access same volume |
| `:Z` | Private label | Only one container accesses volume |
| (none) | No relabeling | May cause permission denied |

## The Bug

My original `docker-compose.yml`:

```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data:Z  # Private label
  django:
    volumes:
      - postgres_data:/var/lib/postgresql/data:Z  # CONFLICT!
```

Both containers mounting the same volume with `:Z` (private unshared label) caused SELinux to enforce that only ONE container could access it. The second container got permission denied.

## The Fix

Change `:Z` to `:z` for shared volumes:

```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data:z  # Shared label

  django:
    depends_on:
      - postgres
    # Django doesn't need to mount postgres_data directly
    # It connects via network, not filesystem

  redis:
    volumes:
      - redis_data:/data:z  # Shared if multiple services need it
```

## Additional SELinux Fix

Even with correct labels, Podman containers need permission to manage cgroups:

```bash
# Enable container cgroup management
sudo setsebool -P container_manage_cgroup on
```

Without this, you might see:

```
Failed to create cgroup: Permission denied
```

## The Complete Fix

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    volumes:
      - postgres_data:/var/lib/postgresql/data:z  # lowercase z!
    environment:
      POSTGRES_DB: flowstate
      POSTGRES_USER: flowstate
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data:z

  django:
    build: .
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app:z  # Source code mount
      - static_volume:/app/static:z

  celery:
    build: .
    depends_on:
      - redis
      - postgres
    volumes:
      - ./backend:/app:z  # Same source, shared label

volumes:
  postgres_data:
  redis_data:
  static_volume:
```

## When to Use :Z (Private)

Use `:Z` only when a single container needs exclusive access:

```yaml
# Good use of :Z - only one container needs this
services:
  single-service:
    volumes:
      - secret_data:/secrets:Z  # Only this container accesses it
```

## Debugging SELinux Issues

```bash
# Check for SELinux denials
sudo ausearch -m avc -ts recent

# See what's being denied
sudo audit2why < /var/log/audit/audit.log

# Temporarily set SELinux to permissive (for debugging only!)
sudo setenforce 0
# If it works now, SELinux was the problem
sudo setenforce 1

# Check boolean settings
getsebool -a | grep container
```

## Common SELinux Container Booleans

```bash
# Allow containers to manage cgroups
sudo setsebool -P container_manage_cgroup on

# Allow containers to connect to any port
sudo setsebool -P container_connect_any on

# Allow containers to use NFS mounts
sudo setsebool -P container_use_nfs on
```

## The Mental Model

Think of SELinux labels like apartment keys:

- `:Z` = Private apartment key (only one tenant)
- `:z` = Shared apartment key (roommates can all enter)
- No label = Trying to enter without a key

When multiple containers need the same volume, they're roommates. Give them shared keys with `:z`.

## Why This Matters

1. **SELinux is enabled by default** on RHEL, CentOS, Oracle Linux, Fedora
2. **Podman respects SELinux** more strictly than Docker
3. **Most tutorials show Docker examples** that skip SELinux considerations
4. **Permission errors are cryptic** - they don't say "SELinux blocked this"

## Key Takeaways

1. **Use `:z` for shared volumes** between multiple containers
2. **Use `:Z` only for single-container volumes** that need isolation
3. **Enable `container_manage_cgroup`** on SELinux systems
4. **Check `ausearch -m avc`** when you see permission errors
5. **Don't disable SELinux** - fix the labels instead

---

*SELinux is security. The extra hour debugging is worth not having a compromised server. Learn the labels, don't disable the protection.*
