import { AfterburnerTrail, PhoenixRebirth } from './particle.js?v=4';
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
        this.prestige = Boolean(stats.prestige);
        this.specialAbility = stats.specialAbility || null;
        this.angle = 0;
        this.radius = 15;
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

        // Ghost powerup
        this.ghostTimer = 0;

        // Passive: partial heal accumulator (for tank/juggernaut/guardian)
        this._passiveHealAccum = 0;

        // ── Per-Ship Passive State Variables ───────────────────────────────────
        this._bloodRushStacks = 0;        // fighter: +5% dmg per kill, max 5
        this._killSinceHit = 0;           // fighter: reset stacks on damage
        this._consecKills = 0;            // inferno: consecutive kills for fire rate
        this._infernoActive = false;      // inferno: fire rate boost active
        this._laserFireTime = 0;          // laser_drone: sustained fire timer
        this._amplifierActive = false;    // laser_drone: +20% dmg boost
        this._eclipseSurvivalTimer = 0;   // eclipse: timed heal
        this._phoenixReviveUsed = false;  // phoenix: once-per-run revive
        this._novaDrainTimer = 0;         // nova: HP drain timer
        this._deathMarkSet = new Set();   // reaper: track first-hit enemies
        this._bossKillCount = 0;          // crimson_emperor / starborn: boss kills
        this._starborMaxHPBonus = 0;      // starborn: bonus max HP from bosses
        this._wraith_coinKills = 0;       // not needed (handled inline on kill)
        this._rapidBurstCounter = 0;      // rapid: track fire count for burst

        // ── Ship Passive Abilities: Constructor Setup ─────────────────────────
        // Speedy ships: shorter dash cooldown
        if (['scout', 'phantom', 'wraith', 'reaper'].includes(shipType)) {
            this.dashCooldown = 3.0;
        }
        // Firepower ships: slight extra fire rate bonus
        if (['rapid', 'pulse', 'laser_drone'].includes(shipType)) {
            this.fireRate = Math.max(0.03, this.fireRate * 0.85);
            this.baseFireRate = this.fireRate;
        }
        // Shadowblade: 30% longer dash (increase dashDuration)
        if (shipType === 'shadowblade') {
            this.dashDuration *= 1.3;
            this.dashSpeed *= 1.2;
        }
        // Nova: all shots deal x2 damage (baked in via multiplier flag)
        if (shipType === 'nova') {
            this.bulletDamage *= 2;
            this.baseBulletDamage = this.bulletDamage;
        }
        // scout: speed bonus flag (applied in update when at full HP)
        this._scoutFullHpSpeed = (shipType === 'scout') ? this.speed * 1.10 : null;

        // ── Entry Animation ─────────────────────────────────────────────────────
        this.isEntering = true;
        this.enterTimer = 0;
        this.enterDuration = 1.5; // seconds to fly in
        // Start below the visible area; will animate to the vertical centre
        this.y = (game.logicalHeight || game.height || 600) + 100;
        this.invulnerableTimer = this.enterDuration + 0.2; // invincible during entry
    }

    update(deltaTime, input) {
        // ── Entry Fly-In Animation ───────────────────────────────────────────────
        if (this.isEntering) {
            this.enterTimer += deltaTime;
            const t = Math.min(this.enterTimer / this.enterDuration, 1);
            // Ease-out cubic so the ship slows into position
            const eased = 1 - Math.pow(1 - t, 3);
            const startY = (this.game.logicalHeight || this.game.height || 600) + 100;
            const targetY = (this.game.logicalHeight || this.game.height || 600) / 2;
            this.y = startY + (targetY - startY) * eased;
            // Angle the ship straight up during approach
            this.angle = -Math.PI / 2;
            // Spawn afterburner trails for visual flair
            this.afterburnerTimer += deltaTime;
            if (this.afterburnerTimer > 0.05) {
                this.afterburnerTimer = 0;
                this.spawnAfterburner();
            }
            if (t >= 1) this.isEntering = false;
            return; // skip all combat / input logic during entry
        }

        // Handle Cooldowns


        // Update health-related timers
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= deltaTime;
        if (this.damageFlashTimer > 0) this.damageFlashTimer -= deltaTime;

        // ── Per-Ship Time-Based Passive Logic ──────────────────────────────
        // Scout: +10% speed at full HP
        if (this.shipType === 'scout' && this._scoutFullHpSpeed) {
            this.speed = (this.currentHealth >= this.maxHealth) ? this._scoutFullHpSpeed : this.speed < this._scoutFullHpSpeed ? this.speed : this._scoutFullHpSpeed / 1.10;
        }
        // Laser Drone: track sustained fire for Amplifier passive
        if (this.shipType === 'laser_drone') {
            if (input && input.keys.fire) {
                this._laserFireTime += deltaTime;
                if (this._laserFireTime >= 3.0 && !this._amplifierActive) {
                    this._amplifierActive = true;
                    this.bulletDamage = this.baseBulletDamage * 1.2;
                }
            } else {
                this._laserFireTime = 0;
                if (this._amplifierActive) {
                    this._amplifierActive = false;
                    this.bulletDamage = this.baseBulletDamage;
                }
            }
        }

        // ── Starborn Titan: Celestial Pull (Item Vacuum) ──
        if (this.shipType === 'starborn' || this.shipType === 'absolute') {
            if (this.game.powerups) {
                this.game.powerups.forEach(p => {
                    const dist = Math.hypot(p.x - this.x, p.y - this.y);
                    if (dist < 300) {
                        const angle = Math.atan2(this.y - p.y, this.x - p.x);
                        const pullSpeed = (300 - dist) * 2;
                        p.x += Math.cos(angle) * pullSpeed * deltaTime;
                        p.y += Math.sin(angle) * pullSpeed * deltaTime;
                    }
                });
            }
            if (this.game.coins_entities) { // Assuming coins exist as separate entities? If not, game.js handles them.
                // Vacuum logic for coins if applicable
            }
        }

        // ── Juggernaut: Adrenaline Rush (Low HP = Rapid Fire) ──
        if (this.shipType === 'juggernaut' || this.shipType === 'absolute') {
            if (this.currentHealth <= this.maxHealth * 0.4) {
                if (!this._adrenalineActive) {
                    this._adrenalineActive = true;
                    this.fireRate = this.baseFireRate * 0.7;
                    if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: 'ADRENALINE!', color: '#ff9900', life: 1.0 });
                }
            } else if (this._adrenalineActive) {
                this._adrenalineActive = false;
                this.fireRate = this.baseFireRate;
            }
        }

        // Update power-up timers
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= deltaTime;
        if (this.slowMotionTimer > 0) this.slowMotionTimer -= deltaTime;
        if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer -= deltaTime;

        // New power-up timers
        if (this.doubleDamageTimer > 0) {
            this.doubleDamageTimer -= deltaTime;
            // Ensure effect is applied (handles re-initialization during ship change)
            if (this.bulletDamage === this.baseBulletDamage) {
                this.bulletDamage = this.baseBulletDamage * 2;
            }
            if (this.doubleDamageTimer <= 0 && this.baseBulletDamage) {
                this.bulletDamage = this.baseBulletDamage;
            }
        }
        if (this.rapidFireTimer > 0) {
            this.rapidFireTimer -= deltaTime;
            // Ensure effect is applied (handles re-initialization during ship change)
            if (this.fireRate === this.baseFireRate) {
                this.fireRate = this.baseFireRate * 0.4;
            }
            if (this.rapidFireTimer <= 0 && this.baseFireRate) {
                this.fireRate = this.baseFireRate; // Reset to normal fire rate
            }
        }
        if (this.ghostTimer > 0) {
            this.ghostTimer -= deltaTime;
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
                // Grant i-frames for the duration of the dash
                this.invulnerableTimer = this.dashDuration + 0.05;
                if (this.game.audio) this.game.audio.dash();
                if (this.game.achievementManager) this.game.achievementManager.addStat('dashes', 1);
            }

            input.keys.dash = false;
        }
        // 360-degree facing: movement direction first, auto-target only while idle.
        if (!this.isDashing) {
            let targetAngleForMovement = null;

            // Prioritize explicit movement input so the ship points where the player steers.
            if (moveVec.x !== 0 || moveVec.y !== 0) {
                const destAngle = Math.atan2(moveVec.y, moveVec.x);
                let diff = destAngle - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.angle += diff * deltaTime * 15;
            } else if (this.game.autoTargetEnabled) {
                const bossActive = this.game.boss && !this.game.boss.markedForDeletion;
                if (!bossActive) {
                    const nearestEnemy = this.findNearestEnemy(700);
                    if (nearestEnemy) {
                        const dx = nearestEnemy.x - this.x;
                        const dy = nearestEnemy.y - this.y;
                        targetAngleForMovement = Math.atan2(dy, dx);
                    }
                }
            }

            if (targetAngleForMovement !== null) {
                const diff = targetAngleForMovement - this.angle;
                const normalizedDiff = diff > Math.PI ? diff - Math.PI * 2 : diff < -Math.PI ? diff + Math.PI * 2 : diff;
                const lockStrength = 4;
                this.angle += normalizedDiff * deltaTime * lockStrength;
            } else if (this.game.boss && !this.game.boss.markedForDeletion && input.keys.fire && moveVec.x === 0 && moveVec.y === 0) {
                // Slight boss assist when stationary and firing.
                const dx = this.game.boss.x - this.x;
                const dy = this.game.boss.y - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 500) {
                    const bossAngle = Math.atan2(dy, dx);
                    let angleDiff = bossAngle - this.angle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                    if (Math.abs(angleDiff) < 0.8) {
                        const bossLockStrength = 3.5;
                        this.angle += angleDiff * deltaTime * bossLockStrength;
                    }
                }
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

            // ── Void Stalker / Absolute: Shadow Step (Leave 1-dmg zone) ──
            if ((this.shipType === 'void' || this.shipType === 'absolute') && Math.random() < 0.3) {
                const zone = new Projectile(this.game, this.x, this.y, 0, 'bullet', this.playerId);
                zone.speed = 0;
                zone.lifetime = 1.0;
                zone.damage = 1;
                zone.piercing = true;
                zone.radius = 35; // 75px diameter -> ~35px radius
                zone.color = 'rgba(68, 0, 255, 0.4)'; // Transparent purple
                this.game.projectiles.push(zone);
            }
        } else {
            this.x += moveVec.x * currentSpeed * deltaTime;
            this.y += moveVec.y * currentSpeed * deltaTime;
        }

        // Boundaries
        this.x = Math.max(this.radius, Math.min(this.game.logicalWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(this.game.logicalHeight - this.radius, this.y));

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

            let shootAngle = this.angle;

            // --- REFINED: Boss Aim Assist (Accuracy Spread) ---
            // We removed mid-air snapping and added a small spread for "fair play" balance
            if (this.game.boss && !this.game.boss.markedForDeletion) {
                const dx = this.game.boss.x - this.x;
                const dy = this.game.boss.y - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 500) { // Range restricted to 500px for close encounters
                    const bossAngle = Math.atan2(dy, dx);
                    let angleDiff = bossAngle - this.angle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                    // If the ship is tilted toward the boss (assist active), add a fair-play spread
                    if (Math.abs(angleDiff) < 0.2) {
                        shootAngle += (Math.random() - 0.5) * 0.12; // 0.12 rad spread (~7 deg)
                    }
                }
            }

            // ── The Absolute / Passives logic helper ──
            const isAbsolute = this.shipType === 'absolute';

            if (this.bulletType === 'spread') {
                const count = (this.shipType === 'bomber' || isAbsolute) ? 5 : 3; // Triple volley / wide spread? Actually bomber is for missiles.
                // Tempest Lord: Lightning God (spread bullets +20% speed)
                const speedMult = (this.shipType === 'tempest' || isAbsolute) ? 1.2 : 1.0;
                for (let i = 0; i < 3; i++) {
                    const offset = (i - 1) * 0.22;
                    const p = new Projectile(this.game, noseX, noseY, shootAngle + offset, 'bullet', this.playerId);
                    p.damage = this.bulletDamage || 1;
                    p.speed = p.speed * speedMult;
                    this.game.projectiles.push(p);
                }
            } else if (this.bulletType === 'railgun') {
                // Single high-speed high-damage piercing shot
                const p = new Projectile(this.game, noseX, noseY, shootAngle, 'bullet', this.playerId);
                p.speed = 2600;
                p.damage = this.bulletDamage || 5;
                p.radius = 7;
                p.piercing = true;
                p.color = '#ffffff';
                this.game.projectiles.push(p);
            } else if (this.bulletType === 'explosive') {
                const p = new Projectile(this.game, noseX, noseY, shootAngle, 'bullet', this.playerId);
                p.damage = this.bulletDamage || 2;
                p.explosive = true;
                p.color = '#ffcc00';
                p.radius = 6;
                // Solar Flare
                if (this.shipType === 'solar' || isAbsolute) p.leavesFire = true;
                // Obliterator Prime
                if (this.shipType === 'obliterator' || isAbsolute) {
                    p.explosionRadiusMult = 1.25;
                    p.explosionDamageMult = 1.25;
                }
                // Leviathan Rox
                if (this.shipType === 'leviathan' || isAbsolute) p.knocksBack = true;
                // Nemesis Prime
                if (this.shipType === 'nemesis' || isAbsolute) p.detonateTwice = true;

                this.game.projectiles.push(p);
            } else if (this.bulletType === 'piercing') {
                const p = new Projectile(this.game, noseX, noseY, shootAngle, 'bullet', this.playerId);
                p.damage = this.bulletDamage || 1;
                p.piercing = true;
                p.color = '#00ff88';
                // Vanguard
                if (this.shipType === 'vanguard' || isAbsolute) p.slowsEnemies = true;
                this.game.projectiles.push(p);
            } else if (this.bulletType === 'laser') {
                // Rapid-fire laser pulses: thin, fast, piercing, short-lived
                const p = new Projectile(this.game, noseX, noseY, shootAngle, 'bullet', this.playerId);
                p.speed = 2200;
                p.damage = this.bulletDamage || 2;
                p.radius = 3;
                p.piercing = true;
                p.lifetime = 0.12;
                p.color = '#ff44ff';
                this.game.projectiles.push(p);
            } else {
                // Normal shot with tiny spread
                const spread = (Math.random() - 0.5) * 0.08;
                const p = new Projectile(this.game, noseX, noseY, shootAngle + spread, 'bullet', this.playerId);
                p.damage = this.bulletDamage || 1;
                this.game.projectiles.push(p);
            }

            // ── Storm Bringer / Absolute: Rapid Suppression ── (Burst every 5th shot)
            if (this.shipType === 'rapid' || isAbsolute) {
                this._rapidShotCount = (this._rapidShotCount || 0) + 1;
                if (this._rapidShotCount % 5 === 0) {
                    // Fire 2 extra bullets immediately slightly offset
                    const p1 = new Projectile(this.game, noseX, noseY, shootAngle - 0.15, 'bullet', this.playerId);
                    const p2 = new Projectile(this.game, noseX, noseY, shootAngle + 0.15, 'bullet', this.playerId);
                    p1.damage = this.bulletDamage || 1; p2.damage = this.bulletDamage || 1;
                    this.game.projectiles.push(p1, p2);
                }
            }

            // Correct: shoot sound for bullets (was wrongly calling dash sound)
            if (this.game.audio) {
                // Use shoot sound if available, fall back to dash
                if (typeof this.game.audio.shoot === 'function') {
                    this.game.audio.shoot(this.shipType);
                }
                // (no fallback — silent fire is better than wrong sfx)
            }
        } else if (type === 'missile') {
            const isAbsolute = this.shipType === 'absolute';
            const missileDmg = Math.max(15, this.bulletDamage * 5); // Scale significantly with ship damage, minimum 15

            // ── Bomber / Absolute: Triple Volley ──
            const count = (this.shipType === 'bomber' || isAbsolute) ? 3 : 1;
            const spread = 0.4; // radians

            for (let i = 0; i < count; i++) {
                const angleOffset = count > 1 ? (-spread / 2 + (spread / (count - 1)) * i) : 0;
                const p = new Projectile(this.game, this.x, this.y, this.angle + angleOffset, 'missile', this.playerId, missileDmg);

                // ── Celestial Striker / Absolute: Missiles auto-split ──
                if (this.shipType === 'celestial' || isAbsolute) {
                    p.autoSplit = true;
                }
                this.game.projectiles.push(p);
            }

            if (this.game.achievementManager) this.game.achievementManager.addStat('missiles', count);
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

        // ── Draw Targeting Reticle on Locked Enemy ──
        // Hide reticle during boss fights
        const bossActive = this.game.boss && !this.game.boss.markedForDeletion;
        if (this.game.autoTargetEnabled && !bossActive) {
            const targetEnemy = this.findNearestEnemy(700);
            if (targetEnemy) {
                ctx.save();
                const boxSize = 25;
                const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;

                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.globalAlpha = pulse * 0.8;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00ff00';

                // Draw corner brackets around target
                const corners = [
                    [-1, -1], [1, -1], [1, 1], [-1, 1]
                ];
                for (const [sx, sy] of corners) {
                    ctx.beginPath();
                    ctx.moveTo(targetEnemy.x + sx * (boxSize - 5), targetEnemy.y + sy * boxSize);
                    ctx.lineTo(targetEnemy.x + sx * boxSize, targetEnemy.y + sy * boxSize);
                    ctx.lineTo(targetEnemy.x + sx * boxSize, targetEnemy.y + sy * (boxSize - 5));
                    ctx.stroke();
                }

                // Draw crosshair center
                ctx.beginPath();
                ctx.moveTo(targetEnemy.x - 8, targetEnemy.y);
                ctx.lineTo(targetEnemy.x + 8, targetEnemy.y);
                ctx.moveTo(targetEnemy.x, targetEnemy.y - 8);
                ctx.lineTo(targetEnemy.x, targetEnemy.y + 8);
                ctx.stroke();

                ctx.restore();
            }
        }

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
            // Co-op Peer Differentiation: If same ship, GUEST (or partner) gets amber glow
            const isPeer = this.playerId !== this.game.playerId && this.game.onlineCoop;
            const sameShipAsLocal = this.shipType === this.game.localShipType;
            const isPrestige = this.prestige || false;

            if (isPeer && sameShipAsLocal) {
                // Amber glow for co-op peer with same ship
                const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
                ctx.shadowBlur = 35 + pulse * 10;
                ctx.shadowColor = '#ff9900'; // Distinct amber color
            } else if (isPrestige) {
                const pulse = Math.sin(Date.now() * 0.003) * 0.4 + 0.6;
                ctx.shadowBlur = 30 + pulse * 15;
                ctx.shadowColor = this.color;
            } else {
                // Normal cyan/ship color glow
                ctx.shadowBlur = 25;
                ctx.shadowColor = this.color;
            }
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

            case 'laser_drone': // LASER DRONE - Autonomous ring fighter
                const laserGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
                laserGrad.addColorStop(0, '#ffffff');
                laserGrad.addColorStop(0.35, '#ff99ee');
                laserGrad.addColorStop(1, '#770055');
                ctx.fillStyle = laserGrad;

                // Central drone core
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Outer control ring
                ctx.strokeStyle = 'rgba(255, 150, 240, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, Math.PI * 2);
                ctx.stroke();

                // Forward nose / laser emitter
                ctx.fillStyle = '#ff00cc';
                ctx.beginPath();
                ctx.moveTo(32, 0);
                ctx.lineTo(12, 6);
                ctx.lineTo(12, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Side pods
                ctx.fillStyle = 'rgba(255, 0, 200, 0.65)';
                ctx.beginPath();
                ctx.rect(-10, 14, 16, 6);
                ctx.rect(-10, -20, 16, 6);
                ctx.fill();
                ctx.stroke();

                // Core glow
                ctx.shadowBlur = 16;
                ctx.shadowColor = '#ff00cc';
                ctx.fillStyle = '#ffccff';
                ctx.beginPath();
                ctx.arc(2, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
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

            case 'wraith': // COSMIC WRAITH - Winged Jet (Purple/Dark)
                const wraithGrad = ctx.createRadialGradient(-10, 0, 3, 10, 0, 20);
                wraithGrad.addColorStop(0, '#9966ff');
                wraithGrad.addColorStop(0.5, '#6633ff');
                wraithGrad.addColorStop(1, '#220066');
                ctx.fillStyle = wraithGrad;

                // Main Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 0);       // Nose
                ctx.lineTo(5, 8);        // Cockpit base
                ctx.lineTo(-20, 5);      // Tail
                ctx.lineTo(-20, -5);
                ctx.lineTo(5, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Aggressive Swept Forward Wings
                ctx.beginPath();
                ctx.moveTo(10, 8);
                ctx.lineTo(-5, 28);
                ctx.lineTo(-15, 28);
                ctx.lineTo(-5, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -8);
                ctx.lineTo(-5, -28);
                ctx.lineTo(-15, -28);
                ctx.lineTo(-5, -5);
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

            case 'tempest': // TEMPEST LORD - Winged Jet (Blue/Cyan)
                const tempestGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 28);
                tempestGrad.addColorStop(0, '#00ffff');
                tempestGrad.addColorStop(0.5, '#00aaff');
                tempestGrad.addColorStop(1, '#0033ff');
                ctx.fillStyle = tempestGrad;

                // Sleek Fuselage
                ctx.beginPath();
                ctx.moveTo(40, 0);
                ctx.lineTo(0, 6);
                ctx.lineTo(-25, 4);
                ctx.lineTo(-25, -4);
                ctx.lineTo(0, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wide Glider Wings
                ctx.beginPath();
                ctx.moveTo(5, 6);
                ctx.lineTo(-10, 35);
                ctx.lineTo(-20, 35);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(5, -6);
                ctx.lineTo(-10, -35);
                ctx.lineTo(-20, -35);
                ctx.lineTo(-10, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Electric detail lines
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(20, 0);
                ctx.stroke();
                break;

            case 'reaper': // VOID REAPER - Winged Jet (Dark Crescent)
                const reaperGrad = ctx.createRadialGradient(10, 0, 3, -10, 0, 24);
                reaperGrad.addColorStop(0, '#1a1a1a');
                reaperGrad.addColorStop(0.5, '#333333');
                reaperGrad.addColorStop(1, '#000000');
                ctx.fillStyle = reaperGrad;

                // Heavy Armored Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 0);
                ctx.lineTo(15, 10);
                ctx.lineTo(-30, 8);
                ctx.lineTo(-30, -8);
                ctx.lineTo(15, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Crescent Shaped Wings
                ctx.beginPath();
                ctx.moveTo(0, 10);
                ctx.quadraticCurveTo(-10, 30, -30, 35);
                ctx.quadraticCurveTo(-20, 20, -20, 8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.quadraticCurveTo(-10, -30, -30, -35);
                ctx.quadraticCurveTo(-20, -20, -20, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Glowing Engines
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.moveTo(-30, -5);
                ctx.lineTo(-35, 0);
                ctx.lineTo(-30, 5);
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
                // Tails
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

            case 'nemesis': // NEMESIS PRIME - Heavy Red/Black Stealth Frame
                const nemesisGrad = ctx.createLinearGradient(-30, 0, 30, 0);
                nemesisGrad.addColorStop(0, '#550011');
                nemesisGrad.addColorStop(0.5, '#ff0044');
                nemesisGrad.addColorStop(1, '#ff3366');
                ctx.fillStyle = nemesisGrad;

                // Aggressive Wide Diamond Fuselage
                ctx.beginPath();
                ctx.moveTo(40, 0);
                ctx.lineTo(10, 20);
                ctx.lineTo(-25, 25);
                ctx.lineTo(-15, 0);
                ctx.lineTo(-25, -25);
                ctx.lineTo(10, -20);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Forward Canards
                ctx.beginPath();
                ctx.moveTo(25, 10);
                ctx.lineTo(15, 25);
                ctx.lineTo(10, 15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(25, -10);
                ctx.lineTo(15, -25);
                ctx.lineTo(10, -15);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Corrupted Core
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(5, 0, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ff0044';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.lineWidth = 1;
                break;

            case 'phantom_x': // PHANTOM-X - Sleek Violet/Neon Railgun Platform
                const phantomXGrad = ctx.createLinearGradient(-25, -20, 25, 20);
                phantomXGrad.addColorStop(0, '#330066');
                phantomXGrad.addColorStop(0.5, '#aa44ff');
                phantomXGrad.addColorStop(1, '#dd88ff');
                ctx.fillStyle = phantomXGrad;

                // Ultra-sleek Needle + Split Wings
                ctx.beginPath();
                ctx.moveTo(45, 0);
                ctx.lineTo(5, 5);
                ctx.lineTo(-30, 12);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-30, -12);
                ctx.lineTo(5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Railgun Rails
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(10, 3);
                ctx.lineTo(40, 2);
                ctx.moveTo(10, -3);
                ctx.lineTo(40, -2);
                ctx.stroke();
                ctx.lineWidth = 1;

                // Neon Phase Core
                ctx.fillStyle = 'rgba(170, 68, 255, 0.8)';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#aa44ff';
                ctx.beginPath();
                ctx.ellipse(15, 0, 10, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'celestial': // CELESTIAL STRIKER - Golden/White Angelic Wings
                const celestGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
                celestGrad.addColorStop(0, '#ffffff');
                celestGrad.addColorStop(0.5, '#ffdd00');
                celestGrad.addColorStop(1, '#ddaa00');
                ctx.fillStyle = celestGrad;

                // Elegant Fuselage
                ctx.beginPath();
                ctx.moveTo(35, 0);
                ctx.lineTo(10, 8);
                ctx.lineTo(-20, 5);
                ctx.lineTo(-25, 0);
                ctx.lineTo(-20, -5);
                ctx.lineTo(10, -8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Sweeping Angelic Wings
                ctx.beginPath();
                ctx.moveTo(10, 8);
                ctx.lineTo(-10, 35);
                ctx.lineTo(-25, 30);
                ctx.lineTo(-12, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(10, -8);
                ctx.lineTo(-10, -35);
                ctx.lineTo(-25, -30);
                ctx.lineTo(-12, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Radiant Core
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffdd00';
                ctx.beginPath();
                ctx.arc(5, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'absolute': // THE ABSOLUTE - Pure White/Prismatic Ultimate Ship
                const absGrad = ctx.createLinearGradient(-30, -30, 30, 30);
                absGrad.addColorStop(0, '#ffffff');
                absGrad.addColorStop(0.3, '#ddffff');
                absGrad.addColorStop(0.7, '#ffddff');
                absGrad.addColorStop(1, '#ffffdd');
                ctx.fillStyle = absGrad;

                // Divine Geometry
                ctx.beginPath();
                ctx.moveTo(40, 0);
                ctx.lineTo(0, 15);
                ctx.lineTo(-30, 30);
                ctx.lineTo(-15, 0);
                ctx.lineTo(-30, -30);
                ctx.lineTo(0, -15);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                // Floating Prisms
                ctx.fillStyle = '#00ffff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(25, 15); ctx.lineTo(15, 25); ctx.lineTo(5, 15); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(25, -15); ctx.lineTo(15, -25); ctx.lineTo(5, -15); ctx.fill();

                // Infinite Core
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            default:
                // Fallback to default shape if somehow missing
                ctx.fillStyle = mainColor || '#00f3ff';
                ctx.beginPath();
                ctx.moveTo(35, 0);
                ctx.lineTo(10, 6);
                ctx.lineTo(-15, 6);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-15, -6);
                ctx.lineTo(10, -6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(8, 6);
                ctx.lineTo(-12, 22);
                ctx.lineTo(-18, 22);
                ctx.lineTo(-12, 6);
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
                break;
                break;

            case 'leviathan': // LEVIATHAN ROX - Heavy Bomber Jet
                const leviathanGrad = ctx.createLinearGradient(-30, -20, 30, 20);
                leviathanGrad.addColorStop(0, '#003d82');
                leviathanGrad.addColorStop(0.5, '#0066cc');
                leviathanGrad.addColorStop(1, '#004400');
                ctx.fillStyle = leviathanGrad;

                // Massive Bomber Fuselage
                ctx.beginPath();
                ctx.moveTo(30, 0);
                ctx.lineTo(10, 12);
                ctx.lineTo(-25, 12);
                ctx.lineTo(-25, -12);
                ctx.lineTo(10, -12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Broad Straight Wings
                ctx.beginPath();
                ctx.moveTo(0, 12);
                ctx.lineTo(-5, 30);
                ctx.lineTo(-15, 30);
                ctx.lineTo(-10, 12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(-5, -30);
                ctx.lineTo(-15, -30);
                ctx.lineTo(-10, -12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Green tech accents
                ctx.fillStyle = '#00ff88';
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(-5 + i * 8, 8);
                    ctx.lineTo(-2 + i * 8, 10);
                    ctx.lineTo(-8 + i * 8, 10);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(-5 + i * 8, -8);
                    ctx.lineTo(-2 + i * 8, -10);
                    ctx.lineTo(-8 + i * 8, -10);
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

            case 'nova': // NOVA ASCENDANT - Supernova lance ship
                const novaGrad = ctx.createRadialGradient(6, 0, 3, 0, 0, 32);
                novaGrad.addColorStop(0, '#ffffff');
                novaGrad.addColorStop(0.4, '#ffeeaa');
                novaGrad.addColorStop(1, '#ff9933');
                ctx.fillStyle = novaGrad;

                // Lance fuselage
                ctx.beginPath();
                ctx.moveTo(44, 0);
                ctx.lineTo(16, 7);
                ctx.lineTo(-18, 10);
                ctx.lineTo(-26, 0);
                ctx.lineTo(-18, -10);
                ctx.lineTo(16, -7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Stellar wings
                ctx.beginPath();
                ctx.moveTo(8, 8);
                ctx.lineTo(-12, 30);
                ctx.lineTo(-26, 34);
                ctx.lineTo(-14, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(8, -8);
                ctx.lineTo(-12, -30);
                ctx.lineTo(-26, -34);
                ctx.lineTo(-14, -10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Supernova core
                ctx.shadowBlur = 22;
                ctx.shadowColor = '#ffeeaa';
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(12, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
        }

        // Common Engine Glow
        const engineColor = (this.isDashing) ? '#ffffaa' : '#ff8800';
        ctx.shadowBlur = 25;
        ctx.shadowColor = engineColor;
        ctx.fillStyle = engineColor;

        // Single central exhaust for sleek jets, dual for heavies
        const isHeavy = ['tank', 'bomber', 'rapid', 'guardian', 'juggernaut', 'laser_drone', 'nova'].includes(type);

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
        // Check all invulnerability conditions
        if (this.isInvincible || this.invulnerableTimer > 0 ||
            this.invulnerabilityTimer > 0 || this.isDashing ||
            this.ghostTimer > 0) {
            return false;
        }

        // ── Phantom: Ghost Protocol ── (15% chance to ignore damage)
        if (this.shipType === 'phantom' && Math.random() < 0.15) {
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 20, text: 'PHASED!', color: '#9900ff', life: 1.0 });
            return false;
        }

        // ── Phantom-X (prestige): 30% damage ignore ──
        if (this.shipType === 'phantom_x' && Math.random() < 0.30) {
            return false;
        }

        // ── V.G. Titan: Reactive Plating (Reflect bullets during dash) ──
        if ((this.shipType === 'tank' || this.shipType === 'absolute') && this.isDashing) {
            // This is handled in Enemy.update() or Collision detection normally
            // But if we're here, it means takeDamage was called (likely by a projectile or contact)
            // If it's a projectile contact, we can mark the projectile for reflection in the game loop.
            // For now, let's just make the player invulnerable during Reactive Plating if they are dashing
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 20, text: 'REFLECTED!', color: '#00ff44', life: 0.8 });
            return false;
        }

        // ── Guardian: Fortress Protocol ── (damage capped at 1 per hit)
        if (this.shipType === 'guardian') {
            amount = Math.min(amount, 1);
        }

        // ── Juggernaut: Unstoppable ── (50% reduction when below 30% HP)
        if (this.shipType === 'juggernaut' && this.currentHealth <= this.maxHealth * 0.3) {
            amount = Math.ceil(amount * 0.5);
        }

        // ── Galaxy Guardian: Repulsor Shield (Knockback area on hit) ──
        if (this.shipType === 'guardian' || this.shipType === 'absolute') {
            this.game.enemies.forEach(e => {
                const dist = Math.hypot(e.x - this.x, e.y - this.y);
                if (dist < 200) {
                    const angle = Math.atan2(e.y - this.y, e.x - this.x);
                    e.x += Math.cos(angle) * 150;
                    e.y += Math.sin(angle) * 150;
                }
            });
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y, text: 'REPULSOR!', color: '#ffffff', life: 0.8 });
        }

        this.currentHealth -= amount;
        this.damageFlashTimer = 0.2;
        this.invulnerableTimer = this.invulnerableDuration;

        // ── Fighter: Blood Rush reset on hit ──
        if (this.shipType === 'fighter' && this._bloodRushStacks > 0) {
            this._bloodRushStacks = 0;
            this.bulletDamage = this.baseBulletDamage;
        }

        // ── Inferno: consecutive kill streak resets on hit ──
        if (this.shipType === 'inferno') {
            this._consecKills = 0;
            if (this._infernoActive) {
                this._infernoActive = false;
                this.fireRate = this.baseFireRate;
            }
        }

        // Play damage sound
        if (this.game.audio) {
            this.game.audio.explosion();
        }

        // Check if dead
        if (this.currentHealth <= 0) {
            // ── Phoenix: Eternal Rebirth ── (Once per match, revive with 3 HP + Animation)
            if (this.shipType === 'phoenix' && !this._phoenixReviveUsed) {
                this._phoenixReviveUsed = true;
                this.currentHealth = 3;
                this.invulnerableTimer = 2.0; // 2s immunity after revive

                // Trigger Phoenix Rebirth Effect
                if (this.game.particles) {
                    this.game.particles.push(new PhoenixRebirth(this.game, this.x, this.y));
                }

                if (this.game.audio) {
                    this.game.audio.explosion(); // Placeholder sound for rebirth
                }

                if (this.game.floatingTexts) {
                    this.game.floatingTexts.push({ x: this.x, y: this.y - 40, text: 'SOLAR REBIRTH!', color: '#ffa500', life: 2.0 });
                }
                return false; // Survived via rebirth
            }

            // ── Rank Perk: HP Mercy (survive first death at 2 HP) ──
            if (!this._rankMercyUsed && this.game.rankPerk && this.game.rankPerk.hpMercy) {
                this._rankMercyUsed = true;
                this.currentHealth = 2;
                this.invulnerableTimer = 1.5;
                if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: 'RANK MERCY!', color: '#ff6600', life: 2.0 });
                return false;
            }

            this.currentHealth = 0;
            return true; // Player died
        }

        return false; // Player survived
    }

    // Called by game when this player kills an enemy (passive ability)
    onEnemyKill(enemy, killedByMissile = false) {
        // ── Eclipse Seraph: Slow Motion on Kill Streak ── (10 kills = 3s Slow Mo)
        if (this.shipType === 'eclipse' || this.shipType === 'absolute') {
            this._eclipseKillStreak = (this._eclipseKillStreak || 0) + 1;
            if (this._eclipseKillStreak >= 10) {
                this._eclipseKillStreak = 0;
                this.slowMotionTimer = 3.0; // 3s Slow Motion
                if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: 'TIME WARP!', color: '#66ccff', life: 1.5 });
            }
        }

        // ── Celestial Striker: EMP Pulse on Missile Kill ──
        if ((this.shipType === 'celestial' || this.shipType === 'absolute') && killedByMissile) {
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: enemy.x, y: enemy.y, text: 'EMP!', color: '#ffff00', life: 0.8 });
            // Apply slow to nearby enemies
            this.game.enemies.forEach(e => {
                const dist = Math.hypot(e.x - enemy.x, e.y - enemy.y);
                if (dist < 120) {
                    e.speedScale = 0.5;
                    e._slowTimer = 2.0;
                }
            });
        }

        // ── Nemesis Prime: Missile Reset on Kill ──
        if (this.shipType === 'nemesis' || this.shipType === 'absolute') {
            this._nemesisKillCount = (this._nemesisKillCount || 0) + 1;
            if (this._nemesisKillCount >= 5) {
                this._nemesisKillCount = 0;
                this.missileTimer = 0; // Instant missile reset
                if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: 'READY!', color: '#ff0033', life: 1.0 });
            }
        }

        // ── Fighter: Blood Rush ── (+5% damage per kill, stacks x5)
        if (this.shipType === 'fighter') {
            this._bloodRushStacks = Math.min(5, (this._bloodRushStacks || 0) + 1);
            this.bulletDamage = this.baseBulletDamage * (1 + this._bloodRushStacks * 0.05);
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 20, text: `BLOOD RUSH x${this._bloodRushStacks}`, color: '#ff0055', life: 1.2 });
        }

        // ── Pulse: Overcharge ── (-0.1s missile CD per kill)
        if (this.shipType === 'pulse') {
            this.missileTimer = Math.max(0, this.missileTimer - 0.1);
        }

        // ── Wraith: Reality Shatter ── (10% chance coin burst)
        if (this.shipType === 'wraith' && Math.random() < 0.10) {
            const bonus = 10;
            this.game.coins = (this.game.coins || 0) + bonus;
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: `+${bonus}c SHATTER`, color: '#cc44ff', life: 1.2 });
        }

        // ── Inferno: Hellfire ── (3+ consecutive kills = +15% fire rate)
        if (this.shipType === 'inferno') {
            this._consecKills = (this._consecKills || 0) + 1;
            if (this._consecKills >= 3 && !this._infernoActive) {
                this._infernoActive = true;
                this.fireRate = Math.max(0.03, this.baseFireRate * 0.85);
                if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: 'HELLFIRE!', color: '#ff4500', life: 1.5 });
            }
        }

        // ── Nemesis (prestige): +1 HP per kill ──
        if (this.shipType === 'nemesis' && this.currentHealth < 50) {
            this.currentHealth += 1;
            this.maxHealth = Math.min(50, Math.max(this.maxHealth, this.currentHealth));
        }
    }

    // Called by game when a boss is defeated
    onBossKill() {
        // ── Crimson Emperor: Missile CD reduction per boss kill ──
        if (this.shipType === 'crimson_emperor') {
            this._bossKillCount = (this._bossKillCount || 0) + 1;
            const reductionFactor = Math.max(0.5, 1.0 - this._bossKillCount * 0.10);
            this.missileCooldown = this.missileCooldown * reductionFactor;
            if (this.game.floatingTexts) this.game.floatingTexts.push({ x: this.x, y: this.y - 30, text: 'MISSILE CD -10%!', color: '#dc143c', life: 1.5 });
        }
    }

    applyPowerUp(type) {
        switch (type) {
            case 'speed':
                this.speedBoostTimer = 6.0;
                break;
            case 'slowmo':
                this.slowMotionTimer = 5.0;
                break;
            case 'invulnerability':
                this.invulnerabilityTimer = 6.0;
                break;
            case 'health_recover':
                this.currentHealth = Math.min(this.currentHealth + 2, this.maxHealth);
                break;
            case 'health_boost':
                this.maxHealth = Math.min(this.maxHealth + 1, 15);
                this.currentHealth = this.maxHealth; // Refill completely
                break;
            case 'shield':
                this.invulnerableTimer = 6.0;
                break;
            case 'double_damage':
                this.doubleDamageTimer = 10.0;
                if (!this.baseBulletDamage) this.baseBulletDamage = this.bulletDamage;
                this.bulletDamage = this.baseBulletDamage * 2;
                break;
            case 'rapid_fire':
                this.rapidFireTimer = 8.0;
                if (!this.baseFireRate) this.baseFireRate = this.fireRate;
                this.fireRate = this.baseFireRate * 0.4; // 2.5x fire rate
                break;
            case 'ghost':
                this.ghostTimer = 4.0; // Phase through enemy contact for 4s
                break;
            case 'emp':
                if (this.game && typeof this.game.triggerEMP === 'function') {
                    this.game.triggerEMP();
                }
                break;
            case 'nuke':
                // Screen-clear handled in game.js checkPowerUpCollisions
                break;
        }

        // Play power-up sound
        if (this.game.audio) this.game.audio.dash();
    }

    isInvulnerable() {
        return this.invulnerableTimer > 0 || this.invulnerabilityTimer > 0 || this.isDashing;
    }

    findNearestEnemy(range) {
        let nearest = null;
        let minDist = range;

        // Check regular enemies
        if (this.game.enemies) {
            this.game.enemies.forEach(enemy => {
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist) {
                    minDist = dist;
                    nearest = enemy;
                }
            });
        }

        // Check boss (boss also follows nearest-priority)
        if (this.game.boss && !this.game.boss.markedForDeletion) {
            const dx = this.game.boss.x - this.x;
            const dy = this.game.boss.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = this.game.boss;
            }
        }

        return nearest;
    }
}
