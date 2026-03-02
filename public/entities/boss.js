import { Projectile } from './projectile.js?v=4';
import { Explosion } from './particle.js?v=4';

// ============================================================
//  BossAI — Smart Strategy Module
//  Tracks player movement samples to detect dodge bias and
//  speed profile, then selects counter-strategies adaptively.
//  All pseudo-randomness is deterministic (sin-based).
// ============================================================
class BossAI {
    constructor(boss) {
        this.boss = boss;
        this.game = boss.game;

        // Player dodge tracking
        this.playerSamples = [];
        this.sampleTimer = 0;
        this.sampleInterval = 0.25; // sample every 0.25s

        // Derived from samples
        this.dodgeBias = 0;     // -1 = left, +1 = right
        this.playerSpeedProfile = 0;  // 0=slow, 1=medium, 2=fast
        this.hitsLanded = 0;
        this.shotsFired = 0;
        this.hitRate = 0;

        // Active strategy
        this.strategy = 'standard'; // 'standard'|'counter-dodge'|'suppress'|'overwhelm'
        this.strategyTimer = 0;
        this.strategyInterval = 4.0;

        // Combo system
        this.combos = {
            A: ['spiral', 'spread', 'missiles'],
            B: ['rapid', 'dash', 'annihilationBeam'],
            C: ['forceField', 'spiral', 'rapid'],  // phase 3 only
        };
        this.currentCombo = 'A';
        this.comboStep = 0;
    }

    update(deltaTime) {
        const player = this.game.player;
        if (!player) return;

        // ── Sample player position ─────────────────────────────
        this.sampleTimer += deltaTime;
        if (this.sampleTimer >= this.sampleInterval) {
            this.sampleTimer = 0;
            this.playerSamples.push({ x: player.x, y: player.y });
            if (this.playerSamples.length > 15) this.playerSamples.shift();
        }

        // ── Compute dodge bias ─────────────────────────────────
        if (this.playerSamples.length >= 6) {
            let leftMoves = 0, rightMoves = 0, totalMag = 0;
            for (let i = 1; i < this.playerSamples.length; i++) {
                const ddx = this.playerSamples[i].x - this.playerSamples[i - 1].x;
                const ddy = this.playerSamples[i].y - this.playerSamples[i - 1].y;
                const mag = Math.hypot(ddx, ddy);
                totalMag += mag;
                // Project movement onto perpendicular (left/right from boss perspective)
                const bossAngle = Math.atan2(player.y - this.boss.y, player.x - this.boss.x);
                const perp = ddx * Math.sin(bossAngle) - ddy * Math.cos(bossAngle);
                if (perp > 0) rightMoves += mag;
                else leftMoves += mag;
            }
            if (totalMag > 0) {
                this.dodgeBias = (rightMoves - leftMoves) / totalMag; // [-1,+1]
            }

            // Player speed profile
            const avgMag = totalMag / (this.playerSamples.length - 1);
            this.playerSpeedProfile = avgMag > 80 ? 2 : (avgMag > 30 ? 1 : 0);
        }

        // ── Select strategy every few seconds ─────────────────
        this.strategyTimer += deltaTime;
        if (this.strategyTimer >= this.strategyInterval) {
            this.strategyTimer = 0;
            this.updateStrategy();
        }
    }

    updateStrategy() {
        const phase = this.boss.phase;
        const absDodgeBias = Math.abs(this.dodgeBias);

        if (phase === 3) {
            this.strategy = 'overwhelm';
        } else if (absDodgeBias > 0.5 && phase >= 2) {
            this.strategy = 'counter-dodge';
        } else if (this.playerSpeedProfile === 2) {
            this.strategy = 'suppress';
        } else {
            this.strategy = 'standard';
        }
    }

    // Get the predicted player position (lead time based on strategy)
    getTargetPosition() {
        const player = this.game.player;
        if (!player || this.playerSamples.length < 2) {
            return player ? { x: player.x, y: player.y } : { x: 0, y: 0 };
        }
        const a = this.playerSamples[this.playerSamples.length - 2];
        const b = this.playerSamples[this.playerSamples.length - 1];
        const dt = this.sampleInterval;
        const vx = (b.x - a.x) / dt;
        const vy = (b.y - a.y) / dt;

        // Lead time depends on strategy
        let lead = 0.3;
        if (this.strategy === 'counter-dodge') {
            // Counter the dodge direction
            lead = 0.5;
        } else if (this.strategy === 'suppress') {
            lead = 0.6; // Further lead for fast players
        } else if (this.strategy === 'overwhelm') {
            lead = 0.4;
        }
        return {
            x: Math.max(20, Math.min(this.game.width - 20, player.x + vx * lead)),
            y: Math.max(20, Math.min(this.game.height - 20, player.y + vy * lead))
        };
    }

    // Get angle toward the counter-dodge zone (opposite of player's expected dodge)
    getCounterDodgeAngle() {
        const target = this.getTargetPosition();
        const dx = target.x - this.boss.x;
        const dy = target.y - this.boss.y;
        // Offset angle in the counter-dodge direction
        const counterOffset = -this.dodgeBias * 0.5;
        return Math.atan2(dy, dx) + counterOffset;
    }

