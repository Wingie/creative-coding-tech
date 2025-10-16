/**
 * Basic Meditation Workshop
 * Breath-Like Particle Background Visualizer
 *
 * Creates a gentle, meditative particle system that evokes:
 * - Breath rhythm (inhale/exhale cycles)
 * - Stillness with subtle movement
 * - Calm interconnection
 * - Present-moment awareness
 */

class Particle {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.baseX = this.x;
        this.baseY = this.y;
        this.vx = (Math.random() - 0.5) * 0.3; // Very slow movement
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 2 + 0.5;
        this.baseOpacity = Math.random() * 0.4 + 0.3;
        this.hue = Math.random() * 60 + 200; // Blue to violet range
        this.breathPhase = Math.random() * Math.PI * 2; // Randomize breath cycle start
    }

    update(time, breathCycle) {
        // Breath-like pulsing based on sine wave (4 second breath cycle)
        const breathInfluence = Math.sin(breathCycle + this.breathPhase) * 0.5 + 0.5;

        // Very gentle drift
        this.vx += Math.sin(time * 0.0003 + this.baseX * 0.005) * 0.005;
        this.vy += Math.cos(time * 0.0003 + this.baseY * 0.005) * 0.005;

        // Apply velocity with strong damping for stillness
        this.vx *= 0.98;
        this.vy *= 0.98;

        // Gentle return to base position (like breath returning to center)
        const returnForceX = (this.baseX - this.x) * 0.001;
        const returnForceY = (this.baseY - this.y) * 0.001;
        this.vx += returnForceX;
        this.vy += returnForceY;

        this.x += this.vx;
        this.y += this.vy;

        // Wrap around screen edges gently
        if (this.x < -50) {
            this.x = this.canvas.width + 50;
            this.baseX = this.x;
        }
        if (this.x > this.canvas.width + 50) {
            this.x = -50;
            this.baseX = this.x;
        }
        if (this.y < -50) {
            this.y = this.canvas.height + 50;
            this.baseY = this.y;
        }
        if (this.y > this.canvas.height + 50) {
            this.y = -50;
            this.baseY = this.y;
        }

        // Opacity pulses with breath
        this.opacity = this.baseOpacity * (0.7 + breathInfluence * 0.3);

        // Size pulses gently with breath
        this.currentRadius = this.radius * (0.9 + breathInfluence * 0.2);
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 60%, 70%, ${this.opacity})`;
        ctx.fill();
    }
}

class BreathParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 60; // Fewer particles for more spacious feel
        this.connectionDistance = 180;
        this.time = 0;
        this.breathCycle = 0;
        this.breathRate = Math.PI / 2000; // 4 second breath cycle (in/out)

        this.resize();
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push(new Particle(this.canvas));
        }
    }

    drawConnections() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.connectionDistance) {
                    // Connection opacity based on distance and breath
                    const breathInfluence = Math.sin(this.breathCycle) * 0.5 + 0.5;
                    const baseOpacity = (1 - distance / this.connectionDistance) * 0.1;
                    const opacity = baseOpacity * (0.7 + breathInfluence * 0.3);

                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);

                    // Use meditation colors for connections
                    const hue = 220 + Math.sin(this.time * 0.0001) * 20; // Subtle color shift
                    this.ctx.strokeStyle = `hsla(${hue}, 60%, 70%, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }
    }

    animate() {
        this.time += 16; // Approximate 60fps
        this.breathCycle += this.breathRate * 16;

        // Clear canvas with gentle trail for smooth, meditative feel
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connections between nearby particles
        this.drawConnections();

        // Update and draw particles
        this.particles.forEach(particle => {
            particle.update(this.time, this.breathCycle);
            particle.draw(this.ctx);
        });

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BreathParticleSystem('particle-canvas');
});

// Optional: React to Reveal.js slide changes
if (typeof Reveal !== 'undefined') {
    Reveal.on('slidechanged', event => {
        // Could add slide-specific particle behavior here
        // For example, change particle count or connection distance
        console.log('Slide changed:', event.indexh);
    });
}
