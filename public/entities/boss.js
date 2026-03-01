import { Projectile } from './projectile.js?v=4';
import { Explosion } from './particle.js?v=4';

export class Boss {
    constructor(game, level, side = 'top', modelIndex = null) {
        this.game = game;
        this.level = level;
        this.side = side;
        this.type = 'boss';
        this.markedForDeletion = false;

        // Randomize model if not provided
        this.modelIndex = modelIndex !== null ? modelIndex : Math.floor(Math.random() * 5);

        // Stats scale with level
        const levelScale = Math.max(1, level / 5);
        this.maxHealth = Math.floor(180 * levelScale); // Slightly increased
        this.health = this.maxHealth;
        this.points = 1500 * levelScale;
        this.coinReward = Math.floor(250 * levelScale);

        // Initial Position logic
        this.targetPoint = { x: game.width / 2, y: 150 };

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

        this.radius = 70;
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
        this.patterns = ['spiral', 'spread', 'rapid', 'missiles'];
        if (this.level >= 10) this.patterns.push('dash');

        // Visuals
        this.tilt = 0;
        this.hasFiredSingleMissile = false;
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

        if (this.level >= 20 && !this.hasFiredSingleMissile && this.state !== 'entering' && this.game.player) {
            const dx = this.game.player.x - this.x;
            const dy = this.game.player.y - this.y;
            const accuracyOffset = (Math.random() - 0.5) * 0.15; // Slight inaccuracy
            const missileAngle = Math.atan2(dy, dx) + accuracyOffset;
            this.fireProjectile(this.x, this.y, missileAngle, 'missile');
            this.hasFiredSingleMissile = true;
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
            case 'missiles': this.missileBarrage(deltaTime); break;
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
        const fireRateMult = this.level >= 20 ? 1.9 : (this.level >= 15 ? 1.35 : 1.0);
        const fireRate = 0.08 / fireRateMult;
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
        const fireRateMult = this.level >= 20 ? 1.9 : (this.level >= 15 ? 1.35 : 1.0);
        const burstRate = 0.6 / fireRateMult;
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
        const fireRateMult = this.level >= 20 ? 1.9 : (this.level >= 15 ? 1.35 : 1.0);
        const fireRate = 0.1 / fireRateMult;
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);

        if (total > prev) {
            const offset = (Math.random() - 0.5) * 0.2;
            this.fireProjectile(this.x, this.y, this.angle + offset, 'bullet');
        }
    }

    missileBarrage(deltaTime) {
        const fireRate = 0.5;
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);

