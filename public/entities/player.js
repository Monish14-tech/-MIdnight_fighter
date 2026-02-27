import { AfterburnerTrail } from './particle.js';
import { Projectile } from './projectile.js';

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
            const count = this.missileCount || 1;
            for (let i = 0; i < count; i++) {
                const offset = count > 1 ? (i - (count - 1) / 2) * 0.2 : 0;
                const p = new Projectile(this.game, this.x, this.y, this.angle + offset, 'missile', this.playerId);
                this.game.projectiles.push(p);
            }
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
        // Use shipType to determine visuals
        // If drawing from store preview (mockGame), we might rely on the passed color or context.
        // But for shape, we need the type.
        // We added this.shipType in constructor.

        const type = this.shipType || 'default';

        ctx.fillStyle = mainColor;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        switch (type) {
            case 'tank': // V.G. TITAN - Heavy Industrial Tech
                // Main Hull - Metallic Green
                const tankGrad = ctx.createLinearGradient(-15, -15, 15, 15);
                tankGrad.addColorStop(0, '#1a331a');
                tankGrad.addColorStop(0.5, '#4d994d');
                tankGrad.addColorStop(1, '#004d00');
                ctx.fillStyle = tankGrad;

                // Armor Block Shape
                ctx.beginPath();
                ctx.moveTo(18, 0); // Blunt nose
                ctx.lineTo(8, 14);
                ctx.lineTo(-12, 16); // Wide rear
                ctx.lineTo(-18, 8);
                ctx.lineTo(-18, -8);
                ctx.lineTo(-12, -16);
                ctx.lineTo(8, -14);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Heavy Plating Detail
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(-10, -6, 12, 12); // Center plate

                // Engine Vents
                ctx.fillStyle = '#000';
                ctx.fillRect(-18, -4, 4, 8);
                break;

            case 'scout': // RAZORBACK - Aerodynamic Needle
                // Fuselage - Racing Yellow
                const scoutGrad = ctx.createLinearGradient(0, -10, 0, 10);
                scoutGrad.addColorStop(0, '#b3b300');
                scoutGrad.addColorStop(0.5, '#ffff00');
                scoutGrad.addColorStop(1, '#b3b300');
                ctx.fillStyle = scoutGrad;

                ctx.beginPath();
                ctx.moveTo(35, 0); // Extremely long nose
                ctx.lineTo(-5, 4);
                ctx.lineTo(-20, 10); // Wing tip back
                ctx.lineTo(-15, 2);
                ctx.lineTo(-15, -2);
                ctx.lineTo(-20, -10);
                ctx.lineTo(-5, -4);
                ctx.closePath();
                ctx.fill();

                // Cockpit Strip
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-5, 0);
                ctx.stroke();
                break;

            case 'fighter': // CRIMSON FURY - Stealth Aggressor
                // Gradient - menacing red/black
                const fighterGrad = ctx.createLinearGradient(-10, 0, 20, 0);
                fighterGrad.addColorStop(0, '#330000');
                fighterGrad.addColorStop(0.5, '#cc0000');
                fighterGrad.addColorStop(1, '#ff3333');
                ctx.fillStyle = fighterGrad;

                // Main body
                ctx.beginPath();
                ctx.moveTo(25, 0);
                ctx.lineTo(5, 4);
                ctx.lineTo(0, 12);
                ctx.lineTo(15, 20); // Forward swept wing tip
                ctx.lineTo(-10, 8);
                ctx.lineTo(-20, 0); // Tail
                ctx.lineTo(-10, -8);
                ctx.lineTo(15, -20); // Forward swept wing tip
                ctx.lineTo(0, -12);
                ctx.lineTo(5, -4);
                ctx.closePath();
                ctx.fill();

                // Highlights
                ctx.strokeStyle = '#ff9999';
                ctx.lineWidth = 1;
                ctx.stroke();
                break;

            case 'rapid': // STORM BRINGER - Gatling Tech
                // Purple/Chrome
                const rapidGrad = ctx.createLinearGradient(-20, 0, 20, 0);
                rapidGrad.addColorStop(0, '#2a004d');
                rapidGrad.addColorStop(0.4, '#aa00ff');
                rapidGrad.addColorStop(1, '#eebbff');
                ctx.fillStyle = rapidGrad;

                ctx.beginPath();
                ctx.moveTo(15, 0);
                ctx.lineTo(5, 5);
                ctx.lineTo(-5, 12); // Stabilizer
                ctx.lineTo(-20, 5); // Engine pod
                ctx.lineTo(-15, 0);
                ctx.lineTo(-20, -5); // Engine pod
                ctx.lineTo(-5, -12);
                ctx.lineTo(5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Multi-barrel Nose
                ctx.fillStyle = '#ccc';
                ctx.beginPath();
                ctx.arc(18, 0, 4, 0, Math.PI * 2); // Gun nose
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(18, -1.5, 1, 0, Math.PI * 2);
                ctx.arc(18, 1.5, 1, 0, Math.PI * 2);
                ctx.arc(19.5, 0, 1, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'bomber': // DOOMSDAY - Strategic Wing
                // Metallic Orange
                const bomberGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 20);
                bomberGrad.addColorStop(0, '#ff6600');
                bomberGrad.addColorStop(1, '#662200');
                ctx.fillStyle = bomberGrad;

                // Flying Wing Shape
                ctx.beginPath();
                ctx.moveTo(15, 0); // Nose
                ctx.lineTo(5, 8);
                ctx.lineTo(0, 25); // Wide wing tip
                ctx.lineTo(-10, 20);
                ctx.lineTo(-5, 5);
                ctx.lineTo(-15, 0); // Rear center
                ctx.lineTo(-5, -5);
                ctx.lineTo(-10, -20);
                ctx.lineTo(0, -25);
                ctx.lineTo(5, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Missile Bay Doors
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(-5, 5, 6, 10);
                ctx.fillRect(-5, -15, 6, 10);
                break;

            case 'phantom': // PHANTOM - Stealth Glass Cannon
                // Dark Purple/Black Stealth
                const phantomGrad = ctx.createLinearGradient(-20, 0, 25, 0);
                phantomGrad.addColorStop(0, '#1a001a');
                phantomGrad.addColorStop(0.5, '#9900ff');
                phantomGrad.addColorStop(1, '#cc66ff');
                ctx.fillStyle = phantomGrad;

                // Sleek Stealth Body
                ctx.beginPath();
                ctx.moveTo(30, 0); // Sharp nose
                ctx.lineTo(10, 3);
                ctx.lineTo(5, 15); // Angled wing
                ctx.lineTo(-15, 12);
                ctx.lineTo(-22, 0);
                ctx.lineTo(-15, -12);
                ctx.lineTo(5, -15);
                ctx.lineTo(10, -3);
                ctx.closePath();
                ctx.fill();

                // Stealth Coating Lines
                ctx.strokeStyle = 'rgba(153,0,255,0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
                break;

            case 'vanguard': // VANGUARD - Elite All-Rounder
                // Cyan/Teal Elite
                const vanguardGrad = ctx.createLinearGradient(-15, 0, 25, 0);
                vanguardGrad.addColorStop(0, '#004d4d');
                vanguardGrad.addColorStop(0.5, '#00ffcc');
                vanguardGrad.addColorStop(1, '#ccffff');
                ctx.fillStyle = vanguardGrad;

                // Advanced Fighter Body
                ctx.beginPath();
                ctx.moveTo(25, 0);
                ctx.lineTo(12, 6);
                ctx.lineTo(8, 18); // Wing
                ctx.lineTo(-8, 15);
                ctx.lineTo(-18, 8);
                ctx.lineTo(-18, -8);
                ctx.lineTo(-8, -15);
                ctx.lineTo(8, -18);
                ctx.lineTo(12, -6);
                ctx.closePath();
                ctx.fill();

                // Elite Markings
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(5, -2, 8, 4);
                ctx.strokeStyle = '#00ffcc';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;

            case 'juggernaut': // JUGGERNAUT - Ultimate Tank
                // Orange/Bronze Heavy
                const juggernautGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
                juggernautGrad.addColorStop(0, '#ff9900');
                juggernautGrad.addColorStop(0.7, '#cc6600');
                juggernautGrad.addColorStop(1, '#663300');
                ctx.fillStyle = juggernautGrad;

                // Massive Fortress Body
                ctx.beginPath();
                ctx.moveTo(20, 0); // Blunt armored nose
                ctx.lineTo(10, 10);
                ctx.lineTo(5, 20); // Heavy wing
                ctx.lineTo(-5, 22);
                ctx.lineTo(-15, 18);
                ctx.lineTo(-22, 10);
                ctx.lineTo(-22, -10);
                ctx.lineTo(-15, -18);
                ctx.lineTo(-5, -22);
                ctx.lineTo(5, -20);
                ctx.lineTo(10, -10);
                ctx.closePath();
                ctx.fill();

                // Heavy Armor Plating
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(-8, -8, 16, 16);
                ctx.strokeStyle = '#ff9900';
                ctx.lineWidth = 3;
                ctx.strokeRect(-8, -8, 16, 16);
                break;

            case 'void': // VOID STALKER - Triple Needle Stealth
                const voidGrad = ctx.createLinearGradient(-20, 0, 40, 0);
                voidGrad.addColorStop(0, '#000033');
                voidGrad.addColorStop(0.5, '#4400ff');
                voidGrad.addColorStop(1, '#000033');
                ctx.fillStyle = voidGrad;

                // Main Central Needle
                ctx.beginPath();
                ctx.moveTo(40, 0);
                ctx.lineTo(10, 4);
                ctx.lineTo(-30, 0);
                ctx.lineTo(10, -4);
                ctx.closePath();
                ctx.fill();

                // Side Needles (Outriggers)
                ctx.fillStyle = '#8800ff';
                ctx.beginPath();
                ctx.moveTo(25, 12);
                ctx.lineTo(5, 14);
                ctx.lineTo(-20, 12);
                ctx.lineTo(5, 10);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(25, -12);
                ctx.lineTo(5, -14);
                ctx.lineTo(-20, -12);
                ctx.lineTo(5, -10);
                ctx.closePath();
                ctx.fill();

                // Connecting Rails
                ctx.strokeStyle = '#4400ff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(10, 4); ctx.lineTo(10, 12);
                ctx.moveTo(10, -4); ctx.lineTo(10, -12);
                ctx.moveTo(-10, 2); ctx.lineTo(-10, 11);
                ctx.moveTo(-10, -2); ctx.lineTo(-10, -11);
                ctx.stroke();
                break;

            case 'pulse': // NEON PULSE - Wingless Twin Core
                const pulseGrad = ctx.createLinearGradient(-25, 0, 25, 0);
                pulseGrad.addColorStop(0, '#00ffff');
                pulseGrad.addColorStop(0.5, '#004444');
                pulseGrad.addColorStop(1, '#00ffff');
                ctx.fillStyle = pulseGrad;

                // Two parallel sleek hulls
                ctx.fillRect(-20, 6, 40, 6);
                ctx.fillRect(-20, -12, 40, 6);

                // Connecting bridge
                ctx.fillStyle = '#00ffff';
                ctx.fillRect(-5, -8, 10, 16);

                // Front emitters
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(22, 9, 3, 0, Math.PI * 2);
                ctx.arc(22, -9, 3, 0, Math.PI * 2);
                ctx.fill();

                // Vertical Stabilizers (Small)
                ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
                ctx.fillRect(-15, 12, 10, 4);
                ctx.fillRect(-15, -16, 10, 4);
                break;

            case 'guardian': // GALAXY GUARDIAN - Massive Hex Fortress
                const guardGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
                guardGrad.addColorStop(0, '#ffffff');
                guardGrad.addColorStop(0.4, '#888888');
                guardGrad.addColorStop(1, '#222222');
                ctx.fillStyle = guardGrad;

                // Large Central Hexagon
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    const rx = Math.cos(angle) * 28;
                    const ry = Math.sin(angle) * 28;
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Outer Shield Plates
                ctx.fillStyle = '#444';
                ctx.fillRect(-32, 15, 15, 10);
                ctx.fillRect(-32, -25, 15, 10);

                // Central Focus Core
                ctx.fillStyle = '#00f3ff';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00f3ff';
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'solar': // SOLAR FLARE - Panel Radiator
                const solarGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 20);
                solarGrad.addColorStop(0, '#ffff00');
                solarGrad.addColorStop(1, '#ff6600');
                ctx.fillStyle = solarGrad;

                // Spherical Core
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI * 2);
                ctx.fill();

                // Large Solar Panels (4 Wings)
                ctx.fillStyle = '#ffaa00';
                for (let i = 0; i < 4; i++) {
                    ctx.save();
                    ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
                    // Rectangular panel
                    ctx.fillRect(8, -18, 20, 36);
                    // Grid lines on panels
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(8, -18, 20, 36);
                    ctx.restore();
                }

                // Central Glowing Rod
                ctx.fillStyle = '#fff';
                ctx.fillRect(5, -2, 25, 4);
                break;

            case 'eclipse': // COSMIC SERAPH - Halo Spear
                const eclipseGrad = ctx.createLinearGradient(-20, 0, 30, 0);
                eclipseGrad.addColorStop(0, '#1a2a3a');
                eclipseGrad.addColorStop(0.5, '#66ccff');
                eclipseGrad.addColorStop(1, '#e6f7ff');
                ctx.fillStyle = eclipseGrad;

                // Spear body
                ctx.beginPath();
                ctx.moveTo(34, 0);
                ctx.lineTo(10, 6);
                ctx.lineTo(-18, 4);
                ctx.lineTo(-26, 0);
                ctx.lineTo(-18, -4);
                ctx.lineTo(10, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Halo ring
                ctx.strokeStyle = '#aaddff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(6, 0, 10, 6, 0, 0, Math.PI * 2);
                ctx.stroke();

                // Wing fins
                ctx.fillStyle = '#66ccff';
                ctx.beginPath();
                ctx.moveTo(4, 8);
                ctx.lineTo(-8, 18);
                ctx.lineTo(-2, 6);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(4, -8);
                ctx.lineTo(-8, -18);
                ctx.lineTo(-2, -6);
                ctx.closePath();
                ctx.fill();
                break;

            case 'obliterator': // MIDNIGHT OBLIVION - Siege Wedge
                const obliteratorGrad = ctx.createLinearGradient(-25, 0, 25, 0);
                obliteratorGrad.addColorStop(0, '#330015');
                obliteratorGrad.addColorStop(0.5, '#ff3366');
                obliteratorGrad.addColorStop(1, '#ffb3cc');
                ctx.fillStyle = obliteratorGrad;

                // Armored wedge hull
                ctx.beginPath();
                ctx.moveTo(28, 0);
                ctx.lineTo(12, 10);
                ctx.lineTo(-18, 18);
                ctx.lineTo(-26, 8);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-26, -8);
                ctx.lineTo(-18, -18);
                ctx.lineTo(12, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Core vents
                ctx.fillStyle = '#111';
                ctx.fillRect(-12, -3, 10, 6);
                ctx.fillStyle = '#ff88aa';
                ctx.fillRect(-8, -2, 4, 4);
                break;

            case 'starborn': // STARFALL TITAN - Trident Ark
                const starbornGrad = ctx.createLinearGradient(-20, -10, 30, 10);
                starbornGrad.addColorStop(0, '#0b2a1f');
                starbornGrad.addColorStop(0.5, '#99ffcc');
                starbornGrad.addColorStop(1, '#e6fff5');
                ctx.fillStyle = starbornGrad;

                // Tri-prong prow
                ctx.beginPath();
                ctx.moveTo(34, 0);
                ctx.lineTo(16, 6);
                ctx.lineTo(8, 16);
                ctx.lineTo(4, 6);
                ctx.lineTo(-18, 10);
                ctx.lineTo(-26, 0);
                ctx.lineTo(-18, -10);
                ctx.lineTo(4, -6);
                ctx.lineTo(8, -16);
                ctx.lineTo(16, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Central crystal
                ctx.fillStyle = '#ccfff0';
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(0, 6);
                ctx.lineTo(-6, 0);
                ctx.lineTo(0, -6);
                ctx.closePath();
                ctx.fill();
                break;

            default: // INTERCEPTOR (Standard)
                // Sci-Fi Chrome/Cyan
                const bodyGrad = ctx.createLinearGradient(-15, 0, 25, 0);
                bodyGrad.addColorStop(0, '#002233');
                bodyGrad.addColorStop(0.4, '#00f3ff');
                bodyGrad.addColorStop(1, '#ffffff');

                ctx.fillStyle = bodyGrad;
                ctx.beginPath();
                ctx.moveTo(28, 0);  // Longer Nose
                ctx.lineTo(15, 5);
                ctx.lineTo(-10, 5);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-10, -5);
                ctx.lineTo(15, -5);
                ctx.closePath();
                ctx.fill();

                // Wings with gradient
                const wingGrad = ctx.createLinearGradient(0, 0, 0, 20);
                wingGrad.addColorStop(0, '#00f3ff');
                wingGrad.addColorStop(1, '#005577');
                ctx.fillStyle = wingGrad;

                // Right Wing
                ctx.beginPath();
                ctx.moveTo(8, 4);
                ctx.lineTo(15, 18);
                ctx.lineTo(5, 22);
                ctx.lineTo(-8, 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Left Wing
                ctx.beginPath();
                ctx.moveTo(8, -4);
                ctx.lineTo(15, -18);
                ctx.lineTo(5, -22);
                ctx.lineTo(-8, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cockpit Glass
                ctx.fillStyle = '#ccffff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f3ff';
                ctx.beginPath();
                ctx.ellipse(5, 0, 8, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        // Common Engine Glow (Enhanced)
        const engineColor = (this.isDashing) ? '#ffffaa' : '#ff8800';
        ctx.shadowBlur = 20;
        ctx.shadowColor = engineColor;
        ctx.fillStyle = engineColor;

        // Draw dual engines for some, single for others
        if (['scout', 'rapid'].includes(type || 'default')) {
            // Single Engine
            ctx.beginPath();
            ctx.arc(-18, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Dual Engines
            ctx.beginPath();
            ctx.arc(-16, 4, 3, 0, Math.PI * 2);
            ctx.arc(-16, -4, 3, 0, Math.PI * 2);
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
