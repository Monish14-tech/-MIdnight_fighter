import { Projectile } from './projectile.js';
import { Explosion } from './particle.js';

export class Boss {
    constructor(game, level, side = 'top') {
        this.game = game;
        this.level = level;
        this.side = side;
        this.type = 'boss';
        this.markedForDeletion = false;

        // Stats scale with level
        const levelScale = Math.max(1, level / 5);
        this.maxHealth = Math.floor(80 * levelScale);
        this.health = this.maxHealth;
        this.points = 2000 * levelScale;
        this.coinReward = Math.floor(500 * levelScale);

        // Initial Position logic
        this.targetPoint = { x: game.width / 2, y: 150 }; // Default fight pos

        if (this.side === 'left') {
            this.x = -200;
            this.y = game.height / 2;
            this.targetPoint = { x: 150, y: game.height / 2 };
        } else if (this.side === 'right') {
            this.x = game.width + 200;
            this.y = game.height / 2;
            this.targetPoint = { x: game.width - 150, y: game.height / 2 };
        } else { // top
            this.x = game.width / 2;
            this.y = -200;
            this.targetPoint = { x: game.width / 2, y: 150 };
        }

        this.radius = 65;
        this.color = level % 10 === 0 ? '#ff00ff' : '#ff3300';

        this.angle = Math.PI / 2;
        this.velocity = { x: 0, y: 0 };
        this.speed = 150 + (levelScale * 10);
        this.rotationSpeed = 2.0;

        // State Machine
        this.state = 'entering';
        this.stateTimer = 0;
        this.phase = 1;
        this.currentAttack = null;

        // Attack Patterns
        this.patterns = ['spiral', 'spread', 'rapid'];
        if (this.level >= 10) this.patterns.push('dash');

        // Visuals
        this.tilt = 0;
    }

    update(deltaTime) {
        if (this.game.gameOver) return;

        this.stateTimer += deltaTime;

        // Phase Transition
        if (this.phase === 1 && this.health < this.maxHealth * 0.5) {
            this.phase = 2;
            if (this.game.screenShake) this.game.screenShake.trigger(30, 0.5);
            // Push away effect and visual change
            this.game.particles.push(new Explosion(this.game, this.x, this.y, '#ffffff'));
            this.color = '#ff0000'; // Enrage color
        }

        switch (this.state) {
            case 'entering': this.handleEntering(deltaTime); break;
            case 'idle': this.handleIdle(deltaTime); break;
            case 'attacking': this.handleAttacking(deltaTime); break;
            case 'repositioning': this.handleRepositioning(deltaTime); break;
            case 'dashing': this.handleDashing(deltaTime); break;
        }

        // Always face player (unless dashing)
        if (this.state !== 'dashing' && this.game.player) {
            const dx = this.game.player.x - this.x;
            const dy = this.game.player.y - this.y;
            const targetAngle = Math.atan2(dy, dx);

            let diff = targetAngle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            // Limit rotation speed
            const rotStep = this.rotationSpeed * deltaTime;
            if (Math.abs(diff) < rotStep) this.angle = targetAngle;
            else this.angle += Math.sign(diff) * rotStep;
        }
    }

