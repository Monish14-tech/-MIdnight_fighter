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
        this.spawnLevel = level;
        this.hasFiredSingleMissile = false;

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
        } else if (this.type === 'phantom') {
            // LEVEL 6+ | Phasing specter - high speed, cannot shoot
            this.speed = 180 * speedMultiplier;
            this.color = '#9966ff'; // Violet/Purple
            this.radius = 15;
            this.points = 150;
            this.health = 2 + hpBonus;
            this.phaseTimer = 0;
            this.phaseCooldown = 3.0;
        } else if (this.type === 'titan') {
            // LEVEL 11+ | Armored colossus - slow, very high health, cannot shoot
            this.speed = 75 * speedMultiplier;
            this.color = '#cc7722'; // Bronze
            this.radius = 28;
            this.points = 400;
            this.health = 10 + hpBonus * 3;
            this.armor = 2;
        } else if (this.type === 'wraith') {
            // LEVEL 16+ | Reality bender - fast ethereal, cannot shoot
            this.speed = 200 * speedMultiplier;
            this.color = '#bb66dd'; // Magenta-Purple
            this.radius = 16;
            this.points = 350;
            this.health = 3 + hpBonus;
            this.teleportCooldown = 2.5;
            this.teleportTimer = 1.5;
        } else if (this.type === 'vortex') {
            // LEVEL 21+ | Spinning void - very slow, high health, cannot shoot
            this.speed = 50 * speedMultiplier;
            this.color = '#6600cc'; // Deep Purple
            this.radius = 20;
            this.points = 500;
            this.health = 12 + hpBonus * 4;
            this.spinRate = 360; // degrees per second
        } else if (this.type === 'bomber') {
            // LEVEL 3+ | Heavy explosive unit - slow, high health, explodes on death
            this.speed = 60 * speedMultiplier;
            this.color = '#ff6600'; // Bright Orange
            this.radius = 28;
            this.points = 350;
            this.health = 8 + hpBonus * 2;
            this.explosionRadius = 80;
            this.explosionDamage = 2;
        } else if (this.type === 'interceptor') {
            // LEVEL 4+ | Swift hunter - very fast, aggressive pursuit
            this.speed = 280 * speedMultiplier;
            this.color = '#00ff88'; // Bright Green
            this.radius = 10;
            this.points = 110;
            this.health = 1 + hpBonus;
            this.dashCooldown = 3.0;
            this.dashTimer = 2.0;
        } else if (this.type === 'decoy') {
            // LEVEL 5+ | Holographic decoy - spawns multiple copies, low health
            this.speed = 160 * speedMultiplier;
            this.color = '#ffff00'; // Bright Yellow
            this.radius = 11;
            this.points = 90;
            this.health = 1;
            this.isDecoy = true;
            this.decoyCount = 2;
        } else if (this.type === 'launcher') {
            // LEVEL 7+ | Missile platform - shoots missiles instead of bullets
            this.speed = 90 * speedMultiplier;
            this.color = '#ff0099'; // Hot Pink
            this.radius = 20;
            this.points = 280;
            this.health = 4 + hpBonus;
            this.shootTimer = 0;
            this.missileMode = true;
        } else if (this.type === 'shielder') {
            // LEVEL 8+ | Shielded defender - has protective shield
            this.speed = 110 * speedMultiplier;
            this.color = '#00ddff'; // Cyan
            this.radius = 19;
            this.points = 240;
            this.health = 4 + hpBonus;
            this.shieldHealth = 3 + hpBonus;
            this.hasShield = true;
        } else if (this.type === 'pulsar') {
            // LEVEL 9+ | Energy pulsar - creates damaging waves
            this.speed = 100 * speedMultiplier;
            this.color = '#ff00ff'; // Magenta
            this.radius = 16;
            this.points = 200;
            this.health = 3 + hpBonus;
            this.pulseTimer = 0;
            this.pulseCooldown = 2.5;
            this.pulseRadius = 60;
        } else if (this.type === 'blade') {
            // LEVEL 10+ | High-speed interceptor - fast melee strikes
            this.speed = 260 * speedMultiplier;
            this.color = '#ff1111'; // Bright Red
            this.radius = 13;
            this.points = 180;
            this.health = 2 + hpBonus;
            this.slashCooldown = 1.5;
            this.slashTimer = 0;
            this.attackRange = 35;
        } else if (this.type === 'tractor') {
            // LEVEL 12+ | Gravitational puller - slow but pulls player
            this.speed = 70 * speedMultiplier;
            this.color = '#9900ff'; // Deep Purple
            this.radius = 24;
            this.points = 310;
            this.health = 6 + hpBonus;
            this.tractorRange = 300;
            this.tractorPull = 50; // Force magnitude
        } else if (this.type === 'mirror') {
            // LEVEL 13+ | Reflects player fire - bounces projectiles
            this.speed = 130 * speedMultiplier;
            this.color = '#ccccff'; // Silver/Blue
            this.radius = 17;
            this.points = 200;
            this.health = 3 + hpBonus;
            this.reflectChance = 0.6; // 60% chance to reflect
            this.rotation = 0;
        } else if (this.type === 'swarmer') {
            // LEVEL 14+ | Medium swarm unit - faster than chaser, medium durability
            this.speed = 200 * speedMultiplier;
            this.color = '#ffaa00'; // Gold/Orange
            this.radius = 10;
            this.points = 95;
            this.health = 1 + hpBonus;
            this.swarming = true;
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
        } else if (this.type === 'interceptor') {
            // Fast aggressive pursuit with occasional dashes
            this.dashTimer -= deltaTime;
            if (this.dashTimer <= 0 && Math.random() < 0.3) {
                this.dashTimer = this.dashCooldown;
                effectiveSpeed *= 2.5; // Boost speed for dash
            }
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
        } else if (this.type === 'tractor') {
            // Move toward player and apply pull force
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
            
            // Apply pull force to player if in range
            const dist = Math.hypot(dx, dy);
            if (dist < this.tractorRange) {
                const pullAngle = Math.atan2(dy, dx);
                this.game.player.x += Math.cos(pullAngle) * this.tractorPull * deltaTime;
                this.game.player.y += Math.sin(pullAngle) * this.tractorPull * deltaTime;
            }
        } else if (this.type === 'blade') {
            // Aggressive fast movement with slashing
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
            
            // Update slash timer
            this.slashTimer -= deltaTime;
        } else if (this.type === 'mirror') {
            // Rotate and move
            this.rotation = (this.rotation + 180 * deltaTime) % 360;
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
        } else if (this.type === 'pulsar') {
            // Move toward player and pulse
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
            
            // Update pulse timer
            this.pulseTimer -= deltaTime;
        } else if (this.type === 'launcher') {
            // Medium speed, stands ground to shoot
            if (Math.hypot(dx, dy) > 250) {
                this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
                this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
            }
        } else {
            // Simple movement towards player
            this.x += Math.cos(this.angle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(this.angle) * effectiveSpeed * deltaTime;
        }

        // Shooter Logic (only shooter, sniper, launcher, and pulsar can attack)
        // No enemies can shoot until first boss appears
        const level = this.game.currentLevel || 1;
        const singleMissileMode = level >= 11;
        const fireRateMultiplier = level >= 24 ? 2.5 : (level >= 15 ? 1.7 : 1.0);
        const spreadMultiplier = level >= 24 ? 0.25 : (level >= 15 ? 0.6 : 1.0);

        if (!this.game.firstBossAppeared) {
            // No shooting allowed before first boss
        } else if (this.type === 'shooter') {
            this.shootTimer += deltaTime;
            if (this.shootTimer > (2.0 / fireRateMultiplier)) {
                this.shootTimer = 0;
                if (singleMissileMode) {
                    if (!this.hasFiredSingleMissile) {
                        const missile = new Projectile(this.game, this.x, this.y, this.angle, 'missile', 'enemy');
                        missile.speed = 260;
                        missile.maxSpeed = 700;
                        missile.acceleration = 300;
                        missile.damage = 2;
                        this.game.projectiles.push(missile);
                        this.hasFiredSingleMissile = true;
                    }
                } else {
                    const spread = (Math.random() - 0.5) * 0.5 * spreadMultiplier;
                    this.game.projectiles.push(new Projectile(this.game, this.x, this.y, this.angle + spread, 'bullet', 'enemy'));
                }
            }
        } else if (this.type === 'sniper') {
            this.shootTimer += deltaTime;
            if (this.shootTimer > (2.8 / fireRateMultiplier)) {
                this.shootTimer = 0;
                if (singleMissileMode) {
                    if (!this.hasFiredSingleMissile) {
                        const missile = new Projectile(this.game, this.x, this.y, this.angle, 'missile', 'enemy');
                        missile.speed = 300;
                        missile.maxSpeed = 800;
                        missile.acceleration = 350;
                        missile.damage = 2;
                        missile.color = '#6bd6ff';
                        this.game.projectiles.push(missile);
                        this.hasFiredSingleMissile = true;
                    }
                } else {
                    const spread = (Math.random() - 0.5) * 0.2 * spreadMultiplier;
                    const shot = new Projectile(this.game, this.x, this.y, this.angle + spread, 'bullet', 'enemy');
                    shot.speed = 700;
                    shot.damage = 2;
                    shot.color = '#6bd6ff';
                    this.game.projectiles.push(shot);
                }
            }
        } else if (this.type === 'launcher') {
            // Launches one missile only from level 11+, otherwise bullets
            this.shootTimer += deltaTime;
            if (this.shootTimer > (3.0 / fireRateMultiplier)) {
                this.shootTimer = 0;
                if (singleMissileMode) {
                    if (!this.hasFiredSingleMissile) {
                        const missile = new Projectile(this.game, this.x, this.y, this.angle, 'missile', 'enemy');
                        missile.speed = 220;
                        missile.maxSpeed = 650;
                        missile.acceleration = 260;
                        missile.damage = 2;
                        missile.color = '#ff0099';
                        this.game.projectiles.push(missile);
                        this.hasFiredSingleMissile = true;
                    }
                } else {
                    const spread = (Math.random() - 0.5) * 0.3 * spreadMultiplier;
                    const bullet = new Projectile(this.game, this.x, this.y, this.angle + spread, 'bullet', 'enemy');
                    bullet.speed = 350;
                    bullet.damage = 2;
                    bullet.color = '#ff0099';
                    this.game.projectiles.push(bullet);
                }
            }
        } else if (this.type === 'pulsar') {
            // Create damaging pulse waves
            if (this.pulseTimer <= 0) {
                this.pulseTimer = this.pulseCooldown;
                // Create expanding pulse effect
                this.game.particles.push(new Explosion(this.game, this.x, this.y, '#ff00ff'));
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

            } else if (this.type === 'phantom') {
                // Phasing specter - translucent with shimmer
                ctx.globalAlpha = 0.6;
                const phantomGrad = ctx.createLinearGradient(-15, -10, 20, 10);
                phantomGrad.addColorStop(0, 'rgba(150,50,200,0.8)');
                phantomGrad.addColorStop(0.5, this.color);
                phantomGrad.addColorStop(1, 'rgba(100,0,150,0.6)');
                ctx.fillStyle = phantomGrad;

                ctx.beginPath();
                ctx.moveTo(24, 0);
                ctx.lineTo(8, 8);
                ctx.lineTo(-10, 6);
                ctx.lineTo(-18, 0);
                ctx.lineTo(-10, -6);
                ctx.lineTo(8, -8);
                ctx.closePath();
                ctx.fill();

                // Phase shimmer lines
                ctx.strokeStyle = 'rgba(200,150,255,0.8)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(0, 12);
                ctx.stroke();

            } else if (this.type === 'titan') {
                // Armored colossus - heavy angular design
                const titanGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 28);
                titanGrad.addColorStop(0, this.color);
                titanGrad.addColorStop(1, '#4a2100');
                ctx.fillStyle = titanGrad;

                // Main body - large hexagon
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3 + Math.PI / 6;
                    const rx = Math.cos(angle) * 26;
                    const ry = Math.sin(angle) * 26;
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Heavy armor plating
                ctx.fillStyle = '#662200';
                ctx.fillRect(-26, -8, 10, 16);
                ctx.fillRect(16, -8, 10, 16);
                // Central reactor glow
                ctx.fillStyle = 'rgba(255,100,0,0.7)';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'wraith') {
                // Reality-bending specter - ethereal outline
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.fillStyle = 'rgba(100,50,150,0.3)';

                // Spiky ethereal form
                ctx.beginPath();
                ctx.moveTo(26, 0);
                ctx.lineTo(12, 8);
                ctx.lineTo(6, 14);
                ctx.lineTo(-8, 10);
                ctx.lineTo(-18, 0);
                ctx.lineTo(-8, -10);
                ctx.lineTo(6, -14);
                ctx.lineTo(12, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Ghost wisps
                ctx.strokeStyle = 'rgba(150,100,200,0.5)';
                ctx.lineWidth = 1;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.arc(-10 + i * 6, 0, 4, 0, Math.PI * 2);
                    ctx.stroke();
                }

            } else if (this.type === 'vortex') {
                // Spinning void - concentric circles
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();

                // Spinning rings
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                const spinAngle = (Date.now() * 0.005) % (Math.PI * 2);
                ctx.beginPath();
                ctx.arc(0, 0, 10, spinAngle, spinAngle + Math.PI / 2);
                ctx.stroke();

                // Inner void
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'bomber') {
                // Heavy explosive platform - bulky angular design
                const bomberGrad = ctx.createLinearGradient(-20, -15, 20, 15);
                bomberGrad.addColorStop(0, 'rgba(255,200,0,0.9)');
                bomberGrad.addColorStop(0.5, this.color);
                bomberGrad.addColorStop(1, '#663300');
                ctx.fillStyle = bomberGrad;

                ctx.beginPath();
                ctx.moveTo(18, 0);
                ctx.lineTo(10, 10);
                ctx.lineTo(-8, 12);
                ctx.lineTo(-16, 6);
                ctx.lineTo(-16, -6);
                ctx.lineTo(-8, -12);
                ctx.lineTo(10, -10);
                ctx.closePath();
                ctx.fill();

                // Payload bays
                ctx.fillStyle = '#333';
                ctx.fillRect(-10, -4, 6, 8);
                ctx.fillRect(-2, -4, 6, 8);
                ctx.fillRect(6, -4, 6, 8);

            } else if (this.type === 'interceptor') {
                // Swift kinetic hunter - sleek and pointed
                const interceptGrad = ctx.createLinearGradient(-15, 0, 25, 0);
                interceptGrad.addColorStop(0, '#003300');
                interceptGrad.addColorStop(0.5, this.color);
                interceptGrad.addColorStop(1, '#ffffff');
                ctx.fillStyle = interceptGrad;

                ctx.beginPath();
                ctx.moveTo(24, 0);
                ctx.lineTo(10, 6);
                ctx.lineTo(-8, 4);
                ctx.lineTo(-14, 0);
                ctx.lineTo(-8, -4);
                ctx.lineTo(10, -6);
                ctx.closePath();
                ctx.fill();

                // Speed lines
                ctx.strokeStyle = 'rgba(0,255,0,0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(14, 0);
                ctx.lineTo(20, 0);
                ctx.stroke();

            } else if (this.type === 'decoy') {
                // Holographic clone - translucent shimmering
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.fillStyle = 'rgba(200,200,255,0.3)';

                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(8, 7);
                ctx.lineTo(-10, 5);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-10, -5);
                ctx.lineTo(8, -7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Hologram flicker
                ctx.globalAlpha = 0.8;
                ctx.strokeStyle = 'rgba(150,150,255,1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(0, 10);
                ctx.stroke();

            } else if (this.type === 'launcher') {
                // Missile platform - boxy with visible weapon pods
                const launcherGrad = ctx.createLinearGradient(-18, -12, 18, 12);
                launcherGrad.addColorStop(0, '#220033');
                launcherGrad.addColorStop(0.5, this.color);
                launcherGrad.addColorStop(1, '#ff99ff');
                ctx.fillStyle = launcherGrad;

                ctx.beginPath();
                ctx.moveTo(16, 0);
                ctx.lineTo(8, 10);
                ctx.lineTo(-12, 8);
                ctx.lineTo(-18, 0);
                ctx.lineTo(-12, -8);
                ctx.lineTo(8, -10);
                ctx.closePath();
                ctx.fill();

                // Missile pods
                ctx.fillStyle = '#ff00ff';
                ctx.fillRect(-6, 10, 4, 6);
                ctx.fillRect(2, 10, 4, 6);
                ctx.fillRect(-6, -16, 4, 6);
                ctx.fillRect(2, -16, 4, 6);

            } else if (this.type === 'shielder') {
                // Protected barrier - hexagon with shield glow
                ctx.fillStyle = this.color;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    const rx = Math.cos(angle) * 20;
                    const ry = Math.sin(angle) * 20;
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                }
                ctx.closePath();
                ctx.fill();

                // Shield barrier visualization
                ctx.strokeStyle = 'rgba(0,255,255,0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.stroke();

                // Center core
                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'pulsar') {
                // Energy wave generator - pulsing sphere with rings
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, 18, 0, Math.PI * 2);
                ctx.fill();

                // Pulsing rings
                const pulsePhase = (Date.now() * 0.002) % (Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,0,255,' + (0.5 + Math.sin(pulsePhase) * 0.3) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 12 + Math.sin(pulsePhase) * 3, 0, Math.PI * 2);
                ctx.stroke();

                // Central charge core
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'blade') {
                // Melee slashing fighter - thin blade shape
                const bladeGrad = ctx.createLinearGradient(-18, -8, 20, 8);
                bladeGrad.addColorStop(0, '#330000');
                bladeGrad.addColorStop(0.5, this.color);
                bladeGrad.addColorStop(1, '#ffcccc');
                ctx.fillStyle = bladeGrad;

                ctx.beginPath();
                ctx.moveTo(26, 0);
                ctx.lineTo(8, 5);
                ctx.lineTo(-14, 2);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-14, -2);
                ctx.lineTo(8, -5);
                ctx.closePath();
                ctx.fill();

                // Cutting edge highlight
                ctx.strokeStyle = 'rgba(255,200,200,0.8)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(20, -1);
                ctx.lineTo(-14, -1);
                ctx.stroke();

            } else if (this.type === 'tractor') {
                // Gravity puller - heavy rounded form
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.fill();

                // Tractor field visualization
                ctx.strokeStyle = 'rgba(200,0,255,0.6)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 14 + i * 4, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Central gravity well
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'mirror') {
                // Reflective angular design - geometric pattern
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(8, 8);
                ctx.lineTo(-10, 10);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-10, -10);
                ctx.lineTo(8, -8);
                ctx.closePath();
                ctx.fill();

                // Reflective panels
                ctx.strokeStyle = 'rgba(0,255,255,0.8)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(10, -8);
                ctx.lineTo(-10, 8);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(10, 8);
                ctx.lineTo(-10, -8);
                ctx.stroke();

                // Central mirror panel
                ctx.fillStyle = 'rgba(100,255,255,0.5)';
                ctx.fillRect(-4, -4, 8, 8);

            } else if (this.type === 'swarmer') {
                // Medium swarm fighter - compact and agile
                const swarmerGrad = ctx.createLinearGradient(-12, -8, 18, 8);
                swarmerGrad.addColorStop(0, '#664400');
                swarmerGrad.addColorStop(0.5, this.color);
                swarmerGrad.addColorStop(1, '#ffdd99');
                ctx.fillStyle = swarmerGrad;

                ctx.beginPath();
                ctx.moveTo(18, 0);
                ctx.lineTo(8, 6);
                ctx.lineTo(-8, 4);
                ctx.lineTo(-14, 0);
                ctx.lineTo(-8, -4);
                ctx.lineTo(8, -6);
                ctx.closePath();
                ctx.fill();

                // Coordinated marker
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(8, 0, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
