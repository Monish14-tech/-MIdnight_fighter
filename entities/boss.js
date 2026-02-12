import { Projectile } from './projectile.js';

export class Boss {
    constructor(game, level) {
        this.game = game;
        this.level = level;
        this.type = 'boss';
        this.markedForDeletion = false;

        // Stats scale with level - Increased for better challenge
        const levelScale = level / 5;
        this.maxHealth = Math.floor(50 * levelScale); // approx 50 HP at level 5
        this.health = this.maxHealth;
        this.points = 1000 * levelScale;

        // Position: Start off-screen and enter
        this.x = game.width / 2;
        this.y = -200;
        this.targetY = 150;

        this.radius = 65;
        this.color = level % 10 === 0 ? '#ff00ff' : '#ff3300';

        this.angle = Math.PI / 2;
        this.velocity = { x: 0, y: 0 };
        this.speed = 120 + (levelScale * 15); // Slightly slower for fair play

        this.shootTimer = 0;
        this.missileTimer = 0;
        this.specialTimer = 0;
        this.fireRate = Math.max(0.5, 1.6 - (levelScale * 0.1));
        this.missileRate = 8.0; // Greatly increased from 4.5 for slower missile firing
        this.specialRate = 6.0;

        this.state = 'entering';
        this.phase = 1;

        // Skill set based on level
        this.skills = this.getSkillsForLevel(level);

        this.targetPoint = { x: game.width / 2, y: this.targetY };
        this.moveTimer = 0;
        this.moveChangeRate = 2.5;

        // Visual properties
        this.rotationZ = 0;
        this.tilt = 0;
    }

    getSkillsForLevel(level) {
        if (level <= 5) return ['rapid_burst'];
        if (level <= 10) return ['rapid_burst', 'shield_pulse'];
        return ['rapid_burst', 'shield_pulse', 'homing_swarm'];
    }

    update(deltaTime) {
        if (this.state === 'entering') {
            this.y += (this.targetY - this.y) * deltaTime * 2;
            if (Math.abs(this.y - this.targetY) < 1) {
                this.state = 'active';
            }
            return;
        }

        if (this.game.gameOver) return;

        // Skill Logic
        this.specialTimer += deltaTime;
        if (this.specialTimer > this.specialRate) {
            this.useSpecialSkill();
            this.specialTimer = 0;
        }

        // Movement AI: More deliberate movement
        this.moveTimer += deltaTime;
        if (this.moveTimer > this.moveChangeRate) {
            this.moveTimer = 0;
            const chance = Math.random();
            if (chance < 0.6 && this.game.player) {
                this.targetPoint = {
                    x: this.game.player.x + (Math.random() - 0.5) * 300,
                    y: Math.min(this.game.height * 0.4, this.game.player.y + (Math.random() - 0.5) * 200)
                };
            } else {
                this.targetPoint = {
                    x: this.radius + Math.random() * (this.game.width - this.radius * 2),
                    y: 100 + Math.random() * (this.game.height * 0.3)
                };
            }
        }

        const dx = this.targetPoint.x - this.x;
        const dy = this.targetPoint.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
            const moveSpeed = this.speed * (this.phase === 2 ? 1.3 : 1.0);
            this.x += (dx / dist) * moveSpeed * deltaTime;
            this.y += (dy / dist) * moveSpeed * deltaTime;
            // Visual tilt
            this.tilt = (dx / dist) * 0.3;
        } else {
            this.tilt *= 0.9;
        }

        // Face player - Smoother rotation for fair play
        if (this.game.player) {
            const pdx = this.game.player.x - this.x;
            const pdy = this.game.player.y - this.y;
            const targetAngle = Math.atan2(pdy, pdx);

            let diff = targetAngle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += diff * deltaTime * (this.phase === 2 ? 3 : 2);
        }

        // Shooting
        this.shootTimer += deltaTime;
        if (this.shootTimer > this.fireRate) {
            this.shoot('bullet');
            this.shootTimer = 0;
        }

        this.missileTimer += deltaTime;
        if (this.missileTimer > this.missileRate) {
            this.shoot('missile');
            this.missileTimer = 0;
        }

        // Shield Pulse Effect
        if (this.isInvulnerable) {
            this.invulnerableTime -= deltaTime;
            if (this.invulnerableTime <= 0) this.isInvulnerable = false;
        }

