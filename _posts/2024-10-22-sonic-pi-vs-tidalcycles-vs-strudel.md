---
layout: post
title: "Sonic Pi vs TidalCycles vs Strudel: A Live Coder's Comparison"
date: 2024-10-22 14:15:00 -0500
categories: [music, live-coding, comparison]
tags: [sonic-pi, tidalcycles, strudel, haskell, ruby, javascript]
---

The live coding scene has evolved tremendously, with three major platforms leading the charge: Sonic Pi, TidalCycles, and Strudel. After extensive time with each, I'm breaking down their strengths, quirks, and ideal use cases for different types of creative coders.

## The Contenders

### Sonic Pi: The Gateway Drug
**Language**: Ruby  
**Created**: 2012 by Sam Aaron  
**Philosophy**: Education-first, performance-ready

### TidalCycles: The Pattern Powerhouse  
**Language**: Haskell  
**Created**: 2009 by Alex McLean  
**Philosophy**: Functional programming meets algorithmic composition

### Strudel: The Web-Native Evolution
**Language**: JavaScript  
**Created**: 2022 by Felix Roos et al.  
**Philosophy**: TidalCycles patterns in the browser

## Learning Curve Comparison

### Sonic Pi: Gentle Slope
```ruby
# Your first loop - immediately understandable
live_loop :drums do
  sample :bd_haus
  sleep 1
  sample :sn_dolf
  sleep 1
end
```

**Pros**: Ruby's readable syntax, excellent documentation, built-in tutorial  
**Cons**: Can become verbose for complex patterns  
**Best For**: Beginners, educators, linear thinkers

### TidalCycles: Steep but Rewarding
```haskell
-- Concise but dense
d1 $ s "bd sn bd sn" # gain (range 0.8 1.2 $ slow 4 sine)
```

**Pros**: Incredibly expressive pattern language, functional programming concepts  
**Cons**: Haskell syntax barrier, SuperCollider dependency  
**Best For**: Functional programming enthusiasts, pattern complexity lovers

### Strudel: Familiar Territory
```javascript
// JavaScript with TidalCycles patterns
s("bd sn bd sn").gain(sine.range(0.8, 1.2).slow(4))
```

**Pros**: No installation hassles, familiar JavaScript syntax, instant gratification  
**Cons**: Newer ecosystem, fewer community resources  
**Best For**: Web developers, collaborative live coding, beginners wanting TidalCycles power

## Performance Capabilities

### Sonic Pi: Stage-Ready Reliability
- **Strengths**: Rock-solid timing, excellent error recovery, visual feedback
- **Live Performance**: Built for it - errors don't crash the show
- **Latency**: Low, predictable
- **Best Features**: `live_loop` system, automatic sync, built-in effects

### TidalCycles: Maximum Expressiveness
- **Strengths**: Unparalleled pattern manipulation, SuperCollider's synthesis power
- **Live Performance**: Powerful but requires expertise to handle gracefully
- **Latency**: Variable depending on SuperCollider setup
- **Best Features**: Pattern transformations, polyrhythmic capabilities

### Strudel: Web-First Innovation
- **Strengths**: Zero setup, shareable sessions, real-time collaboration
- **Live Performance**: Surprisingly capable, browser-based reliability
- **Latency**: Web Audio API dependent, generally acceptable
- **Best Features**: Instant sharing, visual pattern representation, collaborative editing

## Code Style Comparison

### The Same Drum Pattern in Each System

**Sonic Pi** (Verbose but Clear):
```ruby
live_loop :drums do
  at [0, 2] do
    sample :bd_haus, amp: 0.8
  end
  at [1, 3] do  
    sample :sn_dolf, amp: 0.6
  end
  at (0..15).step(0.25) do
    sample :hat_bdu, amp: 0.3 if one_in(3)
  end
  sleep 4
end
```

**TidalCycles** (Concise and Dense):
```haskell
d1 $ stack [
  s "bd ~ bd ~" # gain 0.8,
  s "~ sn ~ sn" # gain 0.6,
  s "hat*16" # gain 0.3 # degradeBy 0.7
]
```

**Strudel** (JavaScript-Familiar):
```javascript
stack(
  s("bd ~ bd ~").gain(0.8),
  s("~ sn ~ sn").gain(0.6),
  s("hat*16").gain(0.3).degradeBy(0.7)
)
```

## Ecosystem and Community

### Sonic Pi
- **Community**: Large educational focus, raspberry pi integration
- **Resources**: Excellent built-in help, active forums
- **Extensions**: Limited but growing
- **Documentation**: Outstanding, tutorial-focused

### TidalCycles  
- **Community**: Academic and underground algorave scene
- **Resources**: Dense documentation, requires dedication
- **Extensions**: Rich SuperCollider ecosystem
- **Documentation**: Comprehensive but challenging

### Strudel
- **Community**: Growing rapidly, web-developer friendly  
- **Resources**: Modern docs, interactive examples
- **Extensions**: JavaScript ecosystem compatibility
- **Documentation**: Clear and interactive

## When to Choose What

### Choose Sonic Pi If:
- You're new to live coding
- Teaching/learning programming through music
- Want reliable live performance
- Prefer readable, verbose code
- Need excellent error handling

### Choose TidalCycles If:
- You love functional programming
- Want maximum pattern complexity
- Need SuperCollider's synthesis power
- Enjoy dense, expressive code
- Are comfortable with steeper learning curves

### Choose Strudel If:
- You want zero installation friction
- Come from web development background
- Need real-time collaboration
- Want TidalCycles patterns without Haskell
- Like modern, interactive development environments

## My Personal Take

After years with each platform:

**For Learning**: Start with Sonic Pi, its educational design is unmatched  
**For Complexity**: TidalCycles remains the pattern king  
**For Accessibility**: Strudel is revolutionizing how we approach live coding  
**For Performance**: Sonic Pi's reliability wins for high-stakes shows  
**For Collaboration**: Strudel's web-native approach is game-changing

## The Future Landscape

The evolution of these platforms shows the maturation of live coding:

1. **Sonic Pi** continues strengthening its educational mission while adding professional features
2. **TidalCycles** remains the research frontier, pushing pattern language boundaries  
3. **Strudel** is democratizing access and enabling new forms of collaborative creation

## Conclusion

There's no "best" choice - only the right tool for your situation. The beauty of the live coding community is that these platforms push each other forward, and many performers use multiple systems.

My advice? Try all three. Start sessions in Sonic Pi, explore complex patterns in TidalCycles, and collaborate in Strudel. The cross-pollination of ideas between platforms often leads to the most interesting music.

The live coding future is multi-platform, and we're all better for it.

---

*What's your platform preference? Share your live coding setup in the comments!*