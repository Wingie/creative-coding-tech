---
layout: post
title: "The One-Character Fix That Saved My Sanity (And Why POSIX Is A Lie)"
date: 2026-01-09 09:00:00 +0100
categories: [devops, linux, scripting]
tags: [bash, linux, macos, shebang, oracle-linux, cross-platform]
---

I recently lost 45 minutes of my life. I will never get them back. I could have spent them learning to juggle, or watching an episode of a mediocre sitcom, or literally staring at a wall.

Instead, I spent them debugging a whitespace character in a shebang line.

Welcome to the wonderful world of cross-platform development, where "Write Once, Run Anywhere" is the biggest lie since "I read the Terms and Conditions."

## The Setup

I have these AI scripts. They're great. I run them on my MacBook, and they spawn little AI agents that do my bidding.

```bash
#!/usr/bin/env claude-run --allow-write
```

This works perfectly on macOS. I felt smug. I felt powerful.

Then I deployed to production. Production is an Oracle Cloud ARM64 server running Oracle Linux 9.

And everything exploded.

```
/usr/bin/env: 'claude-run --allow-write': No such file or directory
```

"No such file or directory," it said.

I looked at the file system. `claude-run` was there. It was in the PATH. I could run it manually.

I cursed. I checked permissions. I re-installed the package. I questioned reality.

## A Brief History of Unix Wars

To understand why this happened, you have to understand that computers are broken.

See, a long time ago, in a galaxy far, far away (Berkeley, California), the BSD folks decided that `env` should parse arguments perfectly logically. If you give it `env foo bar`, it sees "run program `foo` with argument `bar`".

Meanwhile, the GNU folks (the "Penguin People") decided that `env` should be... literal. If you put `#!/usr/bin/env foo bar` in a shebang, Linux sees **one single argument**: `"foo bar"`.

It doesn't look for a program named `foo`. It looks for a program literally named `"foo bar"` (with the space in the filename).

This is insane. This is madness. This is Linux.

A buddy of mine at The Fruit Company (Apple) once told me, "We kept the BSD userland because it actually makes sense." I used to think he was just being an elitist Mac fanatic. Now I think he might be a prophet.

## The Fix: The Magical "-S"

It turns out, the GNU folks eventually realized their rigorous adherence to a broken spec was annoying everyone. So they added a flag.

The `-S` flag. The "Split" flag.

```bash
#!/usr/bin/env -S claude-run --allow-write
```

That one character—` -S `—tells Linux: "Hey, I know you want to treat this entire string as a filename because you are a pedantic monster, but could you please, just this once, split it by spaces like a normal operating system?"

And just like that, it worked.

## The Fallout

I had to update 10 scripts. 

```bash
sed -i 's|#!/usr/bin/env |#!/usr/bin/env -S |g' claude-scripts/*.ai
```

And now I have scripts that look like this:

```bash
#!/usr/bin/env -S claude-run --allow-write
```

This works on Linux (because of `-S`). It works on macOS (because BSD `env` ignores flags it doesn't understand? No, actually macOS doesn't support `-S` in older versions, but `env` splits by default there anyway. It's a mess. Don't look at it too closely.)

## Why You Should Care (Even If You Don't Care)

You might be thinking, "Steve (or Wingston), I don't write shebangs with arguments."

Yes, you do. Or you will. Because eventually, you're going to want to run a script inside a Docker container using a specific interpreter configuration.

And when you do, remember this post. Remember the 45 minutes I died for your sins.

## The Deeper Lesson

The error message was `No such file or directory`. It wasn't "Argument parsing error." It wasn't "Invalid executable."

It was a lie.

The file existed. The directory existed. The *filename* it was looking for (the one with the space in it) didn't exist.

Computers are literal genies. They give you exactly what you ask for, usually in the most destructive way possible.

So, the next time you see a "No such file" error on a script that definitely exists, ask yourself:

1. Am I on Linux?
2. Is there a space in my shebang?
3. Did I forget the `-S`?

And then go pour yourself a drink. You've earned it.

---

## Tired of Bash Script Hell?

I provide therapy for traumatized DevOps engineers:

- **Cross-Platform Audit** - $300 - I'll fix your shebangs.
- **DevOps Consulting** - $150/hr - I'll tell you why your Dockerfile is wrong.
- **Team Training** - Workshops on why Linux is both great and terrible.

**Contact**: [wingston@agentosaurus.com](mailto:wingston@agentosaurus.com)

*POSIX is a suggestion, not a law.*
