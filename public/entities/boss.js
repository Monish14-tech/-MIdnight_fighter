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

        // ── Player position sampling ─────────────────────────────────────
        this.playerSamples = [];
        this.sampleTimer = 0;
        this.sampleInterval = 0.25;

        // ── Derived movement analytics ───────────────────────────────────
        this.dodgeBias = 0;           // -1 = prefers left, +1 = prefers right (vs boss)
        this.playerSpeedProfile = 0;  // 0=slow, 1=medium, 2=fast
        this.preferredQuadrant = 0;   // 0=TL, 1=TR, 2=BL, 3=BR (most used quadrant)
        this.quadrantCounts = [0, 0, 0, 0];

        // ── Player FIRE rhythm tracking ──────────────────────────────────
        this.lastPlayerShotTime = 0;
        this.playerFireGaps = [];       // rolling last 10 gaps between shots
        this.avgPlayerFireGap = 0.4;    // estimated; 0=never, 0.15=spam, 0.4=moderate
        this.playerFireBurstsDetected = 0;

        // ── Player DASH tracking ─────────────────────────────────────────
        this.lastPlayerDashTime = 0;
        this.playerDashCount = 0;
        this.playerDashFreq = 0;        // dashes per second (rolling)

        // ── Hit tracking ─────────────────────────────────────────────────
        this.hitsLanded = 0;
        this.shotsFired = 0;
        this.hitRate = 0;
        this.consecutiveMisses = 0;

        // ── Strategy ─────────────────────────────────────────────────────
        this.strategy = 'standard';
        this.strategyTimer = 0;
        this.strategyInterval = 3.5;

        // ── Fight memory ─────────────────────────────────────────────────
        this.memory = {
            lastAttackUsed: null,
            attackHistory: [],         // last 6 attacks used
            timeInSameQuadrant: 0,
            lastQuadrant: -1,
            playerFiredBursts: 0,
        };

        // ── Dodge system (blind-spot: only update every 0.3 s) ───────────
        this.dodgeVector = { x: 0, y: 0 };
        this.dodgeUpdateTimer = 0;
        this.dodgeUpdateInterval = 0.3;

        // ── Telegraph / vulnerability ─────────────────────────────────────
        // These are READ by Boss for visual + damage calc
        this.telegraphing = false;      // boss glowing orange = attack incoming
        this.telegraphTimer = 0;
        this.telegraphDuration = 0.6;   // player advantage window
        this.pendingAttack = null;      // attack queued during telegraph

        this.weakened = false;          // +50% player damage bonus window
        this.weakenedTimer = 0;
        this.weakenedDuration = 0.8;

        // ── Per-personality, per-phase combo tables ──────────────────────
        this.personalityCombos = {
            Phantom: {
                1: ['phantomShot', 'blinkDash', 'phantomShot', 'rapid'],
                2: ['shadowVolley', 'blinkDash', 'shadowVolley', 'missiles'],
                3: ['chainBlink', 'shadowVolley', 'chainBlink', 'shadowVolley'],
            },
            Titan: {
                1: ['cannonBarrage', 'spread', 'cannonBarrage', 'missiles'],
                2: ['railSalvo', 'cannonBarrage', 'railSalvo', 'spread'],
                3: ['supernova', 'railSalvo', 'supernova', 'cannonBarrage'],
            },
            Berserker: {
                1: ['rageSpin', 'spiral', 'rageSpin', 'rapid'],
                2: ['rageSpin', 'dash', 'berserkerRush', 'rageSpin'],
                3: ['frenzyStorm', 'berserkerRush', 'frenzyStorm', 'groundZero'],
            },
            Tactician: {
                1: ['precisioShot', 'spread', 'precisioShot', 'missiles'],
                2: ['flankVolley', 'precisioShot', 'annihilationBeam', 'flankVolley'],
                3: ['flankVolley', 'coordinatedStrike', 'annihilationBeam', 'coordinatedStrike'],
            },
            Swarmlord: {
                1: ['swarmDrop', 'thunderstrike', 'swarmDrop', 'spiral'],
                2: ['clusterStrike', 'swarmDrop', 'forceField', 'clusterStrike'],
                3: ['monsoonBarrage', 'clusterStrike', 'annihilationBeam', 'monsoonBarrage'],
            },
        };
        this.combos = {
            A: ['spiral', 'spread', 'missiles'],
            B: ['rapid', 'dash', 'annihilationBeam'],
            C: ['forceField', 'spiral', 'rapid'],
        };
        this.currentCombo = 'A';
        this.comboStep = 0;
    }

    // ── Called every frame ──────────────────────────────────────────────
    update(deltaTime) {
        const player = this.game.player;
        if (!player) return;

        // ── Sample player ────────────────────────────────────────────────
        this.sampleTimer += deltaTime;
        if (this.sampleTimer >= this.sampleInterval) {
            this.sampleTimer = 0;
            this._samplePlayer(player);
        }

        // ── Detect fire rhythm ───────────────────────────────────────────
        this._detectFireRhythm(player, deltaTime);

        // ── Detect dash frequency ────────────────────────────────────────
        this._detectDashFrequency(player, deltaTime);

        // ── Update memory ────────────────────────────────────────────────
        this._updateMemory(player, deltaTime);

        // ── Telegraph countdown ──────────────────────────────────────────
        if (this.telegraphing) {
            this.telegraphTimer += deltaTime;
            if (this.telegraphTimer >= this.telegraphDuration) {
                this.telegraphing = false;
                this.telegraphTimer = 0;
            }
        }

        // ── Vulnerability window countdown ───────────────────────────────
        if (this.weakened) {
            this.weakenedTimer += deltaTime;
            if (this.weakenedTimer >= this.weakenedDuration) {
                this.weakened = false;
                this.weakenedTimer = 0;
            }
        }

        // ── Strategy update ──────────────────────────────────────────────
        this.strategyTimer += deltaTime;
        if (this.strategyTimer >= this.strategyInterval) {
            this.strategyTimer = 0;
            this._updateStrategy();
        }
    }

    // ── Core sampling ────────────────────────────────────────────────────
    _samplePlayer(player) {
        this.playerSamples.push({ x: player.x, y: player.y });
        if (this.playerSamples.length > 20) this.playerSamples.shift();

        if (this.playerSamples.length >= 6) {
            let leftMoves = 0, rightMoves = 0, totalMag = 0;
            for (let i = 1; i < this.playerSamples.length; i++) {
                const ddx = this.playerSamples[i].x - this.playerSamples[i - 1].x;
                const ddy = this.playerSamples[i].y - this.playerSamples[i - 1].y;
                const mag = Math.hypot(ddx, ddy);
                totalMag += mag;
                const bossAngle = Math.atan2(player.y - this.boss.y, player.x - this.boss.x);
                const perp = ddx * Math.sin(bossAngle) - ddy * Math.cos(bossAngle);
                if (perp > 0) rightMoves += mag; else leftMoves += mag;
            }
            if (totalMag > 0) this.dodgeBias = (rightMoves - leftMoves) / totalMag;
            const avgMag = totalMag / (this.playerSamples.length - 1);
            this.playerSpeedProfile = avgMag > 80 ? 2 : (avgMag > 30 ? 1 : 0);
        }

        // Quadrant tracking
        const gw = this.game.logicalWidth, gh = this.game.logicalHeight;
        const q = (player.x > gw / 2 ? 1 : 0) + (player.y > gh / 2 ? 2 : 0);
        this.quadrantCounts[q]++;
        this.preferredQuadrant = this.quadrantCounts.indexOf(Math.max(...this.quadrantCounts));
    }

    _detectFireRhythm(player, deltaTime) {
        // Track player fire gaps via fireTimer changes (fireTimer decreasing means just fired)
        if (player.fireTimer <= 0 && this._lastPlayerFireTimerWasPositive) {
            const now = (this.game.lastTime || 0) / 1000;
            if (this.lastPlayerShotTime > 0) {
                const gap = now - this.lastPlayerShotTime;
                if (gap > 0 && gap < 3) {
                    this.playerFireGaps.push(gap);
                    if (this.playerFireGaps.length > 10) this.playerFireGaps.shift();
                    this.avgPlayerFireGap = this.playerFireGaps.reduce((a, b) => a + b, 0) / this.playerFireGaps.length;
                    // Burst detection: gap < 0.2 s = heavy fire
                    if (gap < 0.20) {
                        this.memory.playerFiredBursts++;
                        this.playerFireBurstsDetected++;
                    }
                }
            }
            this.lastPlayerShotTime = now;
        }
        this._lastPlayerFireTimerWasPositive = player.fireTimer > 0;
    }

    _detectDashFrequency(player, deltaTime) {
        if (player.isDashing && !this._playerWasDashing) {
            this.playerDashCount++;
            const now = (this.game.lastTime || 0) / 1000;
            this.lastPlayerDashTime = now;
        }
        this._playerWasDashing = player.isDashing;
        // Rolling dashes-per-10s estimate
        this.playerDashFreq = this.playerDashCount / Math.max(1, (this.game.lastTime || 1) / 1000) * 10;
    }

    _updateMemory(player, deltaTime) {
        // Track how long player stays in same quadrant
        const gw = this.game.logicalWidth, gh = this.game.logicalHeight;
        const q = (player.x > gw / 2 ? 1 : 0) + (player.y > gh / 2 ? 2 : 0);
        if (q === this.memory.lastQuadrant) {
            this.memory.timeInSameQuadrant += deltaTime;
        } else {
            this.memory.lastQuadrant = q;
            this.memory.timeInSameQuadrant = 0;
        }
    }

    _updateStrategy() {
        const phase = this.boss.phase;
        const absDodge = Math.abs(this.dodgeBias);
        const camping = this.memory.timeInSameQuadrant > 4.0;
        const rapidFirer = this.avgPlayerFireGap < 0.18;
        const dasher = this.playerDashFreq > 2;

        if (phase === 3) {
            this.strategy = 'overwhelm';
        } else if (camping) {
            this.strategy = 'flank';
        } else if (rapidFirer) {
            this.strategy = 'shield';        // triggers force field to absorb burst
        } else if (dasher) {
            this.strategy = 'suppress';      // spread/saturation to counter dash mobility
        } else if (absDodge > 0.4 && phase >= 2) {
            this.strategy = 'counter-dodge';
        } else if (this.consecutiveMisses >= 3) {
            this.strategy = 'suppress';
        } else {
            this.strategy = 'standard';
        }
    }

    // ── Projectile dodge (blind-spot: only updates every 0.3 s) ─────────
    dodgeProjectiles(deltaTime) {
        this.dodgeUpdateTimer += deltaTime;
        const shouldUpdate = this.dodgeUpdateTimer >= this.dodgeUpdateInterval;
        if (shouldUpdate) this.dodgeUpdateTimer = 0;

        if (shouldUpdate && this.game.projectiles) {
            let fx = 0, fy = 0;
            for (const p of this.game.projectiles) {
                if (p.ownerId === 'enemy' || p.ownerId === this.boss) continue;
                const dx = this.boss.x - p.x;
                const dy = this.boss.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 220) continue;
                // Only count projectiles heading toward the boss
                const velX = Math.cos(p.angle) * p.speed;
                const velY = Math.sin(p.angle) * p.speed;
                const dot = -dx * velX - dy * velY;
                if (dot <= 0) continue;
                // Repulsion weighted by proximity
                const weight = (220 - dist) / 220;
                fx += (dx / dist) * weight;
                fy += (dy / dist) * weight;
            }
            const len = Math.hypot(fx, fy);
            if (len > 0) {
                this.dodgeVector = { x: (fx / len) * 280, y: (fy / len) * 280 };
            } else {
                this.dodgeVector = { x: 0, y: 0 };
            }
        }

        // Apply the dodge impulse
        if (this.dodgeVector.x !== 0 || this.dodgeVector.y !== 0) {
            this.boss.x += this.dodgeVector.x * deltaTime;
            this.boss.y += this.dodgeVector.y * deltaTime;
            const m = 80;
            this.boss.x = Math.max(m, Math.min(this.game.logicalWidth - m, this.boss.x));
            this.boss.y = Math.max(m, Math.min(this.game.logicalHeight - m, this.boss.y));
        }
    }

    // ── Weighted attack picker — replaces nextComboAttack for idle state ─
    getWeightedAttack() {
        // Build counter pool based on current strategy, memory, and pattern variety
        const phase = this.boss.phase;
        const pers = this.boss.personality;
        const hist = this.memory.attackHistory;

        // Penalise recently used attacks
        const penalise = (name) => hist.slice(-3).includes(name);

        let pool = [];

        // Strategy-specific counters
        if (this.strategy === 'flank') {
            pool = pers === 'Tactician'
                ? ['flankVolley', 'coordinatedStrike', 'precisioShot']
                : ['spread', 'thunderstrike', 'missiles'];
        } else if (this.strategy === 'shield') {
            pool = ['forceField', 'spread', 'cannonBarrage'];
        } else if (this.strategy === 'suppress' || this.strategy === 'overwhelm') {
            pool = ['spiral', 'rapid', 'frenzyStorm', 'monsoonBarrage', 'groundZero'];
        } else if (this.strategy === 'counter-dodge') {
            pool = ['rapidShoot', 'precisioShot', 'railSalvo', 'flankVolley'];
        }

        // Fallback to personality combo
        if (pool.length === 0) {
            const table = (this.personalityCombos[pers] && this.personalityCombos[pers][phase])
                ? this.personalityCombos[pers][phase]
                : this.combos[this.currentCombo];
            this.comboStep = (this.comboStep + 1) % table.length;
            const attack = table[this.comboStep];
            this._recordAttack(attack);
            return attack;
        }

        // Filter penalised attacks, pick from remainder
        const fresh = pool.filter(a => !penalise(a));
        const chosen = (fresh.length > 0 ? fresh : pool)[
            Math.floor(Math.abs(Math.sin((this.game.lastTime || 1) * 0.001 + pool.length)) * (fresh.length > 0 ? fresh : pool).length)
        ];
        this._recordAttack(chosen);
        return chosen;
    }

    _recordAttack(name) {
        this.memory.lastAttackUsed = name;
        this.memory.attackHistory.push(name);
        if (this.memory.attackHistory.length > 6) this.memory.attackHistory.shift();
    }

    // ── PLAYER ADVANTAGE: Telegraph upcoming attack ──────────────────────
    telegraphAttack(attackName) {
        this.telegraphing = true;
        this.telegraphTimer = 0;
        this.pendingAttack = attackName;
    }

    // ── PLAYER ADVANTAGE: Trigger vulnerability window ───────────────────
    triggerWeakened() {
        this.weakened = true;
        this.weakenedTimer = 0;
    }

    // ── PLAYER ADVANTAGE: Pattern interrupt on heavy hit ─────────────────
    onHeavyHit(damage) {
        if (damage >= 15 && this.telegraphing) {
            // Cancel the pending attack, short stun
            this.telegraphing = false;
            this.pendingAttack = null;
            this.boss.state = 'idle';
            this.boss.stateTimer = -0.4; // 0.4 s stun
            if (this.game.floatingTexts) {
                this.game.floatingTexts.push({
                    x: this.boss.x, y: this.boss.y - 50,
                    text: 'INTERRUPTED!', color: '#ffff00', life: 1.2
                });
            }
        }
        // Always start vulnerability window after a heavy hit resolves
        this.triggerWeakened();
        this.consecutiveMisses = 0;
    }

    // ── Reset memory between phases ───────────────────────────────────────
    resetMemory() {
        this.memory = {
            lastAttackUsed: null,
            attackHistory: [],
            timeInSameQuadrant: 0,
            lastQuadrant: -1,
            playerFiredBursts: 0,
        };
        this.consecutiveMisses = 0;
        this.dodgeVector = { x: 0, y: 0 };
        this.weakened = false;
        this.telegraphing = false;
    }

    // ── Retained helpers ─────────────────────────────────────────────────
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
        const aiAggression = this.boss.aiAggression || 1.0;
        let lead = 0.3 * aiAggression;
        if (this.strategy === 'counter-dodge') lead = 0.5 * aiAggression;
        else if (this.strategy === 'suppress' || this.strategy === 'overwhelm') lead = 0.6 * aiAggression;
        return {
            x: Math.max(20, Math.min(this.game.logicalWidth - 20, player.x + vx * lead)),
            y: Math.max(20, Math.min(this.game.logicalHeight - 20, player.y + vy * lead))
        };
    }

    getCounterDodgeAngle() {
        const target = this.getTargetPosition();
        const dx = target.x - this.boss.x;
        const dy = target.y - this.boss.y;
        const counterOffset = -this.dodgeBias * 0.5;
        return Math.atan2(dy, dx) + counterOffset;
    }

    nextComboAttack() { return this.getWeightedAttack(); }

    selectCombo() {
        this.currentCombo = this.boss.phase === 3 ? 'C'
            : (this.strategy === 'counter-dodge' || this.strategy === 'suppress') ? 'B' : 'A';
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
        const levelScale = 1 + (level - 1) * 0.15; // Scale from 1.0 at level 1 to 1.6 at level 5

        // Tier System (Spike every 5 levels)
        this.bossTier = Math.floor((level - 1) / 5);
        const tierMultiplier = Math.pow(1.5, this.bossTier);

        // Dynamic Boss Scaling based on Player's equipped ship stats
        const playerScale = this.game.getPlayerScalingMetrics
            ? this.game.getPlayerScalingMetrics()
            : { aiAggression: 1, speedScale: 1, projectileDensity: 1, damageMultiplier: 1, hpMultiplier: 1 };

        // Base HP scaled to player DPS to maintain Time-to-Kill (TTK) parity
        this.maxHealth = Math.floor(800 * levelScale * tierMultiplier * playerScale.hpMultiplier);
        this.health = this.maxHealth;
        this.points = Math.floor(1500 * levelScale);
        this.coinReward = Math.floor(200 * level * 0.8); // Balanced linear reward

        // Initial Position logic
        this.targetPoint = { x: game.logicalWidth / 2, y: 150 };

        if (this.side === 'left') {
            this.x = -200;
            this.y = game.logicalHeight / 2;
            this.targetPoint = { x: 150, y: game.logicalHeight / 2 };
        } else if (this.side === 'right') {
            this.x = game.logicalWidth + 200;
            this.y = game.logicalHeight / 2;
            this.targetPoint = { x: game.logicalWidth - 150, y: game.logicalHeight / 2 };
        } else { // top
            this.x = game.logicalWidth / 2;
            this.y = -200;
            this.targetPoint = { x: game.logicalWidth / 2, y: 150 };
        }

        this.radius = 70;
        this.color = level % 10 === 0 ? '#ff00ff' : '#ff3300';

        this.angle = Math.PI / 2;
        this.velocity = { x: 0, y: 0 };
        // Speed and rotation also scale with tier spikes and player's speed
        this.speed = (150 + (levelScale * 10)) * (1 + (this.bossTier * 0.15)) * playerScale.speedScale;
        this.rotationSpeed = 2.0 * (1 + (this.bossTier * 0.2)) * playerScale.speedScale;

        // Store damage multiplier for collisions/attacks
        this.damageMultiplier = playerScale.damageMultiplier;
        this.aiAggression = playerScale.aiAggression;
        this.projectileDensity = playerScale.projectileDensity;

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

        // Firing system — rapid-fire from the start
        this.fireTimer = 0;
        this.fireRate = 0.15; // Aggressive bullet hell (was 0.28)

        // ── Personality system ────────────────────────────────
        this.personality = this._getPersonality(); // based on modelIndex
        this.repoShootTimer = 0;  // shoot during repositioning

        // ── Smart BossAI ──────────────────────────────────────
        this.ai = new BossAI(this);
        // Override AI combo to personality combo immediately
        this.ai.currentCombo = this.personality;
        this.ai.comboStep = 0;
    }

    // ── Personality based on modelIndex ──────────────────────────
    _getPersonality() {
        const map = { 0: 'Phantom', 1: 'Titan', 2: 'Berserker', 3: 'Tactician', 4: 'Swarmlord' };
        return map[this.modelIndex] || 'Berserker';
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
            this.ai.resetMemory();
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
            this.ai.resetMemory();
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

        // ── Dodge incoming projectiles ────────────────────────
        if (this.state !== 'dashing' && !this.beamActive && this.state !== 'entering') {
            this.ai.dodgeProjectiles(deltaTime);
        }

        // ── State Machine ─────────────────────────────────────
        switch (this.state) {
            case 'entering': this.handleEntering(deltaTime); break;
            case 'idle': this.handleIdle(deltaTime); break;
            case 'telegraphing': this.handleTelegraphing(deltaTime); break;
            case 'attacking':
                this.handleAttacking(deltaTime);
                // Always move around screen while attacking
                this.moveAroundScreen(deltaTime);
                // Fire immediately — no delay
                if (this.fireTimer > this.fireRate && this.game.player) {
                    this.fireSimple();
                    this.fireTimer = 0;
                }
                break;
            case 'repositioning':
                this.handleRepositioning(deltaTime);
                // Keep shooting during repositioning
                this.repoShootTimer += deltaTime;
                if (this.repoShootTimer > 1.2 && this.game.player) {
                    this.repoShootTimer = 0;
                    this.tripleShot();
                }
                break;
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
            this.x = this.game.logicalWidth / 2;
            this.y = this.game.logicalHeight / 3;
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
        if (this.x > this.game.logicalWidth + screenBuffer) this.x = this.game.logicalWidth + screenBuffer;
        if (this.y < -screenBuffer) this.y = -screenBuffer;
        if (this.y > this.game.logicalHeight + screenBuffer) this.y = this.game.logicalHeight + screenBuffer;
    }

    handleIdle(deltaTime) {
        this.y += Math.sin(this.stateTimer * 3) * 0.5;
        this.tilt = Math.sin(this.stateTimer * 2) * 0.1;
        const margin = 70;
        this.y = Math.max(margin, Math.min(this.game.logicalHeight - margin, this.y));

        let idleDuration = this.phase === 3 ? 0.1 : (this.phase === 2 ? 0.15 : 0.2);
        // Tier Aggression: Significantly cut downtime at higher tiers
        if (this.bossTier > 0) {
            idleDuration = Math.max(0.02, idleDuration - (this.bossTier * 0.03));
        }

        if (this.stateTimer > idleDuration) {
            this.stateTimer = 0;
            this.fireTimer = 0;
            const nextAttack = this.ai.nextComboAttack();
            this.ai.telegraphAttack(nextAttack);
            this.state = 'telegraphing';
        }
    }

    handleTelegraphing(deltaTime) {
        // AI handles the telegraph timer. When done:
        if (!this.ai.telegraphing) {
            if (this.ai.pendingAttack) {
                // Telegraph finished normally
                this.currentAttack = this.ai.pendingAttack;
                this.state = 'attacking';
                this.stateTimer = 0;
                this.ai.pendingAttack = null;
            }
            // If ai.pendingAttack is null, it was interrupted by heavy hit (handled in BossAI)
        }
    }

    handleAttacking(deltaTime) {
        switch (this.currentAttack) {
            // ── Shared/generic attacks
            case 'spiral': this.spiralShoot(deltaTime); break;
            case 'spread': this.spreadShoot(deltaTime); break;
            case 'rapid': this.rapidShoot(deltaTime); break;
            case 'missiles': this.missileBarrage(deltaTime); break;
            case 'thunderstrike': this.thunderstrike(deltaTime); break;
            case 'tripleShot': this.tripleShot(deltaTime); break;
            case 'crossfireBarrage': this.crossfireBarrage(deltaTime); break;
            case 'groundZero': this.groundZero(deltaTime); break;
            case 'blinkDash': this.blinkDash(deltaTime); break;
            // ── Phantom
            case 'phantomShot': this.phantomShot(deltaTime); break;
            case 'shadowVolley': this.shadowVolley(deltaTime); break;
            case 'chainBlink': this.chainBlink(deltaTime); break;
            // ── Titan
            case 'cannonBarrage': this.cannonBarrage(deltaTime); break;
            case 'railSalvo': this.railSalvo(deltaTime); break;
            case 'supernova': this.supernova(deltaTime); break;
            // ── Berserker
            case 'rageSpin': this.rageSpin(deltaTime); break;
            case 'berserkerRush': this.berserkerRush(deltaTime); break;
            case 'frenzyStorm': this.frenzyStorm(deltaTime); break;
            // ── Tactician
            case 'precisioShot': this.precisioShot(deltaTime); break;
            case 'flankVolley': this.flankVolley(deltaTime); break;
            case 'coordinatedStrike': this.coordinatedStrike(deltaTime); break;
            // ── Swarmlord
            case 'swarmDrop': this.swarmDrop(deltaTime); break;
            case 'clusterStrike': this.clusterStrike(deltaTime); break;
            case 'monsoonBarrage': this.monsoonBarrage(deltaTime); break;
            // ── Special
            case 'annihilationBeam': this.startAnnihilationBeam(); return;
            case 'forceField': this.startForceField(); return;
            case 'dash':
                this.state = 'dashing';
                this.prepareDash();
                return;
        }

        // Much shorter attack windows — constant pressure
        let base = this.phase === 3 ? 0.7 : (this.phase === 2 ? 1.0 : 1.3);

        // Tier Aggression: Shrink attack windows to force faster repositioning/variety
        if (this.bossTier > 0) {
            base = Math.max(0.3, base - (this.bossTier * 0.15));
        }

        const attackDuration = this.currentAttack === 'spiral' ? base * 1.2 : base;
        if (this.stateTimer > attackDuration) {
            this.state = 'repositioning';
            this.stateTimer = 0;
            this.pickNewPosition();
        }
    }

    // ── Personality-specific movement while attacking ──────────────
    moveAroundScreen(deltaTime) {
        switch (this.personality) {
            case 'Phantom': {
                // Fast erratic zigzag — across full screen
                const spd = 220 + this.phase * 40;
                const zigX = Math.sin(this.stateTimer * 3.5) * spd;
                const zigY = Math.cos(this.stateTimer * 2.1) * spd * 0.5;
                const cx = this.game.logicalWidth * 0.5;
                const cy = this.game.logicalHeight * 0.5 + Math.sin(this.stateTimer * 0.8) * this.game.logicalHeight * 0.3;
                this.x += (cx + zigX - this.x) * 3 * deltaTime;
                this.y += (cy + zigY - this.y) * 3 * deltaTime;
                break;
            }
            case 'Titan': {
                // Slow horizontal drift and vertical sweep — full screen
                const titanY = this.game.logicalHeight * 0.5 + Math.sin(this.stateTimer * 0.4) * this.game.logicalHeight * 0.35;
                const drift = Math.sin(this.stateTimer * 0.6) * this.game.logicalWidth * 0.28;
                this.x += (this.game.logicalWidth * 0.5 + drift - this.x) * 0.8 * deltaTime;
                this.y += (titanY - this.y) * 1.2 * deltaTime;
                break;
            }
            case 'Berserker': {
                // Aggressive charge: lurches toward player, then strafe-circles
                if (this.game.player) {
                    const px = this.game.player.x, py = this.game.player.y;
                    const chaseWeight = 0.7 + this.phase * 0.1;
                    const orbitX = Math.cos(this.stateTimer * 2.5) * 140;
                    const orbitY = Math.sin(this.stateTimer * 2.5) * 60;
                    const tx = px + orbitX, ty = py - 100 + orbitY;
                    this.x += (tx - this.x) * chaseWeight * deltaTime;
                    this.y += (ty - this.y) * chaseWeight * deltaTime;
                }
                break;
            }
            case 'Tactician': {
                // Flanks to player's side, then repositions to opposite flank
                if (this.game.player) {
                    const flankSide = Math.sign(Math.sin(this.stateTimer * 0.4));
                    const tx = this.game.player.x + flankSide * 260;
                    const ty = this.game.player.y - 80;
                    this.x += (tx - this.x) * 1.5 * deltaTime;
                    this.y += (ty - this.y) * 1.5 * deltaTime;
                }
                break;
            }
            case 'Swarmlord': {
                // Drifts across full screen space
                const swY = this.game.logicalHeight * 0.4 + Math.cos(this.stateTimer * 0.5) * this.game.logicalHeight * 0.3;
                const swX = this.game.logicalWidth * 0.5 + Math.sin(this.stateTimer * 0.5) * this.game.logicalWidth * 0.3;
                this.x += (swX - this.x) * 0.9 * deltaTime;
                this.y += (swY - this.y) * 1.5 * deltaTime;
                break;
            }
            default: {
                const cx = this.game.logicalWidth / 2, cy = this.game.logicalHeight / 3, r = 200;
                const a = this.stateTimer * 1.5;
                this.x = cx + Math.cos(a) * r;
                this.y = cy + Math.sin(a) * r * 0.6;
            }
        }
        const m = 80;
        this.x = Math.max(m, Math.min(this.game.logicalWidth - m, this.x));
        this.y = Math.max(m, Math.min(this.game.logicalHeight - m, this.y));
    }

    // ── Personality-specific ambient fire (replaces old fireSimple) ─
    fireSimple() {
        if (!this.game.player) return;
        const pa = Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
        switch (this.personality) {
            case 'Phantom': {
                // Single precision cyan laser bolt
                const p = this.fireProjectile(this.x, this.y, pa, 'bullet');
                if (p) { p.color = '#00ffff'; p.speed = 400; p.radius = 3; }
                break;
            }
            case 'Titan': {
                // 2 fat orange cannonballs spread outward
                const spread = 0.22;
                const p1 = this.fireProjectile(this.x, this.y, pa - spread, 'bullet');
                const p2 = this.fireProjectile(this.x, this.y, pa + spread, 'bullet');
                [p1, p2].forEach(p => { if (p) { p.color = '#ff6600'; p.speed = 180; p.radius = 10; p.damage = 1.5 * this.damageScale; } });
                break;
            }
            case 'Berserker': {
                // 3-shot aggressive burst in tight cone
                for (let i = -1; i <= 1; i++) {
                    const p = this.fireProjectile(this.x, this.y, pa + i * 0.14, 'bullet');
                    if (p) { p.color = '#ff2200'; p.speed = 340; }
                }
                break;
            }
            case 'Tactician': {
                // 1 high-precision predicted shot
                const target = this.ai.getTargetPosition();
                const ta = Math.atan2(target.y - this.y, target.x - this.x);
                const p = this.fireProjectile(this.x, this.y, ta, 'bullet');
                if (p) { p.color = '#00ccff'; p.speed = 360; p.radius = 3; }
                break;
            }
            case 'Swarmlord': {
                // 2 vertical drop bombs
                const dropA = Math.PI / 2; // straight down
                const p1 = this.fireProjectile(this.x - 30, this.y, dropA, 'bullet');
                const p2 = this.fireProjectile(this.x + 30, this.y, dropA, 'bullet');
                [p1, p2].forEach(p => { if (p) { p.color = '#ffee00'; p.speed = 260; p.radius = 5; p.damage = 1 * this.damageScale; } });
                break;
            }
            default: {
                const count = this.phase === 2 ? 6 : 4;
                const sp = 0.35;
                for (let i = 0; i < count; i++) {
                    const ang = pa - sp / 2 + (sp / (count - 1)) * i;
                    const p = this.fireProjectile(this.x, this.y, ang, 'bullet');
                    if (p) { p.color = '#ffff00'; p.speed = 280; p.damage = 1 * this.damageScale; }
                }
            }
        }
    }

    pickNewPosition() {
        // Ensure safe zone away from corners (minimum 150px margin from edges)
        const safeMargin = 150;
        const maxX = this.game.logicalWidth - safeMargin;
        const maxY = this.game.logicalHeight - safeMargin;
        const minX = safeMargin;
        const minY = safeMargin;

        // Rotate through several predefined safe positions to avoid getting stuck
        const positionIndex = Math.floor(this.stateTimer * 0.5) % 5;
        const positions = [
            { x: this.game.logicalWidth * 0.25, y: this.game.logicalHeight * 0.25 },
            { x: this.game.logicalWidth * 0.75, y: this.game.logicalHeight * 0.25 },
            { x: this.game.logicalWidth * 0.5, y: this.game.logicalHeight * 0.3 },
            { x: this.game.logicalWidth * 0.3, y: this.game.logicalHeight * 0.35 },
            { x: this.game.logicalWidth * 0.7, y: this.game.logicalHeight * 0.35 }
        ];

        let targetPos = positions[positionIndex];

        // Add some deterministic variation to avoid too predictable patterns
        const seed = (this.remoteId || 0) + this.level;
        const variation = (Math.sin(seed) * 30 + Math.cos(seed * 1.5) * 30);
        targetPos.x += variation;
        targetPos.y += variation * 0.5;

        // Clamp to safe zone
        this.targetPoint = {
            x: Math.max(safeMargin, Math.min(this.game.logicalWidth - safeMargin, targetPos.x)),
            y: Math.max(safeMargin, Math.min(this.game.logicalHeight - safeMargin, targetPos.y))
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
        if (this.x > this.game.logicalWidth - hardMargin) {
            this.x = this.game.logicalWidth - hardMargin - 20;
            this.targetPoint.x = Math.min(this.game.logicalWidth - hardMargin - 100, this.targetPoint.x);
        }
        if (this.y < hardMargin) {
            this.y = hardMargin + 20;
            this.targetPoint.y = Math.max(hardMargin + 100, this.targetPoint.y);
        }
        if (this.y > this.game.logicalHeight - hardMargin) {
            this.y = this.game.logicalHeight - hardMargin - 20;
            this.targetPoint.y = Math.min(this.game.logicalHeight - hardMargin - 100, this.targetPoint.y);
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
        // Charge up — use deterministic shake (no Math.random)
        if (this.stateTimer < 0.6) {
            const shake = Math.sin(this.game.lastTime * 0.05) * 6;
            this.x += shake;
            this.y += Math.cos(this.game.lastTime * 0.05) * 6;

            // Keep boss on screen during charge
            const margin = 50;
            this.x = Math.max(margin, Math.min(this.game.logicalWidth - margin, this.x));
            this.y = Math.max(margin, Math.min(this.game.logicalHeight - margin, this.y));

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
            this.x = Math.max(margin, Math.min(this.game.logicalWidth - margin, this.x));
            this.y = Math.max(margin, Math.min(this.game.logicalHeight - margin, this.y));

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
            const densityBonus = Math.floor((this.projectileDensity - 1) * 2);
            const arms = (this.phase === 3 ? 6 : (this.phase === 2 ? 4 : 2)) + densityBonus;
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
            const densityBonus = Math.floor((this.projectileDensity - 1) * 3);
            const count = (this.phase === 3 ? 9 : (this.phase === 2 ? 7 : 5)) + densityBonus;
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
                    shot.damage = 1.5 * this.damageScale;
                    shot.color = '#ffffff';
                    shot.radius = 6;
                    this.game.projectiles.push(shot);
                    // Also spawn a wide beam projectile
                    const wideShot = new Projectile(this.game, this.x, this.y, this.beamAngle + 0.08, 'bullet', 'enemy');
                    wideShot.speed = 900;
                    wideShot.damage = 1.0 * this.damageScale;
                    wideShot.color = '#ff4400';
                    wideShot.radius = 5;
                    this.game.projectiles.push(wideShot);
                    if (this.game.audio) this.game.audio.enemyShot();
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

    // ── Attack: Thunderstrike ─────────────────────────────────
    thunderstrike(deltaTime) {
        const fireRate = this.phase === 3 ? 0.25 : 0.4;
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);
        if (total <= prev) return;

        const target = this.ai.getTargetPosition();
        const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
        const count = this.phase === 3 ? 12 : 8;

        for (let i = 0; i < count; i++) {
            const angle = baseAngle + ((i / count) * Math.PI * 2);
            const p = this.fireProjectile(this.x, this.y, angle, 'bullet');
            if (p) { p.speed = 500 + this.level * 8; p.color = '#ffee00'; p.radius = 5; }
        }
        if (this.game.screenShake) this.game.screenShake.trigger(12, 0.2);
    }

    // ── NEW Attack: Triple Shot ────────────────────────────────────
    tripleShot(deltaTime) {
        const fireRate = this.phase === 3 ? 0.18 : 0.25; // wider dodge gaps
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);
        if (total <= prev) return;

        const target = this.ai.getTargetPosition();
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        const spread = 0.18;
        for (let i = -1; i <= 1; i++) {
            const p = this.fireProjectile(this.x, this.y, base + i * spread, 'bullet');
            if (p) { p.color = '#00ffff'; p.speed = 320 + this.level * 4; } // slower
        }
    }

    // ── NEW Attack: Crossfire Barrage (Titan) ─────────────────────
    crossfireBarrage(deltaTime) {
        const fireRate = this.phase === 3 ? 0.4 : 0.6; // wider gaps between cross volleys
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);
        if (total <= prev) return;

        const rotOffset = total * (Math.PI / 4);
        for (let i = 0; i < 4; i++) {
            const angle = rotOffset + (i / 4) * Math.PI * 2;
            const p = this.fireProjectile(this.x, this.y, angle, 'bullet');
            if (p) { p.color = '#ff6600'; p.speed = 290; p.radius = 7; } // slower
        }
        if (this.game.player) {
            const pa = Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
            const m = this.fireProjectile(this.x, this.y, pa, 'boss_missile');
            if (m) { m.color = '#ff0000'; }
        }
        if (this.game.screenShake) this.game.screenShake.trigger(8, 0.15);
    }

    // ── NEW Attack: Ground Zero (Berserker) ───────────────────────
    groundZero(deltaTime) {
        const fireRate = this.phase === 3 ? 0.18 : 0.28; // slower rings = gaps to dodge through
        const total = Math.floor(this.stateTimer / fireRate);
        const prev = Math.floor((this.stateTimer - deltaTime) / fireRate);
        if (total <= prev) return;

        const arms = this.phase === 3 ? 8 : 6;
        const spin = total * 0.4;
        for (let i = 0; i < arms; i++) {
            const angle = spin + (i / arms) * Math.PI * 2;
            const p = this.fireProjectile(this.x, this.y, angle, 'bullet');
            if (p) { p.color = '#ff2200'; p.speed = 260 + this.level * 4; } // slower
        }
        if (this.game.player) {
            const pa = Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
            this.fireProjectile(this.x, this.y, pa, 'boss_missile');
        }
        if (this.game.screenShake) this.game.screenShake.trigger(15, 0.1);
    }

    // ── NEW Attack: Blink Dash (Phantom) ──────────────────────────
    blinkDash(deltaTime) {
        // Phase 1: charge. Phase 2: invisible blink to player, fire burst
        if (!this._blinkState) this._blinkState = 'charge';
        if (!this._blinkTimer) this._blinkTimer = 0;
        this._blinkTimer += deltaTime;

        if (this._blinkState === 'charge' && this._blinkTimer >= 0.4) {
            // Teleport near player
            if (this.game.player) {
                const px = this.game.player.x, py = this.game.player.y;
                const bAngle = Math.atan2(py - this.y, px - this.x);
                this.x = px - Math.cos(bAngle) * 120;
                this.y = py - Math.sin(bAngle) * 120;
                this.x = Math.max(80, Math.min(this.game.width - 80, this.x));
                this.y = Math.max(80, Math.min(this.game.height - 80, this.y));
            }
            this._blinkState = 'burst';
            this._blinkTimer = 0;
            this.isBlinking = true;
            if (this.game.screenShake) this.game.screenShake.trigger(20, 0.3);
            // Burst fire
            const count = this.phase === 3 ? 10 : 7;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const p = this.fireProjectile(this.x, this.y, angle, 'bullet');
                if (p) { p.color = '#aa00ff'; p.speed = 450; }
            }
        } else if (this._blinkState === 'burst' && this._blinkTimer >= 0.3) {
            this.isBlinking = false;
            this._blinkState = null;
            this._blinkTimer = 0;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  PHANTOM ATTACKS (purple precision teleporter)
    // ══════════════════════════════════════════════════════════════

    // P1: Single high-speed precision bolt, extremely fast
    phantomShot(deltaTime) {
        const rate = this.phase === 3 ? 0.15 : 0.22;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const target = this.ai.getTargetPosition();
        const a = Math.atan2(target.y - this.y, target.x - this.x);
        const p = this.fireProjectile(this.x, this.y, a, 'bullet');
        if (p) { p.color = '#cc00ff'; p.speed = 480; p.radius = 3; }
    }

    // P2: Fires from 2 "shadow" positions flanking the boss
    shadowVolley(deltaTime) {
        const rate = this.phase === 3 ? 0.2 : 0.32;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const target = this.ai.getTargetPosition();
        const perp = this.angle + Math.PI / 2;
        const offset = 80 + this.phase * 20;
        const origins = [
            { x: this.x + Math.cos(perp) * offset, y: this.y + Math.sin(perp) * offset },
            { x: this.x - Math.cos(perp) * offset, y: this.y - Math.sin(perp) * offset },
        ];
        origins.forEach(o => {
            const a = Math.atan2(target.y - o.y, target.x - o.x);
            const p = this.fireProjectile(o.x, o.y, a, 'bullet');
            if (p) { p.color = '#dd00ff'; p.speed = 360; p.radius = 4; }
        });
    }

    // P3: Teleports 3 times rapidly, fires burst ring each time
    chainBlink(deltaTime) {
        if (!this._chainPhase) { this._chainPhase = 0; this._chainTimer = 0; this._chainCount = this.phase === 3 ? 4 : 3; }
        this._chainTimer += deltaTime;
        const blinkInterval = 0.3;
        if (this._chainTimer >= blinkInterval && this._chainPhase < this._chainCount) {
            this._chainTimer = 0;
            this._chainPhase++;
            if (this.game.player) {
                const ang = ((this._chainPhase - 1) / this._chainCount) * Math.PI * 2;
                const r = 150;
                this.x = Math.max(80, Math.min(this.game.width - 80, this.game.player.x + Math.cos(ang) * r));
                this.y = Math.max(80, Math.min(this.game.height - 80, this.game.player.y + Math.sin(ang) * r));
            }
            this.isBlinking = true;
            const burstCount = this.phase === 3 ? 8 : 6;
            for (let i = 0; i < burstCount; i++) {
                const a = (i / burstCount) * Math.PI * 2;
                const p = this.fireProjectile(this.x, this.y, a, 'bullet');
                if (p) { p.color = '#aa00ff'; p.speed = 300; p.radius = 4; }
            }
            if (this.game.screenShake) this.game.screenShake.trigger(15, 0.2);
        }
        if (this._chainPhase >= this._chainCount && this._chainTimer >= 0.2) {
            this.isBlinking = false; this._chainPhase = 0; this._chainCount = 0;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  TITAN ATTACKS (orange heavy dreadnought)
    // ══════════════════════════════════════════════════════════════

    // P1: Wall of 3 slow fat cannonballs
    cannonBarrage(deltaTime) {
        const rate = this.phase === 3 ? 0.5 : 0.7;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const target = this.ai.getTargetPosition();
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        const count = this.phase === 3 ? 5 : 3;
        const spread = 0.5;
        for (let i = 0; i < count; i++) {
            const a = base - spread / 2 + (spread / Math.max(count - 1, 1)) * i;
            const p = this.fireProjectile(this.x, this.y, a, 'bullet');
            if (p) { p.color = '#ff7700'; p.speed = 160; p.radius = 12; p.damage = 2 * (this.damageMultiplier || 1); }
        }
        if (this.game.screenShake) this.game.screenShake.trigger(10, 0.2);
    }

    // P2: Two horizontal beam-lines sweep left-to-right (rail gun lanes)
    railSalvo(deltaTime) {
        const rate = this.phase === 3 ? 0.06 : 0.09;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        // Fire rapid stream from both upper and lower cannons
        const offsets = [-40, 40];
        offsets.forEach(yo => {
            const p = this.fireProjectile(this.x, this.y + yo, 0, 'bullet'); // fires right
            if (p) { p.color = '#ff4400'; p.speed = 420; p.radius = 7; p.damage = 1.5 * (this.damageMultiplier || 1); }
            const p2 = this.fireProjectile(this.x, this.y + yo, Math.PI, 'bullet'); // fires left
            if (p2) { p2.color = '#ff4400'; p2.speed = 420; p2.radius = 7; p2.damage = 1.5 * (this.damageMultiplier || 1); }
        });
    }

    // P3: Full-screen supernova — 16 fat slow shots + shockwave
    supernova(deltaTime) {
        if (!this._supernovaFired) {
            this._supernovaFired = true;
            const count = this.phase === 3 ? 20 : 16;
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2;
                const p = this.fireProjectile(this.x, this.y, a, 'bullet');
                if (p) { p.color = '#ff8800'; p.speed = 130; p.radius = 14; p.damage = 2.5 * (this.damageMultiplier || 1); }
            }
            // Inner fast ring
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
                const p = this.fireProjectile(this.x, this.y, a, 'boss_missile');
                if (p) { p.color = '#ffffff'; }
            }
            if (this.game.screenShake) this.game.screenShake.trigger(60, 1.0);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  BERSERKER ATTACKS (red rage delta wing)
    // ══════════════════════════════════════════════════════════════

    // P1/P2: Spinning ring, arms rotate each volley
    rageSpin(deltaTime) {
        const rate = this.phase === 3 ? 0.14 : 0.22;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const arms = this.phase === 3 ? 10 : (this.phase === 2 ? 8 : 6);
        const spin = total * (Math.PI / (arms * 0.8)); // rotate each volley
        for (let i = 0; i < arms; i++) {
            const a = spin + (i / arms) * Math.PI * 2;
            const p = this.fireProjectile(this.x, this.y, a, 'bullet');
            if (p) { p.color = '#ff3300'; p.speed = 260 + this.phase * 30; }
        }
        if (this.phase === 3 && this.game.screenShake) this.game.screenShake.trigger(8, 0.1);
    }

    // P2/P3: Charges directly at player firing continuous stream along path
    berserkerRush(deltaTime) {
        if (!this._rushPhase) { this._rushPhase = 'charge'; this._rushTimer = 0; }
        this._rushTimer += deltaTime;
        if (this._rushPhase === 'charge') {
            if (this.game.player) {
                const dx = this.game.player.x - this.x, dy = this.game.player.y - this.y;
                const dist = Math.hypot(dx, dy);
                const rushSpd = 500 + this.phase * 80;
                this.x += (dx / dist) * rushSpd * deltaTime;
                this.y += (dy / dist) * rushSpd * deltaTime;
                // Fire bullets along path
                const rate = 0.06;
                const total = Math.floor(this._rushTimer / rate);
                const prev = Math.floor((this._rushTimer - deltaTime) / rate);
                if (total > prev) {
                    const a = Math.atan2(dy, dx);
                    const p = this.fireProjectile(this.x, this.y, a, 'bullet');
                    if (p) { p.color = '#ff5500'; p.speed = 380; }
                }
            }
            if (this._rushTimer >= 0.6) { this._rushPhase = 'recover'; this._rushTimer = 0; }
        } else {
            if (this._rushTimer >= 0.4) { this._rushPhase = null; this._rushTimer = 0; }
        }
    }

    // P3: Full chaos — fast 12-arm ring + aimed burst simultaneously every frame
    frenzyStorm(deltaTime) {
        const rate = this.phase === 3 ? 0.1 : 0.16;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const arms = 12;
        const spin = total * 0.35;
        for (let i = 0; i < arms; i++) {
            const a = spin + (i / arms) * Math.PI * 2;
            const p = this.fireProjectile(this.x, this.y, a, 'bullet');
            if (p) { p.color = i % 2 === 0 ? '#ff2200' : '#ff8800'; p.speed = 220; }
        }
        const target = this.ai.getTargetPosition();
        const aim = Math.atan2(target.y - this.y, target.x - this.x);
        const m = this.fireProjectile(this.x, this.y, aim, 'boss_missile');
        if (m) { m.color = '#ffffff'; }
        if (this.game.screenShake) this.game.screenShake.trigger(10, 0.12);
    }

    // ══════════════════════════════════════════════════════════════
    //  TACTICIAN ATTACKS (cyan precision flanker)
    // ══════════════════════════════════════════════════════════════

    // P1: Single perfectly-timed predicted shot with heavy lead
    precisioShot(deltaTime) {
        const rate = this.phase === 3 ? 0.22 : 0.35;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const target = this.ai.getTargetPosition();
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        // Tight 2-shot burst with minimal spread
        const p1 = this.fireProjectile(this.x, this.y, base - 0.04, 'bullet');
        const p2 = this.fireProjectile(this.x, this.y, base + 0.04, 'bullet');
        [p1, p2].forEach(p => { if (p) { p.color = '#00ddff'; p.speed = 390; p.radius = 4; } });
    }

    // P2/P3: Fires from predicted flank angle — shots come from unexpected directions
    flankVolley(deltaTime) {
        const rate = this.phase === 3 ? 0.18 : 0.28;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        if (!this.game.player) return;
        // Compute flank origin: 200px perpendicular to player's movement
        const perp = this.ai.getCounterDodgeAngle() + Math.PI / 2;
        const flankX = Math.max(80, Math.min(this.game.width - 80, this.game.player.x + Math.cos(perp) * 200));
        const flankY = Math.max(80, Math.min(this.game.height - 80, this.game.player.y + Math.sin(perp) * 200));
        const toPlayer = Math.atan2(this.game.player.y - flankY, this.game.player.x - flankX);
        const count = this.phase === 3 ? 4 : 3;
        for (let i = 0; i < count; i++) {
            const a = toPlayer + (i - (count - 1) / 2) * 0.1;
            const p = this.fireProjectile(flankX, flankY, a, 'bullet');
            if (p) { p.color = '#00ffcc'; p.speed = 360; p.radius = 4; }
        }
    }

    // P3: 5 perfectly-timed shots fired in sequence at 0.12s intervals
    coordinatedStrike(deltaTime) {
        if (!this._csTimer) this._csTimer = 0;
        if (!this._csShot) this._csShot = 0;
        this._csTimer += deltaTime;
        const interval = 0.12;
        const maxShots = this.phase === 3 ? 6 : 5;
        if (this._csShot < maxShots && this._csTimer >= this._csShot * interval) {
            const target = this.ai.getTargetPosition();
            const a = Math.atan2(target.y - this.y, target.x - this.x);
            const p = this.fireProjectile(this.x, this.y, a + (this._csShot % 2 === 0 ? 0 : 0.05), 'bullet');
            if (p) { p.color = '#00ffff'; p.speed = 420; p.radius = 5; }
            this._csShot++;
        }
        if (this._csShot >= maxShots && this._csTimer >= maxShots * interval + 0.3) {
            this._csTimer = 0; this._csShot = 0;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  SWARMLORD ATTACKS (yellow carrier, area denial)
    // ══════════════════════════════════════════════════════════════

    // P1: 5 bullets dropped straight down like bombs
    swarmDrop(deltaTime) {
        const rate = this.phase === 3 ? 0.25 : 0.4;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const count = this.phase === 3 ? 7 : 5;
        const spread = this.game.width * 0.4;
        for (let i = 0; i < count; i++) {
            const ox = -spread / 2 + (spread / (count - 1)) * i;
            const p = this.fireProjectile(this.x + ox, this.y, Math.PI / 2, 'bullet');
            if (p) { p.color = '#ffee00'; p.speed = 220 + this.phase * 30; p.radius = 6; }
        }
    }

    // P2: 3 cluster projectiles that split into 4 each after 0.5s
    clusterStrike(deltaTime) {
        const rate = this.phase === 3 ? 0.4 : 0.6;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const target = this.ai.getTargetPosition();
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        const count = this.phase === 3 ? 4 : 3;
        for (let i = 0; i < count; i++) {
            const a = base + (i - (count - 1) / 2) * 0.25;
            const p = this.fireProjectile(this.x, this.y, a, 'bullet');
            if (p) {
                p.color = '#ffcc00'; p.speed = 200; p.radius = 8;
                // Attach split timer
                p._splitTimer = 0;
                p._splitDone = false;
                const origUpdate = p.update ? p.update.bind(p) : null;
                p.update = (dt) => {
                    if (origUpdate) origUpdate(dt);
                    if (!p._splitDone) {
                        p._splitTimer += dt;
                        if (p._splitTimer >= 0.5) {
                            p._splitDone = true;
                            for (let j = 0; j < 4; j++) {
                                const sa = p._angle !== undefined ? p._angle : a;
                                const sp = this.fireProjectile(p.x, p.y, sa + (j / 4) * Math.PI * 2, 'bullet');
                                if (sp) { sp.color = '#ffaa00'; sp.speed = 280; sp.radius = 4; }
                            }
                            p.markedForDeletion = true;
                        }
                    }
                };
            }
        }
        if (this.game.screenShake) this.game.screenShake.trigger(8, 0.15);
    }

    // P3: 8 simultaneous diagonal rain streams from top in different angles
    monsoonBarrage(deltaTime) {
        const rate = this.phase === 3 ? 0.08 : 0.12;
        const total = Math.floor(this.stateTimer / rate);
        const prev = Math.floor((this.stateTimer - deltaTime) / rate);
        if (total <= prev) return;
        const streams = this.phase === 3 ? 8 : 6;
        for (let i = 0; i < streams; i++) {
            const srcX = (this.game.width / (streams - 1)) * i;
            const dropAngle = Math.PI / 2 + Math.sin(this.stateTimer * 0.8 + i) * 0.4;
            const p = this.fireProjectile(srcX, 0, dropAngle, 'bullet');
            if (p) { p.color = i % 2 === 0 ? '#ffee00' : '#ffaa00'; p.speed = 240 + this.phase * 20; p.radius = 5; }
        }
    }
    fireProjectile(x, y, angle, type) {
        const p = new Projectile(this.game, x, y, angle, type === 'boss_missile' ? 'missile' : type, 'enemy');
        p.source = 'boss';

        if (type === 'boss_missile') {
            p.speed = 180;        // was 250 — slower, more dodgeable
            p.maxSpeed = 420;     // was 600
            p.acceleration = 200; // was 300
            p.damage = (this.level >= 15 ? 2.0 : 1.5) * (this.damageMultiplier || 1);
            p.lifetime = 5.0;
            p.isHoming = false;
            p.color = '#ff0000';
            p.radius = 10;
        } else if (type === 'missile') {
            p.speed = 130;
            p.maxSpeed = 320;
            p.acceleration = 150;
            p.damage = (this.level >= 20 ? 1.2 : 0.8) * (this.damageMultiplier || 1);
            p.lifetime = 4.0;
            p.isHoming = false;
        } else {
            p.speed = 280 + (this.level * 4); // was 350+(level*5) — ~20% slower
            p.damage = Math.max(1, Math.floor(this.level / 5)) * (this.damageMultiplier || 1);
        }
        this.game.projectiles.push(p);
        if (this.game.audio) this.game.audio.enemyShot();
        return p;
    }

    takeDamage(amount) {
        if (this.isInvulnerable) return false;

        // PLAYER ADVANTAGE: +50% damage during vulnerability window
        if (this.ai && this.ai.weakened) {
            amount *= 1.5;
        }

        this.health -= amount;

        if (this.ai) {
            this.ai.hitsLanded++;
            this.ai.onHeavyHit(amount); // Triggers interrupt/weakened if applicable
        }

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

        // ── Phantom blink (invisible during blinkDash) ────────
        if (this.isBlinking) {
            ctx.globalAlpha = 0.08 + Math.abs(Math.sin(this.game.lastTime * 0.04)) * 0.15;
        }

        // ── Pulsing phase aura ring ───────────────────────────
        const auraColors = ['#00ff88', '#ff8800', '#ff2222'];
        const auraColor = auraColors[this.phase - 1] || '#00ff88';
        const auraPulse = 0.35 + Math.abs(Math.sin(this.game.lastTime * (this.phase === 3 ? 0.012 : 0.005))) * 0.55;
        const auraR = this.radius + 14 + Math.abs(Math.sin(this.game.lastTime * 0.004)) * 8;
        ctx.save();
        ctx.globalAlpha = auraPulse * (this.isBlinking ? 0.2 : 1.0);
        ctx.shadowBlur = 40;
        ctx.shadowColor = auraColor;
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = this.phase === 3 ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

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

        // ── PLAYER ADVANTAGES VISUALS ───────────────────────────
        if (this.ai) {
            if (this.ai.telegraphing) {
                // Danger flash / charge up
                ctx.save();
                ctx.globalAlpha = Math.abs(Math.sin(this.game.lastTime * 0.02)) * 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
                ctx.strokeStyle = '#ff3300';
                ctx.lineWidth = 6;
                ctx.stroke();
                // Add a warning exclamation indicator
                ctx.fillStyle = '#ffaa00';
                ctx.font = 'bold 30px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('!', 0, -this.radius - 20);
                ctx.restore();
            }

            if (this.ai.weakened) {
                // Weakened glimmer
                ctx.save();
                ctx.globalAlpha = 0.5 + Math.sin(this.game.lastTime * 0.01) * 0.3;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.globalCompositeOperation = 'overlay';
                ctx.fill();
                ctx.restore();
            }
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

        // Personality label
        const persColors = { Phantom: '#aa00ff', Titan: '#ff6600', Berserker: '#ff2222', Tactician: '#00ccff', Swarmlord: '#ffee00' };
        ctx.globalAlpha = 0.75;
        ctx.font = '9px monospace';
        ctx.fillStyle = persColors[this.personality] || '#ffffff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(`[${this.personality || 'BOSS'}]`, hudX, hudY + 13);

        // Strategy label (phase 2+)
        if (this.phase >= 2) {
            const stratLabels = { 'standard': 'STANDARD', 'counter-dodge': '⟲ COUNTER', 'suppress': '▶▶ SUPPRESS', 'overwhelm': '❯❯❯ OVERWHELM' };
            ctx.globalAlpha = 0.45;
            ctx.font = '8px monospace';
            ctx.fillStyle = '#aaaaff';
            ctx.shadowBlur = 0;
            ctx.fillText(stratLabels[this.ai.strategy] || '', hudX, hudY + 23);
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
        // Cockpit inner glow
        ctx.shadowBlur = 12; ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(30, 0, 7, 4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Animated thruster bloom behind the ship
        const t = this.game.lastTime * 0.001;
        const thrustLen = this.state === 'dashing' ? 85 : (this.state === 'repositioning' ? 55 : 32);
        const thrustWidth = 7 + Math.abs(Math.sin(t * 12)) * 4;
        const thrustGrad = ctx.createLinearGradient(0, 0, -thrustLen, 0);
        thrustGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
        thrustGrad.addColorStop(0.4, this.color + 'bb');
        thrustGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.shadowBlur = 18 + Math.sin(t * 8) * 6;
        ctx.shadowColor = this.color;
        ctx.fillStyle = thrustGrad;
        ctx.beginPath();
        ctx.moveTo(-55, -thrustWidth);
        ctx.lineTo(-55 - thrustLen, 0);
        ctx.lineTo(-55, thrustWidth);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    drawModelSleek(ctx) {
        // PHANTOM — sleek stealth jet with purple wing-tip lights
        const grad = ctx.createLinearGradient(-80, 0, 80, 0);
        grad.addColorStop(0, '#111'); grad.addColorStop(0.5, this.color); grad.addColorStop(1, '#fff');
        ctx.fillStyle = grad; ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(100, 0); ctx.lineTo(55, 12); ctx.lineTo(-40, 16); ctx.lineTo(-80, 8);
        ctx.lineTo(-80, -8); ctx.lineTo(-40, -16); ctx.lineTo(55, -12);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, 14); ctx.lineTo(-40, 90); ctx.lineTo(-80, 90); ctx.lineTo(-60, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, -14); ctx.lineTo(-40, -90); ctx.lineTo(-80, -90); ctx.lineTo(-60, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-50, 14); ctx.lineTo(-70, 38); ctx.lineTo(-80, 38); ctx.lineTo(-65, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-50, -14); ctx.lineTo(-70, -38); ctx.lineTo(-80, -38); ctx.lineTo(-65, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Circuit data-stream lines (pulsing purple)
        ctx.shadowBlur = 0;
        const cp = 0.2 + Math.abs(Math.sin(this.game.lastTime * 0.003)) * 0.6;
        ctx.strokeStyle = `rgba(170,0,255,${cp})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(20, 12); ctx.lineTo(20, -12); ctx.moveTo(-20, 15); ctx.lineTo(-20, -15); ctx.stroke();
        // Wing-tip glowing orbs (purple)
        const wt = this.game.lastTime * 0.006;
        const wPulse = 0.55 + Math.abs(Math.sin(wt)) * 0.45;
        ctx.shadowBlur = 22; ctx.shadowColor = '#cc00ff';
        ctx.fillStyle = `rgba(180,0,255,${wPulse})`;
        ctx.beginPath(); ctx.arc(-80, 90, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-80, -90, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(220,130,255,${wPulse * 0.65})`;
        ctx.beginPath(); ctx.arc(-80, 38, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-80, -38, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawModelHeavy(ctx) {
        // TITAN — bulky dreadnought with orange cannon lights
        const grad = ctx.createLinearGradient(-120, 0, 120, 0);
        grad.addColorStop(0, '#110000'); grad.addColorStop(0.5, this.color); grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad; ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(115, 0); ctx.lineTo(70, 25); ctx.lineTo(-50, 30); ctx.lineTo(-120, 18);
        ctx.lineTo(-120, -18); ctx.lineTo(-50, -30); ctx.lineTo(70, -25);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, 26); ctx.lineTo(-20, 80); ctx.lineTo(-60, 80); ctx.lineTo(-30, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, -26); ctx.lineTo(-20, -80); ctx.lineTo(-60, -80); ctx.lineTo(-30, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(60, 24); ctx.lineTo(20, 55); ctx.lineTo(-20, 55); ctx.lineTo(0, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(60, -24); ctx.lineTo(20, -55); ctx.lineTo(-20, -55); ctx.lineTo(0, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(-40, -22, 70, 44);
        ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = 2; ctx.strokeRect(-40, -22, 70, 44);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(-60, 28); ctx.lineTo(-110, 70); ctx.lineTo(-80, 55); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-60, -28); ctx.lineTo(-110, -70); ctx.lineTo(-80, -55); ctx.closePath(); ctx.fill();
        // Glowing wing cannon muzzle lights (orange, pulsing)
        const ht = 0.5 + Math.abs(Math.sin(this.game.lastTime * 0.008)) * 0.5;
        ctx.shadowBlur = 24; ctx.shadowColor = '#ff6600';
        ctx.fillStyle = `rgba(255,110,0,${ht})`;
        ctx.beginPath(); ctx.arc(-118, 12, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-118, -12, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-58, 28, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-58, -28, 5, 0, Math.PI * 2); ctx.fill();
        // Wing-tip glowing orbs (orange)
        const wt2 = this.game.lastTime * 0.005;
        ctx.shadowBlur = 26; ctx.shadowColor = '#ff6600';
        ctx.fillStyle = `rgba(255,140,0,${0.6 + Math.abs(Math.sin(wt2)) * 0.4})`;
        ctx.beginPath(); ctx.arc(-60, 80, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-60, -80, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,180,60,${0.5 + Math.abs(Math.sin(wt2 + 1)) * 0.4})`;
        ctx.beginPath(); ctx.arc(-20, 55, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-20, -55, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawModelTriangle(ctx) {
        // BERSERKER — aggressive delta wing with red rage lights
        const grad = ctx.createLinearGradient(-100, 0, 100, 0);
        grad.addColorStop(0, '#111'); grad.addColorStop(0.5, this.color); grad.addColorStop(1, '#eee');
        ctx.fillStyle = grad; ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff2200';
        ctx.beginPath();
        ctx.moveTo(110, 0); ctx.lineTo(-80, 100); ctx.lineTo(-60, 0); ctx.lineTo(-80, -100);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(-40, 0); ctx.lineTo(-60, -25); ctx.closePath(); ctx.fill();
        // Rage center stripe
        ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(50, 0); ctx.lineTo(-50, 0); ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = this.color; ctx.globalAlpha = 0.5;
        ctx.fillRect(-20, 20, 15, 30); ctx.fillRect(-20, -50, 15, 30);
        ctx.globalAlpha = 1.0;
        // Wing-tip trail orbs (red-orange, strobe in phase 3)
        const bt = this.game.lastTime * 0.009;
        const bPulse = this.phase === 3 ? (Math.abs(Math.sin(bt * 3)) > 0.5 ? 1.0 : 0.15) : (0.5 + Math.abs(Math.sin(bt)) * 0.5);
        ctx.shadowBlur = 28; ctx.shadowColor = '#ff2200';
        ctx.fillStyle = `rgba(255,50,0,${bPulse})`;
        ctx.beginPath(); ctx.arc(-80, 100, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-80, -100, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,150,0,${bPulse * 0.7})`;
        ctx.beginPath(); ctx.arc(-20, 50, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-20, -50, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawModelStealth(ctx) {
        // TACTICIAN — angular stealth bomber with cyan data-stream lights
        ctx.fillStyle = '#0a0a0a';
        ctx.strokeStyle = this.color; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12; ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(120, 0); ctx.lineTo(20, 45); ctx.lineTo(-90, 110); ctx.lineTo(-60, 30);
        ctx.lineTo(-100, 0); ctx.lineTo(-60, -30); ctx.lineTo(-90, -110); ctx.lineTo(20, -45);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        // Data-stream circuit lines (cyan, pulsing)
        const sp = 0.2 + Math.abs(Math.sin(this.game.lastTime * 0.004)) * 0.65;
        ctx.strokeStyle = `rgba(0,200,255,${sp})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 20); ctx.lineTo(-40, 20); ctx.moveTo(40, -20); ctx.lineTo(-40, -20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(-10, -20); ctx.moveTo(60, 0); ctx.lineTo(20, 0); ctx.stroke();
        // Wing-tip glowing orbs (cyan-blue)
        const st = this.game.lastTime * 0.007;
        const sPulse = 0.5 + Math.abs(Math.sin(st)) * 0.5;
        ctx.shadowBlur = 24; ctx.shadowColor = '#00ccff';
        ctx.fillStyle = `rgba(0,210,255,${sPulse})`;
        ctx.beginPath(); ctx.arc(-90, 110, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-90, -110, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(0,160,255,${sPulse * 0.6})`;
        ctx.beginPath(); ctx.arc(-60, 30, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-60, -30, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawModelCarrier(ctx) {
        // SWARMLORD — wide carrier with yellow pulsing launch bays
        const grad = ctx.createLinearGradient(-130, 0, 100, 0);
        grad.addColorStop(0, '#222'); grad.addColorStop(0.5, this.color); grad.addColorStop(1, '#999');
        ctx.fillStyle = grad; ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(90, 35); ctx.lineTo(90, -35); ctx.lineTo(-130, -55); ctx.lineTo(-130, 55);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(-100, 55, 60, 45); ctx.fillRect(-100, -100, 60, 45);
        ctx.strokeRect(-100, 55, 60, 45); ctx.strokeRect(-100, -100, 60, 45);
        ctx.shadowBlur = 0;
        // Pulsing launch bay lights (animated cyan)
        const ct2 = this.game.lastTime * 0.006;
        const bpulse = 0.4 + Math.abs(Math.sin(ct2)) * 0.6;
        ctx.shadowBlur = 16; ctx.shadowColor = '#00f3ff';
        ctx.fillStyle = `rgba(0,243,255,${bpulse})`;
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(-80 + i * 25, 65, 10, 25);
            ctx.fillRect(-80 + i * 25, -90, 10, 25);
        }
        // Wing-tip glowing orbs (yellow-green)
        const wt3 = this.game.lastTime * 0.005;
        const wPulse3 = 0.6 + Math.abs(Math.sin(wt3)) * 0.4;
        ctx.shadowBlur = 30; ctx.shadowColor = '#ffee00';
        ctx.fillStyle = `rgba(255,230,0,${wPulse3})`;
        ctx.beginPath(); ctx.arc(-130, 55, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-130, -55, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,200,0,${wPulse3 * 0.6})`;
        ctx.beginPath(); ctx.arc(-100, 80, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-100, -80, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
    }
}
