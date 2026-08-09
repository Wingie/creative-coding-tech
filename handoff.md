# creativecodingtech.com — rewrite every page in plain language

*(Plan mode fixes this path. Copy to `handoff.md` in the repo when we start.)*

---

## Context

The facts on the site are now mostly right. The writing is not. Every page reads like it was written by a machine, because it was — first by an automated loop, then by me cleaning up after it in the same register.

Two things need fixing at once, on every page:

1. **The words.** Simple language. Short sentences. If a word needs a dictionary, it's the wrong word.
2. **The point.** Each page needs a reader and a reason for them to get in touch. The Agentosaurus page is the clearest failure: I wrote it as a showpiece about a climate platform. It's a build system that is teaching him how agents behave, and its reader is an engineer who can't get agents working at scale.

Facts are settled from earlier sessions. Two late corrections must carry:

- **LOGOS** is continued pretraining on a 3090 plus a mixture-of-towers architecture. He has shown that training on agentic trajectories does increase capability. He wants donated compute to reach Chinchilla scale. The old "null result / zero router gradient" story is stale.
- **The canary work** proves which training data a model was fine-tuned on. It is not an anti-hallucination check.

---

## The voice: simple words

**If a word needs a dictionary, it's the wrong word.**

Words I used that shouldn't be there, with replacements:

| Don't | Do |
|---|---|
| load-bearing | the part that holds it up |
| legible | you can read it |
| scaffolding | temporary |
| orchestration | running lots of agents |
| provenance | where it came from |
| granularity | small pieces |
| falsifiable | you can prove it wrong |
| adversarial | trying to break it |
| substrate | the hardware underneath |
| unsentimental | strict |

### Rules

1. Most sentences under 15 words.
2. One idea per sentence.
3. Everyday words. If a technical term is the real name of a thing, use it and say what it does the first time.
4. Numbers instead of adjectives. "45 jobs died after four seconds" beats "a serious failure".
5. No em-dashes. Full stop or comma.
6. No "not X, but Y". Just say Y.
7. No clever line at the end of a section. Stop when the point is made.
8. "I" and "you". Contractions fine.
9. Never compare himself to people he doesn't name.
10. Read it out loud. If you wouldn't say it to someone in a pub, rewrite it.

### Example

**Mine:**
> "An autonomous system will report success indefinitely if nobody checks. Knowing which parts are load-bearing and which are scaffolding is the entire skill."

**Target:**
> "If nobody checks, the system keeps saying it worked. Mine said 45 jobs finished fine. All 45 had died after four seconds."

---

## Stop the source first

**The loop is still running.** Verified over SSH on 2026-08-09:

- `~/FlowState/claude-scripts/claude-run` on the server still has `BLOG_ENABLED=true`. The fix I made was local only.
- `~/creative-coding-tech/_posts` on the server holds **134 posts, 104 of them untracked**.
- The newest is `2026-08-09-devlog.md`, written today.
- Nothing auto-commits or pushes them, so they haven't reached the live site. They accumulate until someone commits by hand. That is how the 42 got in.

There are **two generators**, not one:

| Generator | Output | Verdict |
|---|---|---|
| `claude-run` → `generate_blog_post()` | `YYYY-MM-DD-devlog.md` — timestamped activity logs, mechanical, factual | Harmless. Could stay if he wants a public build log. |
| `.agent/workflows/generate_yegge_rant.md` + `generate_rant.md` | The 42 essay posts with borrowed personas | This is what drifted. Delete. |

**Actions:** pull the disable onto the server, delete the two rant workflow files from the repo, and decide what happens to the 104 untracked devlogs (my recommendation: leave them, they're a private build log, don't commit them).

Also: `corrections/index.md` currently claims the generator is "disabled at the source". That is not true yet. Fix the page or fix the server, and preferably both.

---

## Scope

About 90 files. Roughly 7,100 words already rewritten, **28,000 words still original**.

| Group | Files | State |
|---|---|---|
| `_layouts/projects.html` | 1 | **Untouched. This is the `/projects/` page.** Still says "6,000+ GitHub stars", "one of the first", "15 years", and one card is titled FlowState while linking to `/projects/agentosaurus/` |
| `_projects/*.md` bodies | 14 | Links fixed, prose untouched |
| Practice cluster | 9 | Untouched. `/practice/`, `/work/`, `/oracle/`, 6 × `/offerings/` |
| `_posts/` | 42 | Untouched. Three still contain "Steve (or Wingston)". Two say Brooklyn. Five carry `$150/hr` and a third email domain |
| `_tabs/contact.md` prose | 1 | Untouched |
| Already rewritten | 14 | index, about, research, consulting, corrections, agentosaurus — all need the simple-language pass |

---

## Page by page

