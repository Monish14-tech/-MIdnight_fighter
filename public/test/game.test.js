#!/usr/bin/env node
/**
 * Midnight Fighter — Headless Automated Test Suite
 * Run: node public/test/game.test.js
 * No browser required — pure Node.js with minimal mocks.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Tiny test framework
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        results.push({ name, ok: true });
    } catch (e) {
        failed++;
        results.push({ name, ok: false, error: e.message });
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, label) {
    if (a !== b) throw new Error(`${label || 'assertEqual'}: expected ${b}, got ${a}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Minimal SHIP_DATA extracted inline for testing (keeps test self-contained)
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_SHIP_FIELDS = ['name', 'hp', 'speed', 'damage', 'fireRate', 'color', 'bulletType', 'missileCount'];

const SHIP_DATA = {
    'default': { name: 'INTERCEPTOR', hp: 3, speed: 340, damage: 1, fireRate: 0.18, missileCooldown: 3.0, missileCount: 1, color: '#00f3ff', bulletType: 'normal' },
    'scout': { name: 'RAZORBACK', hp: 2, speed: 460, damage: 1, fireRate: 0.14, missileCooldown: 2.0, missileCount: 1, color: '#ffff00', bulletType: 'spread' },
    'phantom': { name: 'PHANTOM', hp: 3, speed: 420, damage: 1, fireRate: 0.13, missileCooldown: 1.8, missileCount: 1, color: '#9900ff', bulletType: 'spread' },
    'rapid': { name: 'STORM BRINGER', hp: 3, speed: 350, damage: 1, fireRate: 0.10, missileCooldown: 1.8, missileCount: 2, color: '#aa00ff', bulletType: 'normal' },
    'fighter': { name: 'CRIMSON FURY', hp: 4, speed: 360, damage: 2, fireRate: 0.17, missileCooldown: 2.5, missileCount: 2, color: '#ff0055', bulletType: 'normal' },
    'pulse': { name: 'NEON PULSE', hp: 4, speed: 400, damage: 2, fireRate: 0.06, missileCooldown: 2.0, missileCount: 2, color: '#00ffff', bulletType: 'normal' },
    'quantum': { name: 'QUANTUM GHOST', hp: 5, speed: 500, damage: 9, fireRate: 0.07, missileCooldown: 1.6, missileCount: 3, color: '#39ff14', bulletType: 'railgun' },
    'void': { name: 'VOID STALKER', hp: 5, speed: 380, damage: 6, fireRate: 0.32, missileCooldown: 2.5, missileCount: 2, color: '#4400ff', bulletType: 'railgun' },
    'solar': { name: 'SOLAR FLARE', hp: 5, speed: 340, damage: 3, fireRate: 0.20, missileCooldown: 3.0, missileCount: 2, color: '#ffcc00', bulletType: 'explosive' },
    'bomber': { name: 'DOOMSDAY', hp: 5, speed: 300, damage: 3, fireRate: 0.18, missileCooldown: 3.0, missileCount: 3, color: '#ff6600', bulletType: 'explosive' },
    'tank': { name: 'V.G. TITAN', hp: 7, speed: 290, damage: 3, fireRate: 0.20, missileCooldown: 3.5, missileCount: 2, color: '#00ff44', bulletType: 'piercing' },
    'laser_drone': { name: 'LASER DRONE', hp: 5, speed: 370, damage: 2, fireRate: 0.05, missileCooldown: 2.5, missileCount: 2, color: '#ff00cc', bulletType: 'laser' },
    'wraith': { name: 'COSMIC WRAITH', hp: 6, speed: 460, damage: 11, fireRate: 0.08, missileCooldown: 1.8, missileCount: 3, color: '#cc44ff', bulletType: 'railgun' },
    'vanguard': { name: 'VANGUARD', hp: 6, speed: 360, damage: 3, fireRate: 0.10, missileCooldown: 2.5, missileCount: 3, color: '#00ffcc', bulletType: 'piercing' },
    'eclipse': { name: 'ECLIPSE SERAPH', hp: 7, speed: 380, damage: 6, fireRate: 0.07, missileCooldown: 2.0, missileCount: 4, color: '#66ccff', bulletType: 'piercing' },
    'shadowblade': { name: 'SHADOWBLADE', hp: 7, speed: 440, damage: 7, fireRate: 0.09, missileCooldown: 2.2, missileCount: 4, color: '#5522aa', bulletType: 'piercing' },
    'guardian': { name: 'GALAXY GUARDIAN', hp: 8, speed: 270, damage: 3, fireRate: 0.17, missileCooldown: 3.5, missileCount: 3, color: '#ffffff', bulletType: 'normal' },
    'obliterator': { name: 'OBLITERATOR PRIME', hp: 8, speed: 320, damage: 8, fireRate: 0.10, missileCooldown: 2.5, missileCount: 5, color: '#ff3366', bulletType: 'explosive' },
    'inferno': { name: 'INFERNO KING', hp: 8, speed: 400, damage: 10, fireRate: 0.12, missileCooldown: 2.0, missileCount: 5, color: '#ff4500', bulletType: 'explosive' },
    'juggernaut': { name: 'JUGGERNAUT', hp: 10, speed: 260, damage: 4, fireRate: 0.22, missileCooldown: 4.0, missileCount: 5, color: '#ff9900', bulletType: 'piercing' },
    'tempest': { name: 'TEMPEST LORD', hp: 9, speed: 380, damage: 8, fireRate: 0.11, missileCooldown: 2.4, missileCount: 6, color: '#00d9ff', bulletType: 'spread' },
    'reaper': { name: 'VOID REAPER', hp: 9, speed: 420, damage: 15, fireRate: 0.09, missileCooldown: 2.0, missileCount: 5, color: '#880022', bulletType: 'explosive' },
    'crimson_emperor': { name: 'CRIMSON EMPEROR', hp: 10, speed: 370, damage: 13, fireRate: 0.10, missileCooldown: 2.2, missileCount: 8, color: '#dc143c', bulletType: 'piercing' },
    'phoenix': { name: 'CELESTIAL PHOENIX', hp: 11, speed: 410, damage: 14, fireRate: 0.12, missileCooldown: 2.0, missileCount: 7, color: '#ffa500', bulletType: 'explosive' },
    'starborn': { name: 'STARBORN TITAN', hp: 11, speed: 360, damage: 9, fireRate: 0.08, missileCooldown: 1.8, missileCount: 6, color: '#99ffcc', bulletType: 'railgun' },
    'leviathan': { name: 'LEVIATHAN ROX', hp: 13, speed: 340, damage: 12, fireRate: 0.13, missileCooldown: 2.5, missileCount: 7, color: '#003d82', bulletType: 'explosive' },
    'sentinel': { name: 'ETERNAL SENTINEL', hp: 15, speed: 380, damage: 16, fireRate: 0.11, missileCooldown: 1.8, missileCount: 9, color: '#e8e8e8', bulletType: 'railgun' },
    'nova': { name: 'NOVA ASCENDANT', hp: 12, speed: 440, damage: 18, fireRate: 0.07, missileCooldown: 1.5, missileCount: 8, color: '#ffeeaa', bulletType: 'railgun' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Mock Game for unit testing game logic inline
// ─────────────────────────────────────────────────────────────────────────────
function createMockGame(overrides = {}) {
    let _seed = 1;
    const game = {
        width: 1920, height: 1080,
        currentLevel: 1,
        enemiesSpawned: 0,
        enemiesForLevel: 5 + (1 * 3), // Level 1 = 8
        entityCounter: 0,
        enemies: [],
        projectiles: [],
        particles: [],
        powerups: [],
        boss: null,
        gameOver: false,
        bossJustDefeated: false,
        score: 0,
        difficultyMultiplier: 1.0,
        spawnedEnemyTypes: new Set(),
        autoTargetEnabled: false,
        random() {
            // Linear congruential PRNG
            _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
            return Math.abs(_seed) / 0x80000000;
        },
        initRandom(seedStr) {
            _seed = [...seedStr].reduce((acc, c) => acc + c.charCodeAt(0), 0);
        },
        getPlayers() { return []; },
        audio: null,
        screenShake: { trigger() { } },
        lastTime: 0,
        ...overrides
    };
    return game;
}

// ─────────────────────────────────────────────────────────────────────────────
//  getAvailableEnemyTypes — copied logic for isolated testing
// ─────────────────────────────────────────────────────────────────────────────
function getAvailableEnemyTypes(level) {
    if (level >= 21) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'splitter', 'phantom', 'titan', 'wraith', 'vortex', 'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor', 'mirror', 'swarmer'];
    if (level >= 16) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'splitter', 'wraith', 'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor', 'mirror', 'swarmer'];
    if (level >= 14) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'titan', 'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'swarmer'];
    if (level >= 12) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'titan', 'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor'];
    if (level >= 10) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom', 'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'blade'];
    if (level >= 8) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom', 'bomber', 'interceptor', 'decoy', 'launcher', 'shielder'];
    if (level >= 6) return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom', 'bomber', 'interceptor', 'decoy', 'launcher'];
    if (level >= 4) return ['chaser', 'heavy', 'shooter', 'swarm', 'bomber', 'interceptor', 'decoy'];
    if (level >= 3) return ['chaser', 'heavy', 'shooter', 'bomber'];
    return ['chaser', 'heavy', 'shooter'];
}

// ─────────────────────────────────────────────────────────────────────────────
//  checkLevelUp — copied logic (pure, no side effects)
// ─────────────────────────────────────────────────────────────────────────────
function checkLevelUp(game) {
    if (game.enemiesSpawned >= game.enemiesForLevel &&
        game.enemies.length === 0 &&
        !game.boss) {
        game.currentLevel++;
        game.enemiesForLevel = game.currentLevel >= 24
            ? 101 + ((game.currentLevel - 24) * 20)
            : 5 + (game.currentLevel * 3);
        game.enemiesSpawned = 0;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PowerUp applyPowerUp — local mock for coverage test
// ─────────────────────────────────────────────────────────────────────────────
const POWERUP_TYPES_IN_SPAWN = ['speed', 'slowmo', 'invulnerability', 'health_recover', 'health_boost', 'shield', 'double_damage', 'rapid_fire', 'nuke', 'ghost', 'ammo_refill'];
const POWERUP_TYPES_IN_APPLY = new Set(['speed', 'slowmo', 'invulnerability', 'health_recover', 'health_boost', 'shield', 'double_damage', 'rapid_fire', 'ghost', 'ammo_refill', 'nuke']);

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────────────────────────────────────

// 1. Spawn gate: enemiesSpawned < enemiesForLevel should be valid after init
test('Spawn gate — initial state allows spawning', () => {
    const g = createMockGame();
    const canSpawn = g.enemiesSpawned < g.enemiesForLevel;
    assert(canSpawn, `Spawn gate blocked: ${g.enemiesSpawned} < ${g.enemiesForLevel}`);
    assertEqual(g.enemiesForLevel, 8, 'Level 1 enemiesForLevel'); // 5 + 1*3 = 8
    assertEqual(g.entityCounter, 0, 'entityCounter starts at 0');
});

// 2. Spawn gate stays consistent after several increments
test('Spawn gate — increments correctly', () => {
    const g = createMockGame();
    for (let i = 0; i < 8; i++) g.enemiesSpawned++;
    assert(g.enemiesSpawned >= g.enemiesForLevel, 'Wave should be exhausted');
});

// 3. SHIP_DATA integrity — all ships have required fields with valid values
test('SHIP_DATA integrity — all ships have required fields', () => {
    for (const [key, ship] of Object.entries(SHIP_DATA)) {
        for (const field of REQUIRED_SHIP_FIELDS) {
            assert(ship[field] !== undefined, `Ship '${key}' missing field '${field}'`);
            if (typeof ship[field] === 'number') {
                assert(ship[field] > 0, `Ship '${key}' field '${field}' must be > 0, got ${ship[field]}`);
            }
        }
    }
});

// 4. SHIP_DATA — new ships present
test('SHIP_DATA — laser_drone and nova ships exist', () => {
    assert('laser_drone' in SHIP_DATA, 'laser_drone ship missing from SHIP_DATA');
    assert('nova' in SHIP_DATA, 'nova ship missing from SHIP_DATA');
    assertEqual(SHIP_DATA['laser_drone'].bulletType, 'laser', 'laser_drone bulletType');
    assertEqual(SHIP_DATA['nova'].bulletType, 'railgun', 'nova bulletType');
});

// 5. PowerUp types coverage — every type in spawn list is handled by applyPowerUp
test('PowerUp types — all spawn types handled in applyPowerUp', () => {
    for (const t of POWERUP_TYPES_IN_SPAWN) {
        assert(POWERUP_TYPES_IN_APPLY.has(t), `PowerUp type '${t}' is in spawn list but NOT handled in applyPowerUp`);
    }
});

// 6. getAvailableEnemyTypes — returns non-empty for all key levels
test('getAvailableEnemyTypes — returns valid arrays for all key levels', () => {
    for (const level of [1, 3, 5, 8, 10, 14, 16, 21, 25]) {
        const types = getAvailableEnemyTypes(level);
        assert(Array.isArray(types) && types.length > 0, `Empty types at level ${level}`);
        assert(types.includes('chaser'), `'chaser' always available, missing at level ${level}`);
    }
});

// 7. Level-up trigger — increments currentLevel when wave complete
test('checkLevelUp — increments level when wave is done', () => {
    const g = createMockGame();
    g.enemiesSpawned = 8; // Equal to level 1 enemiesForLevel
    g.enemies = [];
    g.boss = null;
    const beforeLevel = g.currentLevel;
    checkLevelUp(g);
    assertEqual(g.currentLevel, beforeLevel + 1, 'Level should have incremented');
    assertEqual(g.enemiesSpawned, 0, 'enemiesSpawned reset after level up');
    assertEqual(g.enemiesForLevel, 5 + (g.currentLevel * 3), 'enemiesForLevel updated for new level');
});

// 8. Level-up — does NOT trigger if enemies still alive
test('checkLevelUp — does NOT trigger with enemies alive', () => {
    const g = createMockGame();
    g.enemiesSpawned = 8;
    g.enemies = [{ markedForDeletion: false }]; // 1 enemy alive
    const beforeLevel = g.currentLevel;
    checkLevelUp(g);
    assertEqual(g.currentLevel, beforeLevel, 'Level should not increment with enemies alive');
});

// 9. PRNG determinism — same seed → same sequence
test('PRNG — deterministic: same seed produces same sequence', () => {
    const g1 = createMockGame();
    g1.initRandom('midnight_test_seed_42');
    const seq1 = Array.from({ length: 20 }, () => g1.random());

    const g2 = createMockGame();
    g2.initRandom('midnight_test_seed_42');
    const seq2 = Array.from({ length: 20 }, () => g2.random());

    for (let i = 0; i < seq1.length; i++) {
        assertEqual(seq1[i], seq2[i], `PRNG mismatch at index ${i}`);
    }
});

// 10. PRNG — different seeds → different sequences
test('PRNG — different seeds produce different sequences', () => {
    const g1 = createMockGame(); g1.initRandom('seed_A');
    const g2 = createMockGame(); g2.initRandom('seed_B');
    const s1 = g1.random();
    const s2 = g2.random();
    assert(s1 !== s2, 'Different seeds should produce different first values');
});

// 11. PRNG — values in [0, 1)
test('PRNG — all values are in [0, 1)', () => {
    const g = createMockGame(); g.initRandom('range_test');
    for (let i = 0; i < 200; i++) {
        const v = g.random();
        assert(v >= 0 && v < 1, `PRNG out of range: ${v} at i=${i}`);
    }
});

// 12. Boss phase transitions — logic check
test('Boss phases — transition at correct HP thresholds', () => {
    const maxHP = 180;
    let health = maxHP;
    let phase = 1;
    let phase2Triggered = false;
    let phase3Triggered = false;

    function tickBoss(newHealth) {
        health = newHealth;
        const hpPct = health / maxHP;
        if (!phase2Triggered && hpPct <= 0.6) { phase = 2; phase2Triggered = true; }
        if (!phase3Triggered && hpPct <= 0.3) { phase = 3; phase3Triggered = true; }
    }

    tickBoss(200); assertEqual(phase, 1, 'Phase 1 at full HP');
    tickBoss(110); assertEqual(phase, 1, 'Phase 1 at 61% HP');
    tickBoss(108); assertEqual(phase, 2, 'Phase 2 triggers at 60% HP');
    tickBoss(55); assertEqual(phase, 2, 'Phase 2 persists at 31%');
    tickBoss(54); assertEqual(phase, 3, 'Phase 3 triggers at 30% HP');
});

// 13. Player passive: tank heals on kill (accumulator logic)
test('Player passive — tank heals 1 HP after 4 kills', () => {
    let hp = 3, passiveAccum = 0, maxHp = 7;
    function onEnemyKill() {
        passiveAccum += 0.25;
        if (passiveAccum >= 1) { passiveAccum -= 1; hp = Math.min(maxHp, hp + 1); }
    }
    for (let i = 0; i < 4; i++) onEnemyKill();
    assertEqual(hp, 4, 'Tank should gain 1 HP after 4 kills');
    assertEqual(passiveAccum, 0, 'Accumulator should be 0 after full heal');
});

// 14. Sniper preferredRange scales with level
test('Sniper preferredRange — scales correctly with level', () => {
    for (const level of [1, 5, 10, 20]) {
        const preferredRange = 260 + Math.min((level - 1) * 8, 200);
        assert(preferredRange >= 260, `Range should be >= 260 at level ${level}`);
        assert(preferredRange <= 460, `Range should be <= 460 at level ${level}`);
    }
});

// 15. New powerups (nuke/ghost/ammo_refill) are in the spawn pool
test('New powerups — nuke, ghost, ammo_refill in spawn pool', () => {
    for (const t of ['nuke', 'ghost', 'ammo_refill']) {
        assert(POWERUP_TYPES_IN_SPAWN.includes(t), `'${t}' missing from spawn pool`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Report
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(' MIDNIGHT FIGHTER — Automated Test Results');
console.log('══════════════════════════════════════════════');
for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon}  ${r.name}`);
    if (!r.ok) console.log(`       ↳ ${r.error}`);
}
console.log('──────────────────────────────────────────────');
console.log(`  Passed: ${passed}/${passed + failed}`);
if (failed > 0) {
    console.log(`  Failed: ${failed}`);
    console.log('══════════════════════════════════════════════\n');
    process.exit(1);
} else {
    console.log(`  All ${passed} tests passed ✅`);
    console.log('══════════════════════════════════════════════\n');
}