        // Phase Transition
        if (this.phase === 1 && this.health < this.maxHealth * 0.5) {
            this.phase = 2;
            this.fireRate *= 0.7;
            if (this.game.screenShake) this.game.screenShake.trigger(30, 0.5);
        }
    }

    useSpecialSkill() {
        const skill = this.skills[Math.floor(Math.random() * this.skills.length)];
        switch (skill) {
            case 'shield_pulse':
                this.isInvulnerable = true;
                this.invulnerableTime = 2.0;
                break;
            case 'homing_swarm':
                this.shootHomingSwarm();
                break;
            case 'rapid_burst':
                this.shootRapidBurst();
                break;
        }
    }

    shootHomingSwarm() {
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const p = new Projectile(this.game, this.x, this.y, angle, 'bullet', 'enemy');
            p.speed = 150;
            p.isHoming = true;
            this.game.projectiles.push(p);
        }
    }

    shootRapidBurst() {
        let count = 0;
        const interval = setInterval(() => {
            if (this.markedForDeletion || count > 10) {
                clearInterval(interval);
                return;
            }
            this.shoot('bullet');
            count++;
        }, 100);
    }

    shoot(type) {
        if (!this.game.player || this.game.gameOver) return;

        if (type === 'bullet') {
            const angles = this.phase === 2 ? [-0.2, 0, 0.2] : [0];
            angles.forEach(offset => {
                const p = new Projectile(this.game, this.x, this.y, this.angle + offset, 'bullet', 'enemy');
                p.speed = 300 + (this.level * 2);
                this.game.projectiles.push(p);
            });
        } else if (type === 'missile') {
            const offsets = [-50, 50];
            offsets.forEach(off => {
                const missileX = this.x + Math.cos(this.angle + Math.PI / 2) * off;
                const missileY = this.y + Math.sin(this.angle + Math.PI / 2) * off;
                // Add random spread for reduced accuracy (±15 degrees)
                const spread = (Math.random() - 0.5) * 0.5;
                const p = new Projectile(this.game, missileX, missileY, this.angle + spread, 'missile', 'enemy');
                p.damage = 1; // Further reduced to 1 for fair play
                // Make boss missiles much slower and easier to dodge
                p.speed = 100; // Greatly reduced starting speed (was 200)
                p.maxSpeed = 250; // Greatly reduced max speed (was 500)
                p.acceleration = 150; // Greatly reduced acceleration (was 300)
                p.lifetime = 4.0; // Increased to 4 seconds per user request
                p.age = 0; // Track age
                this.game.projectiles.push(p);
            });
        }
    }

    takeDamage(amount) {
        if (this.isInvulnerable) return false;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Core Glow
        ctx.shadowBlur = this.phase === 2 ? 60 : 40;
        ctx.shadowColor = this.color;

        if (this.isInvulnerable) {
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 80;
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#00f3ff';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.drawModel(ctx);

        ctx.restore();
    }

    drawModel(ctx) {
        ctx.save();
        // Add tilt effect
        ctx.rotate(this.tilt);

        const levelGroup = Math.floor(this.level / 5);
        if (levelGroup % 2 === 1) this.drawModelHeavy(ctx);
        else this.drawModelSleek(ctx);

        // Cockpit
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(30, 0, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Engine Detail
        const engineGlow = ctx.createRadialGradient(-60, 0, 5, -60, 0, 30);
        engineGlow.addColorStop(0, '#fff');
        engineGlow.addColorStop(0.5, this.color);
        engineGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = engineGlow;
        ctx.beginPath();
        ctx.arc(-60, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawModelSleek(ctx) {
        const grad = ctx.createLinearGradient(-80, 0, 80, 0);
        grad.addColorStop(0, '#111');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, '#fff');
        ctx.fillStyle = grad;

        // Main Fuselage
        ctx.beginPath();
        ctx.moveTo(90, 0);   // Nose
        ctx.lineTo(40, 30);  // Cockpit area
        ctx.lineTo(-20, 40); // Wing joint
        ctx.lineTo(-10, 110); // Wing tip
        ctx.lineTo(-40, 40);  // Back wing
        ctx.lineTo(-100, 30); // Tail fin
        ctx.lineTo(-80, 0);   // Rear
        ctx.lineTo(-100, -30);
        ctx.lineTo(-40, -40);
        ctx.lineTo(-10, -110);
        ctx.lineTo(-20, -40);
        ctx.lineTo(40, -30);
        ctx.closePath();
        ctx.fill();

        // Panel Lines
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, 25); ctx.lineTo(20, -25);
        ctx.moveTo(-20, 35); ctx.lineTo(-20, -35);
        ctx.stroke();
    }

    drawModelHeavy(ctx) {
        const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, 100);
        grad.addColorStop(0, this.color);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;

        // Massive Delta Wing / Tank Jet
        ctx.beginPath();
        ctx.moveTo(100, 0);    // Pointy Nose
        ctx.lineTo(20, 60);    // Front wing
        ctx.lineTo(-30, 120);  // Wing tip
        ctx.lineTo(-50, 40);   // Main body
        ctx.lineTo(-120, 40);  // Rocket pods
        ctx.lineTo(-120, -40);
        ctx.lineTo(-50, -40);
        ctx.lineTo(-30, -120);
        ctx.lineTo(20, -60);
        ctx.closePath();
        ctx.fill();

        // Armor Plating Detail
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(-20, -30, 40, 60);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 3;
        ctx.strokeRect(-20, -30, 40, 60);
    }
}
