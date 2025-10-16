/**
 * Reformed Mindfulness Workshop
 * Sovereignty & Contemplation Particle Background Visualizer
 *
 * Creates a contemplative particle system that evokes:
 * - The steady light of Reformed doctrine (warm, consistent glow)
 * - Thoughts observed and released (gentle upward drift)
 * - Coram Deo presence (particles moving "before the face of God")
 * - Contemplative stillness grounded in sovereignty
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
        this.vx = (Math.random() - 0.5) * 0.2; // Slower drift than meditation
        this.vy = -Math.random() * 0.3 - 0.1; // Gentle upward drift (like thoughts released in trust)
        this.radius = Math.random() * 2.5 + 0.5;
        this.baseOpacity = Math.random() * 0.5 + 0.3;

        // Reformed theme colors: sovereignty gold, covenant blue, warm amber
        const colorChoice = Math.random();
        if (colorChoice < 0.4) {
            this.hue = 45; // Sovereignty gold
            this.saturation = 80;
        } else if (colorChoice < 0.7) {
            this.hue = 40; // Heidelberg amber
            this.saturation = 100;
        } else {
            this.hue = 210; // Covenant blue
            this.saturation = 50;
        }

        this.flickerPhase = Math.random() * Math.PI * 2;
    }

    update(time) {
        // Candle-like flickering
        const flicker = Math.sin(time * 0.003 + this.flickerPhase) * 0.3 +
                        Math.sin(time * 0.007 + this.flickerPhase * 2) * 0.2;

        // Very gentle horizontal drift
        this.vx += Math.sin(time * 0.0002 + this.baseX * 0.003) * 0.003;

        // Gentle upward movement (like prayer rising)
        this.vy += Math.sin(time * 0.0001 + this.baseY * 0.002) * 0.002;

        // Apply velocity with damping
        this.vx *= 0.97;
        this.vy *= 0.98;

        this.x += this.vx;
        this.y += this.vy;

        // Wrap around when particles drift too far
        if (this.y < -50) {
            this.y = this.canvas.height + 50;
            this.baseY = this.y;
        }
        if (this.x < -50) {
            this.x = this.canvas.width + 50;
            this.baseX = this.x;
        }
        if (this.x > this.canvas.width + 50) {
            this.x = -50;
            this.baseX = this.x;
        }

        // Opacity flickers like candlelight
        this.opacity = this.baseOpacity * (0.6 + flicker * 0.4);

        // Size pulses very gently with flicker
        this.currentRadius = this.radius * (0.85 + flicker * 0.15);
    }

    draw(ctx) {
        // Draw glow halo (soft radial gradient)
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.currentRadius * 4
        );

        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 70%, ${this.opacity})`);
        gradient.addColorStop(0.4, `hsla(${this.hue}, ${this.saturation}%, 60%, ${this.opacity * 0.3})`);
        gradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, 50%, 0)`);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.currentRadius * 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw brighter center
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, 80%, ${this.opacity})`;
        ctx.fill();
    }
}

class ReformedParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 50; // Fewer particles for sacred/contemplative feel
        this.connectionDistance = 200;
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
                    // Very subtle connections (like threads of light)
                    const baseOpacity = (1 - distance / this.connectionDistance) * 0.08;
                    const flickerOpacity = baseOpacity * (0.7 + Math.sin(this.time * 0.002) * 0.3);

                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);

                    // Use golden light for connections
                    this.ctx.strokeStyle = `hsla(45, 80%, 70%, ${flickerOpacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawCrossConstellation() {
        // Occasionally form subtle cross patterns from nearby particles
        if (Math.random() < 0.02) {
            for (let i = 0; i < this.particles.length; i++) {
                const p1 = this.particles[i];

                // Find particles that could form a cross
                const nearbyHorizontal = this.particles.filter(p =>
                    Math.abs(p.y - p1.y) < 30 && Math.abs(p.x - p1.x) < 150
                );

                const nearbyVertical = this.particles.filter(p =>
                    Math.abs(p.x - p1.x) < 30 && Math.abs(p.y - p1.y) < 150
                );

                if (nearbyHorizontal.length >= 2 && nearbyVertical.length >= 2) {
                    // Draw very subtle cross
                    const opacity = 0.05;
                    this.ctx.strokeStyle = `hsla(270, 60%, 70%, ${opacity})`;
                    this.ctx.lineWidth = 1;

                    // Horizontal line
                    this.ctx.beginPath();
                    this.ctx.moveTo(nearbyHorizontal[0].x, p1.y);
                    this.ctx.lineTo(nearbyHorizontal[1].x, p1.y);
                    this.ctx.stroke();

                    // Vertical line
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, nearbyVertical[0].y);
                    this.ctx.lineTo(p1.x, nearbyVertical[1].y);
                    this.ctx.stroke();
                }
            }
        }
    }

    animate() {
        this.time += 16; // Approximate 60fps

        // Clear canvas with very subtle trail for sacred glow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connections between nearby particles
        this.drawConnections();

        // Occasionally draw subtle cross patterns
        this.drawCrossConstellation();

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
    new ReformedParticleSystem('particle-canvas');
});

// Optional: React to Reveal.js slide changes
if (typeof Reveal !== 'undefined') {
    Reveal.on('slidechanged', event => {
        // Could add slide-specific particle behavior here
        // For example, increase particle count during key theological slides
        console.log('Slide changed:', event.indexh);
    });
}