Each page gets: **who reads it, what they want, what they do next.**

| Page | Reader | What they want | Next step |
|---|---|---|---|
| `/` | Someone who just got the link | Who is this, in 10 seconds | Research or Projects |
| `/about/` | Hiring manager | Can he do the job, is he available | Contact |
| `/research/` | Lab or policy person | Is the work real | Read the paper, or email |
| `/projects/agentosaurus/` | **Engineer whose agents don't work** | How do I stop mine failing | **Email him** |
| `/projects/*` (14) | Prospective client | Has he solved my problem before | Contact |
| `/consulting/` | Someone with a budget | Can he help, how does it work | Contact |
| `/facilitation/` (new) | Event or workshop organiser | Can he run this | Contact |
| `/corrections/` | Sceptic checking him out | Is he honest | (no CTA needed) |
| `/contact/` | All of the above | One form that works | Send |

### Agentosaurus — rewrite around what he learned

The research pulled 21 lessons out of the repo, each with a date and a file. This is the strongest content on the site and none of it is published. The best ones:

- **Agents report success for work that never happened.** 45 sessions in a row died on a rate limit in 4–6 seconds. Every one logged `COMPLETED: success`. Four batch runs reported green while shipping nothing, and the supervisor decided the queues were empty when they held 69 jobs.
- **`set -e` without `set -o pipefail` deleted every error branch.** Piping through `tee` meant every failure took the success path. The rate-limit handler and the timeout handler were unreachable.
- **The quota check returned 0 when it failed**, which looks identical to "0% used". Six runs logged "could not fetch usage, proceeding anyway" and then ran 45 jobs.
- **One threshold across two rate-limit windows.** The weekly window sat at 84–100% for six days while the 5-hour window was at 0–11%. It skipped every expensive job and shipped nothing.
- **Cheap jobs kept the expensive ones locked out.** The small phases ran ungated and kept burning the same weekly budget that was blocking everything else.
- **Ask "did the work land", not "does my branch still exist".** A successful agent pushes to an existing PR and deletes its branch, so success and never-started look the same.
- **Timeouts should make tasks smaller, not longer.** Three-to-five minute tasks, released back to the queue on timeout.
- **Never emergency-commit a crashed agent's leftovers.** Discard them, but log what you discarded.
- **A clean auto-merge rolled a submodule back 358 commits.** Everyone checked the three that conflicted and nobody looked at the one that merged fine.
- **The human is the bottleneck.** 15 PRs open, none merged in four days.
- **Negative result:** letting an agent orchestrate the other agents produced zero completed tasks across five runs.

Structure: what it is → what I learned (the list above) → what runs now → **if your agents are doing this, email me** → what's still broken.

### The practice pages

All claims confirmed real. Merge `/practice/`, `/work/`, `/oracle/` and the 6 `/offerings/` into one `/facilitation/` page. Drop per-session prices and the `Service`/`Offer` price schema. Kill the second contact form at `/oracle/`. Fix the three dead links in `work/index.md` that all point at `/`.

### The blog: 42 → about 12

**Keep and rewrite (7):** SELinux volume mounts · pgvector in Django · ARM64 build failures · the Beta9 GPU pipeline · the auth incident (**confirm it happened first**) · the two agent-infrastructure posts merged into one.

**Fix the premise or cut (4):** three posts are built on `claude-run --allow-write`, which is not a real command or flag. `when-claude-killed-production` claims a Replit incident the body never mentions.

**Delete (13):** everything under ~140 words.

**Delete all 17 workshop posts.** Eight topics, each existing as a teaser, a long-form and a catalogue entry. The real curriculum goes to `/facilitation/`. The 8 published decks in `assets/workshops/` stay.

**Delete the 4 drafts.** Their problem is the premise.

Every kept post needs a `description:` in front matter. None of the 42 has one, so link previews auto-excerpt the first line.

---

## Also fix

- `_layouts/projects.html` — the card titled **FlowState** links to `/projects/agentosaurus/`. And "6,000+ GitHub stars" is wrong: the real upstream has 2,890 and isn't his.
- The `?service=` links on `/consulting/` are dead. The contact form has no JS to read the parameter, so all five land on an empty dropdown.
- Three email domains in use. `workshops@creativecodingtech.com` and `wingston@agentosaurus.com` appear only inside post bodies and are unreachable from any nav.
- `_posts/internal_docs/` holds pricing strategy and Stripe fee notes, committed publicly.
- `_config.yml` still has a `google_site_verification: "your-verification-code"` placeholder.
- The two rant workflow files in `.agent/workflows/`.

---

## Order of work

