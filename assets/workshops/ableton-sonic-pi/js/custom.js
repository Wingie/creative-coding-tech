/**
 * Ableton Live + Sonic Pi Workshop
 * Audio Waveform Particle Visualizer
 *
 * Creates a dynamic particle system that evokes:
 * - Audio waveforms (oscillating patterns)
 * - Beat synchronization (pulsing rhythms)
 * - Electronic music aesthetics (vibrant colors, digital feel)
 * - Live coding energy (dynamic, algorithmic movement)
 */

class AudioParticle {
    constructor(canvas, index, total) {
        this.canvas = canvas;
        this.index = index;
        this.total = total;
        this.reset();

        // Waveform properties
        this.baseY = canvas.height / 2;
        this.frequency = Math.random() * 0.02 + 0.01;
        this.amplitude = Math.random() * 100 + 50;
        this.phase = (index / total) * Math.PI * 2;
    }

    reset() {
        this.x = (this.index / this.total) * this.canvas.width;
        this.y = this.canvas.height / 2;
        this.vx = 0;
        this.vy = 0;
        this.radius = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.6 + 0.3;

        // Color cycling between electric blue, orange, and purple
        this.hueOffset = Math.random() * 60;
    }

    update(time, beatPulse) {
        // Waveform oscillation
        const waveOffset = Math.sin(time * this.frequency + this.phase) * this.amplitude;
        const targetY = this.baseY + waveOffset;

        // Beat-synced pulsing
        const pulseAmount = beatPulse * 30;

        // Smooth movement toward target
        this.vy = (targetY - this.y) * 0.05;
        this.y += this.vy + pulseAmount * Math.sin(this.phase);

        // Horizontal drift for organic feel
        this.x += Math.sin(time * 0.0005 + this.index) * 0.3;

        // Wrap around horizontally
        if (this.x < -50) this.x = this.canvas.width + 50;
        if (this.x > this.canvas.width + 50) this.x = -50;

        // Opacity pulsing
        this.opacity = 0.4 + Math.sin(time * 0.003 + this.phase) * 0.3 + beatPulse * 0.2;

        // Update base Y to follow canvas center
        this.baseY = this.canvas.height / 2;
    }

    draw(ctx, time) {
        // Cycle between electric blue (180), purple (280), and orange (20)
        const hue = ((time * 0.05 + this.hueOffset) % 360);
        let finalHue;

        if (hue < 120) {
            finalHue = 180; // Electric blue
        } else if (hue < 240) {
            finalHue = 280; // Purple
        } else {
            finalHue = 20; // Orange
        }

        // Draw particle with glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsla(${finalHue}, 100%, 60%, ${this.opacity})`;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${finalHue}, 100%, 60%, ${this.opacity})`;
        ctx.fill();

        ctx.shadowBlur = 0;
    }
}

class WaveformParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 120;
        this.connectionDistance = 100;
        this.time = 0;
        this.beatTime = 0;
        this.bpm = 120;
        this.beatInterval = (60 / this.bpm) * 1000;

        this.resize();
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Reinitialize particles on resize
        if (this.particles.length > 0) {
            this.init();
        }
    }

    init() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push(new AudioParticle(this.canvas, i, this.numParticles));
        }
    }

    getBeatPulse() {
        // Create a pulsing effect synced to tempo
        const beatPhase = (this.time % this.beatInterval) / this.beatInterval;
        return Math.max(0, 1 - beatPhase * 4); // Sharp attack, quick decay
    }

    drawConnections() {
        // Draw connections between nearby particles (waveform segments)
        for (let i = 0; i < this.particles.length - 1; i++) {
            const p1 = this.particles[i];
            const p2 = this.particles[i + 1];

            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.connectionDistance) {
                const opacity = (1 - distance / this.connectionDistance) * 0.3;

                // Create gradient along the connection
                const gradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                gradient.addColorStop(0, `rgba(0, 217, 255, ${opacity})`);
                gradient.addColorStop(0.5, `rgba(107, 45, 92, ${opacity})`);
                gradient.addColorStop(1, `rgba(255, 107, 53, ${opacity})`);

                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.strokeStyle = gradient;
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }
        }
    }

    drawWaveformBase() {
        // Draw a subtle base waveform
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);

        for (let x = 0; x < this.canvas.width; x += 10) {
            const y = this.canvas.height / 2 +
                      Math.sin(x * 0.01 + this.time * 0.001) * 20 +
                      Math.sin(x * 0.005 + this.time * 0.002) * 10;
            this.ctx.lineTo(x, y);
        }

        this.ctx.strokeStyle = 'rgba(0, 217, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    animate() {
        this.time += 16; // Approximate 60fps
        const beatPulse = this.getBeatPulse();

        // Clear canvas with slight trail for motion blur
        this.ctx.fillStyle = 'rgba(10, 14, 39, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw base waveform
        this.drawWaveformBase();

        // Draw connections between particles
        this.drawConnections();

        // Update and draw particles
        this.particles.forEach(particle => {
            particle.update(this.time, beatPulse);
            particle.draw(this.ctx, this.time);
        });

        // Draw beat indicator in corner
        if (beatPulse > 0.5) {
            this.ctx.beginPath();
            this.ctx.arc(50, 50, 20 + beatPulse * 10, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 217, 255, ${beatPulse * 0.5})`;
            this.ctx.fill();
        }

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WaveformParticleSystem('particle-canvas');
});

// Optional: React to Reveal.js slide changes
if (typeof Reveal !== 'undefined') {
    Reveal.on('slidechanged', event => {
        // Could adjust BPM or effect intensity based on slide
        console.log('Slide changed:', event.indexh);
    });
}
