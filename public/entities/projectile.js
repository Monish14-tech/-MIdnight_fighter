export class Projectile {
    constructor(game, x, y, angle, type = 'bullet', side = 'player') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.type = type;
        this.side = side;
        this.markedForDeletion = false;

        this.speed = 1000; // Default bullet speed
        this.damage = 1;
        this.radius = 4;
        this.color = '#ffff00'; // Yellow

        if (this.type === 'missile') {
            this.speed = 400; // Start slower, accelerate
            this.maxSpeed = 1200;
            this.acceleration = 800;
            this.damage = 5;
            this.radius = 8;
            this.color = '#ff4400'; // Orange-Red
            this.homingRange = 5000; // Basically infinite
            this.target = null;
        }

        this.isHoming = (this.type === 'missile'); // Default homing for missiles
        this.piercing = false;
        this.explosive = false;
    }

    update(deltaTime) {
        // Track age for lifetime-limited projectiles
        if (this.lifetime !== undefined) {
            this.age = (this.age || 0) + deltaTime;
            if (this.age >= this.lifetime) {
                this.markedForDeletion = true;
                return;
            }
        }

        if (this.type === 'missile' && this.speed < this.maxSpeed) {
            this.speed += this.acceleration * deltaTime;
        }

        if (this.isHoming) {
            // Homing Logic
            if (!this.target || this.target.markedForDeletion) {
                this.findTarget();
            }

            if (this.target) {
                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const targetAngle = Math.atan2(dy, dx);

                // Smooth turning
                const turnSpeed = 10.0 * deltaTime;
                let angleDiff = targetAngle - this.angle;

                // Normalize angle
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                if (Math.abs(angleDiff) < turnSpeed) {
                    this.angle = targetAngle;
                } else {
                    this.angle += Math.sign(angleDiff) * turnSpeed;
                }
            }
        }

        this.x += Math.cos(this.angle) * this.speed * deltaTime;
        this.y += Math.sin(this.angle) * this.speed * deltaTime;

        // Cleanup
        if (this.x < 0 || this.x > this.game.width ||
            this.y < 0 || this.y > this.game.height) {
            this.markedForDeletion = true;
        }
    }

    findTarget() {
        let closestDist = this.homingRange;
        this.target = null;

        if (this.side === 'player' || this.side === 'player1' || this.side === 'player2') {
            // Player missiles target enemies and boss
            this.game.enemies.forEach(enemy => {
                if (enemy.markedForDeletion) return;
                const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    this.target = enemy;
                }
            });
            if (this.game.boss && !this.game.boss.markedForDeletion) {
                const dist = Math.hypot(this.game.boss.x - this.x, this.game.boss.y - this.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    this.target = this.game.boss;
                }
            }
        } else {
            // Enemy missiles target player
            const players = this.game.getPlayers ? this.game.getPlayers() : [this.game.player].filter(Boolean);
            players.forEach(player => {
                if (!player || player.markedForDeletion) return;
                const dist = Math.hypot(player.x - this.x, player.y - this.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    this.target = player;
                }
            });
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;

        if (this.type === 'bullet') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.beginPath();

            if (this.speed > 2000) { // Railgun / High speed
                ctx.rect(-15, -1, 30, 2);
            } else if (this.explosive) {
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            } else {
                ctx.rect(-6, -2, 12, 4);
            }
            ctx.fill();
        } else if (this.type === 'missile') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;

            // Missile Body
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-6, 4);
            ctx.lineTo(-6, -4);
            ctx.closePath();
            ctx.fill();

            // Thruster effect
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-8, 0, 3 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();

            // Smoke trail (optional visual, maybe too expensive here, handled by particles elsewhere?)
        }

        ctx.restore();
    }
}
