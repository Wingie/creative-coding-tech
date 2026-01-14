---
layout: post
title: "The YAML-ification of Human Worth"
date: 2026-01-14 10:00:00 +0100
categories: [career, rant, AI]
tags: [claude-code-job-tailor, recruitment, CI/CD, resume, dystopia, yegge-style]
---

I was looking at the `claude-code-job-tailor` repository today. It’s a tool I use. It’s a tool *you* probably use, or will use, or are currently being beaten by.

And I found this commit:

**["release notes with production-grade CLI architecture"](https://github.com/javiera-vasquez/claude-code-job-tailor/commit/72487ec)**

Read that again. **"Production-grade CLI architecture"**. For a tool that resizes your resume so you can beg for a job.

We have reached the peak of the "YAML-ification of Human Worth".

### The Resume CI/CD Pipeline

There was a time when applying for a job involved printing a piece of paper. Maybe you put it in a nice envelope. It was quaint. It was analog. It was human.

Now? Now we have this:

**["enhance context success data structure"](https://github.com/javiera-vasquez/claude-code-job-tailor/commit/947dd7b)**

We are optimizing the "context success data structure" of our lives. We are treating our careers like a high-availability distributed system that needs 99.999% uptime and structured logging.

We’re building [CI/CD pipelines](https://about.gitlab.com/topics/ci-cd/) for our cover letters. I can see it now:

*   **Stage 1: Linter.** Check if I used the word "synergy" too many times.
*   **Stage 2: Unit Tests.** Verify that my years of experience are > required years.
*   **Stage 3: Deployment.** POST request to the Greenhouse API.
*   **Stage 4: Monitoring.** Prometheus alerts for rejection emails.

### The Arms Race

This tool, and thousands like it, are part of a bizarre arms race.

Recruiters use AI to filter resumes because they get too many applicants.
Applicants use AI (like `claude-code-job-tailor`) to spam resumes because they get too many rejections.
Recruiters get MORE applicants, so they buy BIGGER AI models.
Applicants get MORE rejections, so they build "production-grade CLI architectures" to tailor their resumes faster.

It’s a [Nash Equilibrium](https://en.wikipedia.org/wiki/Nash_equilibrium) of misery.

We are just the meat-puppets turning the crank. We feed the context into the LLM. The LLM spits out a "tailored" reality where we have always been passionate about "enterprise-grade soap dispensing solutions" (or whatever the company does).

### If You Need a Distributed System...

There’s an old saying in systems engineering: "Complexity is the enemy."

If you need a distributed system to generate your resume, **maybe the problem isn't the resume**. Maybe the problem is that we’ve turned the hiring process into a DDOS attack.

We are optimizing for keyword density instead of competence. We are validating YAML instead of validating skills.

But hey, at least the CLI architecture is "production-grade". So when I get rejected by an automated script at 3:00 AM, I can take comfort in the fact that my rejection was processed with robust error handling and structured logging.

### Conclusion

I’m going to keep using the tool. I have to. You have to. We all have to.

But let’s just take a moment to appreciate the absurdity of it. We are engineers. We build worlds. And here we are, engineering the most complex machinery in human history just to say:

"Please hire me. I am good at computer."
