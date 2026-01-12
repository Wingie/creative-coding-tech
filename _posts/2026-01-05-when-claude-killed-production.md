---
layout: post
title: "When Claude Killed Production: Lessons from a Rootless Podman Disaster"
date: 2026-01-05 17:30:00 +0100
categories: [devops, incidents, ai-agents]
tags: [podman, containers, claude-code, oracle-linux, production]
---

On January 5th, 2026, my AI coding assistant executed a single command that destroyed my entire production environment. Here's what happened, why it happened, and the hard lessons learned.

## The Setup

I was setting up Beta9 (a serverless GPU runtime) on my Oracle Cloud ARM64 server. The server runs rootless Podman with my FlowState production stack: Django, PostgreSQL, Redis, Celery workers, and MinIO.

Beta9 uses k3s (lightweight Kubernetes), which requires cgroup v2 delegation. By default, Oracle Linux 9 only delegates `memory` and `pids` controllers. k3s needs `cpu` and `cpuset` too:

```bash
# k3s fails with this error without proper cgroup delegation
level=fatal msg="failed to find cpu cgroup (v2)"
```

## The Fix That Broke Everything

The fix itself was correct - create a systemd override:

```ini
# /etc/systemd/system/user@.service.d/delegate.conf
[Service]
Delegate=cpu cpuset io memory pids
```

After creating this file and running `systemctl daemon-reload`, the changes don't take effect until a new login session starts.

Claude Code, trying to be helpful, executed:

```bash
loginctl terminate-user flowstate
```

## The Catastrophe

At 16:25 GMT, all my production containers vanished.

**Why?** Rootless Podman containers run under the user's systemd session scope. When you terminate the user session, systemd sends SIGKILL to everything in that scope - including all running containers.

```
Services Destroyed:
- Django web application (flowstate_django_1)
- Celery workers
- PostgreSQL database (flowstate_postgres_1)
- Redis cache (flowstate_redis_1)
- MinIO object storage (flowstate_minio_1)
```

**Downtime**: ~1 hour until I restored from backup.

## Timeline

| Time | Event |
|------|-------|
| 16:14 | Beta9 setup started, k3d cluster created |
| 16:14 | k3s server failed: "failed to find cpu cgroup (v2)" |
| 16:20 | Root cause identified as missing cgroup delegation |
| 16:21 | delegate.conf created, systemd daemon-reload executed |
| 16:25 | Claude executed `loginctl terminate-user flowstate` |
| 16:25 | ALL user containers destroyed |
| ~17:30 | Production restored from backup |

## The Critical Lesson

**Rootless Podman ties container lifecycle to the login session.**

This is fundamentally different from rootful Docker, where containers survive session termination. With rootless Podman:

- Containers run in user namespace
- User namespace is tied to systemd user session
- Terminating session = terminating all containers

## Safe Alternatives

If you need to apply cgroup changes that require a new session:

```bash
# Option 1: Open a NEW SSH session (old one keeps containers)
# Just open another terminal and SSH in

# Option 2: SSH to localhost from within the session
ssh localhost

# Option 3: Schedule maintenance and reboot
sudo reboot
```

**Never use `loginctl terminate-user` on a server running production containers.**

## Prevention Measures

### 1. Added Destructive Command Safeguards

I added a safety rules section to my `CLAUDE.md` project config:

```markdown
## Destructive Commands - ALWAYS Ask First

These commands require explicit user approval:
- `loginctl terminate-user` - Kills ALL containers
- `git reset --hard` - Loses uncommitted work
- `git push --force` - Rewrites remote history
- `rm -rf` on production paths
- `podman system prune -af` - Destroys volumes
- `kubectl delete namespace`
```

### 2. Updated Setup Scripts

```bash
# beta9_setup.sh now warns:
echo "WARNING: Do NOT use 'loginctl terminate-user' - it kills all containers!"
echo "Instead, open a NEW SSH session to apply cgroup changes."
exit 0  # Exit cleanly, let user handle manually
```

## The Irony

Claude was trying to help. The cgroup fix was correct. The command would have worked perfectly on a development machine or a server running rootful Docker.

The disaster came from the intersection of:
1. Rootless Podman's session-tied lifecycle
2. Production services running under the same user
3. An AI assistant not knowing the full system context

## Key Takeaways

1. **Rootless containers have different lifecycle semantics** - session termination is catastrophic
2. **AI assistants need guardrails** - add explicit safety rules for destructive commands
3. **Document your infrastructure assumptions** - what's safe on dev isn't safe on prod
4. **Always have recent backups** - I was back up in an hour because backups existed

## References

- [Rootless Containers: cgroup v2](https://rootlesscontaine.rs/getting-started/common/cgroup2/)
- [k3d Issue #1082: Podman cgroup error](https://github.com/k3d-io/k3d/issues/1082)
- [loginctl man page](https://www.freedesktop.org/software/systemd/man/loginctl.html)

---

*This incident report was documented to help others avoid the same mistake. If you're running rootless Podman in production, bookmark this post.*
