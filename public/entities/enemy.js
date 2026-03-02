import { Projectile } from './projectile.js?v=4';
import { Explosion } from './particle.js?v=4';

// ============================================================
//  EnemyBrain — Advanced AI Module
//  Provides: player movement prediction, threat assessment,
//  pack coordination, and adaptive behavior selection.
//  All randomness uses deterministic sin/cos seeds so co-op
//  PRNG remains perfectly synchronized (no Math.random).
// ============================================================
class EnemyBrain {
    constructor(enemy) {
        this.enemy = enemy;
        this.game = enemy.game;

        // Player movement prediction
        this.playerSamples = [];       // [{x,y,t}] last 20 samples
        this.sampleInterval = 0.1;     // sample every 0.1 s
        this.sampleTimer = 0;
        this.predictedPlayerX = 0;
        this.predictedPlayerY = 0;
        this.playerVelX = 0;
        this.playerVelY = 0;

        // Behavior state
        this.behavior = 'aggro';        // 'aggro'|'flank'|'retreat'|'orbit'
        this.behaviorTimer = 0;
        this.behaviorCooldown = 1.5;

        // Pack coordination
        this.alertRadius = 250;
        this.isAlerted = false;
        this.alertTimer = 0;
        this.flanking = false;
        this.flankSide = 1;            // +1 or -1

        // Targeting bracket visual
        this.bracketAlpha = 0;

        // Counter used safely for deterministic pseudo-random
        const numericId = enemy.getNumericId ? enemy.getNumericId() : 0;
        this._seed = numericId + Math.floor(Math.sin((numericId || 1) * 3.14) * 1000);
    }

    // Deterministic pseudo-random [0,1) — NO Math.random
    _prng(offset = 0) {
        return Math.abs(Math.sin(this._seed + offset + this.game.lastTime * 0.0001));
    }

    update(deltaTime) {
        const player = this.game.player;
        if (!player) return;

        // ── Sample player position ──────────────────────────────
        this.sampleTimer += deltaTime;
        if (this.sampleTimer >= this.sampleInterval) {
            this.sampleTimer = 0;
            this.playerSamples.push({ x: player.x, y: player.y, t: this.game.lastTime });
            if (this.playerSamples.length > 20) this.playerSamples.shift();
        }

        // ── Compute player velocity from last 2 samples ─────────
        if (this.playerSamples.length >= 2) {
            const a = this.playerSamples[this.playerSamples.length - 2];
            const b = this.playerSamples[this.playerSamples.length - 1];
            const dt = Math.max((b.t - a.t) * 0.001, 0.001);
            this.playerVelX = (b.x - a.x) / dt;
            this.playerVelY = (b.y - a.y) / dt;
        }

        // ── Predicted player position (adaptive lead time) ──────────
        // Clamp lead time so chasers don't wildly over-predict at high levels
        const level = this.game.currentLevel || 1;
        const leadTime = Math.max(0.18, 0.38 - level * 0.008);
        this.predictedPlayerX = player.x + this.playerVelX * leadTime;
        this.predictedPlayerY = player.y + this.playerVelY * leadTime;
        // Clamp to arena
        this.predictedPlayerX = Math.max(20, Math.min(this.game.width - 20, this.predictedPlayerX));
        this.predictedPlayerY = Math.max(20, Math.min(this.game.height - 20, this.predictedPlayerY));

        // ── Threat assessment → pick behavior ───────────────────
        this.behaviorTimer += deltaTime;
        if (this.behaviorTimer >= this.behaviorCooldown) {
            this.behaviorTimer = 0;
            const dx = player.x - this.enemy.x;
            const dy = player.y - this.enemy.y;
            const dist = Math.hypot(dx, dy);
            const hpRatio = this.enemy.health / (this.enemy.maxStartingHealth || this.enemy.health);

            if (hpRatio < 0.35 && dist < 200) {
                this.behavior = 'retreat';
            } else if (dist < 120) {
                this.behavior = 'orbit';
            } else if (this.isAlerted && this.flanking) {
                this.behavior = 'flank';
            } else {
                this.behavior = 'aggro';
            }
        }

        // ── Alert nearby allies ──────────────────────────────────
        this.alertTimer += deltaTime;
        if (this.alertTimer > 3.0 && this.behavior === 'aggro') {
            this.alertTimer = 0;
            if (this.game.enemies) {
                for (const e of this.game.enemies) {
                    if (e !== this.enemy && e.brain && !e.brain.isAlerted) {
                        const dist = Math.hypot(e.x - this.enemy.x, e.y - this.enemy.y);
                        if (dist < this.alertRadius) {
                            e.brain.isAlerted = true;
                            e.brain.flanking = true;
                            // Alternate flank side per enemy
                            e.brain.flankSide = e.brain._prng(7) > 0.5 ? 1 : -1;
                        }
                    }
                }
            }
        }

        // ── Targeting bracket fade-in ────────────────────────────
        this.bracketAlpha = Math.min(1, this.bracketAlpha + deltaTime * 2);
    }

