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

export class FloatingText {
    constructor(game, x, y, text, color = '#ffffff') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.markedForDeletion = false;
        this.life = 1.5; // 1.5 seconds default life
        this.maxLife = this.life;
        this.vy = -30; // Float upwards
    }

    update(deltaTime) {
        this.y += this.vy * deltaTime;
        this.life -= deltaTime;
        if (this.life <= 0) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;

        // Scale up then down effect
        let scale = 1;
        if (this.life > this.maxLife - 0.2) {
            scale = 1 + ((this.maxLife - this.life) / 0.2) * 0.5; // Pop in
        } else if (this.life < 0.5) {
            scale = this.life / 0.5; // Fade out
        }

        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);

        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, 0, 0);

        ctx.fillText(this.text, 0, 0);

        ctx.restore();
    }
}

export class PhoenixRebirth {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.timer = 0;
        this.duration = 1.5;
        this.markedForDeletion = false;

        // Spawn initial burst of sparks
        for (let i = 0; i < 40; i++) {
            const p = new Particle(game, x, y, '#ffa500', 'spark');
            p.speedX *= 3;
            p.speedY *= 3;
            p.life = 1.5;
            this.game.particles.push(p);
        }
    }

    update(deltaTime) {
        this.timer += deltaTime;
        if (this.timer >= this.duration) this.markedForDeletion = true;

        // Continuous fire particles during the effect
        if (Math.random() < 0.5) {
            const p = new Particle(this.game, this.x, this.y, '#ff4500', 'default');
            p.speedY = -150 - Math.random() * 100; // Rise up
            this.game.particles.push(p);
        }
    }

    draw(ctx) {
        ctx.save();
        const progress = this.timer / this.duration;
        const radius = progress * 250;
        const alpha = 1 - progress;

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ffa500';
        ctx.lineWidth = 4 + (1 - progress) * 10;
        ctx.shadowBlur = 40 * (1 - progress);
        ctx.shadowColor = '#ff4500';

        // Expanding Solar Ring
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Core Glow
        const coreRadius = (1 - progress) * 60;
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, coreRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#ffff00');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