    // Advance to next attack in combo
    nextComboAttack() {
        this.comboStep = (this.comboStep + 1) % this.combos[this.currentCombo].length;
        return this.combos[this.currentCombo][this.comboStep];
    }

    // Pick the best combo for current strategy
    selectCombo() {
        if (this.boss.phase === 3) {
            this.currentCombo = 'C';
        } else if (this.strategy === 'counter-dodge' || this.strategy === 'suppress') {
            this.currentCombo = 'B';
        } else {
            this.currentCombo = 'A';
        }
        this.comboStep = 0;
        return this.combos[this.currentCombo][0];
    }
}

export class Boss {
    constructor(game, level, side = 'top', modelIndex = null) {
        this.game = game;
        this.level = level;
        this.side = side;
        this.type = 'boss';
        this.markedForDeletion = false;

        // Randomize model if not provided
        this.modelIndex = modelIndex !== null ? modelIndex : Math.floor(Math.abs(Math.sin((level + 7) * 3.14)) * 5);

        // Stats scale with level
        const levelScale = 1 + (level - 1) * 0.2; // Scale from 1.0 at level 1 to 1.8 at level 5, 3.8 at level 20
        this.maxHealth = Math.floor(180 * levelScale); // Slightly increased
        this.health = this.maxHealth;
        this.points = Math.floor(1500 * levelScale);
        this.coinReward = Math.floor(200 * level * 0.8); // Balanced linear reward

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

        // ── State Machine ─────────────────────────────────────
        this.state = 'entering';
        this.stateTimer = 0;
        this.phase = 1;                 // 1, 2, 3
        this.repositioningRetried = false; // Track if we've already retried positioning
        this.currentAttack = null;

        // ── Attack Patterns ───────────────────────────────────
        this.patterns = ['spiral', 'spread', 'rapid', 'missiles', 'annihilationBeam', 'forceField', 'thunderstrike'];
        if (this.level >= 10) this.patterns.push('dash');

        // ── Phase transition flags ────────────────────────────
        this.phase2Triggered = false;
        this.phase3Triggered = false;
        this._deathBurstFired = false; // For death animation

        // ── Rage mode ─────────────────────────────────────────
        this.rageMode = false;
        this.rageParticleTimer = 0;

        // ── Force Field attack ────────────────────────────────
        this.forceFieldActive = false;
        this.forceFieldTimer = 0;
        this.forceFieldDuration = 2.0;

        // ── Annihilation Beam ─────────────────────────────────
        this.beamCharging = false;
        this.beamActive = false;
        this.beamTimer = 0;
        this.beamChargeTime = 1.5;
        this.beamFireTime = 0.6;
        this.beamAngle = 0;

        // ── Visuals ───────────────────────────────────────────
        this.tilt = 0;
        this.hasFiredSingleMissile = false;
        this._entrySpawnDone = false; // For entry mini-spawn

        // Firing system (Simple fallback)
        this.fireTimer = 0;
        this.fireRate = 0.3; // Fire every 0.3 seconds
        this.fireDelay = 5.0; // Wait 5 seconds before starting to fire

        // ── Smart BossAI ──────────────────────────────────────
        this.ai = new BossAI(this);
    }

