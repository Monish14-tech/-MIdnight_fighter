import { Projectile } from './projectile.js';
import { Explosion } from './particle.js';

export class Enemy {
    constructor(game, type = 'chaser') {
        this.game = game;
        this.type = type;
        this.markedForDeletion = false;

        // Spawn at edges
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? -50 : this.game.width + 50;
            this.y = Math.random() * this.game.height;
        } else {
            this.x = Math.random() * this.game.width;
            this.y = Math.random() < 0.5 ? -50 : this.game.height + 50;
        }

        this.angle = 0;
        this.speed = 0;
        this.radius = 15;
        this.color = '#ff0000';
        this.points = 100;

        // Difficulty Scaling
        const difficulty = this.game.difficultyMultiplier || 1;
        const level = this.game.currentLevel || 1;

        // Slight speed increase per difficulty level (10% per difficulty multiplier)
        const speedMultiplier = 1 + (difficulty - 1) * 0.1;

        // HP Scaling: +1 HP every 5 levels
        const hpBonus = Math.floor((level - 1) / 5);

        if (this.type === 'chaser') {
            this.speed = (150 + Math.random() * 50) * speedMultiplier;
            this.color = '#ff3333'; // Neon Red
            this.radius = 12;
            this.points = 100;
            this.health = 1 + hpBonus; // Was 3
        } else if (this.type === 'heavy') {
            this.speed = 80 * speedMultiplier;
            this.color = '#ffaa00'; // Neon Orange
            this.radius = 25;
            this.points = 300;
            this.health = 5 + hpBonus; // Was 10. 5 allows for ~2-3 hits with stronger weapons or 5 with basic.
        } else if (this.type === 'shooter') {
            this.speed = 100 * speedMultiplier;
            this.color = '#ff00ff'; // Neon Pink
            this.radius = 15;
            this.points = 200;
            this.health = 2 + hpBonus; // Was 2
            this.shootTimer = 0;
        }
    }

    update(deltaTime) {
        if (!this.game.player) return;

        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        this.angle = Math.atan2(dy, dx);

        // Apply slow motion if player has the power-up
        let effectiveSpeed = this.speed;
        if (this.game.player.slowMotionTimer > 0) {
            effectiveSpeed *= 0.5;
        }

        // Simple movement towards player
        this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
        this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;

        // Shooter Logic
        if (this.type === 'shooter') {
            this.shootTimer += deltaTime;
            if (this.shootTimer > 2.0) {
                this.shootTimer = 0;
                // Add spread to reduce accuracy
                const spread = (Math.random() - 0.5) * 0.5; // +/- 0.25 radians (~14 degrees)
                this.game.projectiles.push(new Projectile(this.game, this.x, this.y, this.angle + spread, 'bullet', 'enemy'));
            }
        }

        // Cleanup if way off screen
        if (this.x < -200 || this.x > this.game.width + 200 ||
            this.y < -200 || this.y > this.game.height + 200) {
            this.markedForDeletion = true;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            return true; // Dead
        }
        return false; // Alive
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Enhanced shadow and glow based on type
        if (this.type === 'heavy') {
            ctx.shadowBlur = 30;
            ctx.shadowColor = this.color;
        } else if (this.type === 'shooter') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
        }

        // Slow motion visual effect
        if (this.game.player && this.game.player.slowMotionTimer > 0) {
            ctx.globalAlpha = 0.7;
            ctx.shadowColor = '#ff00ff';
        }

        ctx.fillStyle = this.color;

        // 3D Realistic Sprite Rendering
        const sprite = this.game.assets.get('enemy_' + this.type);
        if (sprite) {
            const size = this.radius * 4;
            ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        } else {
            // Existing Vector Rendering Logic
            if (this.type === 'chaser') {
                // Predator Drone Style - Sleek and sharp
                const grad = ctx.createLinearGradient(18, 0, -14, 0);
                grad.addColorStop(0, '#fff'); // Nose
                grad.addColorStop(0.5, this.color);
                grad.addColorStop(1, '#300'); // Tail

                ctx.fillStyle = grad;
                // Fuselage
                ctx.beginPath();
                ctx.moveTo(18, 0);
                ctx.lineTo(8, 3);
                ctx.lineTo(-10, 3);
                ctx.lineTo(-14, 0);
                ctx.lineTo(-10, -3);
                ctx.lineTo(8, -3);
                ctx.closePath();
                ctx.fill();
                // Stroke for detail
                ctx.strokeStyle = 'rgba(255,0,0,0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Wings (Forward swept)
                ctx.beginPath();
                ctx.moveTo(2, 3);
                ctx.lineTo(-5, 12);
                ctx.lineTo(-10, 10);
                ctx.lineTo(-4, 3);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(2, -3);
                ctx.lineTo(-5, -12);
                ctx.lineTo(-10, -10);
                ctx.lineTo(-4, -3);
                ctx.closePath();
                ctx.fill();

                // Sensor/Cockpit
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(10, 0, 4, 1.5, 0, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'heavy') {
                // Stealth Bomber Style - Wing-only triangle
                const heavyGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
                heavyGrad.addColorStop(0, this.color);
                heavyGrad.addColorStop(1, '#420'); // Dark edges

                ctx.fillStyle = heavyGrad;
                ctx.beginPath();
                ctx.moveTo(20, 0);   // Nose
                ctx.lineTo(-15, 25); // Top wing tip
                ctx.lineTo(-10, 8);  // Engine indent
                ctx.lineTo(-15, 0);  // Rear center
                ctx.lineTo(-10, -8); // Engine indent
                ctx.lineTo(-15, -25);// Bottom wing tip
                ctx.closePath();
                ctx.fill();

                // Panel lines
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(-15, 25);
                ctx.moveTo(0, 0); ctx.lineTo(-15, -25);
                ctx.stroke();

                // Intakes
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(0, 8, 5, 2, 0, 0, Math.PI * 2);
                ctx.ellipse(0, -8, 5, 2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Glow panels
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.rect(-10, 15, 2, 4);
                ctx.rect(-10, -19, 2, 4);
                ctx.fill();
                ctx.globalAlpha = 1.0;

            } else if (this.type === 'shooter') {
                // Interceptor Style - X-wing or twin tail
                ctx.fillStyle = this.color;
                // Central body
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(5, 5);
                ctx.lineTo(-15, 5);
                ctx.lineTo(-15, -5);
                ctx.lineTo(5, -5);
                ctx.closePath();
                ctx.fill();

                // Twin hulls/engines
                ctx.beginPath();
                ctx.rect(-10, 5, 12, 3);
                ctx.rect(-10, -8, 12, 3);
                ctx.fill();

                // Angled wings
                ctx.beginPath();
                ctx.moveTo(0, 8);
                ctx.lineTo(10, 20);
                ctx.lineTo(2, 22);
                ctx.lineTo(-8, 8);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(10, -20);
                ctx.lineTo(2, -22);
                ctx.lineTo(-8, -8);
                ctx.closePath();
                ctx.fill();

                // Cockpit
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(12, 0, 5, 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
