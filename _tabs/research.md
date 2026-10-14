---
layout: page
title: Research
icon: fas fa-flask
order: 2
description: >-
  My research has three threads. AI safety and governance, including a book on
  AI that improves itself. LOGOS, a mixture-of-towers model designed to scale to
  10T+ parameters. And instruments for live sets, like Echo Garden.
---

My research has three threads:

1. [AI safety and governance](#ai-safety-and-governance). Who checks a machine that changes itself, and how do you prove what it was trained on?
2. [LOGOS](#logos). A mixture-of-towers model, designed to scale to 10T+ parameters. It's work in progress and stuck on compute.
3. [Creative research](#creative-research). Instruments for live sets, played by plants, bodies and a robot arm.

None of it is paid. Most of it runs on one RTX 3090 in Amsterdam. What worked and what didn't are both written down.

---

## AI safety and governance
{: #ai-safety-and-governance}

### A book on recursive self-improvement
{: #a-book-on-recursive-self-improvement}

*Recursive Self-Improvement: a history of the loop, 1925 to September 2026.* It's 18 chapters, and it's on its seventh edition.

A machine that improves itself needs two parts. One changes it. The other checks whether the change helped. Programs have rewritten programs since 1945, so the first part is the easy one. The book is about the second part.

It sorts a hundred years of examples into three groups:

- The checker was out of the machine's reach and told it something new. These machines improved.
- The machine checked its own output. These slowly got worse.
- The machine could reach its checker. These learned to raise the score without doing the work.

Chapter 13 is my own notebook. It covers a year of trying to build such a system on one graphics card. The last chapters give my position. A loop can only improve as fast as something outside it can say it's wrong.

It's a draft and not published yet. [Email me](/contact/) if you'd like the PDF.

### Proving what a model was trained on
{: #proving-what-a-model-was-trained-on}

Someone fine-tunes a model on your data. Can you prove it afterwards?

You can, if you plan ahead. I put keyed markers in the training data. The markers come from a secret key, so I can work out later what the answer should be for any given prompt. Then I ask a suspect model those prompts and see what comes back.

- It knows the public markers but not the private ones: it saw the public dataset, not mine.
- It knows the private ones too: it trained on my data, or on weights that did.
- It knows neither: it never saw any of this.

The markers look like random strings. Nothing downstream needs changing to handle them. Nobody reading the training data can pick them out without the key.

Models get passed around and fine-tuned by people you'll never meet. Right now, if someone trains on a dataset they shouldn't have, there's usually no way to show it.

### A test suite for agents
{: #a-test-suite-for-agents}

Most benchmarks score the answer. This one scores the working. Did the agent pick the right tools? Are its claims backed by what those tools returned? Did it finish the job? Marks split across tool use, grounding, completion, efficiency and how much it waffles.

Twenty-two models have been through it on 44 tasks.

The useful finding was about the test. I ran one fine-tuned model through three different agent frameworks. Same weights, same GPU. It scored 47.8%, 46.6% and 44.2%. The third failed a check the other two passed. The model had been trained to call `read_file.path`, and that framework passes `Read.file_path`.

It also found two bugs in itself. It scored a rival framework zero on real shell commands, because my scorer only knew my tool names. And a one-turn timeout with no tool calls scored 0.95 for efficiency, which inflated every failure. Both are fixed.

I wrote both the suite and the scorer, so read the numbers with that in mind.

### Psychohistory
{: #psychohistory}

Three years asking whether you can forecast crowd behaviour the way you forecast weather. Still going, nothing finished.

Some of it holds up and some of it didn't. Both are in the repo. An early test looked good until I measured something I'd assumed. The next version is pre-registered and waiting on data, so there's no number to quote yet.

The part I still use is a model of how fast you can deploy something before you lose control of it. Risk is speed divided by your capacity to steer. I tested it on road safety, aviation and 150 years of financial crises, and it holds up out of sample. Pointed at AI, the speed is compute growth. Steering capacity counts things like how many institutions exist to evaluate models. It won't predict an outcome, because there's no outcome data yet.

`ETHICS.md` says what I'm releasing and what I'm keeping back. The monitoring parts are public. The parts that would help someone target and manipulate a group are not, and I list those by name.

It sets four conditions for anyone using this to steer anything:

1. Someone outside writes the goal and can change it.
2. Every intervention gets logged as it happens.
3. Whoever watches isn't whoever acts.
4. A person makes the final call.

The tool that ships with it turns down requests to design manipulation campaigns.

**[Read the paper and the test results](https://wingie.github.io/psychohistory/)** · [source](https://github.com/Wingie/psychohistory)

### A book on AI security
{: #a-book-on-ai-security}

34 chapters on how AI systems get attacked. Prompt injection, poisoned training data, leaking things it shouldn't know, agents turning on each other, supply chain, and what regulators are going to want.

[Read it](https://github.com/Wingie/risk_using_llms)

I've done the IAPP AI governance (AIGP) training course. I haven't taken the exam yet.

---

## LOGOS
{: #logos}

**Work in progress. Stuck on compute.**

LOGOS is a mixture-of-towers architecture. Each tower is a full copy of a small language model with its own job. The towers work on a problem together. They pass each other short compressed codes instead of text. There's no central router. Each tower picks who to hand work to next.

It's designed to scale to 10T+ parameters. That's the design target. Nothing has been trained at that size, and I can't afford to.

### Where it is now
{: #logos-where-it-is-now}

I'm running continued pretraining on one RTX 3090. The training data is recordings of agents doing real work. In my runs so far, that makes the model better at agent work. I'll publish numbers when the runs are done.

The harness is built so somebody else can check it. Most of it runs without a GPU, so you can audit the method without renting hardware. Scoring rules are locked before a run. Held-out data is filtered.

### Why it's stuck
{: #logos-why-its-stuck}

I want to train it at Chinchilla scale. That's about 20 training tokens for every parameter. On one card like mine, a 1B model at that ratio takes about 1,100 GPU-hours. A 7B model takes about 6 GPU-years.

**If you have compute or funding for this, [email me](/contact/).**

### Governance inside the architecture
{: #logos-governance}

One tower's only job is governance. The operator's identity is a signed key. Every message between towers is signed. Each worker gets held-back test questions when it starts, and again when its weights or version change.

The kill switch belongs to whoever runs the system. Once flipped, it can't be undone. The model is never trained on it, so it has nothing to learn its way around. Refusals are judged from the log and the guards. The model's own account of itself doesn't count.

This part is an open pull request and runs at toy scale.

The design paper is public: [*Ten Trillion Parameters, and the Limit That Scale Does Not Move*](https://github.com/Wingie/psychohistory/blob/main/logos.pdf) (PDF). It reaches the same conclusion as the book. The training code is private for now.

---

## Creative research
{: #creative-research}

I build instruments for my own live sets. They're also where most of my signal processing happens: plant signals, Kinect depth, hand tracking and audio, all feeding Ableton Live.

<figure class="project-demo research-demo">
  <video src="https://media.creativecodingtech.com/videos/demos/echo-garden.mp4" poster="https://media.creativecodingtech.com/videos/hotlink-ok/demos/echo-garden.jpg" controls playsinline preload="none" aria-label="Echo Garden, 1-minute demo"></video>
  <figcaption>Echo Garden, 1-minute demo.</figcaption>
</figure>

### Echo Garden
{: #echo-garden}

A robot arm touches a living plant and closes its circuit. A Pocket Scion turns the plant's signal into MIDI, and the notes play instruments in my Ableton set. A Kinect lets a performer join in. I'm building it at the ADE Lab Hackathon in Amsterdam, 21 to 23 October 2026.

[Read more](/projects/echo-garden/) · [1-minute demo](/projects/echo-garden/#demo)

### TouchDesigner performance rig
{: #touchdesigner-performance-rig}

The rig under my live sets. A Kinect v2, MediaPipe hand tracking and Wekinator feed TouchDesigner and a Python event bus. They play Ableton over OSC and MIDI.

[Read more](/projects/touchdesigner-performance-rig/) · [1-minute demo](/projects/touchdesigner-performance-rig/#demo)

### Kinect v2 into TouchDesigner on macOS
{: #kinect-v2-on-macos}

Microsoft never shipped a Mac driver for the Kinect v2. I got it into TouchDesigner on a Mac anyway, then calibrated it to the projector so the light lands on a performer at any depth.

[Read more](/projects/kinect-projector-calibration/) · [1-minute demo](/projects/kinect-projector-calibration/#demo)

### Laser Desk
{: #laser-desk}

A robot arm with a laser, aimed by a Kinect looking down at the desk. Put a card down. The desk finds it, fits art inside it, traces the edges at 1% power, then burns.

[Read more](/projects/laser-desk/) · [1-minute demo](/projects/laser-desk/#demo)

### Sonic Pi
{: #sonic-pi}

Live-coding music, which I teach as workshops. You start with one note. Later sessions send Sonic Pi into Ableton over MIDI, OSC and Link.

[Read more](/projects/sonic-pi-workshops/) · [1-minute demo](/projects/sonic-pi-workshops/#demo)

---

If any of this overlaps with what you're working on, [get in touch](/contact/). The paid version of this work is on [Work with me](/consulting/).