    update(deltaTime) {
        if (this.game.gameOver) return;

        this.stateTimer += deltaTime;
        this.fireTimer += deltaTime;

        // ── BossAI tick ───────────────────────────────────────
        this.ai.update(deltaTime);

        // ── Phase Transitions ─────────────────────────────────
        const hpPct = this.health / this.maxHealth;

        if (!this.phase2Triggered && hpPct <= 0.6) {
            this.phase = 2;
            this.phase2Triggered = true;
            if (this.game.screenShake) this.game.screenShake.trigger(30, 0.5);
            this.game.particles.push(new Explosion(this.game, this.x, this.y, '#ffffff'));
            this.color = '#ff0000'; // Enrage color
            this.rotationSpeed = 2.8;
            this.speed *= 1.2;
        }

        if (!this.phase3Triggered && hpPct <= 0.3) {
            this.phase = 3;
            this.phase3Triggered = true;
            this.rageMode = true;
            if (this.game.screenShake) this.game.screenShake.trigger(50, 1.0);
            // Rage burst — 6 explosions
            for (let i = 0; i < 6; i++) {
                const ra = (i / 6) * Math.PI * 2;
                this.game.particles.push(new Explosion(
                    this.game,
                    this.x + Math.cos(ra) * 60,
                    this.y + Math.sin(ra) * 60,
                    '#ffffff'
                ));
            }
            this.color = '#ffffff'; // Pure rage white
            this.rotationSpeed = 4.0;
            this.speed *= 1.3;
        }

        // ── Rage particle spray ───────────────────────────────
        if (this.rageMode) {
            this.rageParticleTimer += deltaTime;
            if (this.rageParticleTimer > 0.15) {
                this.rageParticleTimer = 0;
                const ra = Math.abs(Math.sin(this.game.lastTime * 0.009)) * Math.PI * 2;
                this.game.particles.push(new Explosion(this.game, this.x + Math.cos(ra) * 40, this.y + Math.sin(ra) * 40, '#ff4400'));
            }
        }

        // ── Single missile opener (level 20+) ─────────────────
        if (this.level >= 20 && !this.hasFiredSingleMissile && this.state !== 'entering' && this.game.player) {
            const target = this.ai.getTargetPosition();
            const missileAngle = Math.atan2(target.y - this.y, target.x - this.x);
            this.fireProjectile(this.x, this.y, missileAngle, 'missile');
            this.hasFiredSingleMissile = true;
        }

        // ── Handle beam cooldown/active state ─────────────────
        if (this.beamCharging || this.beamActive) {
            this._updateBeam(deltaTime);
        }

        // ── Handle force field active state ───────────────────
        if (this.forceFieldActive) {
            this._updateForceField(deltaTime);
        }

        // ── State Machine ─────────────────────────────────────
        switch (this.state) {
            case 'entering': this.handleEntering(deltaTime); break;
            case 'idle': this.handleIdle(deltaTime); break;
            case 'attacking':
                this.handleAttacking(deltaTime);
                // Always move around screen while attacking
                this.moveAroundScreen(deltaTime);
                // Start firing only after 5 second delay
                if (this.stateTimer > this.fireDelay && this.fireTimer > this.fireRate && this.game.player) {
                    this.fireSimple();
                    this.fireTimer = 0;
                }
                break;
            case 'repositioning': this.handleRepositioning(deltaTime); break;
            case 'dashing': this.handleDashing(deltaTime); break;
        }

        // ── Always face player (unless dashing/beam) ─────────
        if (this.state !== 'dashing' && !this.beamActive && this.game.player) {
            const dx = this.game.player.x - this.x;
            const dy = this.game.player.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            let diff = targetAngle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const rotStep = this.rotationSpeed * deltaTime;
            if (Math.abs(diff) < rotStep) this.angle = targetAngle;
            else this.angle += Math.sign(diff) * rotStep;
        }
    }

    handleEntering(deltaTime) {
        const dx = this.targetPoint.x - this.x;
        const dy = this.targetPoint.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // CRITICAL: Timeout to prevent stuck entrance
        if (this.stateTimer > 6.0) {
            this.state = 'idle';
            this.stateTimer = 0;
            this.velocity = { x: 0, y: 0 };
            // Force position to safe center
            this.x = this.game.width / 2;
            this.y = this.game.height / 3;
            return;
        }

        if (dist < 30) {  // Generous tolerance
            this.state = 'idle';
            this.stateTimer = 0;
            this.velocity = { x: 0, y: 0 };

            // Level 5+: spawn 4 swarm enemies on entry
            if (this.level >= 5 && !this._entrySpawnDone && this.game.enemies) {
                this._entrySpawnDone = true;
                for (let i = 0; i < 4; i++) {
                    const a = (Math.PI / 2) * i;
                    // Use game.enemies array directly via the game's spawnEnemy logic
                    this.game.spawnEnemy && this.game.spawnEnemy('swarm', this.x + Math.cos(a) * 80, this.y + Math.sin(a) * 80);
                }
            }
        } else {
            this.x += (dx / dist) * this.speed * deltaTime;
            this.y += (dy / dist) * this.speed * deltaTime;
        }

        // Allow boss to move smoothly from off-screen positions
        // Only prevent going too far past the visible area
        const screenBuffer = 150;
        if (this.x < -screenBuffer) this.x = -screenBuffer;
        if (this.x > this.game.width + screenBuffer) this.x = this.game.width + screenBuffer;
        if (this.y < -screenBuffer) this.y = -screenBuffer;
        if (this.y > this.game.height + screenBuffer) this.y = this.game.height + screenBuffer;
    }

    handleIdle(deltaTime) {
        // Hover movement
        this.y += Math.sin(this.stateTimer * 3) * 0.5;
        this.tilt = Math.sin(this.stateTimer * 2) * 0.1;

        // Keep boss on screen while hovering
        const margin = 70;
        this.y = Math.max(margin, Math.min(this.game.height - margin, this.y));

        const idleDuration = this.phase === 3 ? 0.7 : 1.2;
        if (this.stateTimer > idleDuration) {
            this.state = 'attacking';
            this.stateTimer = 0;
            this.fireTimer = 0; // Reset fire timer when attacking starts
            // ── AI picks the next combo attack ─────────────────
            if (this.phase >= 2) {
                this.currentAttack = this.ai.nextComboAttack();
            } else {
                // Phase 1: deterministic selection
                const seed = (this.getNumericId ? this.getNumericId() : 0) + this.game.currentLevel + Math.floor(this.game.lastTime / 5000);
                const attackIdx = Math.floor(Math.abs(Math.sin(seed)) * 4); // Base 4 patterns
                const basePatterns = ['spiral', 'spread', 'rapid', 'missiles'];
                this.currentAttack = basePatterns[attackIdx];
            }
            // Don't do beam in phase 1
            if (this.currentAttack === 'annihilationBeam' && this.phase < 2) {
                this.currentAttack = 'spread';
            }
            // Don't do force field in phase 1
            if (this.currentAttack === 'forceField' && this.phase < 2) {
                this.currentAttack = 'rapid';
            }
            // Don't do thunderstrike in phase 1
            if (this.currentAttack === 'thunderstrike' && this.phase < 2) {
                this.currentAttack = 'spiral';
            }
        }
    }

