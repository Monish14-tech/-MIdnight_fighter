import { AfterburnerTrail } from './particle.js?v=4';
import { Projectile } from './projectile.js?v=4';

export class Player {
    constructor(game, shipType = 'default', options = {}) {
        this.game = game;
        this.x = game.width / 2;
        this.y = game.height / 2;
        this.radius = 15;
        this.playerId = options.playerId || 'player';

        // Get Stats from Game or define them here if circular dependency is an issue
        // Accessing via game instance properly
        // Ideally SHIP_DATA should be in a separate config or static, but for now we trust what's passed or default
        // Actually, importing SHIP_DATA in player.js would be circular if game.js imports player.js. 
        // Let's assume passed shipType string and we look it up in a helper or passed config.
        // BETTER: Game passes the stats object directly? No, cleaner to pass type and look it up.
        // To avoid circular dependency, let's just define the lookups here or attach SHIP_DATA to game instance.

        // Let's use the SHIP_DATA exported from game.js - wait, that causes circle.
        // Solution: Move SHIP_DATA to a utils file or properties file. 
        // For now, I will duplicate the lookup logic OR rely on game.SHIP_DATA if I attached it to the instance? 
        // Javascript modules handle circular refs okay often, but let's be safe.
        // actually let's just accept the stats from game.

        // RE-READING: I defined SHIP_DATA in game.js. 
        // I will move SHIP_DATA to a new file `constants.js` to be safe, OR just access `game.SHIP_DATA` if I attach it.
        // Let's try accessing it via the import, but if that fails, I'll move it.
        // actually, simpler: I'll hardcode the lookup here for now to avoid the refactor overhead of a new file, 
        // OR better: I'll attach SHIP_DATA to the Game class as a static. 
        // `import { SHIP_DATA } from '../game.js'` 

        // Let's just define defaults and overwrite if valid.

        const stats = game.getShipStats ? game.getShipStats(shipType) : {
            hp: 3, speed: 300, damage: 1, fireRate: 0.15, missileCount: 1, color: '#00f3ff'
        }; // Fallback

        this.shipType = shipType;
        this.speed = stats.speed;
        this.isInvincible = Boolean(stats.invincible);

        // Weapon System
        this.fireRate = stats.fireRate;
        this.fireTimer = 0;
        this.missileCooldown = stats.missileCooldown || 5.0;
        this.missileTimer = 0;
        this.bulletDamage = stats.damage;
        this.baseBulletDamage = this.bulletDamage;
        this.missileCount = stats.missileCount;
        this.bulletType = stats.bulletType || 'normal';
        this.baseFireRate = this.fireRate;

        // Visuals
        this.color = stats.color;
        this.angle = 0;
        this.trail = [];
        this.afterburnerTimer = 0;

        // Health System
        this.maxHealth = stats.hp;
        this.currentHealth = this.maxHealth;
        this.invulnerableTimer = 0;
        this.invulnerableDuration = 1.0;
        this.damageFlashTimer = 0;

        // Power-ups
        this.speedBoostTimer = 0;
        this.slowMotionTimer = 0;
        this.invulnerabilityTimer = 0;

        // Dash System
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDuration = 0.18;
        this.dashCooldown = Math.max(this.missileCooldown + 1.0, 6.0);
        this.dashCooldownTimer = 0;
        this.dashSpeed = this.speed * 3.2;
        this.dashDirection = { x: 0, y: 0 };

        // Extra power-up timers
        this.doubleDamageTimer = 0;
        this.rapidFireTimer = 0;
    }

