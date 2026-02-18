// ========================================
// CONSCIOUS CODER PARTICLE SYSTEM
// Data streams meeting plant growth patterns
// Tech-consciousness fusion visualization
// ========================================

(function() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    let dataStreams = [];
    let plantNodes = [];

    // Tech-consciousness color palette
    const techColors = [
        'rgba(0, 255, 65, 0.6)',      // Circuit green
        'rgba(0, 217, 255, 0.5)',     // Electric cyan
        'rgba(76, 175, 80, 0.5)',     // Growth green
    ];

    const dataStreamColor = 'rgba(0, 255, 65, 0.8)';
    const plantColor = 'rgba(76, 175, 80, 0.7)';

    // Configuration
    const config = {
        particleCount: 100,
        maxSpeed: 0.5,              // Faster than earth workshop, slower than art workshop
        connectionDistance: 150,
        baseAlpha: 0.6,
        dataStreamChance: 0.003,    // Vertical data streams
        plantGrowthChance: 0.002,   // Organic growth bursts
        streamDuration: 180,
        pulseSpeed: 0.001
    };

    // Particle class
    class Particle {
        constructor(x, y, type = 'normal') {
            this.x = x || Math.random() * width;
            this.y = y || Math.random() * height;
            this.vx = (Math.random() - 0.5) * config.maxSpeed;
            this.vy = (Math.random() - 0.5) * config.maxSpeed;
            this.radius = 2 + Math.random() * 2;
            this.color = techColors[Math.floor(Math.random() * techColors.length)];
            this.alpha = config.baseAlpha;
            this.type = type;
            this.pulseOffset = Math.random() * Math.PI * 2;
        }

        update(time) {
            // Movement
            this.x += this.vx;
            this.y += this.vy;

            // Wrap edges
            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;

            // Pulse effect
            const pulseScale = 1 + Math.sin(time * config.pulseSpeed + this.pulseOffset) * 0.2;
            this.currentRadius = this.radius * pulseScale;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius || this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Glow effect
            ctx.globalAlpha = this.alpha * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, (this.currentRadius || this.radius) * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Data Stream class - vertical falling code/data
    class DataStream {
        constructor(x) {
            this.x = x;
            this.y = -50;
            this.speed = 3 + Math.random() * 4;
            this.length = 40 + Math.random() * 80;
            this.life = config.streamDuration;
            this.maxLife = this.life;
            this.chars = this.generateChars();
        }

        generateChars() {
            const chars = '01';  // Binary for data stream
            const numChars = Math.floor(this.length / 20);
            return Array.from({length: numChars}, () => chars[Math.floor(Math.random() * chars.length)]);
        }

        update() {
            this.y += this.speed;
            this.life--;
        }

        draw() {
            ctx.save();
            const alpha = this.life / this.maxLife;
            ctx.globalAlpha = alpha * 0.8;

            // Draw trail
            const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.length);
            gradient.addColorStop(0, dataStreamColor);
            gradient.addColorStop(1, 'rgba(0, 255, 65, 0)');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.y + this.length);
            ctx.stroke();

            // Draw binary characters along stream
            ctx.fillStyle = dataStreamColor;
            ctx.font = '12px monospace';
            ctx.globalAlpha = alpha;
            this.chars.forEach((char, i) => {
                const charY = this.y + (i * 20);
                ctx.fillText(char, this.x - 5, charY);
            });

            ctx.restore();
        }
    }

    // Plant Node class - organic growth bursts
    class PlantNode {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.branches = [];
            this.life = config.streamDuration;
            this.maxLife = this.life;
            this.angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; // Mostly upward
            this.length = 30 + Math.random() * 50;
            this.createBranches();
        }

        createBranches() {
            const numBranches = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numBranches; i++) {
                const branchAngle = this.angle + (Math.random() - 0.5) * Math.PI / 3;
                const branchLength = this.length * (0.5 + Math.random() * 0.5);
                this.branches.push({
                    angle: branchAngle,
                    length: branchLength,
                    growth: 0,
                    maxGrowth: branchLength
                });
            }
        }

        update() {
            this.life--;
            // Grow branches
            this.branches.forEach(branch => {
                if (branch.growth < branch.maxGrowth) {
                    branch.growth += 2;
                }
            });
        }

        draw() {
            ctx.save();
            const alpha = this.life / this.maxLife;
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = plantColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            // Draw main stem
            const endX = this.x + Math.cos(this.angle) * this.length;
            const endY = this.y + Math.sin(this.angle) * this.length;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Draw branches
            this.branches.forEach(branch => {
                const branchEndX = endX + Math.cos(branch.angle) * branch.growth;
                const branchEndY = endY + Math.sin(branch.angle) * branch.growth;

                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(branchEndX, branchEndY);
                ctx.stroke();

                // Draw node at end of branch
                if (branch.growth >= branch.maxGrowth) {
                    ctx.fillStyle = plantColor;
                    ctx.beginPath();
                    ctx.arc(branchEndX, branchEndY, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

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

    // Draw connections between nearby particles (tech mesh)
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < config.connectionDistance) {
                    const opacity = (1 - distance / config.connectionDistance) * 0.4;
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.strokeStyle = '#00ff41'; // Circuit green
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

    // Create data stream
    function createDataStream() {
        const x = Math.random() * width;
        dataStreams.push(new DataStream(x));
    }

    // Create plant growth burst
    function createPlantGrowth(x, y) {
        plantNodes.push(new PlantNode(x, y));
    }

    // Animation loop
    let startTime = Date.now();
    function animate() {
        const currentTime = Date.now() - startTime;

        // Clear canvas with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0e0d');
        gradient.addColorStop(1, '#0d1117');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Update and draw particles
        particles.forEach(p => {
            p.update(currentTime);
            p.draw();
        });

        // Draw connections (tech mesh)
        drawConnections();

        // Update and draw data streams
        dataStreams = dataStreams.filter(s => s.life > 0 && s.y < height + 200);
        dataStreams.forEach(s => {
            s.update();
            s.draw();
        });

        // Update and draw plant nodes
        plantNodes = plantNodes.filter(n => n.life > 0);
        plantNodes.forEach(n => {
            n.update();
            n.draw();
        });

        // Randomly create data streams
        if (Math.random() < config.dataStreamChance) {
            createDataStream();
        }

        // Randomly create plant growth
        if (Math.random() < config.plantGrowthChance) {
            const x = Math.random() * width;
            const y = height - 50 - Math.random() * 100; // Near bottom
            createPlantGrowth(x, y);
        }

        requestAnimationFrame(animate);
    }

    // Initialize
    resize();
    window.addEventListener('resize', resize);
    animate();

    // Click to create both data stream and plant growth
    canvas.addEventListener('click', (e) => {
        // Data stream from click point
        dataStreams.push(new DataStream(e.clientX));

        // Plant growth from click point
        createPlantGrowth(e.clientX, e.clientY);
    });

    // Respond to slide changes
    Reveal.on('slidechanged', event => {
        // Create data stream from random position
        createDataStream();

        // Create plant growth near center
        const x = width / 2 + (Math.random() - 0.5) * 300;
        const y = height / 2 + (Math.random() - 0.5) * 200;
        createPlantGrowth(x, y);
    });

})();
