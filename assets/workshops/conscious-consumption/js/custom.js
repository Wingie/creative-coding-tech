// ========================================
// CONSCIOUS CONSUMPTION PARTICLE SYSTEM
// Earth-toned particle system with "awakening" bursts
// ========================================

(function() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    let awakeningParticles = [];

    // Earth-consciousness color palette
    const earthColors = [
        'rgba(45, 80, 22, 0.6)',      // Deep forest green
        'rgba(139, 69, 19, 0.5)',      // Warm earth brown
        'rgba(156, 175, 136, 0.5)',    // Muted sage
        'rgba(107, 70, 193, 0.4)',     // Sacred purple
        'rgba(74, 144, 226, 0.4)'      // Sky blue
    ];

    const awakeningColor = 'rgba(245, 166, 35, 0.8)'; // Golden yellow for awakening

    // Configuration
    const config = {
        particleCount: 80,
        maxSpeed: 0.3,              // Slower, more meditative movement
        connectionDistance: 180,
        baseAlpha: 0.5,
        awakeningChance: 0.002,     // Occasional awakening bursts
        awakeningDuration: 200,     // How long awakening particles last
        breathingSpeed: 0.0008      // Subtle breathing/pulsing effect
    };

    // Particle class
    class Particle {
        constructor(x, y, isAwakening = false) {
            this.x = x || Math.random() * width;
            this.y = y || Math.random() * height;
            this.vx = (Math.random() - 0.5) * config.maxSpeed;
            this.vy = (Math.random() - 0.5) * config.maxSpeed;
            this.radius = isAwakening ? 3 + Math.random() * 2 : 2 + Math.random() * 2;
            this.color = isAwakening ? awakeningColor : earthColors[Math.floor(Math.random() * earthColors.length)];
            this.alpha = isAwakening ? 1 : config.baseAlpha;
            this.isAwakening = isAwakening;
            this.life = isAwakening ? config.awakeningDuration : Infinity;
            this.pulseOffset = Math.random() * Math.PI * 2; // For breathing effect
        }

        update(time) {
            // Gentle movement
            this.x += this.vx;
            this.y += this.vy;

            // Soft edge wrapping (particles reappear on opposite side)
            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;

            // Subtle breathing/pulsing effect
            const breathingScale = 1 + Math.sin(time * config.breathingSpeed + this.pulseOffset) * 0.15;
            this.currentRadius = this.radius * breathingScale;

            // Awakening particles fade and shrink
            if (this.isAwakening) {
                this.life--;
                this.alpha = this.life / config.awakeningDuration;
                this.radius *= 0.98;
            }
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius || this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Soft glow for awakening particles
            if (this.isAwakening) {
                ctx.globalAlpha = this.alpha * 0.3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, (this.currentRadius || this.radius) * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // Initialize canvas size
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;

        // Reinitialize particles on resize
        if (particles.length === 0) {
            for (let i = 0; i < config.particleCount; i++) {
                particles.push(new Particle());
            }
        }
    }

    // Draw connections between nearby particles
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < config.connectionDistance) {
                    const opacity = (1 - distance / config.connectionDistance) * 0.3;
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.strokeStyle = '#9caf88'; // Muted sage for connections
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
    }

    // Create awakening burst
    function createAwakeningBurst(x, y) {
        const burstCount = 5 + Math.floor(Math.random() * 8);
        for (let i = 0; i < burstCount; i++) {
            awakeningParticles.push(new Particle(x, y, true));
        }
    }

    // Animation loop
    let startTime = Date.now();
    function animate() {
        const currentTime = Date.now() - startTime;

        // Clear canvas with subtle gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0e0d');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Update and draw regular particles
        particles.forEach(p => {
            p.update(currentTime);
            p.draw();
        });

        // Draw connections between particles
        drawConnections();

        // Update and draw awakening particles
        awakeningParticles = awakeningParticles.filter(p => p.life > 0);
        awakeningParticles.forEach(p => {
            p.update(currentTime);
            p.draw();
        });

        // Occasionally create awakening bursts
        if (Math.random() < config.awakeningChance) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            createAwakeningBurst(x, y);
        }

        requestAnimationFrame(animate);
    }

    // Initialize
    resize();
    window.addEventListener('resize', resize);
    animate();

    // Create awakening burst on click (interactive element)
    canvas.addEventListener('click', (e) => {
        createAwakeningBurst(e.clientX, e.clientY);
    });

    // Respond to slide changes - create subtle awakening burst
    Reveal.on('slidechanged', event => {
        const x = width / 2 + (Math.random() - 0.5) * 200;
        const y = height / 2 + (Math.random() - 0.5) * 200;
        createAwakeningBurst(x, y);
    });

})();