    update(deltaTime, input) {
        // Handle Cooldowns


        // Update health-related timers
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= deltaTime;
        if (this.damageFlashTimer > 0) this.damageFlashTimer -= deltaTime;

        // Update power-up timers
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= deltaTime;
        if (this.slowMotionTimer > 0) this.slowMotionTimer -= deltaTime;
        if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer -= deltaTime;

        // New power-up timers
        if (this.doubleDamageTimer > 0) {
            this.doubleDamageTimer -= deltaTime;
            if (this.doubleDamageTimer <= 0 && this.baseBulletDamage) {
                this.bulletDamage = this.baseBulletDamage;
            }
        }
        if (this.rapidFireTimer > 0) {
            this.rapidFireTimer -= deltaTime;
            if (this.rapidFireTimer <= 0 && this.baseFireRate) {
                this.fireRate = this.baseFireRate; // Reset to normal fire rate
            }
        }

        // Dash cooldowns
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaTime;
        if (this.dashTimer > 0) {
            this.dashTimer -= deltaTime;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }

        // Weapon Cooldowns
        if (this.fireTimer > 0) this.fireTimer -= deltaTime;
        if (this.missileTimer > 0) this.missileTimer -= deltaTime;

        // Handle Shooting
        if (input.keys.fire && this.fireTimer <= 0) {
            this.shoot('bullet');
            this.fireTimer = this.fireRate;
        }

        if (input.keys.missile && this.missileTimer <= 0) {
            this.shoot('missile');
            this.missileTimer = this.missileCooldown;
        }

        // Movement Logic
        const moveVec = input.getMovementVector();

        // Start dash if available
        if (input.keys.dash && this.dashCooldownTimer <= 0) {
            let dashVector = { x: moveVec.x, y: moveVec.y };
            if (dashVector.x === 0 && dashVector.y === 0) {
                const nearestEnemy = this.findNearestEnemy(700);
                if (nearestEnemy) {
                    const dx = nearestEnemy.x - this.x;
                    const dy = nearestEnemy.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    dashVector = { x: dx / len, y: dy / len };
                } else {
                    dashVector = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
                }
            }

            if (dashVector.x !== 0 || dashVector.y !== 0) {
                this.isDashing = true;
                this.dashTimer = this.dashDuration;
                this.dashCooldownTimer = this.dashCooldown;
                this.dashDirection = dashVector;
                this.angle = Math.atan2(this.dashDirection.y, this.dashDirection.x);
                if (this.game.audio) this.game.audio.dash();
            }

            input.keys.dash = false;
        }

        // 360-Degree Face Direction (Aim Assist) - Only if auto-target is enabled
        if (!this.isDashing) {
            let targetAngleForMovement = null;
            if (this.game.autoTargetEnabled) {
                const nearestEnemy = this.findNearestEnemy(700); // Increased range for auto-detection
                if (nearestEnemy) {
                    const dx = nearestEnemy.x - this.x;
                    const dy = nearestEnemy.y - this.y;
                    targetAngleForMovement = Math.atan2(dy, dx);
                }
            }

            // Apply target angle or movement direction
            if (targetAngleForMovement !== null) {
                const diff = targetAngleForMovement - this.angle;
                const normalizedDiff = diff > Math.PI ? diff - Math.PI * 2 : diff < -Math.PI ? diff + Math.PI * 2 : diff;
                this.angle += normalizedDiff * deltaTime * 4; // Reduced lock strength from 8
            } else if (moveVec.x !== 0 || moveVec.y !== 0) {
                const destAngle = Math.atan2(moveVec.y, moveVec.x);
                let diff = destAngle - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.angle += diff * deltaTime * 10;
            }
        }

        let currentSpeed = this.speed;

        // Apply speed boost power-up
        if (this.speedBoostTimer > 0) {
            currentSpeed *= 2;
        }

        if (this.isDashing) {
            this.x += this.dashDirection.x * this.dashSpeed * deltaTime;
            this.y += this.dashDirection.y * this.dashSpeed * deltaTime;
        } else {
            this.x += moveVec.x * currentSpeed * deltaTime;
            this.y += moveVec.y * currentSpeed * deltaTime;
        }

        // Boundaries
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > this.game.width - this.radius) this.x = this.game.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > this.game.height - this.radius) this.y = this.game.height - this.radius;

        // Update Trail
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].alpha -= deltaTime * 4; // Fade out speed
            if (this.trail[i].alpha <= 0) {
                this.trail.splice(i, 1);
            }
        }

        // Spawn afterburner trails
        this.afterburnerTimer += deltaTime;
        if (this.afterburnerTimer > 0.05) { // Every 50ms
            this.afterburnerTimer = 0;
            if (moveVec.x !== 0 || moveVec.y !== 0) {
                this.spawnAfterburner();
            }
        }
    }

    spawnAfterburner() {
        // Calculate engine position (back of the jet)
        const engineX = this.x + Math.cos(this.angle + Math.PI) * 12;
        const engineY = this.y + Math.sin(this.angle + Math.PI) * 12;

        const color = this.isDashing ? '#ffff00' : '#ff6600';

        if (this.game.afterburners) {
            this.game.afterburners.push(new AfterburnerTrail(this.game, engineX, engineY, this.angle, color));
        }
    }

    shoot(type) {
        if (type === 'bullet') {
            const noseX = this.x + Math.cos(this.angle) * 20;
            const noseY = this.y + Math.sin(this.angle) * 20;

            if (this.bulletType === 'spread') {
                // Fire 3-5 bullets in a fan
                const count = 3;
                for (let i = 0; i < count; i++) {
                    const offset = (i - (count - 1) / 2) * 0.2;
                    const p = new Projectile(this.game, noseX, noseY, this.angle + offset, 'bullet', this.playerId);
                    p.damage = this.bulletDamage || 1;
                    this.game.projectiles.push(p);
                }
            } else if (this.bulletType === 'railgun') {
                // Single huge high-speed high-damage shot
                const p = new Projectile(this.game, noseX, noseY, this.angle, 'bullet', this.playerId);
                p.speed = 2500;
                p.damage = this.bulletDamage || 5;
                p.radius = 8;
                p.piercing = true;
                p.color = '#ffffff';
                this.game.projectiles.push(p);
            } else if (this.bulletType === 'explosive') {
                const p = new Projectile(this.game, noseX, noseY, this.angle, 'bullet', this.playerId);
                p.damage = this.bulletDamage || 2;
                p.explosive = true;
                p.color = '#ffcc00';
                p.radius = 6;
                this.game.projectiles.push(p);
            } else if (this.bulletType === 'piercing') {
                const p = new Projectile(this.game, noseX, noseY, this.angle, 'bullet', this.playerId);
                p.damage = this.bulletDamage || 1;
                p.piercing = true;
                p.color = '#00ff44';
                this.game.projectiles.push(p);
            } else {
                // Default Normal Shot
                const spread = (Math.random() - 0.5) * 0.1;
                const p = new Projectile(this.game, noseX, noseY, this.angle + spread, 'bullet', this.playerId);
                p.damage = this.bulletDamage || 1;
                this.game.projectiles.push(p);
            }

            if (this.game.audio) this.game.audio.dash();
        } else if (type === 'missile') {
            const p = new Projectile(this.game, this.x, this.y, this.angle, 'missile', this.playerId);
            this.game.projectiles.push(p);
            if (this.game.screenShake) this.game.screenShake.trigger(5, 0.2);
        }
    }

    draw(ctx) {
        // Draw Trail
        this.trail.forEach(t => {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(t.angle);
            ctx.scale(0.9, 0.9); // Smaller than player
            ctx.globalAlpha = t.alpha;
            this.drawShape(ctx, this.color);
            ctx.restore();
        });

        // Draw Player
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Enhanced glow based on state
        if (this.invulnerableTimer > 0) {
            // Golden invulnerability glow
            ctx.shadowBlur = 40;
            ctx.shadowColor = '#ffdd00';
            // Pulsing effect
            const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;
        } else if (this.speedBoostTimer > 0) {
            // Green glow for speed boost
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 30;
        } else if (this.doubleDamageTimer > 0) {
            // Hot pink glow for double damage
            ctx.shadowColor = '#ff0066';
            ctx.shadowBlur = 35;
        } else if (this.rapidFireTimer > 0) {
            // Yellow glow for rapid fire
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 30;
        } else if (this.damageFlashTimer > 0) {
            // Red flash when damaged
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 35;
            ctx.globalAlpha = 0.7;
        } else {
            // Normal cyan glow
            ctx.shadowBlur = 25;
            ctx.shadowColor = this.color;
        }

        // 3D Realistic Sprite Rendering
        const sprite = this.game.assets.get(this.shipType);
        if (sprite) {
            // Draw Sprite
            const size = this.radius * 4;
            ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        } else {
            // Fallback to Vector Shape
            this.drawShape(ctx, this.color);
        }

        ctx.restore();
    }

    drawShape(ctx, mainColor) {
        const type = this.shipType || 'default';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        switch (type) {
            case 'default': // INTERCEPTOR - Sleek Jet Fighter
                // Main Fuselage
                const defaultGrad = ctx.createLinearGradient(-15, 0, 25, 0);
                defaultGrad.addColorStop(0, '#003366');
                defaultGrad.addColorStop(0.5, '#0066ff');
                defaultGrad.addColorStop(1, '#00ffff');
                ctx.fillStyle = defaultGrad;

                ctx.beginPath();
                ctx.moveTo(35, 0);       // Nose
                ctx.lineTo(10, 6);       // Forward fuselage
                ctx.lineTo(-15, 6);      // Rear fuselage
                ctx.lineTo(-20, 0);      // Engine exhaust
                ctx.lineTo(-15, -6);
                ctx.lineTo(10, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Main Wings (Delta style)
                ctx.beginPath();
                ctx.moveTo(8, 6);        // Wing root forward
                ctx.lineTo(-12, 22);     // Wing tip
                ctx.lineTo(-18, 22);     // Wing tip rear
                ctx.lineTo(-12, 6);      // Wing root rear
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(8, -6);
                ctx.lineTo(-12, -22);
                ctx.lineTo(-18, -22);
                ctx.lineTo(-12, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Horizontal Stabilizers (Tail fins)
                ctx.beginPath();
                ctx.moveTo(-12, 4);
                ctx.lineTo(-22, 12);
                ctx.lineTo(-25, 12);
                ctx.lineTo(-18, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-12, -4);
                ctx.lineTo(-22, -12);
                ctx.lineTo(-25, -12);
                ctx.lineTo(-18, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit Canopy
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.ellipse(12, 0, 8, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                // Engine Glow Detail
                ctx.fillStyle = '#ff6600';
                ctx.beginPath();
                ctx.arc(-18, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'scout': // RAZORBACK - Lightweight Scout Jet
                const scoutGrad = ctx.createLinearGradient(0, -15, 0, 15);
                scoutGrad.addColorStop(0, '#ffff00');
                scoutGrad.addColorStop(0.5, '#ffcc00');
                scoutGrad.addColorStop(1, '#ff9900');
                ctx.fillStyle = scoutGrad;

                // Fuselage
                ctx.beginPath();
                ctx.moveTo(38, 0);       // Nose
                ctx.lineTo(15, 4);       // Mid
                ctx.lineTo(-20, 4);      // Rear
                ctx.lineTo(-24, 0);      // Exhaust
                ctx.lineTo(-20, -4);
                ctx.lineTo(15, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Narrow Swept Wings
                ctx.beginPath();
                ctx.moveTo(10, 4);
                ctx.lineTo(-5, 18);
                ctx.lineTo(-12, 18);
                ctx.lineTo(-8, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -4);
                ctx.lineTo(-5, -18);
                ctx.lineTo(-12, -18);
                ctx.lineTo(-8, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.ellipse(18, 0, 10, 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'phantom': // PHANTOM - Stealth Bomber
                const phantomGrad = ctx.createLinearGradient(-25, -10, 25, 10);
                phantomGrad.addColorStop(0, '#220044');
                phantomGrad.addColorStop(0.5, '#6600ff');
                phantomGrad.addColorStop(1, '#110022');
                ctx.fillStyle = phantomGrad;

                // Stealth Wing Silhouette (Flying Wing)
                ctx.beginPath();
                ctx.moveTo(35, 0);       // Nose
                ctx.lineTo(5, 30);       // Leading edge
                ctx.lineTo(-20, 35);     // Tip
                ctx.lineTo(-15, 10);     // Rear edge
                ctx.lineTo(-22, 0);      // Center rear
                ctx.lineTo(-15, -10);
                ctx.lineTo(-20, -35);
                ctx.lineTo(5, -30);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Stealth Cockpit
                ctx.fillStyle = 'rgba(100, 100, 255, 0.4)';
                ctx.beginPath();
                ctx.moveTo(15, 0);
                ctx.lineTo(0, 6);
                ctx.lineTo(-10, 0);
                ctx.lineTo(0, -6);
                ctx.closePath();
                ctx.fill();
                break;

            case 'rapid': // STORM BRINGER - Dual Engine Fighter
                const rapidGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
                rapidGrad.addColorStop(0, '#ff00ff');
                rapidGrad.addColorStop(0.5, '#aa00ff');
                rapidGrad.addColorStop(1, '#220044');
                ctx.fillStyle = rapidGrad;

                // Wide Fuselage with Dual Engines
                ctx.beginPath();
                ctx.moveTo(35, 0);       // Nose
                ctx.lineTo(8, 10);       // Mid body
                ctx.lineTo(-15, 12);     // Left Engine
                ctx.lineTo(-22, 6);
                ctx.lineTo(-22, -6);
                ctx.lineTo(-15, -12);    // Right Engine
                ctx.lineTo(8, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // High Swept Wings
                ctx.beginPath();
                ctx.moveTo(5, 10);
                ctx.lineTo(-12, 28);
                ctx.lineTo(-22, 28);
                ctx.lineTo(-12, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -10);
                ctx.lineTo(-12, -28);
                ctx.lineTo(-22, -28);
                ctx.lineTo(-12, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Central Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.ellipse(12, 0, 7, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'fighter': // CRIMSON FURY - Delta Wing
                const fighterGrad = ctx.createLinearGradient(-20, 0, 35, 0);
                fighterGrad.addColorStop(0, '#660000');
                fighterGrad.addColorStop(0.5, '#ff3333');
                fighterGrad.addColorStop(1, '#ffaaaa');
                ctx.fillStyle = fighterGrad;
                ctx.beginPath();
                ctx.moveTo(36, 0);
                ctx.lineTo(0, 20);
                ctx.lineTo(-20, 0);
                ctx.lineTo(0, -20);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.moveTo(-2, -3);
                ctx.lineTo(8, -1);
                ctx.lineTo(8, 1);

                // Classic Fuselage
                ctx.beginPath();
                ctx.moveTo(40, 0);       // Nose
                ctx.lineTo(15, 6);       // Forward
                ctx.lineTo(-20, 6);      // Rear
                ctx.lineTo(-15, 0);      // Exhaust
                ctx.lineTo(-20, -6);
                ctx.lineTo(15, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Swept Main Wings
                ctx.beginPath();
                ctx.moveTo(8, 6);
                ctx.lineTo(-15, 25);
                ctx.lineTo(-22, 25);
                ctx.lineTo(-12, 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(8, -6);
                ctx.lineTo(-15, -25);
                ctx.lineTo(-22, -25);
                ctx.lineTo(-12, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.ellipse(15, 0, 9, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'pulse': // PULSE STRIKER - Forward swept wings
                const pulseGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
                pulseGrad.addColorStop(0, '#ff9900');
                pulseGrad.addColorStop(0.5, '#ff4400');
                pulseGrad.addColorStop(1, '#660000');
                ctx.fillStyle = pulseGrad;

                // Advanced Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 0);       // Nose
                ctx.lineTo(10, 5);       // mid
                ctx.lineTo(-20, 5);      // rear
                ctx.lineTo(-18, 0);
                ctx.lineTo(-20, -5);
                ctx.lineTo(10, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Forward Swept Wings
                ctx.beginPath();
                ctx.moveTo(0, 5);
                ctx.lineTo(15, 24);
                ctx.lineTo(8, 24);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(15, -24);
                ctx.lineTo(8, -24);
                ctx.lineTo(-10, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.ellipse(12, 0, 8, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'quantum': // QUANTUM - Sci-Fi Interceptor
                const quantumGrad = ctx.createLinearGradient(-25, -25, 25, 25);
                quantumGrad.addColorStop(0, '#00ffcc');
                quantumGrad.addColorStop(0.5, '#00cccc');
                quantumGrad.addColorStop(1, '#006666');
                ctx.fillStyle = quantumGrad;

                // Sleek Split-nose Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 3);
                ctx.lineTo(10, 7);
                ctx.lineTo(-20, 7);
                ctx.lineTo(-25, 0);      // Engine core
                ctx.lineTo(-20, -7);
                ctx.lineTo(10, -7);
                ctx.lineTo(35, -3);
                ctx.lineTo(15, 0);       // Split notch
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Geometric Wings
                ctx.beginPath();
                ctx.moveTo(5, 7);
                ctx.lineTo(-10, 26);
                ctx.lineTo(-22, 26);
                ctx.lineTo(-12, 7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -7);
                ctx.lineTo(-10, -26);
                ctx.lineTo(-22, -26);
                ctx.lineTo(-12, -7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // High-tech pulse cockpit
                ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                ctx.arc(5, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'void': // VOID STALKER - Twin-hull interceptor
                const voidGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
                voidGrad.addColorStop(0, '#111111');
                voidGrad.addColorStop(0.5, '#333333');
                voidGrad.addColorStop(1, '#000000');
                ctx.fillStyle = voidGrad;

                // Dual Fuselage / Twin Hull
                ctx.beginPath();
                ctx.moveTo(35, 10);
                ctx.lineTo(-20, 10);
                ctx.lineTo(-24, 7);
                ctx.lineTo(-24, 13);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(35, -10);
                ctx.lineTo(-20, -10);
                ctx.lineTo(-24, -7);
                ctx.lineTo(-24, -13);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Connecting Wing
                ctx.beginPath();
                ctx.moveTo(10, 10);
                ctx.lineTo(10, -10);
                ctx.lineTo(-15, -10);
                ctx.lineTo(-15, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit on the bridge
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.rect(-5, -6, 12, 12);
                ctx.fill();
                break;

            case 'solar': // SOLAR FLARE - Delta Wing with Canards
                const solarGrad = ctx.createLinearGradient(-25, 0, 25, 0);
                solarGrad.addColorStop(0, '#ffff00');
                solarGrad.addColorStop(0.5, '#ffcc00');
                solarGrad.addColorStop(1, '#ff6600');
                ctx.fillStyle = solarGrad;

                // Long Fuselage
                ctx.beginPath();
                ctx.moveTo(40, 0);       // Nose
                ctx.lineTo(15, 5);       // mid
                ctx.lineTo(-20, 5);      // rear
                ctx.lineTo(-15, 0);
                ctx.lineTo(-20, -5);
                ctx.lineTo(15, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Large Delta Wings
                ctx.beginPath();
                ctx.moveTo(0, 5);
                ctx.lineTo(-25, 30);
                ctx.lineTo(-25, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(-25, -30);
                ctx.lineTo(-25, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Canards (Forward small wings)
                ctx.beginPath();
                ctx.moveTo(25, 4);
                ctx.lineTo(18, 12);
                ctx.lineTo(15, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(25, -4);
                ctx.lineTo(18, -12);
                ctx.lineTo(15, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.ellipse(20, 0, 10, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'bomber': // NOVA BOMBER - Heavy Flying Wing
                const bomberGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 32);
                bomberGrad.addColorStop(0, '#ffffff');
                bomberGrad.addColorStop(0.5, '#00ffff');
                bomberGrad.addColorStop(1, '#003366');
                ctx.fillStyle = bomberGrad;

                // Massive Flying Wing
                ctx.beginPath();
                ctx.moveTo(30, 0);       // Nose
                ctx.lineTo(0, 35);       // Leading edge
                ctx.lineTo(-20, 40);     // Tip
                ctx.lineTo(-15, 20);     // Rear edge
                ctx.lineTo(-25, 0);      // Engine bay
                ctx.lineTo(-15, -20);
                ctx.lineTo(-20, -40);
                ctx.lineTo(0, -35);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit Windows
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(5, -12, 6, 24);

                // Bomb Bay Detail
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.strokeRect(-8, -10, 10, 20);
                break;

            case 'tank': // IRON TURTLE - Heavily Armored Gunship
                const tankGrad = ctx.createLinearGradient(-30, -30, 30, 30);
                tankGrad.addColorStop(0, '#333333');
                tankGrad.addColorStop(0.5, '#666666');
                tankGrad.addColorStop(1, '#222222');
                ctx.fillStyle = tankGrad;

                // Broad Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 0);
                ctx.lineTo(15, 15);
                ctx.lineTo(-25, 15);
                ctx.lineTo(-25, -15);
                ctx.lineTo(15, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Heavy Short Wings
                ctx.beginPath();
                ctx.moveTo(10, 15);
                ctx.lineTo(-5, 32);
                ctx.lineTo(-20, 32);
                ctx.lineTo(-15, 15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -15);
                ctx.lineTo(-5, -32);
                ctx.lineTo(-20, -32);
                ctx.lineTo(-15, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Turret / Cockpit
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(5, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ff3300';
                ctx.fillRect(15, -3, 10, 6); // Cannon
                break;

            case 'wraith': // COSMIC WRAITH - Double Teardrop
                const wraithGrad = ctx.createRadialGradient(-10, 0, 3, 10, 0, 20);
                wraithGrad.addColorStop(0, '#9966ff');
                wraithGrad.addColorStop(0.5, '#6633ff');
                wraithGrad.addColorStop(1, '#220066');
                ctx.fillStyle = wraithGrad;
                ctx.beginPath();
                ctx.moveTo(-10, -22);
                ctx.quadraticCurveTo(-18, -10, -16, 0);
                ctx.quadraticCurveTo(-18, 10, -10, 22);
                ctx.lineTo(-2, 10);
                ctx.lineTo(-2, -10);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(10, -22);
                ctx.quadraticCurveTo(18, -10, 16, 0);
                ctx.quadraticCurveTo(18, 10, 10, 22);
                ctx.lineTo(2, 10);
                ctx.lineTo(2, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ff00ff';
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(3, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(-3, 0);
                ctx.closePath();
                ctx.fill();
                break;

            case 'vanguard': // VANGUARD - Armored Spearhead Fighter
                const vanguardGrad = ctx.createLinearGradient(-25, -25, 25, 25);
                vanguardGrad.addColorStop(0, '#ffffff');
                vanguardGrad.addColorStop(0.5, '#4facfe');
                vanguardGrad.addColorStop(1, '#00f2fe');
                ctx.fillStyle = vanguardGrad;

                // Narrow Sharp Fuselage
                ctx.beginPath();
                ctx.moveTo(42, 0);       // Nose
                ctx.lineTo(15, 5);
                ctx.lineTo(-20, 5);
                ctx.lineTo(-15, 0);
                ctx.lineTo(-20, -5);
                ctx.lineTo(15, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Triple Wing Design
                ctx.beginPath();
                ctx.moveTo(10, 5);
                ctx.lineTo(-12, 28);
                ctx.lineTo(-18, 28);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -5);
                ctx.lineTo(-12, -28);
                ctx.lineTo(-18, -28);
                ctx.lineTo(-10, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Vertical Stabilizer (drawn at an angle)
                ctx.beginPath();
                ctx.moveTo(-5, 0);
                ctx.lineTo(-22, 10);
                ctx.lineTo(-22, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.ellipse(18, 0, 10, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'eclipse': // ECLIPSE - Advanced Delta Interceptor
                const eclipseGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
                eclipseGrad.addColorStop(0, '#ffffff');
                eclipseGrad.addColorStop(0.5, '#0066ff');
                eclipseGrad.addColorStop(1, '#0033ff');
                ctx.fillStyle = eclipseGrad;

                // Broad Sci-fi Fuselage
                ctx.beginPath();
                ctx.moveTo(40, 0);
                ctx.lineTo(10, 8);
                ctx.lineTo(-25, 10);
                ctx.lineTo(-25, -10);
                ctx.lineTo(10, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wide Delta Wings
                ctx.beginPath();
                ctx.moveTo(10, 8);
                ctx.lineTo(-15, 30);
                ctx.lineTo(-25, 30);
                ctx.lineTo(-15, 8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -8);
                ctx.lineTo(-15, -30);
                ctx.lineTo(-25, -30);
                ctx.lineTo(-15, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Canopy
                ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                ctx.beginPath();
                ctx.ellipse(15, 0, 12, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'guardian': // GALAXY GUARDIAN - Armored Hex-Fighter
                const guardGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
                guardGrad.addColorStop(0, '#ffffff');
                guardGrad.addColorStop(0.5, '#cccccc');
                guardGrad.addColorStop(1, '#666666');
                ctx.fillStyle = guardGrad;

                // Heavy Hexagonal Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 0);
                ctx.lineTo(10, 15);
                ctx.lineTo(-15, 15);
                ctx.lineTo(-25, 0);
                ctx.lineTo(-15, -15);
                ctx.lineTo(10, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Structural Wings
                ctx.beginPath();
                ctx.moveTo(10, 15);
                ctx.lineTo(-10, 32);
                ctx.lineTo(-20, 28);
                ctx.lineTo(-15, 15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -15);
                ctx.lineTo(-10, -32);
                ctx.lineTo(-20, -28);
                ctx.lineTo(-15, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Command Cockpit
                ctx.fillStyle = '#00f3ff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f3ff';
                ctx.beginPath();
                ctx.rect(0, -6, 15, 12);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'obliterator': // OBLITERATOR PRIME - Heavy Wedge Fighter
                const obliteratorGrad = ctx.createLinearGradient(-30, -10, 30, 10);
                obliteratorGrad.addColorStop(0, '#ff3366');
                obliteratorGrad.addColorStop(0.5, '#ff6699');
                obliteratorGrad.addColorStop(1, '#990022');
                ctx.fillStyle = obliteratorGrad;

                // Broad Wedge Fuselage
                ctx.beginPath();
                ctx.moveTo(38, 0);
                ctx.lineTo(10, 15);
                ctx.lineTo(-20, 18);
                ctx.lineTo(-20, -18);
                ctx.lineTo(10, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Heavy Wings
                ctx.beginPath();
                ctx.moveTo(0, 15);
                ctx.lineTo(-15, 30);
                ctx.lineTo(-25, 30);
                ctx.lineTo(-20, 15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.lineTo(-15, -30);
                ctx.lineTo(-25, -30);
                ctx.lineTo(-20, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.ellipse(15, 0, 10, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'shadowblade': // SHADOWBLADE - Sleek Stealth Interceptor
                const shadowGrad = ctx.createRadialGradient(-15, 0, 3, 15, 0, 24);
                shadowGrad.addColorStop(0, '#1a1a2e');
                shadowGrad.addColorStop(0.5, '#16213e');
                shadowGrad.addColorStop(1, '#0f3460');
                ctx.fillStyle = shadowGrad;

                // Needle Fuselage
                ctx.beginPath();
                ctx.moveTo(42, 0);       // Ultra-sharp nose
                ctx.lineTo(10, 4);
                ctx.lineTo(-20, 4);
                ctx.lineTo(-15, 0);
                ctx.lineTo(-20, -4);
                ctx.lineTo(10, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Swept Blade-like Wings
                ctx.beginPath();
                ctx.moveTo(5, 4);
                ctx.lineTo(-15, 32);
                ctx.lineTo(-25, 32);
                ctx.lineTo(-10, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -4);
                ctx.lineTo(-15, -32);
                ctx.lineTo(-25, -32);
                ctx.lineTo(-10, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.ellipse(20, 0, 12, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'inferno': // INFERNO KING - Fire-swept Fighter
                const infernoGrad = ctx.createRadialGradient(0, -8, 5, 0, 8, 26);
                infernoGrad.addColorStop(0, '#ffff00');
                infernoGrad.addColorStop(0.5, '#ff6600');
                infernoGrad.addColorStop(1, '#ff0000');
                ctx.fillStyle = infernoGrad;

                // Aggressive Fuselage
                ctx.beginPath();
                ctx.moveTo(40, 0);
                ctx.lineTo(10, 8);
                ctx.lineTo(-20, 10);
                ctx.lineTo(-18, 0);
                ctx.lineTo(-20, -10);
                ctx.lineTo(10, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // "Flame" Wings
                ctx.beginPath();
                ctx.moveTo(5, 8);
                ctx.lineTo(-15, 30);
                ctx.lineTo(-22, 22);
                ctx.lineTo(-12, 8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -8);
                ctx.lineTo(-15, -30);
                ctx.lineTo(-22, -22);
                ctx.lineTo(-12, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Double Cockpit
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(10, 4, 3, 0, Math.PI * 2);
                ctx.arc(10, -4, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'juggernaut': // JUGGERNAUT - Heavy Shield
                const juggernautGrad = ctx.createLinearGradient(-22, -22, 22, 22);
                juggernautGrad.addColorStop(0, '#ff9900');
                juggernautGrad.addColorStop(0.5, '#ff7700');
                juggernautGrad.addColorStop(1, '#cc4400');
                ctx.fillStyle = juggernautGrad;
                ctx.beginPath();
                ctx.moveTo(0, -24);
                ctx.lineTo(24, 0);
                ctx.lineTo(0, 24);
                ctx.lineTo(-24, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.beginPath();
                ctx.moveTo(0, -16);
                ctx.lineTo(16, 0);
                ctx.lineTo(0, 16);
                ctx.lineTo(-16, 0);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.moveTo(-6, -6);
                ctx.lineTo(6, -6);
                ctx.lineTo(6, 6);
                ctx.lineTo(-6, 6);
                ctx.closePath();
                ctx.fill();
                break;

            case 'tempest': // TEMPEST LORD - Spiral Polygon
                const tempestGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 28);
                tempestGrad.addColorStop(0, '#00ffff');
                tempestGrad.addColorStop(0.5, '#00aaff');
                tempestGrad.addColorStop(1, '#0033ff');
                ctx.fillStyle = tempestGrad;
                ctx.beginPath();
                for (let i = 0; i < 12; i++) {
                    const angle = i * Math.PI / 6;
                    const r = 24 - i * 1.5;
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = i * Math.PI / 3;
                    const x = Math.cos(angle) * 16;
                    const y = Math.sin(angle) * 16;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
                break;

            case 'reaper': // VOID REAPER - Curved Crescent
                const reaperGrad = ctx.createRadialGradient(10, 0, 3, -10, 0, 24);
                reaperGrad.addColorStop(0, '#1a1a1a');
                reaperGrad.addColorStop(0.5, '#333333');
                reaperGrad.addColorStop(1, '#000000');
                ctx.fillStyle = reaperGrad;
                ctx.beginPath();
                ctx.moveTo(18, -18);
                ctx.quadraticCurveTo(22, 0, 18, 18);
                ctx.lineTo(-14, 12);
                ctx.quadraticCurveTo(-18, 0, -14, -12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(14, -12);
                ctx.quadraticCurveTo(18, 0, 14, 12);
                ctx.stroke();
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.moveTo(-4, -2);
                ctx.lineTo(-2, 0);
                ctx.lineTo(-4, 2);
                ctx.lineTo(-6, 0);
                ctx.closePath();
                ctx.fill();
                break;

            case 'crimson_emperor': // CRIMSON EMPEROR - Crown
                const crimsonGrad = ctx.createRadialGradient(0, -5, 3, 0, 5, 28);
                crimsonGrad.addColorStop(0, '#dc143c');
                crimsonGrad.addColorStop(0.5, '#ff0000');
                crimsonGrad.addColorStop(1, '#660000');
                ctx.fillStyle = crimsonGrad;
                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const angle = i * Math.PI / 5 - Math.PI / 2;
                    const r = (i % 2 === 0) ? 28 : 14;
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.moveTo(0, -14);
                ctx.lineTo(3, -8);
                ctx.lineTo(6, -12);
                ctx.lineTo(3, -6);
                ctx.lineTo(0, -10);
                ctx.closePath();
                ctx.fill();
                break;

            case 'phoenix': // CELESTIAL PHOENIX - Bird-tail Jet
                const phoenixGrad = ctx.createLinearGradient(-20, -10, 30, 10);
                phoenixGrad.addColorStop(0, '#ffa500');
                phoenixGrad.addColorStop(0.5, '#ff6600');
                phoenixGrad.addColorStop(1, '#ff3300');
                ctx.fillStyle = phoenixGrad;

                // Elegant Fuselage
                ctx.beginPath();
                ctx.moveTo(45, 0);       // Long nose
                ctx.lineTo(15, 6);
                ctx.lineTo(-15, 8);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-15, -8);
                ctx.lineTo(15, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Swept Triple-tip Wings
                ctx.beginPath();
                ctx.moveTo(5, 6);
                ctx.lineTo(-10, 32);
                ctx.lineTo(-25, 25);
                ctx.lineTo(-15, 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -6);
                ctx.lineTo(-10, -32);
                ctx.lineTo(-25, -25);
                ctx.lineTo(-15, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Tail plumage (Stabilizers)
                ctx.beginPath();
                ctx.moveTo(-15, 4);
                ctx.lineTo(-30, 15);
                ctx.lineTo(-30, -15);
                ctx.lineTo(-15, -4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.ellipse(25, 0, 12, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'starborn': // STARBORN TITAN - Trident
                const starbornGrad = ctx.createLinearGradient(-20, -10, 30, 10);
                starbornGrad.addColorStop(0, '#99ffcc');
                starbornGrad.addColorStop(0.5, '#55ff99');
                starbornGrad.addColorStop(1, '#00cc66');
                ctx.fillStyle = starbornGrad;
                ctx.beginPath();
                ctx.moveTo(30, 0);
                ctx.lineTo(8, 10);
                ctx.lineTo(12, 24);
                ctx.lineTo(0, 16);
                ctx.lineTo(-12, 24);
                ctx.lineTo(-8, 10);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-8, -10);
                ctx.lineTo(-12, -24);
                ctx.lineTo(0, -16);
                ctx.lineTo(12, -24);
                ctx.lineTo(8, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(4, -4);
                ctx.lineTo(8, 0);
                ctx.lineTo(4, 4);
                ctx.lineTo(0, 8);
                ctx.lineTo(-4, 4);
                ctx.lineTo(-8, 0);
                ctx.lineTo(-4, -4);
                ctx.closePath();
                ctx.fill();
                break;

            case 'leviathan': // LEVIATHAN ROX - Wave Pattern
                const leviathanGrad = ctx.createLinearGradient(-30, -20, 30, 20);
                leviathanGrad.addColorStop(0, '#003d82');
                leviathanGrad.addColorStop(0.5, '#0066cc');
                leviathanGrad.addColorStop(1, '#004400');
                ctx.fillStyle = leviathanGrad;
                ctx.beginPath();
                ctx.moveTo(32, 0);
                ctx.bezierCurveTo(20, 14, 0, 22, -20, 18);
                ctx.lineTo(-26, 8);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-26, -8);
                ctx.bezierCurveTo(0, -22, 20, -14, 32, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#00ff88';
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(-16 + i * 10, 18);
                    ctx.lineTo(-14 + i * 10, 24);
                    ctx.lineTo(-12 + i * 10, 18);
                    ctx.closePath();
                    ctx.fill();
                }
                break;

            case 'sentinel': // ETERNAL SENTINEL - Complex Star
                const sentinelGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 32);
                sentinelGrad.addColorStop(0, '#ffffff');
                sentinelGrad.addColorStop(0.4, '#e8e8e8');
                sentinelGrad.addColorStop(1, '#666666');
                ctx.fillStyle = sentinelGrad;
                ctx.beginPath();
                for (let i = 0; i < 12; i++) {
                    const angle = i * Math.PI / 6;
                    const r = (i % 2 === 0) ? 32 : 16;
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#00ff00';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00ff00';
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = i * Math.PI / 4;
                    const x = Math.cos(angle) * 12;
                    const y = Math.sin(angle) * 12;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = i * Math.PI / 4;
                    const x = Math.cos(angle) * 18;
                    const y = Math.sin(angle) * 18;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
                break;
        }

        // Common Engine Glow
        const engineColor = (this.isDashing) ? '#ffffaa' : '#ff8800';
        ctx.shadowBlur = 25;
        ctx.shadowColor = engineColor;
        ctx.fillStyle = engineColor;

        // Single central exhaust for sleek jets, dual for heavies
        const isHeavy = ['tank', 'bomber', 'rapid', 'guardian', 'juggernaut'].includes(type);

        if (isHeavy) {
            // Dual Exhausts
            ctx.beginPath();
            ctx.arc(-22, 6, 4, 0, Math.PI * 2);
            ctx.arc(-22, -6, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Single Central Exhaust
            ctx.beginPath();
            ctx.arc(-20, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    takeDamage(amount) {
        // Check if player is invulnerable
        if (this.isInvincible || this.invulnerableTimer > 0 || this.invulnerabilityTimer > 0 || this.isDashing) {
            return false; // No damage taken
        }

        this.currentHealth -= amount;
        this.damageFlashTimer = 0.2; // Flash for 200ms
        this.invulnerableTimer = this.invulnerableDuration;

        // Play damage sound
        if (this.game.audio) {
            this.game.audio.explosion();
        }

        // Check if dead
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            return true; // Player died
        }

        return false; // Player survived
    }

    applyPowerUp(type) {
        const duration = 5.0; // 5 seconds for all power-ups

        switch (type) {
            case 'speed':
                this.speedBoostTimer = duration;
                break;
            case 'slowmo':
                this.slowMotionTimer = duration;
                break;
            case 'invulnerability':
                this.invulnerabilityTimer = duration;
                break;
            case 'health_recover':
                this.currentHealth = Math.min(this.currentHealth + 1, this.maxHealth);
                break;
            case 'health_boost':
                this.maxHealth = Math.min(this.maxHealth + 1, 10);
                this.currentHealth = this.maxHealth;
                break;
            case 'shield':
                this.invulnerableTimer = 5.0; // 5 seconds of shield
                break;
            case 'double_damage':
                this.doubleDamageTimer = 10.0; // 10 seconds of double damage
                if (!this.baseBulletDamage) this.baseBulletDamage = this.bulletDamage;
                this.bulletDamage = this.baseBulletDamage * 2;
                break;
            case 'rapid_fire':
                this.rapidFireTimer = 8.0; // 8 seconds of rapid fire
                if (!this.baseFireRate) this.baseFireRate = this.fireRate;
                this.fireRate = this.baseFireRate * 0.5; // Double fire rate
                break;
        }

        // Play power-up sound
        if (this.game.audio) {
            this.game.audio.dash();
        }
    }

    isInvulnerable() {
        return this.invulnerableTimer > 0 || this.invulnerabilityTimer > 0 || this.isDashing;
    }

    findNearestEnemy(range) {
        // Disable auto-targeting when boss is present
        if (this.game.boss) return null;

        let nearest = null;
        let minDist = range;

        this.game.enemies.forEach(enemy => {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        });

        return nearest;
    }
}