1. **Stop the source.** Push the disable to the server. Delete the rant workflows.
2. **`/projects/` index.** Highest traffic, entirely unrewritten, contains a false star count and a broken card title.
3. **Agentosaurus.** The best content, currently the wrong page.
4. **Blog cull.** Delete 34, keep 8, before touching prose.
5. **Simple-language pass on the 6 rewritten pages.**
6. **The 14 project bodies.**
7. **`/facilitation/` merge**, with redirects for the 9 old URLs.
8. **The 8 kept posts.**
9. **Loose ends** from the list above.

---

## How to check it worked

- `bundle exec jekyll build` clean, no conflicts.
- `htmlproofer` passes.
- Every `github.com` link in `_site` returns 200.
- Grep the built site for: `load-bearing`, `legible`, `scaffolding`, `orchestration`, `Steve (or Wingston)`, `Brooklyn`, `$150/hr`, `6,000+`, `15 years`, `one of the first`. All should return nothing.
- Read three pages out loud. If a sentence is hard to say, it's not done.
- Confirm on the server that `BLOG_ENABLED` is off and no new post appeared the next morning.

---

## Decided

- **Devlogs:** turn the loop off on the server, leave the 104 files where they are, uncommitted. They stay a private record.
- **The auth incident post is real** — keep and rewrite. Same for the Lambda Labs SDXL post, with the pricing refreshed. That takes the blog to **9 keepers**.
- **Fractional CTO stays out.** Five offers on `/consulting/`.

## Still open

- **The festival** you're doing AV for. Name it and `/facilitation/` can cite real work instead of describing a capability.

---

## Devlog data (mined 2026-08-09)

105 devlogs copied from the server. They are machine logs, not posts. Do not publish
them. But the numbers in them are real and usable:

- **3,416 agent runs across 105 days.** 79% success, 20% failed.
- Success rate by month: **52% (Jan) → 84% (Feb) → 86% (Mar) → 100% (Apr, Jul, Aug)**
- Median successful run: **3m41s**. Longest: 29m.
- Busiest agent: `continue-build`, 993 runs, 88% ok. Weakest: `test-changes`, 205 runs, 60% ok.

**The 100% is false, and the logs prove it.** Cross-checked against the rate-limit
bug documented in commit 66d03b24:

| Day | Runs | All "success"? | Finished in <=10s |
|---|---|---|---|
| 2026-08-05 | 15 | yes | **13** |
| 2026-08-06 | 28 | yes | **24** |
| 2026-08-07 | 28 | yes | **27** |
| 2026-08-08 | 27 | yes | 0 |
| 2026-08-09 | 10 | yes | 0 |

64 runs marked success that died in under ten seconds, then the fix lands on the 8th
and the pattern stops. This is the best single example on the site of the thing the
whole Agentosaurus page is about: the success signal was really a "the process didn't
crash" signal. Open the page with it.

Raw files: `scratchpad/server-posts/` (not committed).

---

## How real engineering managers write their About page

Researched 13 sites: Will Larson, Camille Fournier, Charity Majors, Rands, Lara Hogan,
Jacob Kaplan-Moss, Gergely Orosz, Kellan Elliott-McCrea, Marc Brooker, Julia Evans,
Dan Luu, Ben Kuhn, Vicki Boykis.

**Median About page: 82 words.** Range 13 to 155. Nothing longer except one commercial
coaching bio.

| Person | Words |
|---|---|
| Camille Fournier | 13 |
| Lara Hogan | 14 |
| Ben Kuhn | 46 |
| Jacob Kaplan-Moss | 52 |
| Marc Brooker | 71 |
| Kellan Elliott-McCrea | 102 |
| Will Larson | 119 |

**The shape**, near-identical across all of them:

1. Greeting or bare name. "Hi," / "I'm Kellan." / "My name is Marc Brooker."
2. One sentence on what you do now. Present tense.
3. Career as a compressed list, past tense, company names only.
4. A human detail that is not work.
5. Routing. "Get in touch."

**What none of them do:**

- **No adjectives about themselves.** Zero instances of seasoned, passionate, driven,
  experienced, proven across all 13. The only two sites using them are selling coaching.
- **Nobody narrates a job.** No "at X I grew the team from 10 to 60". Companies are bare
  names in a list. Kellan compresses seven senior roles into one verb-less fragment and
  puts it AFTER the call to action.
- **No mission statements.** Several state one narrow falsifiable opinion instead.
- **No section-closing wisdom.** They end on a shrug, a link, or a joke.

**The mechanism that makes them read human:** every good one has at least one specific,
checkable, slightly odd fact. Classical piano dropout. First website in 1994. Machining
and welding. "A's dad." If you change one thing, add the two weird true facts.

**About and hire-me are separate pages.** About stays short because the commercial
pressure lives at /consulting/. Their hire-me pages run 5-20x longer than their bios,
and they lead with what they will NOT do.
