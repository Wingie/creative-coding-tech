# Conscious Art Making Workshop Presentation

## Viewing Options

### Option 1: Blog Post (Recommended for Public Viewing)
The presentation is embedded in the main blog at:
`/posts/conscious-art-workshop-presentation/`

This allows visitors to:
- View the slideshow directly in the blog
- Navigate with arrow keys or on-screen controls
- Access on mobile devices
- Share via blog URL

### Option 2: Direct Presentation (For Development/Testing)
Open `index.html` directly in a browser for full-screen presentation mode.

## Navigation Controls

- **←/→ Arrow Keys**: Previous/Next slide
- **↑/↓ Arrow Keys**: Navigate vertical slides (if any)
- **ESC**: Slide overview mode
- **F**: Fullscreen mode
- **S**: Speaker notes (if available)
- **?**: Show keyboard shortcuts

## File Structure

```
conscious-art/
├── index.html           # Main presentation file
├── css/
│   └── custom.css      # Organic, mindful aesthetic styling
├── js/
│   └── custom.js       # Particle background visualizer
├── assets/
│   ├── images/         # (Future: conceptual visuals)
│   └── memes/          # (Future: strategic humor images)
└── README.md           # This file
```

## Technical Details

### Dependencies
- Reveal.js framework (referenced from `../../../../../libs/reveal.js`)
- Custom CSS for workshop theming
- Custom JavaScript for organic particle animation

### Features
- **Responsive Design**: Works on desktop, tablet, mobile
- **Particle Background**: Gentle, flowing animation evoking organic movement
- **Custom Color Palette**: Earth tones, sage green, soft purple, warm cream
- **Smooth Transitions**: Fade effects for contemplative pacing
- **Accessibility**: High contrast, readable fonts, keyboard navigation

### Customization

**Color Variables** (in `css/custom.css`):
```css
--earth-brown: #8B7355;
--sage-green: #9CAF88;
--soft-purple: #B4A7D6;
--warm-cream: #F5E6D3;
--deep-indigo: #4A5568;
--gentle-blue: #81A5C4;
--clay-terracotta: #C17B5C;
```

**Particle System** (in `js/custom.js`):
- 80 particles with organic movement
- Interconnected within 150px radius
- Blue-to-purple color range (hue 240-300)
- Subtle pulsing opacity

## Content Overview

**18 Slides:**
1. Title & Introduction
2. What We'll Explore Today
3. The Creative Colonization (Problem)
4. The Shift (Old Way vs New Way)
5. Core Philosophy
6. Session Structure (4-hour breakdown)
7. Meditation Foundation
8. Materials as Collaborators
9. Meme Break (Levity)
10. Somatic Intelligence
11. Shadow Work Through Art
12. Witnessing Circles
13. Who This Is For
14. Transformations & Outcomes
15. Participant Testimonials
16. Session Offerings & Pricing
17. Next Steps / How to Register
18. Closing Quote

## Embedding in Blog Posts

To embed this presentation in other blog posts or pages:

```html
<div class="presentation-container">
  <iframe
    src="/path/to/conscious-art/index.html"
    class="workshop-presentation"
    allowfullscreen
    title="Conscious Art Making Workshop Presentation">
  </iframe>
</div>

<style>
.presentation-container {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 */
  margin: 40px 0;
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}

.workshop-presentation {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}
</style>
```

## Future Enhancements

### Images Needed:
- `assets/images/meditation-practice.jpg`
- `assets/images/art-materials.jpg`
- `assets/images/witnessing-circle.jpg`
- `assets/images/creative-process.jpg`

### Memes to Add:
- Perfectionism humor
- Creative block relatability
- Shadow work levity
- Process vs product jokes

### Interactive Elements:
- Audio recordings of meditation guidance
- Video clips of workshop sessions
- Interactive polls ("Which material calls to you?")
- Embedded testimonial videos

## Maintenance

**Before Each Workshop Season:**
- Update dates in slide 16 (Session Offerings)
- Refresh testimonials if new ones available
- Check all email links work
- Test on mobile devices
- Update pricing if changed

**Technical Updates:**
- Keep Reveal.js version in sync with main site
- Test browser compatibility
- Optimize images when added
- Check particle animation performance on low-end devices

## Contact

Questions about this presentation or the workshop?

**Email:** workshops@creativecodingtech.com

---

*Created with ❤️ for Creative Coding & Technology*
*Presentation Style: Organic, Mindful, Accessible*
