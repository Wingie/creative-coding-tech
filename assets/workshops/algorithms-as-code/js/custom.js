/**
 * Algorithms as Code Workshop
 * Generative Particle Background Visualizer
 *
 * Features algorithmic patterns inspired by:
 * - Flow fields (Perlin noise)
 * - Emergence from simple rules
 * - Recursive patterns
 * - Mathematical beauty
 */

// Simple Perlin noise implementation
class PerlinNoise {
    constructor() {
        this.gradients = {};
        this.memory = {};
    }

    rand_vect() {
        let theta = Math.random() * 2 * Math.PI;
        return { x: Math.cos(theta), y: Math.sin(theta) };
    }

    dot_prod_grid(x, y, vx, vy) {
        let g_vect;
        let d_vect = { x: x - vx, y: y - vy };
        let grid_key = `${vx},${vy}`;

        if (this.gradients[grid_key]) {
            g_vect = this.gradients[grid_key];
        } else {
            g_vect = this.rand_vect();
            this.gradients[grid_key] = g_vect;
        }

        return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
    }

    smootherstep(x) {
        return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
    }

    interp(x, a, b) {
        return a + this.smootherstep(x) * (b - a);
    }

    get(x, y) {
        let mem_key = `${x},${y}`;
        if (this.memory[mem_key]) {
            return this.memory[mem_key];
        }

        let xf = Math.floor(x);
        let yf = Math.floor(y);

        let tl = this.dot_prod_grid(x, y, xf, yf);
        let tr = this.dot_prod_grid(x, y, xf + 1, yf);
        let bl = this.dot_prod_grid(x, y, xf, yf + 1);
        let br = this.dot_prod_grid(x, y, xf + 1, yf + 1);

        let xt = this.interp(x - xf, tl, tr);
        let xb = this.interp(x - xf, bl, br);
        let v = this.interp(y - yf, xt, xb);

        this.memory[mem_key] = v;
        return v;
    }
}

class Particle {
    constructor(canvas, noise) {
        this.canvas = canvas;
        this.noise = noise;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.vx = 0;
        this.vy = 0;
        this.radius = Math.random() * 2.5 + 0.5;
        this.opacity = Math.random() * 0.6 + 0.3;
        this.hue = Math.random() * 60 + 260; // Purple to pink range
        this.age = 0;
        this.maxAge = Math.random() * 500 + 300;
    }

    update(time) {
        // Flow field based on Perlin noise
        let noiseScale = 0.003;
        let noiseStrength = 0.5;

        let angle = this.noise.get(
            this.x * noiseScale,
            this.y * noiseScale
        ) * Math.PI * 2 * noiseStrength;

        // Add time-based rotation to flow field
        angle += time * 0.0001;

        // Apply force from flow field
        this.vx += Math.cos(angle) * 0.05;
        this.vy += Math.sin(angle) * 0.05;

        // Add subtle attraction to center
        let centerX = this.canvas.width / 2;
        let centerY = this.canvas.height / 2;
        let dx = centerX - this.x;
        let dy = centerY - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.vx += (dx / dist) * 0.002;
            this.vy += (dy / dist) * 0.002;
        }

        // Velocity damping
        this.vx *= 0.97;
        this.vy *= 0.97;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Age the particle
        this.age++;

        // Fade out near end of life
        if (this.age > this.maxAge * 0.8) {
            let fadeProgress = (this.age - this.maxAge * 0.8) / (this.maxAge * 0.2);
            this.opacity = (Math.random() * 0.6 + 0.3) * (1 - fadeProgress);
        }

        // Reset if too old or out of bounds
        if (this.age > this.maxAge ||
            this.x < -50 || this.x > this.canvas.width + 50 ||
            this.y < -50 || this.y > this.canvas.height + 50) {
            this.reset();
        }

        // Color shift over time
        this.hue = 260 + Math.sin(time * 0.0005 + this.x * 0.01) * 30;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 70%, 65%, ${this.opacity})`;
        ctx.fill();

        // Add subtle glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${this.hue}, 70%, 65%, ${this.opacity * 0.5})`;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class AlgorithmicParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 100;
        this.connectionDistance = 120;
        this.time = 0;
        this.noise = new PerlinNoise();
        this.branches = [];

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
            this.particles.push(new Particle(this.canvas, this.noise));
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
                    const opacity = (1 - distance / this.connectionDistance) * 0.2;

                    // Color gradient based on position
                    let avgHue = (p1.hue + p2.hue) / 2;

                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);

                    // Create gradient line
                    let gradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                    gradient.addColorStop(0, `hsla(${p1.hue}, 70%, 65%, ${opacity})`);
                    gradient.addColorStop(1, `hsla(${p2.hue}, 70%, 65%, ${opacity})`);

                    this.ctx.strokeStyle = gradient;
                    this.ctx.lineWidth = 0.8;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawRecursiveBranch(x, y, angle, depth, length) {
        if (depth === 0) return;

        let endX = x + Math.cos(angle) * length;
        let endY = y + Math.sin(angle) * length;

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);

        let hue = 180 + depth * 20 + this.time * 0.05;
        let opacity = depth * 0.05;

        this.ctx.strokeStyle = `hsla(${hue}, 60%, 60%, ${opacity})`;
        this.ctx.lineWidth = depth * 0.5;
        this.ctx.stroke();

        // Recursively draw branches
        let angleVariation = 0.5;
        this.drawRecursiveBranch(
            endX, endY,
            angle - angleVariation,
            depth - 1,
            length * 0.7
        );
        this.drawRecursiveBranch(
            endX, endY,
            angle + angleVariation,
            depth - 1,
            length * 0.7
        );
    }

    drawBackgroundPattern() {
        // Draw subtle recursive pattern in background
        let centerX = this.canvas.width / 2;
        let centerY = this.canvas.height / 2;

        // Only redraw occasionally for performance
        if (this.time % 100 === 0) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.02;

            // Draw multiple starting points
            for (let i = 0; i < 6; i++) {
                let angle = (Math.PI * 2 / 6) * i + this.time * 0.0001;
                this.drawRecursiveBranch(
                    centerX,
                    centerY,
                    angle,
                    5,
                    50
                );
            }

            this.ctx.restore();
        }
    }

    animate() {
        this.time += 16;

        // Clear with fade trail for motion blur effect
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background recursive pattern
        this.drawBackgroundPattern();

        // Draw connections between particles
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
    new AlgorithmicParticleSystem('particle-canvas');
});

// React to Reveal.js slide changes
if (typeof Reveal !== 'undefined') {
    Reveal.on('slidechanged', event => {
        // Could add slide-specific effects here
        // For example, increase particle count on technical slides
        console.log('Slide changed:', event.indexh);
    });
}