        if (total > prev && total < 5) { // Fire a burst of 4 missiles
            const count = this.phase === 2 ? 3 : 2;
            const spread = 0.6;
            for (let i = 0; i < count; i++) {
                const accuracyOffset = (Math.random() - 0.5) * 0.2; // Add random spread for lower accuracy
                const angle = this.angle - spread / 2 + (spread / (count - 1)) * i + accuracyOffset;
                this.fireProjectile(this.x, this.y, angle, 'boss_missile');
            }
        }
    }

    fireProjectile(x, y, angle, type) {
        const p = new Projectile(this.game, x, y, angle, type === 'boss_missile' ? 'missile' : type, 'enemy');
        p.source = 'boss';

        if (type === 'boss_missile') {
            // Updated: Reduced damage, non-homing
            p.speed = 250;
            p.maxSpeed = 600;
            p.acceleration = 300;
            p.damage = this.level >= 15 ? 2.5 : 1.8; // Reduced from 4/3
            p.lifetime = 5.0;
            p.isHoming = false; // Explicitly non-homing
            p.color = '#ff0000';
            p.radius = 12;
        } else if (type === 'missile') {
            p.speed = 160;
            p.maxSpeed = 420;
            p.acceleration = 180;
            p.damage = this.level >= 20 ? 1.5 : 1.0; // Reduced from 2/1
            p.lifetime = 4.0;
            p.isHoming = false; // Explicitly non-homing
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

        // 3D Realistic Sprite Rendering
        const sprite = this.game.assets.get('boss');
        if (sprite) {
            const size = this.radius * 2.5;
            ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        } else {
            this.drawModel(ctx);
        }

        ctx.restore();
    }

    drawModel(ctx) {
        ctx.save();
        // Add tilt effect
        ctx.rotate(this.tilt);

        switch (this.modelIndex) {
            case 0: this.drawModelSleek(ctx); break;
            case 1: this.drawModelHeavy(ctx); break;
            case 2: this.drawModelTriangle(ctx); break;
            case 3: this.drawModelStealth(ctx); break;
            case 4: this.drawModelCarrier(ctx); break;
            default: this.drawModelSleek(ctx);
        }

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

        // Long sharp swept fuselage
        ctx.beginPath();
        ctx.moveTo(100, 0);  // Nose tip
        ctx.lineTo(55, 12);  // Forward fuselage
        ctx.lineTo(-40, 16); // Rear body
        ctx.lineTo(-80, 8);  // Engine nacelle
        ctx.lineTo(-80, -8);
        ctx.lineTo(-40, -16);
        ctx.lineTo(55, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Main swept-delta wings
        ctx.beginPath();
        ctx.moveTo(30, 14);
        ctx.lineTo(-40, 90);  // Leading tip
        ctx.lineTo(-80, 90);  // Rear tip
        ctx.lineTo(-60, 14);  // Wing root rear
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(30, -14);
        ctx.lineTo(-40, -90);
        ctx.lineTo(-80, -90);
        ctx.lineTo(-60, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Horizontal stabilizers
        ctx.beginPath();
        ctx.moveTo(-50, 14);
        ctx.lineTo(-70, 38);
        ctx.lineTo(-80, 38);
        ctx.lineTo(-65, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-50, -14);
        ctx.lineTo(-70, -38);
        ctx.lineTo(-80, -38);
        ctx.lineTo(-65, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Panel Lines
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, 12); ctx.lineTo(20, -12);
        ctx.moveTo(-20, 15); ctx.lineTo(-20, -15);
        ctx.stroke();
    }

    drawModelHeavy(ctx) {
        const grad = ctx.createLinearGradient(-120, 0, 120, 0);
        grad.addColorStop(0, '#110000');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad;

        // Massive fortress fuselage (wide body)
        ctx.beginPath();
        ctx.moveTo(115, 0);
        ctx.lineTo(70, 25);
        ctx.lineTo(-50, 30);
        ctx.lineTo(-120, 18);
        ctx.lineTo(-120, -18);
        ctx.lineTo(-50, -30);
        ctx.lineTo(70, -25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Weapon wings (four outer)
        ctx.beginPath();
        ctx.moveTo(30, 26);
        ctx.lineTo(-20, 80);
        ctx.lineTo(-60, 80);
        ctx.lineTo(-30, 26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(30, -26);
        ctx.lineTo(-20, -80);
        ctx.lineTo(-60, -80);
        ctx.lineTo(-30, -26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner wings (closer to body)
        ctx.beginPath();
        ctx.moveTo(60, 24);
        ctx.lineTo(20, 55);
        ctx.lineTo(-20, 55);
        ctx.lineTo(0, 24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(60, -24);
        ctx.lineTo(20, -55);
        ctx.lineTo(-20, -55);
        ctx.lineTo(0, -24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Quad engine exhausts
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(-118, 10, 5, 0, Math.PI * 2);
        ctx.arc(-118, -10, 5, 0, Math.PI * 2);
        ctx.arc(-58, 28, 4, 0, Math.PI * 2);
        ctx.arc(-58, -28, 4, 0, Math.PI * 2);
        ctx.fill();

        // Command fortress armor plates
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(-40, -22, 70, 44);
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-40, -22, 70, 44);

        // Side fins / stabilizers
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(-60, 28);
        ctx.lineTo(-110, 70);
        ctx.lineTo(-80, 55);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-60, -28);
        ctx.lineTo(-110, -70);
        ctx.lineTo(-80, -55);
        ctx.closePath();
        ctx.fill();
    }

    drawModelTriangle(ctx) {
        const grad = ctx.createLinearGradient(-100, 0, 100, 0);
        grad.addColorStop(0, '#111');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, '#eee');
        ctx.fillStyle = grad;

        // Sharp Triangle Body
        ctx.beginPath();
        ctx.moveTo(110, 0);     // Nose
        ctx.lineTo(-80, 100);   // Left rear
        ctx.lineTo(-60, 0);     // Engine notch
        ctx.lineTo(-80, -100);  // Right rear
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top fin
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(40, 0);
        ctx.lineTo(-40, 0);
        ctx.lineTo(-60, -25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing panels
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-20, 20, 15, 30);
        ctx.fillRect(-20, -50, 15, 30);
        ctx.globalAlpha = 1.0;
    }

    drawModelStealth(ctx) {
        ctx.fillStyle = '#0a0a0a'; // Ultra dark

        // Stealth Diamond Body
        ctx.beginPath();
        ctx.moveTo(120, 0);    // Nose
        ctx.lineTo(20, 45);    // Left mid
        ctx.lineTo(-90, 110);  // Left wing tip (forward swept-ish)
        ctx.lineTo(-60, 30);   // Left rear
        ctx.lineTo(-100, 0);   // Tail
        ctx.lineTo(-60, -30);  // Right rear
        ctx.lineTo(-90, -110); // Right wing tip
        ctx.lineTo(20, -45);   // Right mid
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Internal glowing patterns (hex lines)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 20); ctx.lineTo(-40, 20);
        ctx.moveTo(40, -20); ctx.lineTo(-40, -20);
        ctx.stroke();
    }

    drawModelCarrier(ctx) {
        const grad = ctx.createLinearGradient(-130, 0, 100, 0);
        grad.addColorStop(0, '#222');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, '#999');
        ctx.fillStyle = grad;

        // Wide Blocky Body
        ctx.beginPath();
        ctx.moveTo(90, 35);
        ctx.lineTo(90, -35);
        ctx.lineTo(-130, -55);
        ctx.lineTo(-130, 55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Outrigger engines
        ctx.fillRect(-100, 55, 60, 45);
        ctx.fillRect(-100, -100, 60, 45);
        ctx.strokeRect(-100, 55, 60, 45);
        ctx.strokeRect(-100, -100, 60, 45);

        // Landing bays / Hangar lights
        ctx.fillStyle = '#00f3ff';
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(-80 + i * 25, 65, 10, 25);
            ctx.fillRect(-80 + i * 25, -90, 10, 25);
        }
        ctx.globalAlpha = 1.0;
    }
}
