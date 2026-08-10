---
layout: post
title: "env: 'foo bar': No such file or directory"
date: 2026-01-09 09:00:00 +0100
categories: [devops, linux]
tags: [bash, linux, macos, shebang]
description: >-
  A shebang with arguments works on macOS and fails on Linux. The error says the
  file doesn't exist. The file exists. Here's what's actually happening and the
  one flag that fixes it.
---

I write my agent prompts as executable files. They start like this:

```bash
#!/usr/bin/env claude-run --allow-write
```

`claude-run` is my own wrapper. It runs a prompt file and stays read-only unless you pass `--allow-write`.

This worked on my Mac. I deployed to an Oracle Linux ARM box and got:

```
/usr/bin/env: 'claude-run --allow-write': No such file or directory
```

The file was there. It was on PATH. I could run it by hand. I spent 45 minutes on this.

## What's happening

Linux reads everything after `#!/usr/bin/env` as **one argument**. So it goes looking for a program called `claude-run --allow-write`, space included. There is no such program, so it tells you there's no such file.

The error is true. It's just not about the file you think.

BSD `env`, which is what macOS ships, splits on spaces. Same script, two behaviours.

## The fix

GNU added a flag for this. `-S`, for split:

```bash
#!/usr/bin/env -S claude-run --allow-write
```

That's it. I updated ten scripts:

```bash
sed -i 's|#!/usr/bin/env |#!/usr/bin/env -S |g' claude-scripts/*.ai
```

macOS has supported `-S` since Big Sur, so the same line now works both places. If you need to support older macOS, you can't use `-S` there, and the usual workaround is a two-line wrapper script instead of a shebang.

## Why it took 45 minutes

Because "No such file or directory" sent me to check the filesystem. I checked permissions. I reinstalled the thing. I did not think to look at the space.

If a script that definitely exists tells you it doesn't, check whether your shebang has arguments in it.