    handleAttacking(deltaTime) {
        switch (this.currentAttack) {
            case 'spiral': this.spiralShoot(deltaTime); break;
            case 'spread': this.spreadShoot(deltaTime); break;
            case 'rapid': this.rapidShoot(deltaTime); break;
            case 'missiles': this.missileBarrage(deltaTime); break;
            case 'thunderstrike': this.thunderstrike(deltaTime); break;
            case 'annihilationBeam': this.startAnnihilationBeam(); return;
            case 'forceField': this.startForceField(); return;
            case 'dash':
                this.state = 'dashing';
                this.prepareDash();
                return;
        }

        // End attack after duration
        const attackDuration = this.currentAttack === 'spiral' ? (this.phase === 3 ? 2.0 : 3.0) : (this.phase === 3 ? 1.0 : 2.0);
        if (this.stateTimer > attackDuration) {
            this.state = 'repositioning';
            this.stateTimer = 0;
            this.pickNewPosition();
        }
    }

    moveAroundScreen(deltaTime) {
        // Move in a circular pattern around the screen while attacking
        const centerX = this.game.width / 2;
        const centerY = this.game.height / 3;
        const radius = 200;
        const orbitSpeed = 1.5; // Rad/sec

        // Circular orbit around center point
        const angle = this.stateTimer * orbitSpeed;
        this.x = centerX + Math.cos(angle) * radius;
        this.y = centerY + Math.sin(angle) * radius * 0.6;

        // Clamp to screen bounds
        const margin = 80;
        this.x = Math.max(margin, Math.min(this.game.width - margin, this.x));
        this.y = Math.max(margin, Math.min(this.game.height - margin, this.y));
    }

    fireSimple() {
        // Mix of bullets and missiles - improved accuracy
        const count = this.phase === 2 ? 6 : 4;
        const spread = 0.35; // Tighter spread for better accuracy
        const baseAngle = this.angle;

        // Bullets - more accurate spread
        for (let i = 0; i < count; i++) {
            const angle = baseAngle - spread / 2 + (spread / (count - 1)) * i;
            this.fireProjectile(this.x, this.y, angle, 'bullet');
        }

        // Missiles - fire 2 missiles at player with improved accuracy
        if (this.game.player) {
            const missileSpread = 0.15; // Very tight spread for missile accuracy
            const missileAngle = Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
            this.fireProjectile(this.x, this.y, missileAngle - missileSpread / 2, 'boss_missile');
            this.fireProjectile(this.x, this.y, missileAngle + missileSpread / 2, 'boss_missile');
        }
    }

    pickNewPosition() {
        // Ensure safe zone away from corners (minimum 150px margin from edges)
        const safeMargin = 150;
        const maxX = this.game.width - safeMargin;
        const maxY = this.game.height - safeMargin;
        const minX = safeMargin;
        const minY = safeMargin;

        // Rotate through several predefined safe positions to avoid getting stuck
        const positionIndex = Math.floor(this.stateTimer * 0.5) % 5;
        const positions = [
            { x: this.game.width * 0.25, y: this.game.height * 0.25 },
            { x: this.game.width * 0.75, y: this.game.height * 0.25 },
            { x: this.game.width * 0.5, y: this.game.height * 0.3 },
            { x: this.game.width * 0.3, y: this.game.height * 0.35 },
            { x: this.game.width * 0.7, y: this.game.height * 0.35 }
        ];

        let targetPos = positions[positionIndex];

        // Add some deterministic variation to avoid too predictable patterns
        const seed = (this.remoteId || 0) + this.level;
        const variation = (Math.sin(seed) * 30 + Math.cos(seed * 1.5) * 30);
        targetPos.x += variation;
        targetPos.y += variation * 0.5;

        // Clamp to safe zone
        this.targetPoint = {
            x: Math.max(safeMargin, Math.min(this.game.width - safeMargin, targetPos.x)),
            y: Math.max(safeMargin, Math.min(this.game.height - safeMargin, targetPos.y))
        };
    }

