import { Projectile } from './projectile.js?v=4';
import { Explosion } from './particle.js?v=4';

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
            // Fast aggressive pursuit with occasional dashes - Deterministic
            this.dashTimer -= deltaTime;
            const pseudoRandom = Math.abs(Math.sin((this.remoteId || 0) + this.game.lastTime * 0.005));
            if (this.dashTimer <= 0 && pseudoRandom < 0.3) {
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
                    const seed = (this.remoteId || 0) + this.game.lastTime;
                    const spread = (Math.sin(seed * 1.5) * 0.5) * spreadMultiplier;
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
                    const seed = (this.remoteId || 0) + this.game.lastTime;
                    const spread = (Math.sin(seed * 2.1) * 0.2) * spreadMultiplier;
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
                    const seed = (this.remoteId || 0) + this.game.lastTime;
                    const spread = (Math.sin(seed * 0.8) * 0.3) * spreadMultiplier;
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
                // Predator Scout Jet - sleek and aggressive
                const grad = ctx.createLinearGradient(15, 0, -15, 0);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.5, this.color);
                grad.addColorStop(1, '#330000');
                ctx.fillStyle = grad;

                // Fuselage
                ctx.beginPath();
                ctx.moveTo(25, 0);       // Nose
                ctx.lineTo(5, 4);        // Mid
                ctx.lineTo(-12, 4);      // Rear
                ctx.lineTo(-15, 0);      // Exhaust
                ctx.lineTo(-12, -4);
                ctx.lineTo(5, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Swept Wings
                ctx.beginPath();
                ctx.moveTo(5, 4);        // Wing root
                ctx.lineTo(-8, 14);      // Wing tip
                ctx.lineTo(-14, 14);     // Wing tip rear
                ctx.lineTo(-6, 4);       // Wing root rear
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -4);
                ctx.lineTo(-8, -14);
                ctx.lineTo(-14, -14);
                ctx.lineTo(-6, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Tail Fins
                ctx.beginPath();
                ctx.moveTo(-6, 3);
                ctx.lineTo(-14, 8);
                ctx.lineTo(-16, 8);
                ctx.lineTo(-12, 3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-6, -3);
                ctx.lineTo(-14, -8);
                ctx.lineTo(-16, -8);
                ctx.lineTo(-12, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.ellipse(8, 0, 5, 2, 0, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'heavy') {
                // Flying Fortress Bomber - massive and armored
                const heavyGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 35);
                heavyGrad.addColorStop(0, this.color);
                heavyGrad.addColorStop(1, '#331100');
                ctx.fillStyle = heavyGrad;

                // Main Wing / Body (Flying Wing design)
                ctx.beginPath();
                ctx.moveTo(35, 0);       // Nose
                ctx.lineTo(10, 30);      // Leading edge left
                ctx.lineTo(-20, 35);     // Rear tip left
                ctx.lineTo(-25, 15);     // Rear notch left
                ctx.lineTo(-22, 0);      // Center rear (Engine bay)
                ctx.lineTo(-25, -15);    // Rear notch right
                ctx.lineTo(-20, -35);    // Rear tip right
                ctx.lineTo(10, -30);     // Leading edge right
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Structural Ribs / Armor
                ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(10, 20); ctx.lineTo(-15, 25);
                ctx.moveTo(10, -20); ctx.lineTo(-15, -25);
                ctx.stroke();

                // Engine Exhausts (Multiple)
                ctx.fillStyle = '#ff3300';
                ctx.beginPath();
                ctx.arc(-22, 10, 4, 0, Math.PI * 2);
                ctx.arc(-22, -10, 4, 0, Math.PI * 2);
                ctx.fill();

                // Cockpit (Large command deck)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.rect(5, -8, 12, 16);
                ctx.fill();
                ctx.stroke();

            } else if (this.type === 'shooter') {
                // Heavy Interceptor - twin engine with weapon pods
                const shooterGrad = ctx.createLinearGradient(-15, 0, 25, 0);
                shooterGrad.addColorStop(0, '#330033');
                shooterGrad.addColorStop(0.5, this.color);
                shooterGrad.addColorStop(1, '#ffccff');
                ctx.fillStyle = shooterGrad;

                // Main Fuselage (Wide)
                ctx.beginPath();
                ctx.moveTo(30, 0);       // Nose
                ctx.lineTo(8, 8);        // Cockpit area
                ctx.lineTo(-15, 10);     // Rear
                ctx.lineTo(-20, 6);      // Left Engine
                ctx.lineTo(-20, -6);     // Right Engine
                ctx.lineTo(-15, -10);
                ctx.lineTo(8, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wings with Weapon Pods
                ctx.beginPath();
                ctx.moveTo(0, 8);        // Wing root
                ctx.lineTo(-10, 24);     // Wing mid
                ctx.lineTo(-18, 24);     // Wing mid rear
                ctx.lineTo(-12, 8);      // Wing root rear
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(-10, -24);
                ctx.lineTo(-18, -24);
                ctx.lineTo(-12, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Weapon Pods at tips
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-18, 20, 12, 6);
                ctx.fillRect(-18, -26, 12, 6);

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.ellipse(10, 0, 6, 3, 0, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'swarm') {
                // Nano Dart Drone - tiny and fast
                const swarmGrad = ctx.createLinearGradient(12, 0, -12, 0);
                swarmGrad.addColorStop(0, '#ffffff');
                swarmGrad.addColorStop(0.5, this.color);
                swarmGrad.addColorStop(1, '#550000');
                ctx.fillStyle = swarmGrad;

                // Tiny sharp body
                ctx.beginPath();
                ctx.moveTo(16, 0);   // Nose
                ctx.lineTo(4, 3);    // Mid
                ctx.lineTo(-10, 3);  // Rear
                ctx.lineTo(-12, 0);  // Exhaust
                ctx.lineTo(-10, -3);
                ctx.lineTo(4, -3);
                ctx.closePath();
                ctx.fill();

                // Micro wings
                ctx.beginPath();
                ctx.moveTo(0, 3);
                ctx.lineTo(-6, 9);
                ctx.lineTo(-10, 9);
                ctx.lineTo(-8, 3);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(-6, -9);
                ctx.lineTo(-10, -9);
                ctx.lineTo(-8, -3);
                ctx.closePath();
                ctx.fill();

                // Cockpit dot
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(6, 0, 1.5, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'sniper') {
                // Long-Range Rail Jet - needle-nosed precision fighter
                const sniperGrad = ctx.createLinearGradient(20, 0, -20, 0);
                sniperGrad.addColorStop(0, '#ffffff');
                sniperGrad.addColorStop(0.4, this.color);
                sniperGrad.addColorStop(1, '#003344');
                ctx.fillStyle = sniperGrad;

                // Ultra-long fuselage
                ctx.beginPath();
                ctx.moveTo(30, 0);       // Nose
                ctx.lineTo(10, 3);
                ctx.lineTo(-22, 3);
                ctx.lineTo(-26, 0);
                ctx.lineTo(-22, -3);
                ctx.lineTo(10, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Small rear delta wings
                ctx.beginPath();
                ctx.moveTo(-8, 3);
                ctx.lineTo(-18, 14);
                ctx.lineTo(-22, 14);
                ctx.lineTo(-16, 3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-8, -3);
                ctx.lineTo(-18, -14);
                ctx.lineTo(-22, -14);
                ctx.lineTo(-16, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Sight reticle
                ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(20, 0, 3, 0, Math.PI * 2);
                ctx.stroke();

            } else if (this.type === 'splitter') {
                // Split-wing Fighter - delta wing with crack pattern
                const splitGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 18);
                splitGrad.addColorStop(0, '#ffffff');
                splitGrad.addColorStop(0.5, this.color);
                splitGrad.addColorStop(1, '#220044');
                ctx.fillStyle = splitGrad;

                // Fuselage
                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(6, 4);
                ctx.lineTo(-14, 4);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-14, -4);
                ctx.lineTo(6, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Delta Wings
                ctx.beginPath();
                ctx.moveTo(4, 4);
                ctx.lineTo(-10, 18);
                ctx.lineTo(-16, 18);
                ctx.lineTo(-10, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(4, -4);
                ctx.lineTo(-10, -18);
                ctx.lineTo(-16, -18);
                ctx.lineTo(-10, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Fracture lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-2, -6); ctx.lineTo(4, 0); ctx.lineTo(-2, 6);
                ctx.stroke();

            } else if (this.type === 'phantom') {
                // Stealth flying wing - nearly invisible
                ctx.globalAlpha = 0.55;
                const phantomGrad = ctx.createLinearGradient(-15, -10, 22, 10);
                phantomGrad.addColorStop(0, 'rgba(80,0,160,0.5)');
                phantomGrad.addColorStop(0.5, this.color);
                phantomGrad.addColorStop(1, 'rgba(50,0,100,0.3)');
                ctx.fillStyle = phantomGrad;

                // Stealth flying-wing silhouette
                ctx.beginPath();
                ctx.moveTo(28, 0);
                ctx.lineTo(2, 15);
                ctx.lineTo(-16, 18);
                ctx.lineTo(-14, 8);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-14, -8);
                ctx.lineTo(-16, -18);
                ctx.lineTo(2, -15);
                ctx.closePath();
                ctx.fill();

                // Phase engine shimmer
                ctx.strokeStyle = 'rgba(200,150,255,0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-5, -10); ctx.lineTo(-5, 10);
                ctx.stroke();

            } else if (this.type === 'titan') {
                // Armored strategic bomber - massive flying wing
                const titanGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 32);
                titanGrad.addColorStop(0, this.color);
                titanGrad.addColorStop(1, '#3a1a00');
                ctx.fillStyle = titanGrad;

                // Massive delta flying-wing body
                ctx.beginPath();
                ctx.moveTo(32, 0);
                ctx.lineTo(5, 28);
                ctx.lineTo(-20, 32);
                ctx.lineTo(-24, 16);
                ctx.lineTo(-24, -16);
                ctx.lineTo(-20, -32);
                ctx.lineTo(5, -28);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Armor plating ribs
                ctx.strokeStyle = 'rgba(255,150,0,0.4)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(5, 20); ctx.lineTo(-15, 24);
                ctx.moveTo(5, -20); ctx.lineTo(-15, -24);
                ctx.stroke();

                // Reactor glow
                ctx.fillStyle = 'rgba(255,100,0,0.8)';
                ctx.beginPath();
                ctx.arc(-20, 8, 4, 0, Math.PI * 2);
                ctx.arc(-20, -8, 4, 0, Math.PI * 2);
                ctx.fill();

                // Cockpit tower
                ctx.fillStyle = 'rgba(255, 200, 0, 0.7)';
                ctx.fillRect(0, -8, 14, 16);

            } else if (this.type === 'wraith') {
                // Ethereal Stealth Jet - ghostly fighter
                ctx.globalAlpha = 0.65;
                const wraithGrad = ctx.createLinearGradient(-14, 0, 24, 0);
                wraithGrad.addColorStop(0, 'rgba(80,0,100,0.4)');
                wraithGrad.addColorStop(0.5, this.color);
                wraithGrad.addColorStop(1, 'rgba(180,80,220,0.8)');
                ctx.fillStyle = wraithGrad;

                // Fighter fuselage
                ctx.beginPath();
                ctx.moveTo(28, 0);
                ctx.lineTo(8, 5);
                ctx.lineTo(-15, 5);
                ctx.lineTo(-18, 0);
                ctx.lineTo(-15, -5);
                ctx.lineTo(8, -5);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Swept phantom wings
                ctx.beginPath();
                ctx.moveTo(5, 5);
                ctx.lineTo(-10, 16);
                ctx.lineTo(-18, 14);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -5);
                ctx.lineTo(-10, -16);
                ctx.lineTo(-18, -14);
                ctx.lineTo(-10, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Ghost emitters
                ctx.strokeStyle = 'rgba(150,100,200,0.5)';
                ctx.lineWidth = 1;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.arc(-14 + i * 4, 0, 3, 0, Math.PI * 2);
                    ctx.stroke();
                }

            } else if (this.type === 'vortex') {
                // Spinning Void Bomber - radial turbine fighter
                ctx.fillStyle = this.color;

                const spinAngle = (Date.now() * 0.003) % (Math.PI * 2);
                // 4 rotating swept blades
                for (let i = 0; i < 4; i++) {
                    const a = spinAngle + i * Math.PI / 2;
                    ctx.save();
                    ctx.rotate(a);
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(20, 4);
                    ctx.lineTo(22, 0);
                    ctx.lineTo(20, -4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                // Center hub
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(100, 0, 255, 0.7)';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'bomber') {
                // Heavy Carpet Bomber - wide wing platform with payload
                const bomberGrad = ctx.createLinearGradient(-20, -14, 20, 14);
                bomberGrad.addColorStop(0, 'rgba(255,180,0,0.9)');
                bomberGrad.addColorStop(0.5, this.color);
                bomberGrad.addColorStop(1, '#663300');
                ctx.fillStyle = bomberGrad;

                // Full flying wing design
                ctx.beginPath();
                ctx.moveTo(25, 0);
                ctx.lineTo(5, 28);
                ctx.lineTo(-18, 32);
                ctx.lineTo(-20, 16);
                ctx.lineTo(-22, 0);
                ctx.lineTo(-20, -16);
                ctx.lineTo(-18, -32);
                ctx.lineTo(5, -28);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Bomb bays
                ctx.fillStyle = '#333';
                ctx.fillRect(-10, -4, 6, 8);
                ctx.fillRect(-2, -4, 6, 8);
                ctx.fillRect(6, -4, 6, 8);

            } else if (this.type === 'interceptor') {
                // High-speed needle jet - fastest attacker
                const interceptGrad = ctx.createLinearGradient(-12, 0, 24, 0);
                interceptGrad.addColorStop(0, '#001100');
                interceptGrad.addColorStop(0.4, this.color);
                interceptGrad.addColorStop(1, '#ffffff');
                ctx.fillStyle = interceptGrad;

                // Hot rod fuselage
                ctx.beginPath();
                ctx.moveTo(26, 0);       // Very sharp nose
                ctx.lineTo(8, 4);
                ctx.lineTo(-10, 4);
                ctx.lineTo(-14, 0);
                ctx.lineTo(-10, -4);
                ctx.lineTo(8, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wing-less – uses canards only (speed design)
                ctx.beginPath();
                ctx.moveTo(8, 4);
                ctx.lineTo(2, 12);
                ctx.lineTo(-4, 12);
                ctx.lineTo(-2, 4);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(8, -4);
                ctx.lineTo(2, -12);
                ctx.lineTo(-4, -12);
                ctx.lineTo(-2, -4);
                ctx.closePath();
                ctx.fill();

                // Speed afterburner trail
                ctx.strokeStyle = 'rgba(0,255,100,0.7)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-14, 0); ctx.lineTo(-22, 0);
                ctx.stroke();

            } else if (this.type === 'decoy') {
                // Holographic clone fighter - glowing ghost jet
                ctx.globalAlpha = 0.45;
                const decoyGrad = ctx.createLinearGradient(14, 0, -14, 0);
                decoyGrad.addColorStop(0, '#ffffff');
                decoyGrad.addColorStop(0.5, this.color);
                decoyGrad.addColorStop(1, 'rgba(255,255,0,0.2)');
                ctx.fillStyle = decoyGrad;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 1.5;

                // Same shape as a scout, but translucent
                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(6, 3);
                ctx.lineTo(-12, 3);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-12, -3);
                ctx.lineTo(6, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wing
                ctx.beginPath();
                ctx.moveTo(2, 3);
                ctx.lineTo(-8, 12);
                ctx.lineTo(-12, 12);
                ctx.lineTo(-6, 3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(2, -3);
                ctx.lineTo(-8, -12);
                ctx.lineTo(-12, -12);
                ctx.lineTo(-6, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Hologram scan line
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = 'rgba(200,200,255,0.9)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-4, -8); ctx.lineTo(-4, 8);
                ctx.stroke();

            } else if (this.type === 'launcher') {
                // Missile Platform Jet - heavy with external weapon pods
                const launcherGrad = ctx.createLinearGradient(-18, -10, 18, 10);
                launcherGrad.addColorStop(0, '#1a0028');
                launcherGrad.addColorStop(0.5, this.color);
                launcherGrad.addColorStop(1, '#ff99ff');
                ctx.fillStyle = launcherGrad;

                // Wide fuselage
                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(5, 10);
                ctx.lineTo(-15, 10);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-15, -10);
                ctx.lineTo(5, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Missile pod wings
                ctx.beginPath();
                ctx.moveTo(0, 10);
                ctx.lineTo(-12, 22);
                ctx.lineTo(-20, 22);
                ctx.lineTo(-14, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(-12, -22);
                ctx.lineTo(-20, -22);
                ctx.lineTo(-14, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Missile pods
                ctx.fillStyle = '#ff00ff';
                ctx.fillRect(-18, 18, 10, 5);
                ctx.fillRect(-18, -23, 10, 5);

            } else if (this.type === 'shielder') {
                // Shielded Gunship - armored fuselage with visible shield dome
                const shielderGrad = ctx.createLinearGradient(14, 0, -14, 0);
                shielderGrad.addColorStop(0, '#005588');
                shielderGrad.addColorStop(0.5, this.color);
                shielderGrad.addColorStop(1, '#003355');
                ctx.fillStyle = shielderGrad;

                // Armored body
                ctx.beginPath();
                ctx.moveTo(24, 0);
                ctx.lineTo(6, 12);
                ctx.lineTo(-14, 12);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-14, -12);
                ctx.lineTo(6, -12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wings
                ctx.beginPath();
                ctx.moveTo(6, 12);
                ctx.lineTo(-8, 24);
                ctx.lineTo(-16, 20);
                ctx.lineTo(-10, 12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(6, -12);
                ctx.lineTo(-8, -24);
                ctx.lineTo(-16, -20);
                ctx.lineTo(-10, -12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Shield barrier visualization
                ctx.strokeStyle = 'rgba(0,255,255,0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 26, 0, Math.PI * 2);
                ctx.stroke();

            } else if (this.type === 'pulsar') {
                // Energy Pulse Jet - propelled by wave burst rings
                const pulsarGrad = ctx.createLinearGradient(14, 0, -14, 0);
                pulsarGrad.addColorStop(0, '#ffffff');
                pulsarGrad.addColorStop(0.5, this.color);
                pulsarGrad.addColorStop(1, '#440044');
                ctx.fillStyle = pulsarGrad;

                // Compact fuselage
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(5, 6);
                ctx.lineTo(-12, 6);
                ctx.lineTo(-16, 0);
                ctx.lineTo(-12, -6);
                ctx.lineTo(5, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Short swept wings
                ctx.beginPath();
                ctx.moveTo(2, 6);
                ctx.lineTo(-8, 16);
                ctx.lineTo(-14, 16);
                ctx.lineTo(-6, 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(2, -6);
                ctx.lineTo(-8, -16);
                ctx.lineTo(-14, -16);
                ctx.lineTo(-6, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Pulsing emission rings
                const pulsePhase = (Date.now() * 0.002) % (Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,0,255,' + (0.4 + Math.sin(pulsePhase) * 0.3) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-8, 0, 8 + Math.sin(pulsePhase) * 2, 0, Math.PI * 2);
                ctx.stroke();

            } else if (this.type === 'blade') {
                // Razor-Blade Jet - ultra-thin melee interceptor
                const bladeGrad = ctx.createLinearGradient(-16, -4, 22, 4);
                bladeGrad.addColorStop(0, '#220000');
                bladeGrad.addColorStop(0.5, this.color);
                bladeGrad.addColorStop(1, '#ffffff');
                ctx.fillStyle = bladeGrad;

                // Paper-thin razor fuselage
                ctx.beginPath();
                ctx.moveTo(28, 0);       // Blade tip
                ctx.lineTo(5, 3);
                ctx.lineTo(-16, 3);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-16, -3);
                ctx.lineTo(5, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Slashing fin edges (large angled wings)
                ctx.beginPath();
                ctx.moveTo(-2, 3);
                ctx.lineTo(-12, 14);
                ctx.lineTo(-20, 10);
                ctx.lineTo(-12, 3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-2, -3);
                ctx.lineTo(-12, -14);
                ctx.lineTo(-20, -10);
                ctx.lineTo(-12, -3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Edge highlight
                ctx.strokeStyle = 'rgba(255,180,180,0.8)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(22, -1); ctx.lineTo(-14, -1);
                ctx.stroke();

            } else if (this.type === 'tractor') {
                // Gravity Well Gunship - heavy platform with tractor emitters
                const tractorGrad = ctx.createLinearGradient(-20, 0, 20, 0);
                tractorGrad.addColorStop(0, '#110022');
                tractorGrad.addColorStop(0.5, this.color);
                tractorGrad.addColorStop(1, '#7700ff');
                ctx.fillStyle = tractorGrad;

                // Wide heavy body
                ctx.beginPath();
                ctx.moveTo(28, 0);
                ctx.lineTo(5, 16);
                ctx.lineTo(-20, 16);
                ctx.lineTo(-25, 0);
                ctx.lineTo(-20, -16);
                ctx.lineTo(5, -16);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Tractor emitter arrays
                ctx.strokeStyle = 'rgba(150,0,255,0.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 18 + i * 5, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Central gravity eye
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(100, 0, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();

            } else if (this.type === 'mirror') {
                // Reflective Interceptor - angled mirror-panel jet
                const mirrorGrad = ctx.createLinearGradient(-15, -10, 15, 10);
                mirrorGrad.addColorStop(0, '#555577');
                mirrorGrad.addColorStop(0.5, this.color);
                mirrorGrad.addColorStop(1, '#aaaaee');
                ctx.fillStyle = mirrorGrad;

                // Flat edgy fuselage
                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(5, 10);
                ctx.lineTo(-15, 10);
                ctx.lineTo(-18, 0);
                ctx.lineTo(-15, -10);
                ctx.lineTo(5, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wings
                ctx.beginPath();
                ctx.moveTo(2, 10);
                ctx.lineTo(-8, 20);
                ctx.lineTo(-18, 18);
                ctx.lineTo(-10, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(2, -10);
                ctx.lineTo(-8, -20);
                ctx.lineTo(-18, -18);
                ctx.lineTo(-10, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Reflective panels - cross diagonal lines
                ctx.strokeStyle = 'rgba(150,200,255,0.9)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(10, -8); ctx.lineTo(-10, 8);
                ctx.moveTo(10, 8); ctx.lineTo(-10, -8);
                ctx.stroke();

            } else if (this.type === 'swarmer') {
                // Medium Swarmer - compact multi-role fighter
                const swarmerGrad = ctx.createLinearGradient(-10, -6, 18, 6);
                swarmerGrad.addColorStop(0, '#664400');
                swarmerGrad.addColorStop(0.5, this.color);
                swarmerGrad.addColorStop(1, '#ffdd99');
                ctx.fillStyle = swarmerGrad;

                // Compact fighter fuselage
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(5, 5);
                ctx.lineTo(-10, 5);
                ctx.lineTo(-14, 0);
                ctx.lineTo(-10, -5);
                ctx.lineTo(5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Compact wings
                ctx.beginPath();
                ctx.moveTo(3, 5);
                ctx.lineTo(-5, 14);
                ctx.lineTo(-12, 14);
                ctx.lineTo(-6, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(3, -5);
                ctx.lineTo(-5, -14);
                ctx.lineTo(-12, -14);
                ctx.lineTo(-6, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Targeting marker
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(8, 0, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