    handleEntering(deltaTime) {
        const dx = this.targetPoint.x - this.x;
        const dy = this.targetPoint.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            this.state = 'idle';
            this.stateTimer = 0;
            this.velocity = { x: 0, y: 0 };
        } else {
            this.x += (dx / dist) * this.speed * deltaTime;
            this.y += (dy / dist) * this.speed * deltaTime;
        }
    }

    handleIdle(deltaTime) {
        // Hover movement
        this.y += Math.sin(this.stateTimer * 3) * 0.5;

        // Visual wobble
        this.tilt = Math.sin(this.stateTimer * 2) * 0.1;

        if (this.stateTimer > 1.5) { // Idle duration
            this.state = 'attacking';
            this.stateTimer = 0;
            // Pick random attack
            this.currentAttack = this.patterns[Math.floor(Math.random() * this.patterns.length)];
            // Lower chance for dash
            if (this.currentAttack === 'dash' && Math.random() > 0.4) this.currentAttack = 'spread';
        }
    }

    handleAttacking(deltaTime) {
        switch (this.currentAttack) {
            case 'spiral': this.spiralShoot(deltaTime); break;
            case 'spread': this.spreadShoot(deltaTime); break;
            case 'rapid': this.rapidShoot(deltaTime); break;
            case 'dash':
                this.state = 'dashing';
                this.prepareDash();
                return; // Switch state immediately
        }

        // End attack after duration
        const attackDuration = this.currentAttack === 'spiral' ? 3.0 : 2.0;
        if (this.stateTimer > attackDuration) {
            this.state = 'repositioning';
            this.stateTimer = 0;
            this.pickNewPosition();
        }
    }

    pickNewPosition() {
        const margin = 100;
        this.targetPoint = {
            x: margin + Math.random() * (this.game.width - margin * 2),
            y: margin + Math.random() * (this.game.height * 0.5) // Top half
        };
    }

    handleRepositioning(deltaTime) {
        const dx = this.targetPoint.x - this.x;
        const dy = this.targetPoint.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Bank into turn
        this.tilt = (dx / dist) * 0.3;

        if (dist < 10) {
            this.state = 'idle';
            this.stateTimer = 0;
            this.tilt = 0;
        } else {
            const moveSpeed = this.speed * 1.5;
            this.x += (dx / dist) * moveSpeed * deltaTime;
            this.y += (dy / dist) * moveSpeed * deltaTime;
        }
    }

    prepareDash() {
        if (!this.game.player) return;
        this.dashTarget = { x: this.game.player.x, y: this.game.player.y };
        this.stateTimer = 0;
        // Warning flash
        this.game.particles.push(new Explosion(this.game, this.x, this.y, '#ff0000'));
    }

    handleDashing(deltaTime) {
        // 0.0 - 0.6s: Charge up (Shake and align)
        // 0.6s - 1.2s: Dash forward
        // > 1.2s: Cooldown / Exit

        if (this.stateTimer < 0.6) {
            // Shake
            this.x += (Math.random() - 0.5) * 8;
            this.y += (Math.random() - 0.5) * 8;

            // Lock angle
            const dx = this.dashTarget.x - this.x;
            const dy = this.dashTarget.y - this.y;
            this.angle = Math.atan2(dy, dx);

        } else if (this.stateTimer < 1.2) {
            const dashSpeed = 900;
            this.x += Math.cos(this.angle) * dashSpeed * deltaTime;
            this.y += Math.sin(this.angle) * dashSpeed * deltaTime;

            // Trail
            if (Math.random() < 0.5) {
                this.game.particles.push(new Explosion(this.game, this.x, this.y, this.color));
            }
        } else {
            this.state = 'idle';
            this.stateTimer = 0;
        }
    }

    spiralShoot(deltaTime) {
        // Rotational fire
        const fireRate = 0.08;
        const totalShots = Math.floor(this.stateTimer / fireRate);
        const prevShots = Math.floor((this.stateTimer - deltaTime) / fireRate);

        if (totalShots > prevShots) {
            const spin = this.stateTimer * 5;
            const arms = this.phase === 2 ? 4 : 2;
            for (let i = 0; i < arms; i++) {
                const angle = spin + (Math.PI * 2 / arms) * i;
                this.fireProjectile(this.x, this.y, angle, 'bullet');
            }
        }
    }

    spreadShoot(deltaTime) {
        const burstRate = 0.6;
        const totalBursts = Math.floor(this.stateTimer / burstRate);
        const prevBursts = Math.floor((this.stateTimer - deltaTime) / burstRate);

        if (totalBursts > prevBursts) {
            const count = this.phase === 2 ? 7 : 5;
            const spread = 0.8; // Radians
            const baseAngle = this.angle;
            for (let i = 0; i < count; i++) {
                const angle = baseAngle - spread / 2 + (spread / (count - 1)) * i;
                this.fireProjectile(this.x, this.y, angle, 'bullet');
            }
        }
    }

    rapidShoot(deltaTime) {
        const fireRate = 0.1;
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);

        if (total > prev) {
            const offset = (Math.random() - 0.5) * 0.2;
            this.fireProjectile(this.x, this.y, this.angle + offset, 'bullet');

            // Occasionally fire a missile - drastically reduced chance
            if (Math.random() < 0.05) { // Was 0.2
                this.fireProjectile(this.x, this.y, this.angle + (Math.random() - 0.5), 'missile');
            }
        }
    }

    fireProjectile(x, y, angle, type) {
        const p = new Projectile(this.game, x, y, angle, type, 'enemy');
        if (type === 'missile') {
            // Drastically reduced missile stats for fairness
            p.speed = 80;      // Was 150
            p.maxSpeed = 160;  // Was 300
            p.acceleration = 50; // Was 150
            p.damage = 1;      // Minimized damage
            p.lifetime = 4.0;
        } else {
            p.speed = 350 + (this.level * 5);
        }
        this.game.projectiles.push(p);
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