    handleRepositioning(deltaTime) {
        const dx = this.targetPoint.x - this.x;
        const dy = this.targetPoint.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.tilt = (dx / Math.max(dist, 1)) * 0.3;

        const repoSpeed = this.speed * (this.phase === 3 ? 2.2 : 1.5);
        if (dist < 40) {  // Reached target
            this.state = 'idle';
            this.stateTimer = 0;
            this.tilt = 0;
            this.repositioningRetried = false;
            return;
        }

        // If stuck for too long, pick a new position ONCE
        if (this.stateTimer > 4.5 && !this.repositioningRetried) {
            this.repositioningRetried = true;
            this.pickNewPosition();
        }

        // Move toward target
        if (dist > 0) {
            this.x += (dx / dist) * repoSpeed * deltaTime;
            this.y += (dy / dist) * repoSpeed * deltaTime;
        }

        // Force escape from corners with strong push-back
        const hardMargin = 120;
        if (this.x < hardMargin) {
            this.x = hardMargin + 20;
            this.targetPoint.x = Math.max(hardMargin + 100, this.targetPoint.x);
        }
        if (this.x > this.game.width - hardMargin) {
            this.x = this.game.width - hardMargin - 20;
            this.targetPoint.x = Math.min(this.game.width - hardMargin - 100, this.targetPoint.x);
        }
        if (this.y < hardMargin) {
            this.y = hardMargin + 20;
            this.targetPoint.y = Math.max(hardMargin + 100, this.targetPoint.y);
        }
        if (this.y > this.game.height - hardMargin) {
            this.y = this.game.height - hardMargin - 20;
            this.targetPoint.y = Math.min(this.game.height - hardMargin - 100, this.targetPoint.y);
        }

        // Ultimate safety: if STILL stuck after 8 seconds, just go idle
        if (this.stateTimer > 8.0) {
            this.state = 'idle';
            this.stateTimer = 0;
            this.repositioningRetried = false;
        }
    }

    prepareDash() {
        if (!this.game.player) return;
        // Dash toward PREDICTED position
        const target = this.ai.getTargetPosition();
        this.dashTarget = { x: target.x, y: target.y };
        this.stateTimer = 0;
        this.game.particles.push(new Explosion(this.game, this.x, this.y, '#ff0000'));
    }

    handleDashing(deltaTime) {
        if (this.stateTimer < 0.5) {
            // Charge up — use deterministic shake (no Math.random)
            const shake = Math.sin(this.game.lastTime * 0.05) * 6;
            this.x += shake;
            this.y += Math.cos(this.game.lastTime * 0.05) * 6;

            if (this.stateTimer < 0.6) {
                // Keep boss on screen during charge
                const margin = 50;
                this.x = Math.max(margin, Math.min(this.game.width - margin, this.x));
                this.y = Math.max(margin, Math.min(this.game.height - margin, this.y));

                // Lock angle
                const dx = this.dashTarget.x - this.x;
                const dy = this.dashTarget.y - this.y;
                this.angle = Math.atan2(dy, dx);

            } else if (this.stateTimer < 1.1) {
                const dashSpeed = 900 * (this.phase === 3 ? 1.4 : 1.0);
                this.x += Math.cos(this.angle) * dashSpeed * deltaTime;
                this.y += Math.sin(this.angle) * dashSpeed * deltaTime;

                // Keep boss on screen during dash
                const margin = 80;
                this.x = Math.max(margin, Math.min(this.game.width - margin, this.x));
                this.y = Math.max(margin, Math.min(this.game.height - margin, this.y));

                // Deterministic trail
                if (Math.abs(Math.sin(this.game.lastTime * 0.1)) > 0.5) {
                    this.game.particles.push(new Explosion(this.game, this.x, this.y, this.color));
                }
            } else {
                this.state = 'idle';
                this.stateTimer = 0;
            }
        }

        // ── Attack: Spiral Shoot ───────────────────────────────────
        spiralShoot(deltaTime) {
            const fireRateMult = this.phase === 3 ? 2.5 : (this.phase === 2 ? 1.7 : 1.0);
            const fireRate = 0.08 / fireRateMult;
            const totalShots = Math.floor(this.stateTimer / fireRate);
            const prevShots = Math.floor((this.stateTimer - deltaTime) / fireRate);

            if (totalShots > prevShots) {
                const spin = this.stateTimer * (this.phase === 3 ? 7 : 5);
                const arms = this.phase === 3 ? 6 : (this.phase === 2 ? 4 : 2);
                for (let i = 0; i < arms; i++) {
                    const angle = spin + (Math.PI * 2 / arms) * i;
                    this.fireProjectile(this.x, this.y, angle, 'bullet');
                }
            }
        }

        // ── Attack: Spread Shoot ───────────────────────────────────
        spreadShoot(deltaTime) {
            const fireRateMult = this.phase === 3 ? 2.5 : (this.phase === 2 ? 1.7 : 1.0);
            const burstRate = 0.55 / fireRateMult;
            const totalBursts = Math.floor(this.stateTimer / burstRate);
            const prevBursts = Math.floor((this.stateTimer - deltaTime) / burstRate);

            if (totalBursts > prevBursts) {
                const count = this.phase === 3 ? 9 : (this.phase === 2 ? 7 : 5);
                const spread = 0.8;

                // ── AI Strategy: use counter-dodge angle ──────────
                let baseAngle = this.angle;
                if (this.ai.strategy === 'counter-dodge') {
                    baseAngle = this.ai.getCounterDodgeAngle();
                } else {
                    const target = this.ai.getTargetPosition();
                    baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
                }

                for (let i = 0; i < count; i++) {
                    const angle = baseAngle - spread / 2 + (spread / (count - 1)) * i;
                    this.fireProjectile(this.x, this.y, angle, 'bullet');
                }
            }
        }

        // ── Attack: Rapid Shoot ────────────────────────────────────
        rapidShoot(deltaTime) {
            const fireRateMult = this.phase === 3 ? 2.5 : (this.phase === 2 ? 1.7 : 1.0);
            const fireRate = 0.09 / fireRateMult;
            const total = Math.floor(this.stateTimer / fireRate);
            const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);

            if (total > prev) {
                // Aim at predicted player position
                const target = this.ai.getTargetPosition();
                const aimAngle = Math.atan2(target.y - this.y, target.x - this.x);
                // Tiny jitter (deterministic)
                const jitter = Math.sin(total * 2.7 + (this.remoteId || 0)) * 0.08;
                this.fireProjectile(this.x, this.y, aimAngle + jitter, 'bullet');
                // Phase 3: double tap
                if (this.phase === 3) {
                    this.fireProjectile(this.x, this.y, aimAngle - jitter, 'bullet');
                }
            }
        }

