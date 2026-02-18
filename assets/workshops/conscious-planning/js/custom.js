// ========================================
// CONSCIOUS PLANNING PARTICLE SYSTEM
// Flowing time streams meeting moments of stillness
// Time-consciousness visualization
// ========================================

(function() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    let timeStreams = [];
    let pausePoints = [];

    // Time-consciousness color palette
    const timeColors = [
        'rgba(124, 58, 237, 0.6)',    // Mindful purple
        'rgba(59, 130, 246, 0.5)',    // Serene blue
        'rgba(20, 184, 166, 0.5)',    // Muted teal
    ];

    const streamColor = 'rgba(245, 158, 11, 0.7)'; // Soft gold for time streams
    const pauseColor = 'rgba(249, 115, 22, 0.8)';  // Warm coral for pause points

    // Configuration
    const config = {
        particleCount: 80,
        maxSpeed: 0.4,              // Gentle, unhurried movement
        connectionDistance: 160,
        baseAlpha: 0.5,
        timeStreamChance: 0.002,    // Flowing time streams
        pausePointChance: 0.002,    // Moments of stillness
        streamDuration: 220,
        breathingSpeed: 0.0008      // Slow breathing effect
    };

    // Particle class
    class Particle {
        constructor(x, y, type = 'normal') {
            this.x = x || Math.random() * width;
            this.y = y || Math.random() * height;
            this.vx = (Math.random() - 0.5) * config.maxSpeed;
            this.vy = (Math.random() - 0.5) * config.maxSpeed;
            this.radius = 2 + Math.random() * 2;
            this.color = timeColors[Math.floor(Math.random() * timeColors.length)];
            this.alpha = config.baseAlpha;
            this.type = type;
            this.pulseOffset = Math.random() * Math.PI * 2;
        }

        update(time) {
            // Gentle movement
            this.x += this.vx;
            this.y += this.vy;

            // Soft edge wrapping
            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;

            // Breathing/pulsing effect
            const breathingScale = 1 + Math.sin(time * config.breathingSpeed + this.pulseOffset) * 0.15;
            this.currentRadius = this.radius * breathingScale;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius || this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Soft glow
            ctx.globalAlpha = this.alpha * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, (this.currentRadius || this.radius) * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Time Stream class - flowing horizontal stream
    class TimeStream {
        constructor(y) {
            this.x = -100;
            this.y = y || height / 2 + (Math.random() - 0.5) * height * 0.6;
            this.speed = 1.5 + Math.random() * 2;
            this.width = 200 + Math.random() * 400;
            this.height = 3 + Math.random() * 5;
            this.life = config.streamDuration;
            this.maxLife = this.life;
            this.wave = Math.random() * Math.PI * 2;
        }

        update(time) {
            this.x += this.speed;
            this.life--;
            // Gentle wave motion
            this.currentY = this.y + Math.sin(time * 0.001 + this.wave) * 30;
        }

        draw() {
            ctx.save();
            const alpha = this.life / this.maxLife;
            ctx.globalAlpha = alpha * 0.6;

            // Draw flowing stream
            const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
            gradient.addColorStop(0, 'rgba(245, 158, 11, 0)');
            gradient.addColorStop(0.5, streamColor);
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(this.x, this.currentY || this.y, this.width, this.height);

            // Add shimmer effect
            ctx.globalAlpha = alpha * 0.3;
            ctx.fillRect(this.x, (this.currentY || this.y) - this.height, this.width, this.height);

            ctx.restore();
        }
    }

    // Pause Point class - moment of stillness
    class PausePoint {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.life = config.streamDuration;
            this.maxLife = this.life;
            this.maxRadius = 60 + Math.random() * 40;
            this.currentRadius = 0;
            this.pulsePhase = 0;
        }

        update() {
            this.life--;

            // Grow to max size
            if (this.currentRadius < this.maxRadius) {
                this.currentRadius += 2;
            }

            // Breathing pulse
            this.pulsePhase += 0.02;
        }

        draw() {
            ctx.save();
            const alpha = this.life / this.maxLife;
            const pulse = 1 + Math.sin(this.pulsePhase) * 0.2;

            // Outer ring (pause moment)
            ctx.globalAlpha = alpha * 0.3;
            ctx.strokeStyle = pauseColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius * pulse, 0, Math.PI * 2);
            ctx.stroke();

            // Inner glow
            ctx.globalAlpha = alpha * 0.5;
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.currentRadius * pulse * 0.5);
            gradient.addColorStop(0, pauseColor);
            gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius * pulse * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Center point (the pause)
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = pauseColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 5 * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // Initialize canvas size
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;

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
                    ctx.strokeStyle = '#7c3aed'; // Mindful purple
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

    // Create time stream
    function createTimeStream() {
        const y = Math.random() * height;
        timeStreams.push(new TimeStream(y));
    }

    // Create pause point (moment of stillness)
    function createPausePoint(x, y) {
        pausePoints.push(new PausePoint(x, y));
    }

    // Animation loop
    let startTime = Date.now();
    function animate() {
        const currentTime = Date.now() - startTime;

        // Clear canvas with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Update and draw particles
        particles.forEach(p => {
            p.update(currentTime);
            p.draw();
        });

        // Draw connections
        drawConnections();

        // Update and draw time streams
        timeStreams = timeStreams.filter(s => s.life > 0 && s.x < width + 500);
        timeStreams.forEach(s => {
            s.update(currentTime);
            s.draw();
        });

        // Update and draw pause points
        pausePoints = pausePoints.filter(p => p.life > 0);
        pausePoints.forEach(p => {
            p.update();
            p.draw();
        });

        // Randomly create time streams
        if (Math.random() < config.timeStreamChance) {
            createTimeStream();
        }

        // Randomly create pause points
        if (Math.random() < config.pausePointChance) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            createPausePoint(x, y);
        }

        requestAnimationFrame(animate);
    }

    // Initialize
    resize();
    window.addEventListener('resize', resize);
    animate();

    // Click to create pause point (moment of presence)
    canvas.addEventListener('click', (e) => {
        createPausePoint(e.clientX, e.clientY);
        // Also create time stream through the point
        timeStreams.push(new TimeStream(e.clientY));
    });

    // Respond to slide changes - create pause point
    Reveal.on('slidechanged', event => {
        // Create pause point near center
        const x = width / 2 + (Math.random() - 0.5) * 200;
        const y = height / 2 + (Math.random() - 0.5) * 200;
        createPausePoint(x, y);

        // Sometimes also create time stream
        if (Math.random() < 0.5) {
            createTimeStream();
        }
    });

})();
