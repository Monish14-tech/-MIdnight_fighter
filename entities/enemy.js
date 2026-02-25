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
        } else if (this.type === 'swarm') {
            this.speed = 220 * speedMultiplier;
            this.color = '#ff7a6b';
            this.radius = 9;
            this.points = 80;
            this.health = 1;
        } else if (this.type === 'sniper') {
            this.speed = 120 * speedMultiplier;
            this.color = '#6bd6ff';
            this.radius = 14;
            this.points = 250;
            this.health = 2 + hpBonus;
            this.shootTimer = 0;
            this.preferredRange = 260;
        } else if (this.type === 'splitter') {
            this.speed = 140 * speedMultiplier;
            this.color = '#a97bff';
            this.radius = 18;
            this.points = 220;
            this.health = 3 + hpBonus;
            this.splitOnDeath = true;
            this.splitCount = 2;
            this.splitType = 'swarm';
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

        // Movement behaviors
        if (this.type === 'sniper') {
            const dist = Math.hypot(dx, dy);
            let moveAngle = this.angle;
            if (dist < this.preferredRange - 40) {
                moveAngle = this.angle + Math.PI; // Back away
            } else if (dist > this.preferredRange + 60) {
                moveAngle = this.angle; // Move in
            } else {
                moveAngle = this.angle + Math.PI / 2 * (Math.sin(this.game.lastTime * 0.001) > 0 ? 1 : -1);
            }
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;
        } else {
            // Simple movement towards player
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
        }

        // Shooter Logic
        if (this.type === 'shooter') {
            this.shootTimer += deltaTime;
            if (this.shootTimer > 2.0) {
                this.shootTimer = 0;
                // Add spread to reduce accuracy
                const spread = (Math.random() - 0.5) * 0.5; // +/- 0.25 radians (~14 degrees)
                this.game.projectiles.push(new Projectile(this.game, this.x, this.y, this.angle + spread, 'bullet', 'enemy'));
            }
        } else if (this.type === 'sniper') {
            this.shootTimer += deltaTime;
            if (this.shootTimer > 2.8) {
                this.shootTimer = 0;
                const spread = (Math.random() - 0.5) * 0.2;
                const shot = new Projectile(this.game, this.x, this.y, this.angle + spread, 'bullet', 'enemy');
                shot.speed = 700;
                shot.damage = 2;
                shot.color = '#6bd6ff';
                this.game.projectiles.push(shot);
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
        } else if (this.type === 'sniper') {
            ctx.shadowBlur = 22;
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
                // Manta Blade - wide predator sweep
                const grad = ctx.createLinearGradient(20, 0, -20, 0);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.5, this.color);
                grad.addColorStop(1, '#220000');
                ctx.fillStyle = grad;

                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(8, 6);
                ctx.lineTo(-12, 12);
                ctx.lineTo(-20, 6);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-20, -6);
                ctx.lineTo(-12, -12);
                ctx.lineTo(8, -6);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,80,80,0.6)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Eye slit
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(10, 0, 5, 1.8, 0, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'heavy') {
                // Fortress Hex - armored core
                const heavyGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 26);
                heavyGrad.addColorStop(0, this.color);
                heavyGrad.addColorStop(1, '#3a1400');
                ctx.fillStyle = heavyGrad;

                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    const rx = Math.cos(angle) * 22;
                    const ry = Math.sin(angle) * 22;
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Side armor fins
                ctx.fillStyle = '#662200';
                ctx.fillRect(-28, 10, 10, 6);
                ctx.fillRect(-28, -16, 10, 6);
                // Core hatch
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(-6, -4, 12, 8);

            } else if (this.type === 'shooter') {
                // Tri-wing Striker
                const shooterGrad = ctx.createLinearGradient(-10, 0, 20, 0);
                shooterGrad.addColorStop(0, '#330033');
                shooterGrad.addColorStop(0.5, this.color);
                shooterGrad.addColorStop(1, '#ffccff');
                ctx.fillStyle = shooterGrad;

                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(6, 6);
                ctx.lineTo(-12, 4);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-12, -4);
                ctx.lineTo(6, -6);
                ctx.closePath();
                ctx.fill();

                // Upper and lower wings
                ctx.beginPath();
                ctx.moveTo(4, 6);
                ctx.lineTo(10, 18);
                ctx.lineTo(0, 16);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(4, -6);
                ctx.lineTo(10, -18);
                ctx.lineTo(0, -16);
                ctx.closePath();
                ctx.fill();

                // Cockpit node
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(12, 0, 3, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'swarm') {
                // Needle Drone
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(18, 0);
                ctx.lineTo(6, 3);
                ctx.lineTo(-12, 0);
                ctx.lineTo(6, -3);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(10, 0, 1.8, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'sniper') {
                // Rail Lance
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(26, 0);
                ctx.lineTo(8, 5);
                ctx.lineTo(-14, 3);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-14, -3);
                ctx.lineTo(8, -5);
                ctx.closePath();
                ctx.fill();

                // Barrel rail
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(16, 0);
                ctx.lineTo(-10, 0);
                ctx.stroke();

            } else if (this.type === 'splitter') {
                // Crystal Splitter
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(16, 0);
                ctx.lineTo(6, 10);
                ctx.lineTo(-10, 6);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-10, -6);
                ctx.lineTo(6, -10);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.arc(2, 0, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
