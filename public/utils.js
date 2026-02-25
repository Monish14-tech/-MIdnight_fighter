export class ScreenShake {
    constructor() {
        this.duration = 0;
        this.intensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    trigger(intensity, duration) {
        this.intensity = intensity;
        this.duration = duration;
    }

    update(deltaTime) {
        if (this.duration > 0) {
            this.duration -= deltaTime;
            this.offsetX = (Math.random() * 2 - 1) * this.intensity;
            this.offsetY = (Math.random() * 2 - 1) * this.intensity;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
        }
    }
}

export class Nebula {
    constructor(game) {
        this.game = game;
        this.reset();
    }
    reset() {
        this.x = Math.random() * this.game.width;
        this.y = Math.random() * this.game.height;
        this.size = 200 + Math.random() * 400;
        this.color = `hsla(${200 + Math.random() * 60}, 100%, 50%, 0.015)`; // Reduced from 0.03
        this.vx = (Math.random() - 0.5) * 5;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        this.x += this.vx;
        if (this.x < -this.size || this.x > this.game.width + this.size) this.reset();
    }
}

export class CosmicDust {
    constructor(game) {
        this.game = game;
        this.reset();
    }
    reset() {
        this.x = Math.random() * this.game.width;
        this.y = Math.random() * this.game.height;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = 20 + Math.random() * 30;
        this.size = Math.random() * 2;
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; // Reduced from 0.4
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        this.x += this.vx;
        this.y += this.vy;
        if (this.y > this.game.height) this.reset();
    }
}

export class Planet {
    constructor(game) {
        this.game = game;
        this.reset();
    }
    reset() {
        this.x = Math.random() * this.game.width;
        this.y = Math.random() * this.game.height;
        this.size = 50 + Math.random() * 150;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = 0.5 + Math.random() * 1.5;
        // Random planet colors - reduced opacity significantly
        const colors = [
            'rgba(100, 150, 255, 0.15)', // Blue - Reduced from 0.3
            'rgba(255, 150, 100, 0.15)', // Orange - Reduced from 0.3
            'rgba(150, 100, 255, 0.15)', // Purple - Reduced from 0.3
            'rgba(100, 255, 150, 0.15)', // Green - Reduced from 0.3
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    draw(ctx) {
        // Planet body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Planet rings (50% chance)
        if (this.size > 80 && Math.random() > 0.5) {
            ctx.strokeStyle = this.color.replace('0.3', '0.2');
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size * 1.5, this.size * 0.3, 0.3, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.x += this.vx;
        this.y += this.vy;
        if (this.y > this.game.height + this.size) this.reset();
    }
}

export class Asteroid {
    constructor(game) {
        this.game = game;
        this.reset();
    }
    reset() {
        this.x = Math.random() * this.game.width;
        this.y = -50;
        this.size = 10 + Math.random() * 30;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = 2 + Math.random() * 4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw irregular asteroid shape
        ctx.fillStyle = 'rgba(150, 150, 150, 0.2)'; // Reduced from 0.4
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = this.size * (0.7 + Math.random() * 0.3);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;

        if (this.y > this.game.height + this.size) this.reset();
    }
}