        // ── Attack: Missile Barrage ────────────────────────────────
        missileBarrage(deltaTime) {
            const fireRate = this.phase === 3 ? 0.3 : 0.5;
            const total = Math.floor(this.stateTimer / fireRate);
            const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);
            const maxVolley = this.phase === 3 ? 7 : 5;

            if (total > prev && total < maxVolley) {
                const count = this.phase === 3 ? 4 : (this.phase === 2 ? 3 : 2);
                const spread = 0.6;

                // Aim toward predicted player
                const target = this.ai.getTargetPosition();
                const aimAngle = Math.atan2(target.y - this.y, target.x - this.x);

                for (let i = 0; i < count; i++) {
                    const seed = total + i + (this.remoteId || 0);
                    const accuracyOffset = Math.sin(seed * 1.7) * (this.phase === 3 ? 0.1 : 0.15);
                    const angle = aimAngle - spread / 2 + (spread / Math.max(count - 1, 1)) * i + accuracyOffset;
                    this.fireProjectile(this.x, this.y, angle, 'boss_missile');
                }
            }
        }

        // ── NEW Attack: Annihilation Beam ──────────────────────────
        startAnnihilationBeam() {
            if (this.beamCharging || this.beamActive) return;
            this.beamCharging = true;
            this.beamActive = false;
            this.beamTimer = 0;
            // Lock beam angle toward the counter-dodge zone
            if (this.game.player) {
                this.beamAngle = this.ai.strategy === 'counter-dodge'
                    ? this.ai.getCounterDodgeAngle()
                    : Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
            }
            if (this.game.screenShake) this.game.screenShake.trigger(10, 0.3);
            this.state = 'attacking'; // stays in attacking
        }

        _updateBeam(deltaTime) {
            this.beamTimer += deltaTime;

            if (this.beamCharging && this.beamTimer >= this.beamChargeTime) {
                // Start firing
                this.beamCharging = false;
                this.beamActive = true;
                this.beamTimer = 0;
                if (this.game.screenShake) this.game.screenShake.trigger(40, 0.8);
            }

            if (this.beamActive) {
                // Sweep the beam
                const sweepRate = (this.phase === 3 ? 3.0 : 2.0); // radians per second
                this.beamAngle += sweepRate * deltaTime;

                // Spawn projectiles along beam direction rapid-fire
                if (this.beamTimer < this.beamFireTime) {
                    const fireRate = 0.04;
                    const total = Math.floor(this.beamTimer / fireRate);
                    const prev = Math.floor((this.beamTimer - deltaTime) / fireRate);
                    if (total > prev) {
                        const shot = new Projectile(this.game, this.x, this.y, this.beamAngle, 'bullet', 'enemy');
                        shot.speed = 900;
                        shot.damage = 1.5;
                        shot.color = '#ffffff';
                        shot.radius = 6;
                        this.game.projectiles.push(shot);
                        // Also spawn a wide beam projectile
                        const wideShot = new Projectile(this.game, this.x, this.y, this.beamAngle + 0.08, 'bullet', 'enemy');
                        wideShot.speed = 900;
                        wideShot.damage = 1.0;
                        wideShot.color = '#ff4400';
                        wideShot.radius = 5;
                        this.game.projectiles.push(wideShot);
                    }
                } else {
                    // Beam done
                    this.beamActive = false;
                    this.state = 'repositioning';
                    this.stateTimer = 0;
                    this.pickNewPosition();
                }
            }
        }

        // ── NEW Attack: Force Field ────────────────────────────────
        startForceField() {
            if (this.forceFieldActive) return;
            this.forceFieldActive = true;
            this.forceFieldTimer = 0;
            this.isInvulnerable = true;

            // 360° burst ring
            const bulletCount = this.phase === 3 ? 20 : 14;
            for (let i = 0; i < bulletCount; i++) {
                const angle = (i / bulletCount) * Math.PI * 2;
                this.fireProjectile(this.x, this.y, angle, 'bullet');
            }
            if (this.game.screenShake) this.game.screenShake.trigger(20, 0.5);
            this.state = 'attacking';
        }

        _updateForceField(deltaTime) {
            if (!this.forceFieldActive) return;
            // Use its own dedicated timer (forceFieldTimer), NOT stateTimer, to avoid double-advancing
            this.forceFieldTimer += deltaTime;
            if (this.forceFieldTimer >= this.forceFieldDuration) {
                this.forceFieldActive = false;
                this.isInvulnerable = false;
                this.state = 'repositioning';
                this.stateTimer = 0;
                this.pickNewPosition();
            }
        }

        // ── NEW Attack: Thunderstrike ─────────────────────────────────
        thunderstrike(deltaTime) {
            // Fire one asterisk volley: 8 bolts in cardinal + diagonal directions,
            // aimed roughly at player with a slight spread per bolt.
            const fireRate = this.phase === 3 ? 0.35 : 0.55;
            const total = Math.floor(this.stateTimer / fireRate);
            const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);
            if (total <= prev) return;

            const target = this.ai.getTargetPosition();
            const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
            const count = this.phase === 3 ? 10 : 8;

            for (let i = 0; i < count; i++) {
                const spread = ((i / count) * Math.PI * 2);
                const angle = baseAngle + spread;
                const p = this.fireProjectile(this.x, this.y, angle, 'bullet');
                if (p) {
                    p.speed = 480 + (this.level * 8);
                    p.color = '#ffee00';
                    p.radius = 5;
                }
            }
            if (this.game.screenShake) this.game.screenShake.trigger(12, 0.2);
        }

        fireProjectile(x, y, angle, type) {
            const p = new Projectile(this.game, x, y, angle, type === 'boss_missile' ? 'missile' : type, 'enemy');
            p.source = 'boss';

            if (type === 'boss_missile') {
                p.speed = 250;
                p.maxSpeed = 600;
                p.acceleration = 300;
                p.damage = this.level >= 15 ? 2.5 : 1.8;
                p.lifetime = 5.0;
                p.isHoming = false;
                p.color = '#ff0000';
                p.radius = 10;
            } else if (type === 'missile') {
                p.speed = 160;
                p.maxSpeed = 420;
                p.acceleration = 180;
                p.damage = this.level >= 20 ? 1.5 : 1.0;
                p.lifetime = 4.0;
                p.isHoming = false;
            } else {
                p.speed = 350 + (this.level * 5);
                p.damage = Math.max(1, Math.floor(this.level / 5));
            }
            this.game.projectiles.push(p);
            return p; // return so callers can customize further
        }

        takeDamage(amount) {
            if (this.isInvulnerable) return false;
            this.health -= amount;
            // Track hits for AI accuracy adaptation
            if (this.ai) this.ai.hitsLanded++;
            if (this.health <= 0) {
                this.health = 0;
                // ─ Death burst: 12 explosions in a ring ────────────────────────
                if (!this._deathBurstFired) {
                    this._deathBurstFired = true;
                    for (let i = 0; i < 12; i++) {
                        const ra = (i / 12) * Math.PI * 2;
                        const dist = 50 + (i % 3) * 30;
                        this.game.particles.push(new Explosion(
                            this.game,
                            this.x + Math.cos(ra) * dist,
                            this.y + Math.sin(ra) * dist,
                            i % 2 === 0 ? '#ffffff' : this.color
                        ));
                    }
                    if (this.game.screenShake) this.game.screenShake.trigger(80, 1.2);
                }
                return true;
            }
            return false;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // ── Force Field visual ────────────────────────────────
            if (this.forceFieldActive) {
                // NOTE: _updateForceField() is called solely from update() - do NOT call it here.
                const ffPhase = (this.forceFieldTimer / this.forceFieldDuration);
                const ffRadius = this.radius + 15 + Math.sin(this.game.lastTime * 0.015) * 5;
                ctx.save();
                ctx.globalAlpha = 0.7 - ffPhase * 0.5;
                ctx.shadowBlur = 60;
                ctx.shadowColor = '#00f3ff';
                ctx.strokeStyle = '#00f3ff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, ffRadius, 0, Math.PI * 2);
                ctx.stroke();
                // Hexagonal inner pattern
                ctx.globalAlpha = 0.3;
                ctx.strokeStyle = '#aaffff';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    const a = (i / 6) * Math.PI * 2 + this.game.lastTime * 0.003;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a) * ffRadius * 0.9, Math.sin(a) * ffRadius * 0.9);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // ── Beam charging visual ──────────────────────────────
            if (this.beamCharging) {
                const chargeProgress = this.beamTimer / this.beamChargeTime;
                ctx.save();
                ctx.globalAlpha = chargeProgress * 0.8;
                ctx.shadowBlur = 80 * chargeProgress;
                ctx.shadowColor = '#ffffff';
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 3;
                for (let i = 0; i < 3; i++) {
                    const r = (1 - chargeProgress) * (this.radius + 30 + i * 15);
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // ── Beam active visual ─────────────────────────────────
            if (this.beamActive) {
                ctx.save();
                ctx.globalAlpha = 0.95;
                ctx.rotate(this.beamAngle - this.angle); // beam angle in local space
                const beamLen = Math.max(this.game.width, this.game.height) * 1.5;
                // Outer glow
                const grd = ctx.createLinearGradient(0, 0, beamLen, 0);
                grd.addColorStop(0, 'rgba(255,255,255,1)');
                grd.addColorStop(0.2, 'rgba(255,100,0,0.9)');
                grd.addColorStop(1, 'rgba(255,0,0,0)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, -18, beamLen, 36);
                // Core
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.fillRect(0, -6, beamLen, 12);
                ctx.restore();
            }

            ctx.rotate(this.angle);

            // Core Glow
            ctx.shadowBlur = this.rageMode ? 80 : (this.phase === 2 ? 60 : 40);
            ctx.shadowColor = this.rageMode ? '#ffffff' : this.color;

            // Shield ring if invulnerable
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

            // ── Boss HUD overlay ───────────────────────────────────
            this._drawHUD(ctx);
        }

        _drawHUD(ctx) {
            // Boss phase + strategy indicator (drawn in screen space below boss)
            const hudX = this.x;
            const hudY = this.y + this.radius + 22;

            ctx.save();
            ctx.globalAlpha = 0.85;

            // Phase label
            const phaseColors = ['#00ff88', '#ffaa00', '#ff4444'];
            const phaseColor = phaseColors[this.phase - 1] || '#ffffff';
            ctx.font = 'bold 11px "Segoe UI", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = phaseColor;
            ctx.shadowBlur = 8;
            ctx.shadowColor = phaseColor;

            const phaseLabel = this.rageMode ? '⚡ RAGE MODE ⚡' : `PHASE ${this.phase}`;
            ctx.fillText(phaseLabel, hudX, hudY);

            // Strategy label
            if (this.phase >= 2) {
                const strategyLabels = {
                    'standard': 'STANDARD',
                    'counter-dodge': '⟲ COUNTER',
                    'suppress': '▶▶ SUPPRESS',
                    'overwhelm': '❯❯❯ OVERWHELM',
                };
                ctx.globalAlpha = 0.6;
                ctx.font = '9px monospace';
                ctx.fillStyle = '#aaaaff';
                ctx.shadowBlur = 0;
                ctx.fillText(strategyLabels[this.ai.strategy] || '', hudX, hudY + 13);
            }

            ctx.restore();
        }

        drawModel(ctx) {
            ctx.save();
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
            ctx.beginPath();
            ctx.moveTo(100, 0);
            ctx.lineTo(55, 12);
            ctx.lineTo(-40, 16);
            ctx.lineTo(-80, 8);
            ctx.lineTo(-80, -8);
            ctx.lineTo(-40, -16);
            ctx.lineTo(55, -12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(30, 14);
            ctx.lineTo(-40, 90);
            ctx.lineTo(-80, 90);
            ctx.lineTo(-60, 14);
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
            ctx.fillStyle = '#ff3300';
            ctx.beginPath();
            ctx.arc(-118, 10, 5, 0, Math.PI * 2);
            ctx.arc(-118, -10, 5, 0, Math.PI * 2);
            ctx.arc(-58, 28, 4, 0, Math.PI * 2);
            ctx.arc(-58, -28, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(-40, -22, 70, 44);
            ctx.strokeStyle = 'rgba(255,255,255,0.30)';
            ctx.lineWidth = 2;
            ctx.strokeRect(-40, -22, 70, 44);
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
            ctx.beginPath();
            ctx.moveTo(110, 0);
            ctx.lineTo(-80, 100);
            ctx.lineTo(-60, 0);
            ctx.lineTo(-80, -100);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.moveTo(40, 0);
            ctx.lineTo(-40, 0);
            ctx.lineTo(-60, -25);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(-20, 20, 15, 30);
            ctx.fillRect(-20, -50, 15, 30);
            ctx.globalAlpha = 1.0;
        }

        drawModelStealth(ctx) {
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.moveTo(120, 0);
            ctx.lineTo(20, 45);
            ctx.lineTo(-90, 110);
            ctx.lineTo(-60, 30);
            ctx.lineTo(-100, 0);
            ctx.lineTo(-60, -30);
            ctx.lineTo(-90, -110);
            ctx.lineTo(20, -45);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.stroke();
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
            ctx.beginPath();
            ctx.moveTo(90, 35);
            ctx.lineTo(90, -35);
            ctx.lineTo(-130, -55);
            ctx.lineTo(-130, 55);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(-100, 55, 60, 45);
            ctx.fillRect(-100, -100, 60, 45);
            ctx.strokeRect(-100, 55, 60, 45);
            ctx.strokeRect(-100, -100, 60, 45);
            ctx.fillStyle = '#00f3ff';
            ctx.globalAlpha = 0.6;
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(-80 + i * 25, 65, 10, 25);
                ctx.fillRect(-80 + i * 25, -90, 10, 25);
            }
            ctx.globalAlpha = 1.0;
        }
    }
