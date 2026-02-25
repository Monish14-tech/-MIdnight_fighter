export class Particle {
    constructor(game, x, y, color, type = 'default') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 200 - 100;
        this.speedY = Math.random() * 200 - 100;
        this.life = 1.0; // Seconds
        this.decay = Math.random() * 1.5 + 0.5;
        this.markedForDeletion = false;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 5;
    }

    update(deltaTime) {
        this.x += this.speedX * deltaTime;
        this.y += this.speedY * deltaTime;
        this.life -= this.decay * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;

        // Slow down particles over time
        this.speedX *= 0.98;
        this.speedY *= 0.98;

        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // shadowBlur is removed from individual particles for performance
        // If needed, we can draw a single large glow for the whole Explosion
        ctx.fillStyle = this.color;

        if (this.type === 'spark') {
            ctx.fillRect(-this.size * 2, -this.size * 0.5, this.size * 4, this.size);
        } else if (this.type === 'smoke') {
            const smokeSize = this.size * (2 - this.life);
            ctx.beginPath();
            ctx.arc(0, 0, smokeSize, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

export class Explosion {
    constructor(game, x, y, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.color = color;
        this.particles = [];
        this.markedForDeletion = false;

        // Create varied particle types
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(game, x, y, color, 'default'));
        }
        for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(game, x, y, color, 'spark'));
        }
        for (let i = 0; i < 5; i++) {
            const smokeColor = 'rgba(100, 100, 100, 0.5)';
            this.particles.push(new Particle(game, x, y, smokeColor, 'smoke'));
        }
    }

    update(deltaTime) {
        this.particles.forEach(p => p.update(deltaTime));
        this.particles = this.particles.filter(p => !p.markedForDeletion);
        if (this.particles.length === 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        // Draw one big glow for the entire explosion instead of per-particle
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.color;
        this.particles.forEach(p => p.draw(ctx));
        ctx.restore();
    }
}

// Afterburner trail for jets
export class AfterburnerTrail {
    constructor(game, x, y, angle, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.life = 0.3;
        this.maxLife = 0.3;
        this.markedForDeletion = false;
        this.size = 8;
    }

    update(deltaTime) {
        this.life -= deltaTime;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Create gradient for flame effect
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        // Moderate shadowBlur for trail
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
