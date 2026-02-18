---
description: Create a reveal.js presentation for a workshop with SEO-optimized blog post
---

# Create Workshop Presentation

I need you to create a complete reveal.js presentation and SEO-optimized blog post for a workshop.

## Input Required from User

Before proceeding, please ask the user for:

1. **Workshop Name** (e.g., "Conscious Art Making", "Ableton Live + Sonic Pi")
2. **Workshop Focus** (brief description: e.g., "mindfulness-based art practice", "hybrid live coding performance")
3. **Target Audience** (who is this for?)
4. **Session Format** (e.g., "6 sessions × 4 hours", "8 sessions × 4 hours")
5. **Key Topics/Themes** (3-5 main topics covered in the workshop)

## Your Task

Once you have this information, create:

### 1. Presentation Structure (20-25 slides)

Follow this template:

**Opening (3-4 slides)**
- Title slide with workshop name, subtitle, tagline
- What we'll explore today (split if needed)
- The problem/challenge this workshop addresses

**Core Content (12-16 slides)**
- Key concepts and foundations (split into digestible chunks)
- Methodology and approach
- Materials/tools/techniques
- Practical applications
- Who this is for (1-2 slides)
- What you'll gain/outcomes (1-2 slides)

**Social Proof & Logistics (4-5 slides)**
- Participant testimonials (1-2 slides)
- Session offerings and pricing (1-2 slides)
- How to register (1-2 slides)

**Closing (2 slides)**
- Core values/taglines
- Final message with contact info

### 2. Technical Implementation

**Folder Structure**:
```
/Users/wingston/code/creative-coding-tech/assets/workshops/{workshop-slug}/
├── index.html (reveal.js presentation)
├── css/
│   └── custom.css (workshop-specific styling)
└── js/
    └── custom.js (particle background visualizer)
```

**Requirements**:
- Use reveal.js CDN (v4.6.1)
- Include particle canvas background
- Custom color palette appropriate to workshop theme
- Responsive design (16:9 aspect ratio)
- Smooth fade transitions
- No slide should have more than 5 main points
- Split dense content into multiple slides

### 3. Blog Post

Create SEO-optimized blog post at:
`/Users/wingston/code/creative-coding-tech/_posts/{YYYY-MM-DD}-{workshop-slug}-presentation.md`

**Frontmatter**:
```yaml
---
layout: post
title: "[Keyword-Rich Title]: [Workshop Name] for [Benefit]"
date: {today's date} 14:00:00 -0400
categories: [workshops, presentations]
tags: [keyword1, keyword2, keyword3, etc.]
description: "Benefit-focused meta description with primary keywords (150-160 chars)"
pin: true
---
```

**Content Structure**:
1. Opening paragraph with natural keyword placement
2. Embedded presentation iframe with responsive CSS
3. "What You'll Discover" section (6-8 bullet points)
4. "Workshop Pricing & Formats" section
5. "What Participants Say" testimonials
6. "How to Register for the Workshop" with email CTA
7. Links to other workshops
8. Closing tagline

### 4. Documentation

Update `/Users/wingston/code/creative-coding-tech/_posts/internal_docs/workshop-sessions/{workshop-slug}/README.md` with:
- Viewing options
- Navigation controls
- File structure
- Technical details
- Complete slide list
- Maintenance notes

## Important Guidelines

1. **Content Density**: Keep slides concise for iframe embedding - max 5 points per slide
2. **SEO Focus**: Use natural, benefit-focused language (not technical presentation terms)
3. **Keywords**: Research relevant transactional long-tail keywords for the workshop type
4. **Visual Hierarchy**: Use fragments, colors, icons, and spacing effectively
5. **Accessibility**: Sliding scale pricing, inclusive language
6. **Style**: Match the organic, mindful aesthetic of the Conscious Art workshop
7. **Particle System**: Customize colors/behavior to match workshop theme

## Before Creating Files

Present your plan to the user:
- Workshop theme and color palette
- Slide outline (all 20-25 slides listed)
- Primary SEO keywords
- Estimated session pricing

Wait for user approval before creating any files.

## Reference Template

Use the Conscious Art Making workshop as your template:
- `/Users/wingston/code/creative-coding-tech/assets/workshops/conscious-art/`
- `/Users/wingston/code/creative-coding-tech/_posts/2025-10-13-conscious-art-workshop-presentation.md`
- `/Users/wingston/code/creative-coding-tech/_posts/internal_docs/workshop-sessions/conscious-art/README.md`

Study its structure, styling, particle system, and SEO approach.