    // Returns the angle toward the predicted player position (lead-targeting)
    getLeadAngle() {
        const dx = this.predictedPlayerX - this.enemy.x;
        const dy = this.predictedPlayerY - this.enemy.y;
        return Math.atan2(dy, dx);
    }

    // Returns the angle for flanking movement (offset ±90° from direct line)
    getFlankAngle(directAngle) {
        return directAngle + (Math.PI / 2) * this.flankSide;
    }

    // Returns the "retreat" direction (away from player + slight sideways)
    getRetreatAngle(directAngle) {
        return directAngle + Math.PI + this.flankSide * 0.4;
    }

    // Returns an orbit tangent angle (circles the player)
    getOrbitAngle(directAngle) {
        const orbitSpeed = this._prng(3) > 0.5 ? 1 : -1;
        return directAngle + (Math.PI / 2) * orbitSpeed;
    }

    // Draw targeting bracket (called from Enemy.draw)
    drawBrackets(ctx) {
        if (this.bracketAlpha <= 0) return;
        const px = this.predictedPlayerX - this.enemy.x;
        const py = this.predictedPlayerY - this.enemy.y;
        ctx.save();
        ctx.rotate(-this.enemy.angle); // unrotate so brackets align to world
        ctx.translate(px, py);
        ctx.globalAlpha = this.bracketAlpha * 0.55;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1.5;
        const s = 7, g = 4;
        // Corner brackets
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.beginPath();
            ctx.moveTo(sx * (s + g), sy * g);
            ctx.lineTo(sx * (s + g), sy * (s + g));
            ctx.lineTo(sx * g, sy * (s + g));
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class Enemy {
    constructor(game, type = 'chaser', x = null, y = null) {
        this.game = game;
        this.type = type;
        this.markedForDeletion = false;

        // Spawn at edges — use game.random() for co-op PRNG sync
        const rng = () => (game.random ? game.random() : Math.random());
        if (x !== null && y !== null) {
            this.x = x;
            this.y = y;
        } else {
            if (rng() < 0.5) {
                this.x = rng() < 0.5 ? -50 : this.game.width + 50;
                this.y = rng() * this.game.height;
            } else {
                this.x = rng() * this.game.width;
                this.y = rng() < 0.5 ? -50 : this.game.height + 50;
            }
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
            // Snipers back off more as levels increase
            this.preferredRange = 260 + Math.min((level - 1) * 8, 200);
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

        // ── Attach EnemyBrain for smart AI ──────────────────────
        this.maxStartingHealth = this.health;
        this.brain = new EnemyBrain(this);

        // Swarm flanking init — every swarm enemy gets a flank side
        if (this.type === 'swarm' || this.type === 'swarmer') {
            this.brain.flankSide = Math.sin(this.getNumericId() * 7.3 + 1) > 0 ? 1 : -1;
            this.brain.flanking = true;
        }
    }

    // Helper to extract numeric ID from string (e.g., 'enemy_42' -> 42) to prevent NaN in Math functions
    getNumericId() {
        if (!this.remoteId) return 0;
        if (typeof this.remoteId === 'number') return this.remoteId;
        const match = this.remoteId.match(/\d+$/);
        return match ? parseInt(match[0]) : 0;
    }

    update(deltaTime) {
        if (!this.game.player) return;

        // ── EnemyBrain tick ──────────────────────────────────────
        if (this.brain) this.brain.update(deltaTime);

        const player = this.game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const directAngle = Math.atan2(dy, dx);
        this.angle = directAngle; // default; types may override below

        // Apply slow motion if player has the power-up
        let effectiveSpeed = this.speed;
        if (player.slowMotionTimer > 0) effectiveSpeed *= 0.5;

        // ── Helper: choose movement angle from brain behavior ────
        const getMoveAngle = (baseAngle) => {
            if (!this.brain) return baseAngle;
            switch (this.brain.behavior) {
                case 'retreat': return this.brain.getRetreatAngle(baseAngle);
                case 'orbit': return this.brain.getOrbitAngle(baseAngle);
                case 'flank': return this.brain.getFlankAngle(baseAngle);
                default: return baseAngle;
            }
        };

        // ── Per-type Smart AI Movement ───────────────────────────
        if (this.type === 'chaser') {
            // ★ Predictive intercept — aim at where player WILL be
            const leadAngle = this.brain ? this.brain.getLeadAngle() : directAngle;
            this.angle = leadAngle;
            const moveAngle = getMoveAngle(leadAngle);
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'swarm') {
            // ★ Coordinated pincer — split into two groups from opposite angles
            const pincerAngle = directAngle + (Math.PI / 2.2) * (this.brain ? this.brain.flankSide : 1);
            this.angle = directAngle;
            this.x += Math.cos(pincerAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(pincerAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'swarmer') {
            // ★ Coordinated pincer (same mechanic for larger swarmer)
            const pincerAngle = directAngle + (Math.PI / 2.5) * (this.brain ? this.brain.flankSide : 1);
            this.angle = directAngle;
            this.x += Math.cos(pincerAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(pincerAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'sniper') {
            // ★ Smart range control + strafe
            let moveAngle = directAngle;
            if (dist < this.preferredRange - 40) {
                moveAngle = directAngle + Math.PI; // back off
            } else if (dist > this.preferredRange + 60) {
                moveAngle = directAngle; // close in
            } else {
                // Strafe sideways using brain orbit tangent
                moveAngle = this.brain ? this.brain.getOrbitAngle(directAngle) : directAngle + Math.PI / 2;
            }
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'interceptor') {
            // ★ Dash toward predicted position when player is moving fast
            this.dashTimer -= deltaTime;
            const playerSpeed = this.brain
                ? Math.hypot(this.brain.playerVelX, this.brain.playerVelY)
                : 0;
            // Dash if player is accelerating away
            const pseudoRandom = Math.abs(Math.sin(this.getNumericId() + this.game.lastTime * 0.005));
            if (this.dashTimer <= 0 && (pseudoRandom < 0.3 || playerSpeed > 220)) {
                this.dashTimer = this.dashCooldown;
                effectiveSpeed *= 2.5;
            }
            // Aim at predicted position
            const interceptAngle = this.brain ? this.brain.getLeadAngle() : directAngle;
            this.angle = interceptAngle;
            this.x += Math.cos(interceptAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(interceptAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'heavy') {
            // ★ Zigzag approach — harder to hit
            const zigzag = Math.sin(this.game.lastTime * 0.002 + this.getNumericId()) * 0.6;
            const moveAngle = directAngle + zigzag;
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'tractor') {
            // ★ Orbit player while pulling
            const orbitAngle = this.brain ? this.brain.getOrbitAngle(directAngle) : directAngle;
            this.x += Math.cos(orbitAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(orbitAngle) * effectiveSpeed * deltaTime;
            // Pull force
            if (dist < this.tractorRange) {
                player.x += Math.cos(directAngle) * this.tractorPull * deltaTime;
                player.y += Math.sin(directAngle) * this.tractorPull * deltaTime;
            }

        } else if (this.type === 'blade') {
            // ★ Attacks the player's LANDING ZONE — aims where player will stop
            const landAngle = this.brain ? this.brain.getLeadAngle() : directAngle;
            this.angle = landAngle;
            this.x += Math.cos(landAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(landAngle) * effectiveSpeed * deltaTime;
            this.slashTimer -= deltaTime;

        } else if (this.type === 'phantom') {
            // ★ Phases out (invisible) when a player projectile is aimed at it
            this.phaseTimer -= deltaTime;
            let moveAngle = directAngle;
            // Check if any player projectile is heading toward this phantom
            if (this.phaseTimer <= 0 && this.game.projectiles) {
                for (const p of this.game.projectiles) {
                    if (p.owner === 'player') {
                        const pdx = this.x - p.x;
                        const pdy = this.y - p.y;
                        const projAngle = Math.atan2(pdy, pdx);
                        const projHeading = p.angle || Math.atan2(p.vy || 0, p.vx || 1);
                        const angleDiff = Math.abs(projAngle - projHeading);
                        if (angleDiff < 0.25 && Math.hypot(pdx, pdy) < 180) {
                            // Dodge sideways!
                            this.phaseTimer = this.phaseCooldown;
                            moveAngle = directAngle + (Math.PI / 2) * (this.brain ? this.brain.flankSide : 1);
                            this.isPhasing = true;
                            break;
                        }
                    }
                }
            }
            if (this.phaseTimer > this.phaseCooldown - 0.5) {
                this.isPhasing = true;
            } else {
                this.isPhasing = false;
            }
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'mirror') {
            this.rotation = (this.rotation + 180 * deltaTime) % 360;
            const moveAngle = getMoveAngle(directAngle);
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'pulsar') {
            this.pulseTimer -= deltaTime;
            const moveAngle = getMoveAngle(directAngle);
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;

        } else if (this.type === 'launcher') {
            // ★ Strafe sideways while keeping firing range
            if (dist > 250) {
                this.x += Math.cos(directAngle) * effectiveSpeed * deltaTime;
                this.y += Math.sin(directAngle) * effectiveSpeed * deltaTime;
            } else {
                // Strafe
                const strafeAngle = directAngle + Math.PI / 2;
                this.x += Math.cos(strafeAngle) * effectiveSpeed * 0.65 * deltaTime;
                this.y += Math.sin(strafeAngle) * effectiveSpeed * 0.65 * deltaTime;
            }

        } else {
            // Generic brain-aware movement
            const moveAngle = getMoveAngle(directAngle);
            this.x += Math.cos(moveAngle) * effectiveSpeed * deltaTime;
            this.y += Math.sin(moveAngle) * effectiveSpeed * deltaTime;
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
                        // Lead-targeted missile
                        const aimAngle = this.brain ? this.brain.getLeadAngle() : this.angle;
                        const missile = new Projectile(this.game, this.x, this.y, aimAngle, 'missile', 'enemy');
                        missile.speed = 260;
                        missile.maxSpeed = 700;
                        missile.acceleration = 300;
                        missile.damage = 2;
                        this.game.projectiles.push(missile);
                        this.hasFiredSingleMissile = true;
                    }
                } else {
                    const seed = this.getNumericId() + this.game.lastTime;
                    // Add slight inaccuracy to lead calculation (up to 0.15 radians error)
                    const accuracyError = (this.brain ? (this.brain._prng(99) - 0.5) * 0.3 : 0);
                    const leadAngle = (this.brain ? this.brain.getLeadAngle() : this.angle) + accuracyError;

                    if (dist < 200) {
                        // Close range: slightly more spread (0.2 instead of 0.12)
                        const spread = 0.2 * spreadMultiplier;
                        for (let i = -1; i <= 1; i += 2) {
                            this.game.projectiles.push(new Projectile(this.game, this.x, this.y, leadAngle + spread * i, 'bullet', 'enemy'));
                        }
                    } else {
                        // Long range: much more spread (0.8 instead of 0.5)
                        const spread = (Math.sin(seed * 1.5) * 0.8) * spreadMultiplier;
                        this.game.projectiles.push(new Projectile(this.game, this.x, this.y, leadAngle + spread, 'bullet', 'enemy'));
                    }
                }
            }
        } else if (this.type === 'sniper') {
            this.shootTimer += deltaTime;
            if (this.shootTimer > (2.8 / fireRateMultiplier)) {
                this.shootTimer = 0;
                // Sniper always lead-targets
                const leadAngle = this.brain ? this.brain.getLeadAngle() : this.angle;
                if (singleMissileMode) {
                    if (!this.hasFiredSingleMissile) {
                        const missile = new Projectile(this.game, this.x, this.y, leadAngle, 'missile', 'enemy');
                        missile.speed = 300;
                        missile.maxSpeed = 800;
                        missile.acceleration = 350;
                        missile.damage = 2;
                        missile.color = '#6bd6ff';
                        this.game.projectiles.push(missile);
                        this.hasFiredSingleMissile = true;
                    }
                } else {
                    // Precision lead shot — slightly more spread for fairness
                    const seed = this.getNumericId() + this.game.lastTime;
                    const accuracyError = (this.brain ? (this.brain._prng(88) - 0.5) * 0.15 : 0);
                    const spread = (Math.sin(seed * 2.1) * 0.15) * spreadMultiplier;
                    const shot = new Projectile(this.game, this.x, this.y, leadAngle + spread + accuracyError, 'bullet', 'enemy');
                    shot.speed = 750; // slightly faster for lead-targeting accuracy
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
                    const seed = this.getNumericId() + this.game.lastTime;
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

        // ── Smart AI Visual Indicators ─────────────────────────────
        if (this.brain) {
            // 1. Red targeting brackets (predicted player position)
            this.brain.drawBrackets(ctx);

            // 2. Blue warning arc — shown when about to dash or slash
            const showWarningArc = (
                (this.type === 'interceptor' && this.dashTimer !== undefined && this.dashTimer <= 0.6) ||
                (this.type === 'blade' && this.slashTimer !== undefined && this.slashTimer <= 0.4)
            );
            if (showWarningArc) {
                ctx.save();
                ctx.rotate(-this.angle); // world space
                const pulse = 0.5 + 0.5 * Math.sin(this.game.lastTime * 0.015);
                ctx.globalAlpha = 0.55 + pulse * 0.35;
                ctx.shadowBlur = 14;
                ctx.shadowColor = '#44aaff';
                ctx.strokeStyle = '#44aaff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius + 7 + pulse * 3, -Math.PI * 0.6, Math.PI * 0.6);
                ctx.stroke();
                ctx.restore();
            }

            // 3. Yellow ! alert icon — pack backup signal received
            if (this.brain.isAlerted) {
                ctx.save();
                ctx.rotate(-this.angle); // world space
                const iconPulse = 0.7 + 0.3 * Math.abs(Math.sin(this.game.lastTime * 0.01));
                ctx.globalAlpha = iconPulse * 0.9;
                ctx.font = 'bold 13px monospace';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffdd00';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffaa00';
                ctx.fillText('!', 0, -(this.radius + 12));
                ctx.restore();
            }
        }

        ctx.restore();
    }
}
