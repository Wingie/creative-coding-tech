/**
 * Conscious Art Making Workshop
 * Organic Particle Background Visualizer
 *
 * Creates a gentle, flowing particle system that evokes:
 * - Organic movement (like breath, water, growth)
 * - Interconnection (particles influence each other)
 * - Emergence (simple rules create complex beauty)
 */

class Particle {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.2;
        this.hue = Math.random() * 60 + 240; // Blue to purple range
    }

    update(time) {
        // Organic movement with sine wave influence
        this.vx += Math.sin(time * 0.001 + this.x * 0.01) * 0.01;
        this.vy += Math.cos(time * 0.001 + this.y * 0.01) * 0.01;

        // Apply velocity with damping
        this.vx *= 0.99;
        this.vy *= 0.99;

        this.x += this.vx;
        this.y += this.vy;

        // Wrap around screen edges
        if (this.x < 0) this.x = this.canvas.width;
        if (this.x > this.canvas.width) this.x = 0;
        if (this.y < 0) this.y = this.canvas.height;
        if (this.y > this.canvas.height) this.y = 0;

        // Subtle opacity pulsing
        this.opacity = 0.3 + Math.sin(time * 0.002 + this.x * 0.01) * 0.2;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 70%, 65%, ${this.opacity})`;
        ctx.fill();
    }
}

class OrganicParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 80;
        this.connectionDistance = 150;
        this.time = 0;

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
                    const opacity = (1 - distance / this.connectionDistance) * 0.15;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(180, 167, 214, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }
    }

    animate() {
        this.time += 16; // Approximate 60fps

        // Clear canvas with slight trail effect for organic feel
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connections between nearby particles
        this.drawConnections();

        // Update and draw particles
        this.particles.forEach(particle => {
            particle.update(this.time);
            particle.draw(this.ctx);
        });

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new OrganicParticleSystem('particle-canvas');
});

// Optional: React to Reveal.js slide changes for subtle effects
if (typeof Reveal !== 'undefined') {
    Reveal.on('slidechanged', event => {
        // Could add slide-specific particle behavior here
        console.log('Slide changed:', event.indexh);
    });
}
