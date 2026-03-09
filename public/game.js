import { InputHandler } from './input.js?v=16';
import { Player } from './entities/player.js?v=16';
import { Enemy } from './entities/enemy.js?v=16';
import { Explosion, FloatingText } from './entities/particle.js?v=16';
import { Projectile } from './entities/projectile.js?v=16';
import { AudioController } from './audio.js?v=16';
import { ScreenShake, Nebula, CosmicDust, Planet, Asteroid } from './utils.js?v=16';
import { PowerUp } from './entities/powerup.js?v=16';
import { LeaderboardManager } from './leaderboard.js?v=16';
import { SocketIONetplay } from './socketio-netplay.js?v=16';
import { AchievementManager, ACHIEVEMENT_DATA } from './achievements.js?v=16';
import { RANK_DATA, getRankByGlobalPosition } from './ranks.js?v=16';

class AssetLoader {
    constructor() {
        this.assets = new Map();
        this.loadingPromises = [];
    }

    load(name, src) {
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.assets.set(name, img);
                resolve(img);
            };
            img.onerror = () => {
                resolve(null); // Fallback to vector
            };
        });
        this.loadingPromises.push(promise);
        return promise;
    }

    async loadAll() {
        return Promise.all(this.loadingPromises);
    }

    get(name) {
        return this.assets.get(name);
    }
}

export const SHIP_DATA = {
    // ── Tier 0: Starter ──────────────────────────────────────────────────────
    'default': { name: 'INTERCEPTOR', price: 0, hp: 5, speed: 450, damage: 3, fireRate: 0.12, missileCooldown: 1.5, missileCount: 2, color: '#00f3ff', bulletType: 'normal', desc: 'Standard issue. Reliable & fast.', passive: 'None' },
    // ── Tier 1: Early ──────────────────────────────────────
    'scout': { name: 'RAZORBACK', price: 15000, hp: 5, speed: 600, damage: 3, fireRate: 0.10, missileCooldown: 1.2, missileCount: 2, color: '#ffff00', bulletType: 'spread', desc: 'Blazing speed. Fan spread.', passive: 'Speed Demon: Dash CD = 3s. +10% speed at full HP.' },
    'phantom': { name: 'PHANTOM', price: 35000, hp: 6, speed: 550, damage: 3, fireRate: 0.08, missileCooldown: 1.0, missileCount: 2, color: '#9900ff', bulletType: 'spread', desc: 'Nimble spread fighter.', passive: 'Ghost Protocol: 15% chance to ignore incoming damage.' },
    'rapid': { name: 'STORM BRINGER', price: 65000, hp: 6, speed: 450, damage: 3, fireRate: 0.06, missileCooldown: 1.0, missileCount: 3, color: '#aa00ff', bulletType: 'normal', desc: 'Hyper fire rate. Dual missiles.', passive: 'Rapid Suppression: Every 5th shot fires a burst of 3.' },
    'fighter': { name: 'CRIMSON FURY', price: 100000, hp: 8, speed: 460, damage: 5, fireRate: 0.12, missileCooldown: 1.5, missileCount: 3, color: '#ff0055', bulletType: 'normal', desc: 'High damage. Extra HP.', passive: 'Blood Rush: +5% damage per kill (stacks ×5, resets on hit).' },
    'pulse': { name: 'NEON PULSE', price: 150000, hp: 8, speed: 500, damage: 5, fireRate: 0.04, missileCooldown: 1.2, missileCount: 3, color: '#00ffff', bulletType: 'normal', desc: 'Extreme fire rate. Neon core.', passive: 'Overcharge: Each kill reduces missile CD by 0.1s.' },
    // ── Tier 2: Mid ──────────────────────────────────────
    'quantum': { name: 'QUANTUM GHOST', price: 250000, hp: 10, speed: 650, damage: 16, fireRate: 0.05, missileCooldown: 1.0, missileCount: 4, color: '#39ff14', bulletType: 'railgun', desc: 'Quantum entity. Hyper velocity.', passive: 'Quantum Tunnel: Railgun pierces asteroids.' },
    'void': { name: 'VOID STALKER', price: 400000, hp: 10, speed: 500, damage: 12, fireRate: 0.20, missileCooldown: 1.5, missileCount: 4, color: '#4400ff', bulletType: 'railgun', desc: 'Experimental railgun. Shadow walk.', passive: 'Shadow Step: Dash leaves a damage zone (75px, 1 dmg).' },
    'solar': { name: 'SOLAR FLARE', price: 600000, hp: 10, speed: 460, damage: 8, fireRate: 0.12, missileCooldown: 1.5, missileCount: 4, color: '#ffcc00', bulletType: 'explosive', desc: 'Explosive solar rounds.', passive: 'Solar Burn: Explosions leave fire DOT patch (0.8s).' },
    'bomber': { name: 'DOOMSDAY', price: 850000, hp: 10, speed: 420, damage: 8, fireRate: 0.10, missileCooldown: 1.5, missileCount: 5, color: '#ff6600', bulletType: 'explosive', desc: 'Triple missile barrage.', passive: 'Triple Volley: Missiles fire in a triple spread.' },
    'tank': { name: 'V.G. TITAN', price: 1200000, hp: 7, speed: 400, damage: 8, fireRate: 0.12, missileCooldown: 1.8, missileCount: 4, color: '#00ff44', bulletType: 'piercing', desc: 'Heavy armor. Piercing shots.', passive: 'Iron Will: +1 HP per 4 kills.' },
    'laser_drone': { name: 'LASER DRONE', price: 1600000, hp: 10, speed: 480, damage: 6, fireRate: 0.03, missileCooldown: 1.2, missileCount: 4, color: '#ff00cc', bulletType: 'laser', desc: 'Sustained laser pulses. High DPS.', passive: 'Amplifier: 3s sustained fire gives +20% damage.' },
    // ── Tier 3: Upper-Mid ────────────────────────────────
    'wraith': { name: 'COSMIC WRAITH', price: 2200000, hp: 6, speed: 600, damage: 20, fireRate: 0.05, missileCooldown: 1.0, missileCount: 5, color: '#cc44ff', bulletType: 'railgun', desc: 'Void phantom. Reality breaker.', passive: 'Reality Shatter: 10% chance each kill spawns a coin burst (+10c).' },
    'vanguard': { name: 'VANGUARD', price: 3000000, hp: 6, speed: 480, damage: 8, fireRate: 0.06, missileCooldown: 1.2, missileCount: 5, color: '#00ffcc', bulletType: 'piercing', desc: 'Elite piercing fighter.', passive: 'Piercing Barrage: Piercing rounds slow enemies 15%.' },
    'eclipse': { name: 'ECLIPSE SERAPH', price: 4000000, hp: 7, speed: 500, damage: 12, fireRate: 0.05, missileCooldown: 1.0, missileCount: 6, color: '#66ccff', bulletType: 'piercing', desc: 'Angel core. Enhanced hull.', passive: 'Angel Core: Heal +1 HP every 8s of survival.' },
    'shadowblade': { name: 'SHADOWBLADE', price: 5500000, hp: 7, speed: 560, damage: 15, fireRate: 0.06, missileCooldown: 1.2, missileCount: 6, color: '#5522aa', bulletType: 'piercing', desc: 'Silent assassin. Stealth.', passive: 'Stealth Mode: Dash range is 30% longer.' },
    'guardian': { name: 'GALAXY GUARDIAN', price: 7500000, hp: 8, speed: 380, damage: 8, fireRate: 0.10, missileCooldown: 1.8, missileCount: 5, color: '#ffffff', bulletType: 'normal', desc: 'Elite protector. High HP.', passive: 'Fortress Protocol: Damage capped at 1 per hit. +1 HP per 5 kills.' },
    // ── Tier 4: Advanced ────────────────────────────────
    'obliterator': { name: 'OBLITERATOR PRIME', price: 9500000, hp: 8, speed: 440, damage: 18, fireRate: 0.06, missileCooldown: 1.2, missileCount: 7, color: '#ff3366', bulletType: 'explosive', desc: 'Siege frame. Reinforced core.', passive: 'Siege Frame: Explosions deal +25% area damage.' },
    'inferno': { name: 'INFERNO KING', price: 12000000, hp: 8, speed: 520, damage: 22, fireRate: 0.07, missileCooldown: 1.0, missileCount: 7, color: '#ff4500', bulletType: 'explosive', desc: 'Blazing hellfire. Pure devastation.', passive: 'Hellfire: 3+ consecutive kills give +15% fire rate.' },
    'juggernaut': { name: 'JUGGERNAUT', price: 15000000, hp: 10, speed: 380, damage: 10, fireRate: 0.12, missileCooldown: 1.8, missileCount: 7, color: '#ff9900', bulletType: 'piercing', desc: 'God of War. Heals on kill.', passive: 'Unstoppable: Below 30% HP, take 50% less damage.' },
    'tempest': { name: 'TEMPEST LORD', price: 18000000, hp: 9, speed: 500, damage: 18, fireRate: 0.06, missileCooldown: 1.1, missileCount: 8, color: '#00d9ff', bulletType: 'spread', desc: 'Lightning god. Storm incarnate.', passive: 'Lightning God: Spread bullets gain +20% speed.' },
    'reaper': { name: 'VOID REAPER', price: 22000000, hp: 9, speed: 550, damage: 28, fireRate: 0.05, missileCooldown: 0.9, missileCount: 8, color: '#880022', bulletType: 'explosive', desc: 'Death embodied. Final judgment.', passive: 'Death Mark: First hit on each new enemy deals double damage.' },
    'crimson_emperor': { name: 'CRIMSON EMPEROR', price: 27000000, hp: 10, speed: 490, damage: 25, fireRate: 0.06, missileCooldown: 1.0, missileCount: 10, color: '#dc143c', bulletType: 'piercing', desc: 'Royal ruler. Absolute dominion.', passive: 'Absolute Dominion: Missile CD -10% per boss kill (max 50%).' },
    'phoenix': { name: 'CELESTIAL PHOENIX', price: 33000000, hp: 11, speed: 530, damage: 26, fireRate: 0.07, missileCooldown: 0.9, missileCount: 10, color: '#ffa500', bulletType: 'explosive', desc: 'Mythic firebird. Eternal rebirth.', passive: 'Eternal Rebirth: Once per run, revive at 3 HP on death.' },
    'starborn': { name: 'STARBORN TITAN', price: 40000000, hp: 11, speed: 480, damage: 18, fireRate: 0.04, missileCooldown: 0.8, missileCount: 9, color: '#99ffcc', bulletType: 'railgun', desc: 'Mythic relic. God-tier hull.', passive: 'God-Tier Hull: +1 max HP per boss killed (up to +5).' },
    'leviathan': { name: 'LEVIATHAN ROX', price: 50000000, hp: 13, speed: 460, damage: 24, fireRate: 0.08, missileCooldown: 1.2, missileCount: 10, color: '#003d82', bulletType: 'explosive', desc: 'Deep sea titan. Unstoppable.', passive: 'Tsunami Force: Explosions knock back nearby enemies.' },
    'sentinel': { name: 'ETERNAL SENTINEL', price: 75000000, hp: 15, speed: 500, damage: 32, fireRate: 0.06, missileCooldown: 0.8, missileCount: 14, color: '#e8e8e8', bulletType: 'railgun', desc: 'Ultimate guardian. Infinite power.', passive: 'Infinite Power: Railgun shots slightly home toward nearest enemy.' },
    'nova': { name: 'NOVA ASCENDANT', price: 100000000, hp: 12, speed: 580, damage: 36, fireRate: 0.04, missileCooldown: 0.6, missileCount: 16, color: '#ffeeaa', bulletType: 'railgun', desc: 'Supernova core. Reality-shattering.', passive: 'Supernova: All shots deal ×2 damage but drain 1 HP every 15s.' },

    // ── PRESTIGE TIER: Achievement-locked only — cannot be purchased (hidden from armory) ──────────
    'nemesis': {
        name: 'NEMESIS PRIME', price: 0,
        hp: 28, speed: 620, damage: 40, fireRate: 0.04, missileCooldown: 0.7, missileCount: 12,
        color: '#ff0044', bulletType: 'explosive',
        desc: '☠ Achievement: GOD OF WAR. Passive: every kill adds 1 HP (max 50). Explosive rounds detonate twice.',
        passive: 'God of War: Every kill +1 HP (max 50). Explosives detonate twice.',
        achievementLocked: 'god_of_war',
        specialAbility: 'kill_heal',
        prestige: true
    },
    'phantom_x': {
        name: 'PHANTOM-X', price: 0,
        hp: 22, speed: 700, damage: 30, fireRate: 0.05, missileCooldown: 0.6, missileCount: 14,
        color: '#aa44ff', bulletType: 'railgun',
        desc: '🌌 Achievement: ANOMALY KILLER. Passive: phases through bullets 30% of the time. Railgun pierces infinitely.',
        passive: 'Anomaly Killer: 30% damage ignore. Railgun pierces infinitely.',
        achievementLocked: 'anomaly_killer',
        specialAbility: 'phase_dodge',
        prestige: true
    },
    'celestial': {
        name: 'CELESTIAL STRIKER', price: 0,
        hp: 26, speed: 560, damage: 50, fireRate: 0.06, missileCooldown: 0.5, missileCount: 18,
        color: '#ffdd00', bulletType: 'explosive',
        desc: '🌠 Rank: ACE COMMANDER (Top 10). Passive: score multiplier ×3. Missiles auto-split on impact.',
        passive: 'Reach to the Top: Score ×3. Missiles auto-split on impact.',
        achievementLocked: 'legendary_score',
        specialAbility: 'score_triple',
        prestige: true
    },
    'absolute': {
        name: 'THE ABSOLUTE', price: 0,
        hp: 40, speed: 600, damage: 60, fireRate: 0.03, missileCooldown: 0.4, missileCount: 20,
        color: '#ffffff', bulletType: 'railgun',
        desc: '🌌 Achievement: THE ABSOLUTE. All abilities combined. True endgame. 100% completion only.',
        passive: 'All Passives: Every passive ability unlocked simultaneously.',
        achievementLocked: 'the_absolute',
        specialAbility: 'all_passives',
        prestige: true
    },
};
// Prices are set directly above — no auto-computation override needed.


export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

        this.lastTime = 0;
        this.score = 0;

        // One-time hard reset to clear all player data as requested
        if (!localStorage.getItem('midnight_hard_reset_v3')) {
            localStorage.clear();
            localStorage.setItem('midnight_hard_reset_v3', 'true');
            console.log('Game Hard Reset Executed');
        }

        // Persistence
        this.highScore = parseInt(localStorage.getItem('midnight_highscore')) || 0;
        this.coins = parseInt(localStorage.getItem('midnight_coins')) || 0;
        this.playCount = parseInt(localStorage.getItem('midnight_play_count')) || 0;

        // Testing toggles (DISABLED FOR PRODUCTION)
        const UNLOCK_ALL_SHIPS_FOR_TESTING = false;
        const RESET_SHIPS = false;
        const RESET_COINS = false;

        if (RESET_COINS) {
            this.coins = 0;
            localStorage.setItem('midnight_coins', this.coins);
        }

        if (UNLOCK_ALL_SHIPS_FOR_TESTING) {
            this.ownedShips = Object.keys(SHIP_DATA);
            const savedSelected = localStorage.getItem('midnight_selected_ship') || 'default';
            this.selectedShip = this.ownedShips.includes(savedSelected) ? savedSelected : 'default';
            localStorage.setItem('midnight_owned_ships', JSON.stringify(this.ownedShips));
            localStorage.setItem('midnight_selected_ship', this.selectedShip);
        } else if (RESET_SHIPS) {
            this.ownedShips = ['default'];
            this.selectedShip = 'default';
            localStorage.setItem('midnight_owned_ships', JSON.stringify(this.ownedShips));
            localStorage.setItem('midnight_selected_ship', 'default');
        } else {
            this.ownedShips = JSON.parse(localStorage.getItem('midnight_owned_ships')) || ['default'];
            this.selectedShip = localStorage.getItem('midnight_selected_ship') || 'default';

            // Armory Sanitization: If ownedShips contains things it shouldn't (from previous testing), reset it
            // Only do this if the player name hasn't changed (legacy check)
            if (this.ownedShips.length > 1 && !localStorage.getItem('midnight_armory_sanitized')) {
                // Keep only 'default' if the player hasn't earned enough coins to realistically buy everything
                // This is a safety measure to ensure the user gets a fresh progression start as requested.
                this.ownedShips = ['default'];
                this.selectedShip = 'default';
                localStorage.setItem('midnight_owned_ships', JSON.stringify(this.ownedShips));
                localStorage.setItem('midnight_selected_ship', 'default');
                localStorage.setItem('midnight_armory_sanitized', 'true');
            }
        }

        // Ensure guardian is not equipped by default
        if (this.selectedShip === 'guardian') {
            this.selectedShip = 'default';
            localStorage.setItem('midnight_selected_ship', this.selectedShip);
        }

        this.gameOver = false;
        this.isRunning = false;
        this.fromPauseMenu = false; // Track if armory opened from pause

        // Achievements & Ranks
        this.achievementManager = new AchievementManager(this);
        this.leaderboard = new LeaderboardManager();

        // Global Sync
        this.syncGlobalData();

        // Level System
        this.currentLevel = 1;
        this.levelScore = 0;
        this.levelThresholds = this.generateLevelThresholds();
        this.difficultyMultiplier = 1.0;

        // UI Elements
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.hud = document.getElementById('hud');
        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');

        // Controllers
        this.player = null;
        this.playerTwo = null;
        this.input = new InputHandler({
            bindings: InputHandler.bindings.singlePlayer,
            enableTouch: true,
            enabled: true
        });
        this.inputTwo = new InputHandler({
            bindings: InputHandler.bindings.coopPlayerTwo,
            enableTouch: false,
            enabled: false
        });
        this.audio = new AudioController();
        this.screenShake = new ScreenShake();
        this.assets = new AssetLoader();

        // Initialize audio settings (music toggle should not mute gameplay SFX)
        const musicEnabled = localStorage.getItem('midnight_music_enabled') !== 'false';
        this.audio.toggleMusic(musicEnabled);

        // Arrays
        this.enemies = [];
        this.particles = [];
        this.projectiles = [];
        this.afterburners = [];
        this.powerups = [];
        this.nebulas = [];
        this.cosmicDust = [];
        this.planets = [];
        this.asteroids = [];

        // AAA State
        this.impactTimer = 0;
        this.isWarping = false;
        this.warpTimer = 0;
        this.boss = null;
        this.bossTimer = 0;
        this.bossJustDefeated = false;
        this.bossDefeatTimer = 0;
        this.firstBossAppeared = false;
        this.lastBossLevel = 0;
        this.timeScale = 1.0;
        this.slowMoTimer = 0;

        // Enemy Tracking for Unique Spawning
        this.spawnedEnemyTypes = new Set();

        // Timers
        this.enemyTimer = 0;
        this.enemyInterval = 0.8;      // Balanced spawn rate
        this.powerupTimer = 0;
        this.powerupInterval = 12.0;
        this.enemiesSpawned = 0;
        this.enemiesForLevel = 12 + (this.currentLevel * 4); // Level 1 = 16, L2 = 20, L5 = 32 ...
        this.entityCounter = 0;
        this.comboMultiplier = 1;
        this.comboTimer = 0;

        // Gameplay Extras
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.comboWindow = 3.0;
        this.comboMax = 5.0;
        this.enemyDropChance = 0.08;
        this.currentKillStreak = 0; // Kill streak tracker for achievements

        // Settings
        this.autoTargetEnabled = localStorage.getItem('midnight_autotarget_enabled') !== 'false';

        // Leaderboard
        this.leaderboard = new LeaderboardManager();

        // Co-op state
        this.coopMode = false;
        this.collabRoomId = null;
        this.collabTeamMembers = null;
        this.collabPollTimer = null;
        this.onlineCoop = false;
        this.onlineRole = null;
        this.remotePlayerState = null;
        this.remoteInputState = {
            keys: { up: false, down: false, left: false, right: false, fire: false, missile: false, dash: false },
            getMovementVector() {
                let x = 0;
                let y = 0;
                if (this.keys.left) x -= 1;
                if (this.keys.right) x += 1;
                if (this.keys.up) y -= 1;
                if (this.keys.down) y += 1;
                if (x !== 0 || y !== 0) {
                    const len = Math.sqrt(x * x + y * y);
                    x /= len;
                    y /= len;
                }
                return { x, y };
            }
        };
        this.remoteShipType = this.selectedShip;
        this.localShipType = this.selectedShip;
        this.netplay = new SocketIONetplay();
        this.netSyncTimer = 0;
        this.rankPerk = { coinBonus: 0, hpMercy: false, nameGlow: false, hudBorder: false };
        this.globalRank = Infinity; // Store competitive ranking position

        // Fullscreen management
        this.fullscreenCheckTimer = 0;

        // Bindings
        this.loop = this.loop.bind(this);
        this.resize = this.resize.bind(this);

        this.initAtmosphere();
        this.addEventListeners();
        this.updatePlayerNameDisplay();

        // Check for autostart after match restart
        if (sessionStorage.getItem('midnight_autostart') === 'true') {
            sessionStorage.removeItem('midnight_autostart');
            // Give a tiny delay for everything to settle
            setTimeout(() => this.startGame(), 250);
        } else {
            // Start Menu music if not autostarting
            this.audio.playTrack('menu');
        }

        // Check for global data reset
        this.checkDataVersion();
    }

    initAtmosphere() {
        import('./utils.js?v=4').then(m => {
            for (let i = 0; i < 5; i++) this.nebulas.push(new m.Nebula(this));
            for (let i = 0; i < 30; i++) this.cosmicDust.push(new m.CosmicDust(this));
        });
    }

    triggerImpact(freezeTime = 0.05, flashIntense = 0.2) {
        this.impactTimer = freezeTime;
        const overlay = document.getElementById('impact-overlay');
        if (overlay) {
            overlay.style.opacity = flashIntense;
            setTimeout(() => { if (overlay) overlay.style.opacity = 0; }, 50);
        }
        this.screenShake.trigger(15, 0.1);
    }

    addEventListeners() {
        window.addEventListener('resize', this.resize);

        const handleStart = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            // Unlock audio on direct user gesture (required by many browsers)
            if (this.audio && this.audio.ctx && this.audio.ctx.state === 'suspended') {
                this.audio.ctx.resume().catch(() => { });
            }
            // Auto-fullscreen on game start
            this.enterFullscreen();
            this.startGame();
        };

        this.startBtn.addEventListener('click', handleStart);
        this.startBtn.addEventListener('touchstart', handleStart, { passive: false });

        this.restartBtn.addEventListener('click', handleStart);
        this.restartBtn.addEventListener('touchstart', handleStart, { passive: false });

        // Store Buttons
        const storeBtn = document.getElementById('store-btn');
        if (storeBtn) {
            storeBtn.addEventListener('click', () => this.openStore());
            storeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openStore(); }, { passive: false });
        }

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeStore());
            backBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.closeStore(); }, { passive: false });
        }

        // Pause & Menu Buttons
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
            pauseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.togglePause(); }, { passive: false });
        }

        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => this.togglePause());
            resumeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.togglePause(); }, { passive: false });
        }

        const pauseArmoryBtn = document.getElementById('pause-armory-btn');
        if (pauseArmoryBtn) {
            pauseArmoryBtn.addEventListener('click', () => this.openStoreFromPause());
            pauseArmoryBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openStoreFromPause(); }, { passive: false });
        }

        // Settings Button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggleSettingsMenu());
            settingsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleSettingsMenu(); }, { passive: false });
        }

        const closeSettingsBtn = document.getElementById('close-settings-btn');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => this.toggleSettingsMenu());
            closeSettingsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleSettingsMenu(); }, { passive: false });
        }

        // Settings Checkboxes
        const musicToggle = document.getElementById('music-toggle');
        if (musicToggle) {
            musicToggle.checked = localStorage.getItem('midnight_music_enabled') !== 'false';
            musicToggle.addEventListener('change', (e) => {
                localStorage.setItem('midnight_music_enabled', e.target.checked);
                this.audio.toggleMusic(e.target.checked);
            });
        }

        const autoTargetToggle = document.getElementById('autotarget-toggle');
        if (autoTargetToggle) {
            autoTargetToggle.checked = localStorage.getItem('midnight_autotarget_enabled') !== 'false';
            autoTargetToggle.addEventListener('change', (e) => {
                localStorage.setItem('midnight_autotarget_enabled', e.target.checked);
                this.autoTargetEnabled = e.target.checked;
            });
        }

        const mainMenuBtn = document.getElementById('main-menu-btn');
        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', () => this.goToMainMenu());
            mainMenuBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.goToMainMenu(); }, { passive: false });
        }

        // Game Over Buttons
        // Game Over Buttons
        const goToStoreBtn = document.getElementById('go-to-store-btn');
        if (goToStoreBtn) {
            const handleStore = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.goToStoreFromGameOver();
            };
            goToStoreBtn.addEventListener('click', handleStore);
            goToStoreBtn.addEventListener('touchstart', handleStore, { passive: false });
        }

        const goToMainBtn = document.getElementById('go-to-main-btn');
        if (goToMainBtn) {
            const handleMain = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.goToMainMenu();
            };
            goToMainBtn.addEventListener('click', handleMain);
            goToMainBtn.addEventListener('touchstart', handleMain, { passive: false });
        }

        // Leaderboard Buttons
        const leaderboardBtn = document.getElementById('leaderboard-btn');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => this.openLeaderboard());
            leaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openLeaderboard(); }, { passive: false });
        }

        const collabBtn = document.getElementById('collab-btn');
        if (collabBtn) {
            const showSoon = () => {
                const existing = document.getElementById('collab-toast');
                if (existing) return;

                const toast = document.createElement('div');
                toast.id = 'collab-toast';
                toast.style.position = 'fixed';
                toast.style.top = '20px';
                toast.style.left = '50%';
                toast.style.transform = 'translateX(-50%)';
                toast.style.background = 'rgba(255, 0, 100, 0.95)';
                toast.style.border = '2px solid var(--neon-pink)';
                toast.style.boxShadow = '0 0 20px var(--neon-pink), inset 0 0 10px var(--neon-pink)';
                toast.style.padding = '15px 30px';
                toast.style.borderRadius = '8px';
                toast.style.zIndex = '4000';
                toast.style.textAlign = 'center';
                toast.style.animation = 'toast-slide-down 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

                toast.innerHTML = `
                    <div style="font-weight: bold; color: #fff; letter-spacing: 2px;">COLLABORATIVE MODE</div>
                    <div style="font-size: 0.9em; color: #ffeb3b; margin-top: 5px;">COMING SOON! 🚀</div>
                `;
                document.body.appendChild(toast);

                setTimeout(() => {
                    toast.style.animation = 'toast-fade-out 0.5s forwards';
                    setTimeout(() => toast.remove(), 500);
                }, 2500);
            };
            collabBtn.addEventListener('click', showSoon);
            collabBtn.addEventListener('touchstart', (e) => { e.preventDefault(); showSoon(); }, { passive: false });
        }

        const backFromLeaderboardBtn = document.getElementById('back-from-leaderboard-btn');
        if (backFromLeaderboardBtn) {
            backFromLeaderboardBtn.addEventListener('click', () => this.closeLeaderboard());
            backFromLeaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.closeLeaderboard(); }, { passive: false });
        }

        const collabBackBtn = document.getElementById('collab-back-btn');
        if (collabBackBtn) {
            collabBackBtn.addEventListener('click', () => this.closeCollaborate());
            collabBackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.closeCollaborate(); }, { passive: false });
        }

        const backFromRanksBtn = document.getElementById('back-from-ranks-btn');
        if (backFromRanksBtn) {
            backFromRanksBtn.addEventListener('click', () => this.goToMainMenu());
            backFromRanksBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.goToMainMenu(); }, { passive: false });
        }

        const rankBadge = document.getElementById('player-rank-main');
        if (rankBadge) {
            rankBadge.addEventListener('click', () => this.openRankInfo());
        }



        const collabCreateBtn = document.getElementById('collab-create-btn');
        if (collabCreateBtn) {
            collabCreateBtn.addEventListener('click', () => this.createCollaborateRoom());
            collabCreateBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.createCollaborateRoom(); }, { passive: false });
        }

        const collabJoinBtn = document.getElementById('collab-join-btn');
        if (collabJoinBtn) {
            collabJoinBtn.addEventListener('click', () => this.joinCollaborateRoom());
            collabJoinBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.joinCollaborateRoom(); }, { passive: false });
        }

        const collabLeaveBtn = document.getElementById('collab-leave-btn');
        if (collabLeaveBtn) {
            collabLeaveBtn.addEventListener('click', () => this.leaveCollaborateRoom());
            collabLeaveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.leaveCollaborateRoom(); }, { passive: false });
        }

        const pauseLeaveBtn = document.getElementById('leave-room-btn');
        if (pauseLeaveBtn) {
            pauseLeaveBtn.addEventListener('click', () => this.leaveCollaborateRoom(true));
            pauseLeaveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.leaveCollaborateRoom(true); }, { passive: false });
        }

        const goToLeaderboardBtn = document.getElementById('go-to-leaderboard-btn');
        if (goToLeaderboardBtn) {
            goToLeaderboardBtn.addEventListener('click', () => this.openLeaderboardFromGameOver());
            goToLeaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openLeaderboardFromGameOver(); }, { passive: false });
        }

        const refreshLeaderboardBtn = document.getElementById('refresh-leaderboard-btn');
        if (refreshLeaderboardBtn) {
            refreshLeaderboardBtn.addEventListener('click', () => this.leaderboard.displayLeaderboard());
            refreshLeaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.leaderboard.displayLeaderboard(); }, { passive: false });
        }

        const setNameBtn = document.getElementById('set-name-btn');
        if (setNameBtn) {
            setNameBtn.addEventListener('click', () => this.setPlayerName());
            setNameBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.setPlayerName(); }, { passive: false });
        }

        const playerNameInput = document.getElementById('player-name-input');
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.setPlayerName();
            });
        }

        // Keyboard Pause
        window.addEventListener('keydown', (e) => {
            if (e.key && (e.key === 'Escape' || e.key.toLowerCase() === 'p') && this.isRunning && !this.gameOver) {
                this.togglePause();
            }
        });

        this.netplay.on('peer_state', (message) => this.applyPeerState(message));
        this.netplay.on('peer_input', (message) => this.applyPeerInput(message));
        this.netplay.on('peer_joined', (message) => {
            if (message?.shipType) {
                this.remoteShipType = message.shipType;
                this.updatePlayerHudInfo();
            }
        });
        this.netplay.on('force_game_over', () => this.handleGameOver());
        this.netplay.on('room_closed', () => {
            this.leaveCollaborateRoom(true, true);
        });
        this.netplay.on('closed', () => {
            if (this.onlineCoop) {
                this.leaveCollaborateRoom(true, true);
            }
        });

        // Remote Spawn Listeners
        this.netplay.on('spawn_enemy', (data) => {
            if (this.onlineRole === 'guest') {
                const enemy = new Enemy(this, data.type);
                enemy.x = data.x;
                enemy.y = data.y;
                enemy.remoteId = data.id;
                this.enemies.push(enemy);
            }
        });

        this.netplay.on('destroy_enemy', (data) => {
            if (this.onlineRole === 'guest') {
                const index = this.enemies.findIndex(e => e.remoteId === data.id);
                if (index !== -1) {
                    const enemy = this.enemies[index];
                    if (!enemy.markedForDeletion) {
                        enemy.markedForDeletion = true;
                        this.addScore(enemy.points, data.useCombo);
                        this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
                    }
                }
            }
        });

        this.netplay.on('spawn_boss', (data) => {
            if (this.onlineRole === 'guest' && !this.boss) {
                this.spawnBoss(data.type);
                if (this.boss) {
                    this.boss.remoteId = data.id;
                    this.boss.x = data.x;
                    this.boss.y = data.y;
                }
            }
        });

        this.netplay.on('destroy_boss', (data) => {
            if (this.onlineRole === 'guest' && this.boss && this.boss.remoteId === data.id) {
                this.handleBossDefeat();
            }
        });

        this.netplay.on('spawn_powerup', (data) => {
            if (this.onlineRole === 'guest') {
                const pu = new PowerUp(this, data.type, data.x, data.y);
                pu.remoteId = data.id;
                this.powerups.push(pu);
            }
        });

        this.netplay.on('destroy_powerup', (data) => {
            if (this.onlineRole === 'guest') {
                const index = this.powerups.findIndex(p => p.remoteId === data.id);
                if (index !== -1) {
                    this.powerups[index].markedForDeletion = true;
                }
            }
        });

        this.netplay.on('level_up', (data) => {
            if (this.onlineRole === 'guest') {
                this.currentLevel = data.level;
                this.enemiesForLevel = data.enemiesForLevel;
                this.enemiesSpawned = 0;
                this.score = data.score;
                this.difficultyMultiplier = data.difficultyMultiplier;
                this.enemyInterval = data.enemyInterval;

                this.showLevelUpText(this.currentLevel);
                if (this.audio) this.audio.dash();
            }
        });

        this.netplay.on('spawn_boss', (data) => {
            if (this.onlineRole === 'guest' && !this.boss) {
                import('./entities/boss.js?v=4').then(m => {
                    const BossClass = m.default || m.Boss;
                    if (BossClass) {
                        this.boss = new BossClass(this, data.level, data.side, data.modelIndex);
                        this.boss.remoteId = data.id;
                        const bossHud = document.getElementById('boss-hud');
                        if (bossHud) bossHud.classList.add('active');
                        const bossName = document.getElementById('boss-name');
                        if (bossName) bossName.innerText = data.name || "UNIDENTIFIED THREAT";
                    }
                });
            }
        });

        this.netplay.on('spawn_powerup', (data) => {
            if (this.onlineRole === 'guest') {
                const pu = new PowerUp(this, data.type, data.x, data.y);
                pu.remoteId = data.id;
                this.powerups.push(pu);
            }
        });
    }

    initRandom(seedStr) {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
        }
        this.randomSeed = hash;
    }

    random() {
        if (this.randomSeed === undefined) {
            return Math.random();
        }
        let x = Math.sin(this.randomSeed++) * 10000;
        return x - Math.floor(x);
    }

    init() {
        this.resize();
        this.drawBackground();

        this.entityCounter = 0;

        // Initialize cosmic atmosphere
        this.initializeCosmicAtmosphere();

        // Update coin display on start screen
        const coinEl = document.getElementById('total-coins-display');
        if (coinEl) coinEl.innerText = `COINS: ${this.coins}`;

        // Refresh rank badge and UI theming
        this.refreshRankDisplay();

        this.updatePlayerHudInfo();

        // Hide pause menu initially
        document.getElementById('pause-menu').classList.remove('active');

        // Fullscreen Button
        const fsBtn = document.getElementById('fullscreen-btn');
        if (fsBtn) {
            const toggleFs = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.toggleFullScreen();
            };
            fsBtn.addEventListener('click', toggleFs);
            fsBtn.addEventListener('touchstart', toggleFs, { passive: false });
        }

        // Resize listener is already added in constructor/addEventListeners

    }


    toggleSettingsMenu() {
        const settingsMenu = document.getElementById('settings-menu');
        if (!settingsMenu) return;
        if (settingsMenu.classList.contains('active')) {
            settingsMenu.classList.remove('active');
            // Restore whichever screen was visible before
            if (this.isRunning && !this.gameOver && !this.isPaused) {
                // nothing to restore - settings was over gameplay
            } else if (this.isPaused) {
                document.getElementById('pause-menu')?.classList.add('active');
            } else {
                this.startScreen.classList.add('active');
            }
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            settingsMenu.classList.add('active');
        }
    }

    toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    enterFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
            });
        }
    }

    enableFullScreen() {
        this.toggleFullScreen();
    }


    getShipStats(type) {
        return SHIP_DATA[type] || SHIP_DATA['default'];
    }

    getPlayerScalingMetrics() {
        const ship = this.getShipStats(this.selectedShip);
        const baseShip = SHIP_DATA['default'];

        // 1. Primary Gun DPS
        const getBulletMult = (type) => {
            if (type === 'spread') return 2.2; // 3 bullets but harder to land all
            if (type === 'explosive') return 1.5; // Area damage
            if (type === 'piercing') return 1.3; // Multi-hit potential
            if (type === 'railgun') return 1.0; // Raw damage is already high
            return 1.0;
        };

        const baseGunDps = (baseShip.damage * getBulletMult(baseShip.bulletType)) / baseShip.fireRate;
        const playerGunDps = (ship.damage * getBulletMult(ship.bulletType)) / ship.fireRate;

        // 2. Missile DPS (Base damage is 5)
        const baseMissileDps = (baseShip.missileCount * 5) / baseShip.missileCooldown;
        const playerMissileDps = (ship.missileCount * 5) / ship.missileCooldown;

        // 3. Passive Ability Weight
        let passiveWeight = 1.0;
        if (ship.specialAbility === 'kill_heal') passiveWeight += 0.2;
        if (ship.specialAbility === 'phase_dodge') passiveWeight += 0.3;
        if (ship.specialAbility === 'score_triple') passiveWeight += 0.1;
        if (ship.specialAbility === 'all_passives') passiveWeight += 1.0;
        if (ship.invincible) passiveWeight += 0.5;

        // 4. Combined Scaling — more aggressive so high-tier jets don't trivialize content
        const totalBasePower = baseGunDps + baseMissileDps;
        const totalPlayerPower = (playerGunDps + playerMissileDps) * passiveWeight;

        // Exponent 0.90 (near-linear) ensures boss HP/damage keeps pace with player DPS
        const powerMultiplier = Math.pow(totalPlayerPower / totalBasePower, 0.90);
        const speedMultiplier = Math.pow(ship.speed / baseShip.speed, 0.80);
        const survivabilityMultiplier = Math.pow(ship.hp / baseShip.hp, 0.85);

        return {
            hpScale: Math.max(1, powerMultiplier),           // Boss HP scales with player DPS
            // Damage scales with both player HP (survivability) AND player DPS — big DPS = tougher boss attacks
            damageScale: Math.max(1, Math.max(survivabilityMultiplier, powerMultiplier * 0.6)),
            speedScale: Math.max(1, speedMultiplier)         // Boss speed scales with player speed
        };
    }

    getMaxEnemiesOnScreen() {
        const level = this.currentLevel || 1;
        // Balanced concurrent caps for challenge without frustration (Max 35)
        if (level >= 24) return 35;
        if (level >= 20) return 30;
        if (level >= 15) return 25;
        if (level >= 10) return 18;
        if (level >= 5) return 12;
        return 7 + level; // L1=8, L2=9, L3=10, L4=11
    }

    getEnemyContactDamage() {
        if (this.currentLevel >= 24) return 2;
        if (this.currentLevel >= 15) return 1.5;
        return 2;
    }

    getEnemyProjectileDamage(baseDamage = 1) {
        if (this.currentLevel >= 24) return Math.max(2, baseDamage + 1);
        if (this.currentLevel >= 15) return Math.max(1.5, baseDamage * 1.25);
        return baseDamage;
    }

    generateLevelThresholds() {
        const thresholds = [];
        for (let i = 1; i <= 50; i++) {
            thresholds.push(i * 1000 * Math.pow(1.1, i - 1));
        }
        return thresholds;
    }

    async syncGlobalData() {
        // 1. Check Data Version from Server
        try {
            const versionRes = await fetch(`${this.leaderboard.apiUrl}/version`);
            const versionData = await versionRes.json();
            if (versionData.success) {
                const serverVersion = versionData.version;
                const localVersion = parseInt(localStorage.getItem('midnight_game_version')) || 1;

                if (serverVersion > localVersion) {
                    console.log(`🚨 GAME DATA RESET DETECTED (Server: ${serverVersion}, Local: ${localVersion})`);
                    this.resetProgress();
                    localStorage.setItem('midnight_game_version', serverVersion);
                    // Refresh page to ensure total state reset
                    window.location.reload();
                    return;
                }
            }
        } catch (e) {
            console.warn('[Sync] Failed to check game version:', e);
        }

        const playerName = this.leaderboard.getPlayerName();
        if (!playerName) return;

        // console.log(`[Sync] Fetching global stats for ${playerName}...`);
        const stats = await this.leaderboard.getPlayerStats(playerName);

        if (stats && stats.score !== undefined) {
            // console.log(`[Sync] Found global score: ${stats.score}. Local: ${this.highScore}`);
            if (stats.score > this.highScore) {
                this.highScore = stats.score;
                localStorage.setItem('midnight_highscore', this.highScore);
                // console.log(`[Sync] Local high score updated to match global.`);
            }
            if (stats.globalRank !== undefined) {
                this.globalRank = stats.globalRank;
                // Sync to achievements
                if (this.achievementManager) {
                    this.achievementManager.updateGlobalRank(this.globalRank);
                }
                // console.log(`[Sync] Player is ranked #${this.globalRank} globally.`);
            }
        }

        // Update Main Menu Rank Display
        this.refreshRankDisplay();

        // Populate Top 5 Global Players on Start Screen (ONLY if player is in top 5)
        try {
            const top5 = await this.leaderboard.fetchLeaderboard(5);
            const container = document.getElementById('top-players-display');
            if (container && top5.length > 0) {
                // Check if the current player is in the top 5
                const isPlayerInTop5 = top5.some(entry => entry.playerName === playerName);

                if (isPlayerInTop5) {
                    container.style.display = 'block'; // Ensure it's visible

                    // Keep the header, clear existing entries
                    const header = container.querySelector('h3');
                    container.innerHTML = '';
                    if (header) {
                        header.innerText = '★ GLOBAL LEGEND ★';
                        container.appendChild(header);
                    } else {
                        const h = document.createElement('h3');
                        h.innerText = '★ GLOBAL LEGEND ★';
                        container.appendChild(h);
                    }

                    // Only display the player's own position, name, and score
                    const playerIndex = top5.findIndex(entry => entry.playerName === playerName);
                    const playerEntry = top5[playerIndex];

                    // Determine rank based on global position to get the correct color
                    const pRankData = typeof getRankByGlobalPosition === 'function' && playerEntry._rank
                        ? getRankByGlobalPosition(playerEntry._rank)
                        : { color: '#ffd700' };

                    if (header) {
                        header.innerText = '★ GLOBAL LEGEND ★';
                        header.style.color = pRankData.color;
                        header.style.textShadow = `0 0 10px ${pRankData.color}`;
                    }

                    const div = document.createElement('div');
                    div.className = 'top-player-entry';
                    div.style.color = pRankData.color;
                    div.style.borderColor = pRankData.color;
                    div.style.textShadow = `0 0 5px ${pRankData.color}`;
                    div.style.boxShadow = `inset 0 0 10px ${pRankData.color}40`;

                    div.innerText = `#${playerIndex + 1} ${playerEntry.playerName} ${playerEntry.score.toLocaleString()} pts`;
                    container.appendChild(div);
                } else {
                    // Hide the element if player is not in top 5
                    container.style.display = 'none';
                }
            }
        } catch (e) {
            console.warn('[Sync] Failed to fetch top players:', e);
        }
    }

    resetProgress() {
        console.warn('🗑️  Clearing all local progress data...');
        const keysToClear = [
            'midnight_highscore',
            'midnight_coins',
            'midnight_owned_ships',
            'midnight_selected_ship',
            'midnight_stats',
            'midnight_claimed_achievements',
            'midnight_unclaimed_achievements',
            'midnight_player_name',
            'midnight_playerName',
            'midnight_armory_sanitized'
        ];
        keysToClear.forEach(key => localStorage.removeItem(key));
    }

    getPlayerRank() {
        const rank = getRankByGlobalPosition(this.globalRank);
        return rank.name;
    }

    // Apply dynamic neon theming based on player's current rank color
    applyRankTheme(rankColor) {
        const root = document.documentElement;
        root.style.setProperty('--rank-color', rankColor);
        root.style.setProperty('--rank-glow', rankColor + '88');
    }

    // Refresh the rank badge display on start screen
    refreshRankDisplay() {
        const rank = getRankByGlobalPosition(this.globalRank);

        // Update existing small rank text
        const rankMain = document.getElementById('player-rank-main');
        if (rankMain) {
            rankMain.innerText = rank.name;
            rankMain.style.color = rank.color;
            rankMain.style.textShadow = `0 0 12px ${rank.color}`;
            rankMain.classList.remove('hidden');
        }

        // Update the prominent rank panel (if present)
        const rankPanel = document.getElementById('rank-panel');
        if (rankPanel) {
            if (rank.rankTarget === 1) {
                rankPanel.classList.add('glow-guardian');
            } else {
                rankPanel.classList.remove('glow-guardian');
            }

            const badgeEl = rankPanel.querySelector('.rank-panel-badge');
            const nameEl = rankPanel.querySelector('.rank-panel-name');
            const ptsEl = rankPanel.querySelector('.rank-panel-pts');

            if (badgeEl) {
                badgeEl.innerText = rank.badge;
                badgeEl.style.background = rank.color;
                badgeEl.style.boxShadow = `0 0 20px ${rank.color}`;
            }
            if (nameEl) {
                nameEl.innerText = rank.name;
                nameEl.style.color = rank.color;
                nameEl.style.textShadow = `0 0 10px ${rank.color}`;
            }
            if (ptsEl) {
                ptsEl.innerText = `HIGH SCORE: ${this.highScore.toLocaleString()} PTS`;
            }

            rankPanel.style.borderColor = rank.color + '88';
            rankPanel.style.boxShadow = `0 0 20px ${rank.color}44, inset 0 0 15px ${rank.color}11`;
        }

        // Apply full rank theming
        this.applyRankTheme(rank.color);
    }

    applyRankPerks() {
        if (!this.rankPerk) return;
        const rank = getRankByGlobalPosition(this.globalRank);

        // 1. Name Glow Perk
        const p1NameEl = document.getElementById('p1-hud-name');
        if (p1NameEl) {
            if (this.rankPerk.nameGlow) {
                p1NameEl.classList.add('rank-glow-name');
                p1NameEl.style.color = rank.color;
            } else {
                p1NameEl.classList.remove('rank-glow-name');
                p1NameEl.style.color = '';
            }
        }

        // 2. HUD Border Perk
        const hudLeft = document.getElementById('hud-left');
        if (hudLeft) {
            if (this.rankPerk.hudBorder) {
                hudLeft.classList.add('rank-hud-border');
                hudLeft.style.color = rank.color; // Used for border currentColor
            } else {
                hudLeft.classList.remove('rank-hud-border');
                hudLeft.style.color = '';
            }
        }
    }

    openRankInfo() {
        const screen = document.getElementById('ranks-screen');
        if (!screen) return;

        const list = document.getElementById('ranks-list');
        if (list) {
            list.innerHTML = '';
            // Sort by rankTarget ascending for display
            [...RANK_DATA].sort((a, b) => a.rankTarget - b.rankTarget).forEach(rank => {
                let targetText = '';
                if (rank.rankTarget === 1) targetText = 'Rank 1';
                else if (rank.rankTarget === 2) targetText = 'Rank 2';
                else if (rank.rankTarget === 3) targetText = 'Rank 3';
                else if (rank.rankTarget === Infinity) targetText = 'Default';
                else if (rank.rankTarget >= 1000) targetText = 'Top ' + (rank.rankTarget / 1000) + 'k';
                else targetText = 'Top ' + rank.rankTarget;

                const item = document.createElement('div');
                item.className = 'rank-info-item';
                item.style.borderColor = rank.color;
                item.innerHTML = `
                    <div class="rank-info-badge" style="background: ${rank.color}">${rank.badge}</div>
                    <div class="rank-info-details">
                        <div class="rank-info-name" style="color: ${rank.color}">${rank.name}</div>
                        <div class="rank-info-threshold">${targetText}</div>
                    </div>
                `;
                list.appendChild(item);
            });
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    checkLevelUp() {
        // Wave Completion Logic - Symmetric (Both clients independently calculate)

        if (this.enemiesSpawned >= this.enemiesForLevel &&
            this.enemies.length === 0 &&
            !this.boss) {

            this.currentLevel++;

            // New Level Setup — balanced wave progression
            if (this.currentLevel >= 24) {
                this.enemiesForLevel = 80 + ((this.currentLevel - 24) * 15);
            } else {
                this.enemiesForLevel = 10 + (this.currentLevel * 3);
            }
            this.enemiesSpawned = 0;

            this.difficultyMultiplier = Math.min(5.0, 1 + (this.currentLevel - 1) * 0.15);
            // Spawn interval baseline adjusted (1.2s) to increase gaps between spawning
            this.enemyInterval = Math.max(0.4, 1.2 / this.difficultyMultiplier);

            // Removing 'level_up' netplay event because progression is strictly symmetric

            // Trigger Boss Warp every 5 levels
            if (this.currentLevel % 5 === 0) {
                this.triggerWarp();
            } else {
                this.levelScore = this.score; // Keep for records

                // Level Up Visuals
                this.screenShake.trigger(30, 0.3);
                if (this.audio) this.audio.levelUp();

                // Show Level Up Text
                this.showLevelUpText(this.currentLevel);
            }
        }
    }

    showLevelUpText(level) {
        const hud = document.getElementById('hud');
        if (hud) {
            const levelText = document.createElement('div');
            levelText.innerText = `LEVEL ${level}`;
            levelText.style.position = 'absolute';
            levelText.style.top = '40%';
            levelText.style.left = '50%';
            levelText.style.transform = 'translate(-50%, -50%)';
            levelText.style.color = '#fff';
            levelText.style.fontSize = '4rem';
            levelText.style.fontWeight = 'bold';
            levelText.style.textShadow = '0 0 20px #00f3ff';
            levelText.style.zIndex = '20';
            levelText.style.animation = 'fadeOut 2s forwards';
            document.body.appendChild(levelText);
            setTimeout(() => levelText.remove(), 2000);
        }
    }

    triggerWarp() {
        // Show boss alert instead of slow motion
        this.showBossAlert();

        setTimeout(() => {
            this.spawnBoss();
        }, 2000); // 2 second alert before boss spawns
    }

    showBossAlert() {
        // Create alert overlay
        const alertDiv = document.createElement('div');
        alertDiv.id = 'boss-alert';
        alertDiv.innerHTML = `
            <div class="boss-alert-content">
                <h1 class="glitch" data-text="⚠ WARNING ⚠">⚠ WARNING ⚠</h1>
                <p class="boss-alert-text">ANOMALY DETECTED</p>
                <p class="boss-alert-subtext">PREPARE FOR COMBAT</p>
            </div>
        `;
        document.body.appendChild(alertDiv);

        // Play alert sound
        if (this.audio) this.audio.playTrack('boss');

        // Remove after 2 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 2000);
    }

    spawnBoss() {
        if (!this.firstBossAppeared) {
            this.firstBossAppeared = true;
        }
        this.lastBossLevel = this.currentLevel;

        this.enemies.forEach(enemy => {
            enemy.markedForDeletion = true;
            this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
        });
        this.enemies = [];

        import('./entities/boss.js?v=4').then(m => {
            const sides = ['top', 'left', 'right'];
            const side = sides[Math.floor(this.random() * sides.length)];
            const modelIndex = Math.floor(this.random() * 5);

            const BossClass = m.default || m.Boss;
            this.boss = new BossClass(this, this.currentLevel, side, modelIndex);

            const bossHud = document.getElementById('boss-hud');
            if (bossHud) bossHud.classList.add('active');

            const enemyCounter = document.getElementById('enemy-counter');
            if (enemyCounter) enemyCounter.style.display = 'none';

            const names = [
                'ANOMALY: V-STRIKE',
                'ANOMALY: THE FORTRESS',
                'ANOMALY: THE APEX',
                'ANOMALY: SHADOW REAPER',
                'ANOMALY: VOID CARRIER'
            ];
            const name = (this.currentLevel % 10 === 0 ? 'ELITE ' : '') + names[modelIndex];

            const bossName = document.getElementById('boss-name');
            if (bossName) bossName.innerText = name;

            // Symmetric spawning - both clients assign same ID
            this.boss.remoteId = 'boss_' + (this.entityCounter++);
        });
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        this.drawBackground();
    }

    startGame() {
        // If we want a fresh state after every match, we can use location.reload().
        // If we are calling startGame while gameOver is true, it means it's a RESTART.
        if (this.gameOver) {
            sessionStorage.setItem('midnight_autostart', 'true');
            window.location.reload();
            return;
        }

        if (!this.onlineCoop || !this.randomSeed) {
            this.initRandom(Date.now().toString()); // Single player fallback
        }

        // Rank Perks Initialization
        const rank = getRankByGlobalPosition(this.globalRank);
        this.rankPerk = rank.perk || { coinBonus: 0, hpMercy: false };
        this.applyRankPerks();
        if (this.audio) this.audio.playTrack('gameplay');

        this.isRunning = true;
        this.gameOver = false;
        this.revivedThisRun = false;
        this.isPaused = false;
        this.score = 0;
        this.currentLevel = 1; // Reset to level 1 on new game
        this.boss = null;
        this.bossJustDefeated = false;
        this.bossDefeatTimer = 0;
        this.firstBossAppeared = false;
        this.lastBossLevel = 0;
        this.spawnedEnemyTypes.clear(); // Reset enemy type tracking
        this.difficultyMultiplier = 1.0; // Retained from original
        this.lastTime = 0; // Retained from original

        // Reset entities. Guests also need these values initialised so spawning works symmetrically.
        if (!this.onlineCoop || this.onlineRole === 'host') {
            this.enemies = [];
            this.particles = [];
            this.projectiles = [];
            this.afterburners = [];
            this.powerups = [];
        }
        // Always reset spawn counters so the spawn condition never starts as undefined
        this.enemiesSpawned = 0;
        this.enemiesForLevel = 12 + (this.currentLevel * 4);
        this.entityCounter = 0;

        this.enemyTimer = 0;
        this.enemyInterval = 0.8;
        this.powerupTimer = 0;
        this.powerupInterval = 12.0;

        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        if (this.hud) this.hud.style.display = 'flex';

        // Always enter fullscreen when starting game
        this.enterFullscreen();

        // Fix: Ensure Boss HUD is hidden on restart
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        const healthP2 = document.getElementById('health-container-p2');
        if (healthP2) healthP2.style.display = this.coopMode ? 'flex' : 'none';

        if (this.coopMode) {
            this.input.setBindings(InputHandler.bindings.coopPlayerOne);
            this.inputTwo.setEnabled(!this.onlineCoop || this.onlineRole === 'host');
        } else {
            this.input.setBindings(InputHandler.bindings.singlePlayer);
            this.inputTwo.setEnabled(false);
        }

        const localPlayerId = this.onlineCoop && this.onlineRole === 'guest' ? 'player2' : 'player1';
        const remotePlayerId = localPlayerId === 'player1' ? 'player2' : 'player1';
        const localShip = this.coopMode ? this.localShipType : this.selectedShip;
        const remoteShip = this.coopMode ? this.remoteShipType : this.selectedShip;

        this.player = new Player(this, localShip, { playerId: localPlayerId });
        if (this.coopMode) {
            this.playerTwo = new Player(this, remoteShip, { playerId: remotePlayerId });
            this.playerTwo.x = this.player.x + 80;
            this.playerTwo.y = this.player.y + 80;
        } else {
            this.playerTwo = null;
        }

        const leaveRoomBtn = document.getElementById('leave-room-btn');
        if (leaveRoomBtn) leaveRoomBtn.style.display = this.onlineCoop ? 'inline-block' : 'none';

        this.updatePlayerHudInfo();

        // Update games played achievement
        if (this.achievementManager) {
            this.achievementManager.addStat('games', 1);
        }

        // Show game controls (pause and settings buttons)
        this.showGameControls();

        requestAnimationFrame(this.loop);
    }

    showGameControls() {
        // Show pause and settings buttons
        const pauseBtn = document.getElementById('pause-btn');
        const settingsBtn = document.getElementById('settings-btn');
        if (pauseBtn) pauseBtn.style.display = 'flex';
        if (settingsBtn) settingsBtn.style.display = 'flex';

        // Show mobile controls for touch devices or small screens
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            // Check if device is touch-enabled or small screen
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const isSmallScreen = window.innerWidth <= 1024;

            if (isTouchDevice || isSmallScreen) {
                mobileControls.classList.add('active');
            }
        }
    }

    hideGameControls() {
        // Hide pause and settings buttons
        const pauseBtn = document.getElementById('pause-btn');
        const settingsBtn = document.getElementById('settings-btn');
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (settingsBtn) settingsBtn.style.display = 'none';

        // Hide mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.remove('active');
        }
    }

    togglePause() {
        if (!this.isRunning || this.gameOver) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            document.getElementById('pause-menu').classList.add('active');
        } else {
            document.getElementById('pause-menu').classList.remove('active');
            this.lastTime = 0; // Reset delta time to prevent jump
        }
    }

    toggleSettingsMenu() {
        if (!this.isRunning || this.gameOver) return;

        const settingsMenu = document.getElementById('settings-menu');
        settingsMenu.classList.toggle('active');

        if (settingsMenu.classList.contains('active')) {
            this.isPaused = true;
        } else {
            this.isPaused = false;
            this.lastTime = 0; // Reset delta time to prevent jump
        }
    }

    goToMainMenu() {
        if (this.onlineCoop) {
            this.leaveCollaborateRoom(true, true);
            return;
        }

        // Auto-refresh to ensure leaderboard/starting ui is updated
        window.location.reload();
    }

    goToStoreFromGameOver() {
        this.gameOverScreen.classList.remove('active');
        this.openStore();
        // Since we didn't reload, we might need to reset some game state flags if we want to allow immediate restart
        // but opening store is already safe as is.
    }

    // Leaderboard Methods
    openLeaderboard() {
        this.startScreen.classList.remove('active');
        document.getElementById('leaderboard-screen').classList.add('active');
        this.leaderboard.displayLeaderboard();

        // Set player name input value if exists
        const input = document.getElementById('player-name-input');
        if (input && this.leaderboard.getPlayerName()) {
            input.value = this.leaderboard.getPlayerName();
        }

        // Hide SET NAME button if player already has a name
        const setNameBtn = document.getElementById('set-name-btn');
        const playerName = this.leaderboard.getPlayerName();
        if (setNameBtn) {
            setNameBtn.style.display = playerName ? 'none' : 'inline-block';
        }
    }

    openLeaderboardFromGameOver() {
        this.gameOverScreen.classList.remove('active');
        document.getElementById('leaderboard-screen').classList.add('active');
        this.leaderboard.displayLeaderboard();

        // Set player name input value if exists
        const input = document.getElementById('player-name-input');
        if (input && this.leaderboard.getPlayerName()) {
            input.value = this.leaderboard.getPlayerName();
        }

        // Hide SET NAME button if player already has a name
        const setNameBtn = document.getElementById('set-name-btn');
        const playerName = this.leaderboard.getPlayerName();
        if (setNameBtn) {
            setNameBtn.style.display = playerName ? 'none' : 'inline-block';
        }
    }

    closeLeaderboard() {
        document.getElementById('leaderboard-screen').classList.remove('active');
        this.startScreen.classList.add('active');
    }

    openCollaborate() {
        this.startScreen.classList.remove('active');
        const screen = document.getElementById('collab-screen');
        if (screen) screen.classList.add('active');

        const roomInput = document.getElementById('collab-room-input');
        if (roomInput) roomInput.value = '';

        const roomDisplay = document.getElementById('collab-room-display');
        const waiting = document.getElementById('collab-waiting');
        const status = document.getElementById('collab-status');
        const leaveBtn = document.getElementById('collab-leave-btn');
        if (roomDisplay) roomDisplay.classList.add('hidden');
        if (waiting) waiting.classList.add('hidden');
        if (status) status.innerText = '';
        if (leaveBtn) leaveBtn.classList.add('hidden');

        const createBtn = document.getElementById('collab-create-btn');
        const joinBtn = document.getElementById('collab-join-btn');
        if (createBtn) createBtn.classList.remove('hidden');
        if (joinBtn) joinBtn.disabled = false;
    }

    closeCollaborate() {
        document.getElementById('collab-screen').classList.remove('active');
        this.startScreen.classList.add('active');
    }


    setPlayerName() {
        const input = document.getElementById('player-name-input');
        if (!input || !input.value.trim()) {
            alert('Please enter a valid pilot name!');
            return;
        }

        const name = input.value.trim();
        this.leaderboard.setPlayerName(name);
        this.updatePlayerNameDisplay();
        alert(`Pilot name set to: ${name}`);

        // Hide SET NAME button after setting the name
        const setNameBtn = document.getElementById('set-name-btn');
        if (setNameBtn) {
            setNameBtn.style.display = 'none';
        }
    }

    updatePlayerNameDisplay() {
        // console.log("Updating player name displays...");
        // 1. Update main menu display
        const displayEl = document.getElementById('current-player-name');
        if (displayEl) {
            const playerName = this.leaderboard.getPlayerName();
            displayEl.innerText = playerName || 'UNKNOWN';
        }
        // 2. Update rank panel
        this.refreshRankDisplay();
        // 3. Update HUD display
        this.updatePlayerHudInfo();
    }

    updatePlayerHudInfo() {
        // console.log("Updating HUD info. Local name:", this.leaderboard.getPlayerName());
        const p1NameEl = document.getElementById('p1-hud-name');
        const p1ShipEl = document.getElementById('p1-hud-ship');
        const p2NameEl = document.getElementById('p2-hud-name');
        const p2ShipEl = document.getElementById('p2-hud-ship');

        const localName = this.leaderboard.getPlayerName() || 'UNKNOWN';
        const peerName = this.collabTeamMembers
            ? this.collabTeamMembers.find(name => name !== localName) || 'UNKNOWN'
            : 'UNKNOWN';

        if (p1NameEl) p1NameEl.innerText = `YOU: ${localName}`;
        if (p1ShipEl) p1ShipEl.innerText = `SHIP: ${(SHIP_DATA[this.localShipType]?.name || this.localShipType || 'DEFAULT').toUpperCase()}`;

        const showP2 = this.coopMode;
        if (p2NameEl) {
            p2NameEl.style.display = showP2 ? 'block' : 'none';
            p2NameEl.innerText = `ALLY: ${peerName}`;
        }
        if (p2ShipEl) {
            p2ShipEl.style.display = showP2 ? 'block' : 'none';
            p2ShipEl.innerText = `SHIP: ${(SHIP_DATA[this.remoteShipType]?.name || this.remoteShipType || 'DEFAULT').toUpperCase()}`;
        }
    }

    applyPeerInput(message) {
        if (!this.onlineCoop) return;
        if (!message || !message.input) return;
        // Reset all keys to false first, then apply incoming input
        // This prevents sticky keys (auto-shooting bug)
        this.remoteInputState.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false,
            missile: false,
            dash: false,
            ...message.input
        };
    }

    applyPeerState(message) {
        if (!this.onlineCoop || !this.playerTwo || !message || !message.state) return;
        const state = message.state;

        // Both host and guest should apply peer state for proper synchronization
        this.playerTwo.x = typeof state.x === 'number' ? state.x : this.playerTwo.x;
        this.playerTwo.y = typeof state.y === 'number' ? state.y : this.playerTwo.y;
        this.playerTwo.angle = typeof state.angle === 'number' ? state.angle : this.playerTwo.angle;
        if (typeof state.health === 'number') this.playerTwo.currentHealth = state.health;
        if (typeof state.maxHealth === 'number') this.playerTwo.maxHealth = state.maxHealth;

        if (state.shipType && state.shipType !== this.remoteShipType) {
            this.remoteShipType = state.shipType;
            this.updatePlayerHudInfo();
        }

        // Only guest syncs game state from host
        if (this.onlineRole === 'guest') {
            if (typeof state.score === 'number') this.score = state.score;
            if (typeof state.level === 'number') this.currentLevel = state.level;
            if (state.gameOver && !this.gameOver) {
                this.handleGameOver();
            }
        }
    }

    initializeCosmicAtmosphere() {
        // Create nebulas for volumetric gas clouds
        for (let i = 0; i < 5; i++) {
            this.nebulas.push(new Nebula(this));
        }

        // Create cosmic dust particles for velocity effect
        for (let i = 0; i < 100; i++) {
            this.cosmicDust.push(new CosmicDust(this));
        }

        // Create planets
        for (let i = 0; i < 3; i++) {
            this.planets.push(new Planet(this));
        }

        // Create asteroids
        for (let i = 0; i < 15; i++) {
            this.asteroids.push(new Asteroid(this));
        }
    }

    getPlayers() {
        const players = [];
        if (this.player) players.push(this.player);
        if (this.coopMode && this.playerTwo) players.push(this.playerTwo);
        return players;
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        try {
            if (!this.lastTime || this.isPaused) { // If paused, just keep updating lastTime without processing?
                // actually, if paused, we can just skip the whole loop body effectively,
                // BUT we need to handle the resume properly.
                // Better: if isPaused, just return early or requestFrame but don't update.
                if (this.isPaused) {
                    this.lastTime = timestamp; // Keep clock running so no huge delta on resume
                    requestAnimationFrame(this.loop);
                    return;
                }
            }

            if (!this.lastTime) {
                this.lastTime = timestamp;
            }

            const deltaTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            this.update(deltaTime);
            this.draw();
        } catch (e) {

            this.isRunning = false;
            throw e; // Re-throw to trigger window.onerror
        }

        requestAnimationFrame(this.loop);
    }

    update(deltaTime) {
        if (this.isPaused) return;

        // Hit-Stop Impact Effect (Temporal Freeze)
        if (this.impactTimer > 0) {
            this.impactTimer -= deltaTime;
            return;
        }

        // Warp Sequence handling
        if (this.isWarping) {
            this.cosmicDust.forEach(d => {
                d.vy *= 10;
                d.draw(this.ctx); // Extra speed visual during update loop too
            });
            return;
        }

        // Safety cap for deltaTime
        const dt = Math.min(deltaTime, 0.1);

        // Periodically check and maintain fullscreen during gameplay
        this.fullscreenCheckTimer += dt;
        if (this.fullscreenCheckTimer >= 2.0) { // Check every 2 seconds
            this.fullscreenCheckTimer = 0;
            if (!document.fullscreenElement && this.isRunning && !this.gameOver) {
                this.enterFullscreen();
            }
        }

        this.screenShake.update(dt);

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboMultiplier = 1;
            }
        }

        // Handle boss defeat timer - allows unique enemies to spawn for ~10 seconds
        if (this.bossJustDefeated) {
            this.bossDefeatTimer += dt;
            if (this.bossDefeatTimer > 15.0) { // 15 seconds of unique enemy spawning
                this.bossJustDefeated = false;
                this.bossDefeatTimer = 0;
            }
        }

        if (!this.gameOver) {
            const players = this.getPlayers();
            if (players.length > 0) {
                if (this.onlineCoop && this.coopMode) {
                    if (this.player) this.player.update(dt, this.input);
                    if (this.playerTwo) this.playerTwo.update(dt, this.remoteInputState);
                } else {
                    players.forEach((player, index) => {
                        const input = index === 0 ? this.input : this.inputTwo;
                        player.update(dt, input);
                    });
                }
            }

            if (this.onlineCoop) {
                this.netSyncTimer += dt;
                this.netplay.emit('input_update', { input: { ...this.input.keys } });

                if (this.netSyncTimer >= (1 / 60) && this.player) {
                    this.netSyncTimer = 0;
                    this.netplay.emit('state_update', {
                        state: {
                            x: this.player.x,
                            y: this.player.y,
                            angle: this.player.angle,
                            health: this.player.currentHealth,
                            maxHealth: this.player.maxHealth,
                            shipType: this.player.shipType,
                            isDashing: this.player.isDashing,
                            score: this.score,
                            level: this.currentLevel
                        }
                    });
                }

                if (this.playerTwo && this.remotePlayerState) {
                    const s = this.remotePlayerState;
                    const lerpFactor = 0.3;
                    this.playerTwo.x += (s.x - this.playerTwo.x) * lerpFactor;
                    this.playerTwo.y += (s.y - this.playerTwo.y) * lerpFactor;
                    this.playerTwo.angle = s.angle;
                    this.playerTwo.currentHealth = s.health;
                    this.playerTwo.maxHealth = s.maxHealth;
                    this.playerTwo.isDashing = s.isDashing;

                    if (this.onlineRole === 'guest') {
                        if (s.score !== undefined) this.score = s.score;
                        if (s.level !== undefined) this.currentLevel = s.level;
                    }

                    if (s.shipType && this.playerTwo.shipType !== s.shipType) {
                        this.playerTwo.shipType = s.shipType;
                        this.remoteShipType = s.shipType;
                        this.updatePlayerHudInfo();
                    }
                }
            }

            // Spawning logic - Only the host handles spawning
            const isHost = !this.onlineCoop || this.onlineRole === 'host';
            if (isHost) {
                this.enemyTimer += dt;

                // Burst Spawn Logic: If screen is too empty, spawn faster
                const maxOnScreen = this.getMaxEnemiesOnScreen();
                const currentCount = this.enemies.length;
                const burstThreshold = Math.ceil(maxOnScreen * 0.4);

                if (this.enemyTimer > this.enemyInterval && !this.boss) {
                    // Decide how many to spawn: 2 if screen is empty, 1 otherwise
                    let spawnCount = (currentCount < burstThreshold) ? 2 : 1;

                    for (let i = 0; i < spawnCount; i++) {
                        if (this.enemies.length < maxOnScreen &&
                            this.enemiesSpawned < this.enemiesForLevel) {
                            const enemy = this.spawnEnemy();
                            this.enemiesSpawned += (enemy ? enemy.weight : 1);
                        }
                    }
                    this.enemyTimer = 0;
                }

                this.powerupTimer += dt;
                // During boss fights, spawn power-ups more frequently (every 8s)
                const powerupCooldown = this.boss ? 8.0 : this.powerupInterval;
                if (this.powerupTimer > powerupCooldown && this.powerups.length < (this.boss ? 5 : 3)) {
                    if (this.boss) {
                        // Guaranteed mercy drop during boss fight
                        this.spawnPowerUpAt(
                            this.random() * this.width * 0.8 + this.width * 0.1,
                            this.random() * this.height * 0.8 + this.height * 0.1
                        );
                    } else {
                        this.spawnPowerUp();
                    }
                    this.powerupTimer = 0;
                }
            }

            // Entity Updates
            if (this.empTimer > 0) {
                this.empTimer -= dt;
                // Draw only: enemies and boss logic skipped while frozen
            } else {
                this.enemies.forEach(e => e.update(dt));
                if (this.boss) {
                    this.boss.update(dt);
                }
            }

            this.projectiles.forEach(p => p.update(dt));
            this.powerups.forEach(p => p.update(dt));

            if (this.boss) {
                this.updateBossUI();
            }

            this.afterburners.forEach(a => {
                if (a.update) a.update(dt);
                else {
                    a.life -= dt;
                    if (a.life <= 0) a.markedForDeletion = true;
                }
            });

            // Collisions
            this.checkCollisions();
            this.checkProjectileCollisions();
            this.checkPowerUpCollisions();
            this.checkLevelUp();
        } else {
            this.enemies.forEach(e => e.update(dt));
            this.projectiles.forEach(p => p.update(dt));
            this.afterburners.forEach(a => {
                if (a.update) a.update(dt);
                else { a.life -= dt; if (a.life <= 0) a.markedForDeletion = true; }
            });
        }

        // Always update particles
        this.particles.forEach(p => p.update(dt));

        // Cleanup
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
        this.particles = this.particles.filter(p => !p.markedForDeletion);
        this.powerups = this.powerups.filter(p => !p.markedForDeletion);
        this.afterburners = this.afterburners.filter(a => !a.markedForDeletion);

        // Cleanup Boss
        if (this.boss && this.boss.markedForDeletion) {
            this.boss = null;
            this.bossJustDefeated = true;
            this.spawnedEnemyTypes.clear(); // Clear spawned types for new unique enemies
            this.removeLowestHPEnemy(); // Remove the weakest enemy after boss defeat
            const bossHud = document.getElementById('boss-hud');
            if (bossHud) bossHud.classList.remove('active');
        }

        this.updateUI();
    }

    updateBossUI() {
        if (!this.boss) return;
        const fill = document.getElementById('boss-health-fill');
        if (fill) {
            const pct = (this.boss.health / this.boss.maxHealth) * 100;
            fill.style.width = `${pct}%`;
        }
    }

    draw() {
        // Cosmic Atmosphere Background Layer
        // Draw nebulas (volumetric gas clouds)
        this.nebulas.forEach(nebula => nebula.draw(this.ctx));

        // Draw planets
        this.planets.forEach(planet => planet.draw(this.ctx));

        // Draw asteroids
        this.asteroids.forEach(asteroid => asteroid.draw(this.ctx));

        // Draw cosmic dust (high-speed particles)
        this.cosmicDust.forEach(dust => dust.draw(this.ctx));

        // Background trail
        this.ctx.fillStyle = 'rgba(5, 5, 16, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(this.screenShake.offsetX, this.screenShake.offsetY);

        // Draw Players
        if (!this.gameOver) {
            if (this.player) this.player.draw(this.ctx);
            if (this.coopMode && this.playerTwo) this.playerTwo.draw(this.ctx);
        }

        // Draw Boss
        if (this.boss) this.boss.draw(this.ctx);

        // Draw Entities
        this.enemies.forEach(e => e.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.afterburners.forEach(a => {
            if (a.draw) a.draw(this.ctx);
        });
        this.particles.forEach(p => p.draw(this.ctx));
        this.powerups.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }

    drawBackground() {
        this.ctx.fillStyle = '#050510';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw AAA Atmosphere
        this.nebulas.forEach(n => n.draw(this.ctx));
        this.cosmicDust.forEach(d => d.draw(this.ctx));

        // Grid lines
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    addScore(points, useCombo = true) {
        if (useCombo) {
            if (this.comboTimer > 0) {
                this.comboMultiplier = Math.min(this.comboMax, this.comboMultiplier + 0.25);
            } else {
                this.comboMultiplier = 1;
            }
            this.comboTimer = this.comboWindow;
            this.score += Math.round(points * this.comboMultiplier);
        } else {
            this.score += points;
        }
    }

    handleEnemyDefeat(enemy, useCombo = true) {
        if (!enemy || enemy.markedForDeletion) return;

        // Mutual Optimistic Combat: Broadcast destruction if enemy has remoteId
        if (this.onlineCoop && enemy.remoteId) {
            this.netplay.emit('destroy_enemy', {
                id: enemy.remoteId,
                useCombo: useCombo
            });
        }

        enemy.markedForDeletion = true;
        this.addScore(enemy.points, useCombo);
        if (this.achievementManager) this.achievementManager.addStat('kills', 1);
        // Track kill streak
        this.currentKillStreak++;
        if (this.achievementManager) this.achievementManager.updateMaxKillstreak(this.currentKillStreak);
        this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
        if (this.audio) this.audio.explosion();

        // ── Combo-Based Economy ──
        // Removed combo coin drops as per user request

        // Passive: trigger on-kill effects for all players
        this.getPlayers().forEach(p => { if (p.onEnemyKill) p.onEnemyKill(); });

        if (enemy.splitOnDeath) {
            for (let i = 0; i < enemy.splitCount; i++) {
                const child = new Enemy(this, enemy.splitType || 'swarm');
                child.x = enemy.x + (this.random() - 0.5) * 20;
                child.y = enemy.y + (this.random() - 0.5) * 20;

                // Symmetric ID assignment
                child.remoteId = 'enemy_' + (this.entityCounter++);
                this.enemies.push(child);
            }
        }

        if (this.powerups.length < 3 && this.random() < this.enemyDropChance) {
            this.spawnPowerUpAt(enemy.x, enemy.y);
        }
    }

    spawnEnemy(forcedType = null, forcedX = null, forcedY = null) {
        const typeRand = this.random();
        const level = this.currentLevel || 1;
        let type = forcedType || 'chaser';

        if (!forcedType) {
            const availableTypes = this.getAvailableEnemyTypes(level);
            if (this.bossJustDefeated) {
                const uniqueTypes = availableTypes.filter(t => !this.spawnedEnemyTypes.has(t));
                if (uniqueTypes.length > 0) {
                    type = uniqueTypes[Math.floor(this.random() * uniqueTypes.length)];
                } else {
                    this.bossJustDefeated = false;
                    type = availableTypes[Math.floor(this.random() * availableTypes.length)];
                }
            } else {
                type = this.selectEnemyTypeByProbability(typeRand, level, availableTypes);
            }
        }

        this.spawnedEnemyTypes.add(type);
        const enemy = new Enemy(this, type, forcedX, forcedY);
        enemy.remoteId = 'enemy_' + (this.entityCounter++);
        this.enemies.push(enemy);
        return enemy;
    }

    getAvailableEnemyTypes(level) {
        if (level >= 21) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'splitter', 'phantom', 'titan', 'wraith', 'vortex',
                'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor', 'mirror', 'swarmer'];
        } else if (level >= 16) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'splitter', 'wraith',
                'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor', 'mirror', 'swarmer'];
        } else if (level >= 14) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'titan',
                'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'swarmer'];
        } else if (level >= 12) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'titan',
                'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor'];
        } else if (level >= 10) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom',
                'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'blade'];
        } else if (level >= 8) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom',
                'bomber', 'interceptor', 'decoy', 'launcher', 'shielder'];
        } else if (level >= 6) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom',
                'bomber', 'interceptor', 'decoy', 'launcher'];
        } else if (level >= 4) {
            return ['chaser', 'heavy', 'shooter', 'swarm',
                'bomber', 'interceptor', 'decoy'];
        } else if (level >= 3) {
            return ['chaser', 'heavy', 'shooter', 'bomber'];
        } else {
            return ['chaser', 'heavy', 'shooter'];
        }
    }

    selectEnemyTypeByProbability(typeRand, level, availableTypes) {
        // Progressive enemy unlock system with all 16 enemy types integrated
        if (level >= 21) {
            // LEVEL 21+ | All enemy types available with maximum variety
            if (typeRand > 0.96) return 'vortex';
            else if (typeRand > 0.92) return 'titan';
            else if (typeRand > 0.88) return 'wraith';
            else if (typeRand > 0.84) return 'mirror';
            else if (typeRand > 0.80) return 'tractor';
            else if (typeRand > 0.76) return 'blade';
            else if (typeRand > 0.72) return 'pulsar';
            else if (typeRand > 0.68) return 'shielder';
            else if (typeRand > 0.62) return 'swarmer';
            else if (typeRand > 0.56) return 'launcher';
            else if (typeRand > 0.50) return 'phantom';
            else if (typeRand > 0.44) return 'splitter';
            else if (typeRand > 0.38) return 'sniper';
            else if (typeRand > 0.30) return 'swarm';
            else if (typeRand > 0.20) return 'shooter';
            else if (typeRand > 0.10) return 'heavy';
            else return 'chaser';
        } else if (level >= 16) {
            // LEVEL 16-20 | Wraith and advanced new enemies
            if (typeRand > 0.92) return 'wraith';
            else if (typeRand > 0.88) return 'mirror';
            else if (typeRand > 0.84) return 'tractor';
            else if (typeRand > 0.80) return 'blade';
            else if (typeRand > 0.76) return 'swarmer';
            else if (typeRand > 0.72) return 'launcher';
            else if (typeRand > 0.68) return 'pulsar';
            else if (typeRand > 0.62) return 'splitter';
            else if (typeRand > 0.56) return 'sniper';
            else if (typeRand > 0.42) return 'swarm';
            else if (typeRand > 0.28) return 'shooter';
            else if (typeRand > 0.14) return 'heavy';
            else return 'chaser';
        } else if (level >= 14) {
            // LEVEL 14-15 | Swarmer emerges - coordinated squadron threat
            if (typeRand > 0.88) return 'swarmer';
            else if (typeRand > 0.84) return 'mirror';
            else if (typeRand > 0.80) return 'tractor';
            else if (typeRand > 0.76) return 'blade';
            else if (typeRand > 0.72) return 'launcher';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.62) return 'titan';
            else if (typeRand > 0.56) return 'sniper';
            else if (typeRand > 0.42) return 'swarm';
            else if (typeRand > 0.28) return 'shooter';
            else if (typeRand > 0.14) return 'heavy';
            else return 'chaser';
        } else if (level >= 13) {
            // LEVEL 13 | Mirror appears - reflective threat
            if (typeRand > 0.86) return 'mirror';
            else if (typeRand > 0.82) return 'tractor';
            else if (typeRand > 0.78) return 'blade';
            else if (typeRand > 0.74) return 'launcher';
            else if (typeRand > 0.70) return 'pulsar';
            else if (typeRand > 0.66) return 'phantom';
            else if (typeRand > 0.60) return 'titan';
            else if (typeRand > 0.54) return 'sniper';
            else if (typeRand > 0.40) return 'swarm';
            else if (typeRand > 0.26) return 'shooter';
            else if (typeRand > 0.13) return 'heavy';
            else return 'chaser';
        } else if (level >= 12) {
            // LEVEL 12 | Tractor emerges - gravitational threat
            if (typeRand > 0.84) return 'tractor';
            else if (typeRand > 0.80) return 'blade';
            else if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'pulsar';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.62) return 'titan';
            else if (typeRand > 0.54) return 'sniper';
            else if (typeRand > 0.40) return 'swarm';
            else if (typeRand > 0.26) return 'shooter';
            else if (typeRand > 0.13) return 'heavy';
            else return 'chaser';
        } else if (level >= 11) {
            // LEVEL 11 | Titan awakens - armored colossus threat
            if (typeRand > 0.84) return 'titan';
            else if (typeRand > 0.80) return 'blade';
            else if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'pulsar';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.54) return 'sniper';
            else if (typeRand > 0.40) return 'swarm';
            else if (typeRand > 0.26) return 'shooter';
            else if (typeRand > 0.13) return 'heavy';
            else return 'chaser';
        } else if (level >= 10) {
            // LEVEL 10 | Blade emerges - melee slashing threat
            if (typeRand > 0.82) return 'blade';
            else if (typeRand > 0.78) return 'launcher';
            else if (typeRand > 0.74) return 'pulsar';
            else if (typeRand > 0.70) return 'phantom';
            else if (typeRand > 0.64) return 'shielder';
            else if (typeRand > 0.52) return 'sniper';
            else if (typeRand > 0.38) return 'swarm';
            else if (typeRand > 0.24) return 'shooter';
            else if (typeRand > 0.12) return 'heavy';
            else return 'chaser';
        } else if (level >= 9) {
            // LEVEL 9 | Pulsar emerges - energy wave threat
            if (typeRand > 0.80) return 'pulsar';
            else if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'phantom';
            else if (typeRand > 0.68) return 'shielder';
            else if (typeRand > 0.60) return 'sniper';
            else if (typeRand > 0.46) return 'swarm';
            else if (typeRand > 0.32) return 'shooter';
            else if (typeRand > 0.16) return 'heavy';
            else return 'chaser';
        } else if (level >= 8) {
            // LEVEL 8 | Shielder emerges - protected barrier threat
            if (typeRand > 0.78) return 'shielder';
            else if (typeRand > 0.74) return 'launcher';
            else if (typeRand > 0.70) return 'phantom';
            else if (typeRand > 0.62) return 'sniper';
            else if (typeRand > 0.48) return 'swarm';
            else if (typeRand > 0.34) return 'shooter';
            else if (typeRand > 0.17) return 'heavy';
            else return 'chaser';
        } else if (level >= 6) {
            // LEVEL 6-7 | Launcher appears - missile platform threat
            if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'phantom';
            else if (typeRand > 0.64) return 'sniper';
            else if (typeRand > 0.50) return 'swarm';
            else if (typeRand > 0.36) return 'shooter';
            else if (typeRand > 0.18) return 'heavy';
            else return 'chaser';
        } else if (level >= 5) {
            // LEVEL 5 | Decoy emerges - holographic clone threat
            if (typeRand > 0.74) return 'decoy';
            else if (typeRand > 0.70) return 'phantom';
            else if (typeRand > 0.62) return 'sniper';
            else if (typeRand > 0.50) return 'swarm';
            else if (typeRand > 0.36) return 'shooter';
            else if (typeRand > 0.18) return 'heavy';
            else return 'chaser';
        } else if (level >= 4) {
            // LEVEL 4 | Interceptor appears - speed threat
            if (typeRand > 0.72) return 'interceptor';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.60) return 'sniper';
            else if (typeRand > 0.48) return 'swarm';
            else if (typeRand > 0.34) return 'shooter';
            else if (typeRand > 0.17) return 'heavy';
            else return 'chaser';
        } else if (level >= 3) {
            // LEVEL 3 | Bomber emerges - explosive threat
            if (typeRand > 0.70) return 'bomber';
            else if (typeRand > 0.66) return 'phantom';
            else if (typeRand > 0.58) return 'sniper';
            else if (typeRand > 0.46) return 'swarm';
            else if (typeRand > 0.32) return 'shooter';
            else if (typeRand > 0.16) return 'heavy';
            else return 'chaser';
        } else {
            // LEVEL 1-2 | Early game - basic enemies only
            if (typeRand > 0.70) return 'shooter';
            else if (typeRand > 0.40) return 'heavy';
            else return 'chaser';
        }
    }

    removeLowestHPEnemy() {
        if (this.enemies.length === 0) return;

        // Sort enemies by health (ascending) and remove the lowest HP enemy
        let lowestHPEnemy = this.enemies[0];
        let lowestIndex = 0;

        for (let i = 1; i < this.enemies.length; i++) {
            if (this.enemies[i].health < lowestHPEnemy.health) {
                lowestHPEnemy = this.enemies[i];
                lowestIndex = i;
            }
        }

        // Mark the lowest HP enemy for deletion
        lowestHPEnemy.markedForDeletion = true;
    }

    spawnPowerUp() {
        const types = [
            'speed', 'slowmo', 'invulnerability',
            'health_recover', 'health_boost',
            'shield', 'double_damage', 'rapid_fire',
            'nuke', 'ghost', 'emp'
        ];
        const type = types[Math.floor(this.random() * types.length)];
        const pu = new PowerUp(this, type);

        // Assign symmetric network ID
        pu.remoteId = 'pu_' + (this.entityCounter++);

        this.powerups.push(pu);
    }

    spawnPowerUpAt(x, y) {
        let type = 'speed';

        // ── Context-Aware Power-up Drops (Mercy System) ──
        if (this.player) {
            const hpRatio = this.player.currentHealth / this.player.maxHealth;
            const isBossFight = !!this.boss; // Detect boss fight

            let wHealth = 1;
            let wShield = 1;
            let wOffense = 2;
            let wUtility = 1;
            let wEmp = 0;
            let wMaxHeal = 0;

            // Initialize pool for weighted random selection
            const pool = [];

            if (isBossFight) {
                // Boss fight mercy: heavy bias toward survivability
                wHealth = 5;
                wShield = 4;
                wEmp = 3;
                wMaxHeal = 2;
                wOffense = 1;
                wUtility = 2;
            } else if (hpRatio < 0.35) {
                wHealth = 6;
                wShield = 4;
                wOffense = 1;
                wUtility = 1;
            } else if (hpRatio < 0.6) {
                wHealth = 3;
                wShield = 2;
                wOffense = 2;
                wUtility = 1;
            } else if (hpRatio >= 1.0) {
                wHealth = 0;
                wOffense = 4;
            }

            // Boss fight + critical HP = maximum mercy
            if (isBossFight && hpRatio < 0.35) {
                wHealth = 8;
                wShield = 5;
                wMaxHeal = 4;
            }

            const hasOffense = this.player.doubleDamageTimer > 0 || this.player.rapidFireTimer > 0;
            if (!hasOffense && hpRatio > 0.35) {
                wOffense += 3;
            }

            // Fill pool based on weights
            for (let i = 0; i < wHealth; i++) pool.push('health_recover');
            for (let i = 0; i < wShield; i++) pool.push('shield');
            for (let i = 0; i < wEmp; i++) pool.push('emp');
            for (let i = 0; i < wMaxHeal; i++) pool.push('health_boost');

            for (let i = 0; i < wOffense; i++) {
                pool.push('double_damage');
                pool.push('rapid_fire');
            }

            for (let i = 0; i < wUtility; i++) {
                pool.push('speed');
                pool.push('slowmo');
                pool.push('invulnerability');
            }

            if (pool.length > 0) {
                type = pool[Math.floor(this.random() * pool.length)];
            }
        } else {
            // Fallback purely random
            const types = ['speed', 'slowmo', 'invulnerability', 'health_recover', 'shield', 'double_damage', 'rapid_fire'];
            type = types[Math.floor(this.random() * types.length)];
        }

        const pu = new PowerUp(this, type, x, y);

        // Assign symmetric network ID
        pu.remoteId = 'pu_' + (this.entityCounter++);

        this.powerups.push(pu);
    }

    checkCollisions() {
        if (this.gameOver || this.isWarping) return;

        const players = this.getPlayers();
        if (players.length === 0) return;

        this.enemies.forEach(enemy => {
            if (enemy.markedForDeletion) return;

            for (let i = 0; i < players.length; i += 1) {
                const player = players[i];
                const dx = enemy.x - player.x;
                const dy = enemy.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < enemy.radius + player.radius) {
                    if (player.isInvulnerable()) {
                        this.handleEnemyDefeat(enemy, true);
                    } else {
                        const playerDied = player.takeDamage(this.getEnemyContactDamage());
                        if (this.audio) this.audio.playerHit();
                        this.triggerImpact(0.1, 0.5);
                        this.hudFlashDamage();
                        this.currentKillStreak = 0; // Reset kill streak on damage
                        if (playerDied) {
                            this.handleGameOver();
                        } else {
                            this.handleEnemyDefeat(enemy, false);
                        }
                    }
                    break;
                }
            }
        });

        // Boss Collision
        if (this.boss) {
            players.forEach(player => {
                if (player.isInvulnerable()) return;
                const dx = this.boss.x - player.x;
                const dy = this.boss.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.boss.radius + player.radius) {
                    const bossContactDamage = this.currentLevel >= 20 ? Math.max(2, Math.ceil(player.maxHealth / 2)) : this.getEnemyContactDamage();
                    const died = player.takeDamage(bossContactDamage);
                    if (this.audio) this.audio.playerHit();
                    this.triggerImpact(0.15, 0.6);
                    this.hudFlashDamage();
                    if (died) this.handleGameOver();
                }
            });
        }
    }

    checkProjectileCollisions() {
        if (this.isWarping) return;

        this.projectiles.forEach(proj => {
            if (proj.markedForDeletion) return;

            // Player vs Enemies/Boss
            const isPlayerProjectile = proj.side === 'player' || (typeof proj.side === 'string' && proj.side.startsWith('player'));
            if (isPlayerProjectile) {
                this.enemies.forEach(enemy => {
                    if (enemy.markedForDeletion || proj.markedForDeletion) return;
                    const dx = proj.x - enemy.x;
                    const dy = proj.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < enemy.radius + proj.radius) {
                        // Support for Piercing / Explosive
                        if (proj.explosive) {
                            const r = 100 * (proj.explosionRadiusMult || 1);
                            const d = proj.damage * 2 * (proj.explosionDamageMult || 1);
                            this.triggerExplosion(proj.x, proj.y, r, d, proj);
                            if (proj.detonateTwice) {
                                setTimeout(() => { if (!this.gameOver) this.triggerExplosion(proj.x, proj.y, r, d, proj); }, 250);
                            }
                            proj.markedForDeletion = true;
                        } else if (proj.piercing) {
                            // Vanguard slow
                            if (proj.slowsEnemies) {
                                enemy.speed = Math.max(enemy.speed * 0.5, enemy.speed * 0.95);
                            }
                            // Don't delete, just damage
                            const dead = enemy.takeDamage(proj.damage);
                            if (dead) {
                                this.handleEnemyDefeat(enemy, true);
                            }
                        } else {
                            if (proj.autoSplit && proj.type === 'missile') {
                                for (let s = 0; s < 3; s++) {
                                    const sp = new Projectile(this, proj.x, proj.y, proj.angle - 0.4 + (s * 0.4), 'bullet', proj.side);
                                    sp.damage = proj.damage * 0.4;
                                    sp.color = '#ffffaa';
                                    sp.radius = 4;
                                    this.projectiles.push(sp);
                                }
                            }
                            proj.markedForDeletion = true;
                            const dead = enemy.takeDamage(proj.damage);
                            if (dead) {
                                this.handleEnemyDefeat(enemy, true);
                            }
                        }
                    }
                });

                if (this.boss && !proj.markedForDeletion) {
                    const dx = proj.x - this.boss.x;
                    const dy = proj.y - this.boss.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < this.boss.radius + proj.radius) {
                        if (proj.explosive) {
                            const r = 120 * (proj.explosionRadiusMult || 1);
                            const d = proj.damage * 3 * (proj.explosionDamageMult || 1);
                            this.triggerExplosion(proj.x, proj.y, r, d, proj);
                            if (proj.detonateTwice) {
                                setTimeout(() => { if (!this.gameOver) this.triggerExplosion(proj.x, proj.y, r, d, proj); }, 250);
                            }
                            proj.markedForDeletion = true;
                        } else if (proj.piercing) {
                            const dead = this.boss.takeDamage(proj.damage);
                            if (this.audio) this.audio.bossHit();
                            if (dead) this.handleBossDefeat();
                        } else {
                            if (proj.autoSplit && proj.type === 'missile') {
                                for (let s = 0; s < 3; s++) {
                                    const sp = new Projectile(this, proj.x, proj.y, proj.angle - 0.4 + (s * 0.4), 'bullet', proj.side);
                                    sp.damage = proj.damage * 0.4;
                                    sp.color = '#ffffaa';
                                    sp.radius = 4;
                                    this.projectiles.push(sp);
                                }
                            }
                            proj.markedForDeletion = true;
                            const dead = this.boss.takeDamage(proj.damage);
                            if (this.audio) this.audio.bossHit();
                            if (dead) this.handleBossDefeat();
                        }
                    }
                }
            } else {
                // Enemy vs Player
                const players = this.getPlayers();
                players.forEach(player => {
                    if (!player || player.isInvulnerable() || proj.markedForDeletion) return;
                    const dx = proj.x - player.x;
                    const dy = proj.y - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < player.radius + proj.radius) {
                        proj.markedForDeletion = true;
                        const hitDamage = (proj.source === 'boss' && this.currentLevel >= 20)
                            ? Math.max(2, Math.ceil(player.maxHealth / 2))
                            : this.getEnemyProjectileDamage(proj.damage || 1);
                        const died = player.takeDamage(hitDamage);
                        if (this.audio) this.audio.playerHit();
                        this.triggerImpact(0.1, 0.5);
                        this.hudFlashDamage();
                        this.currentKillStreak = 0; // Reset kill streak on damage
                        if (died) this.handleGameOver();
                    }
                });

                // Enemy vs Enemy (Friendly Fire)
                if (!proj.markedForDeletion) {
                    this.enemies.forEach(enemy => {
                        // Don't let an enemy shoot itself instantly, and boss projectiles don't hurt enemies for balance
                        if (enemy.markedForDeletion || proj.markedForDeletion || proj.source === 'boss') return;
                        // Avoid immediate self-collision by checking if the projectile just spawned near the enemy
                        const dx = proj.x - enemy.x;
                        const dy = proj.y - enemy.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        // Only collide if it's actually hitting them and not inside them (newly spawned)
                        if (dist < enemy.radius + proj.radius && dist > 15) {
                            proj.markedForDeletion = true;
                            // Friendly fire does 50% damage to prevent accidental full-clears of the board
                            const dead = enemy.takeDamage(Math.max(1, Math.floor((proj.damage || 1) * 0.5)));
                            if (dead) {
                                this.handleEnemyDefeat(enemy, false); // No combo points for friendly fire
                            }
                        }
                    });
                }
            }
        });
    }

    triggerExplosion(x, y, radius, damage, sourceProj = null) {
        // Visual explosion
        this.particles.push(new Explosion(this, x, y, '#ffaa00'));

        if (sourceProj && sourceProj.leavesFire) {
            const fire = new Projectile(this, x, y, 0, 'bullet', 'player');
            fire.speed = 0; fire.lifetime = 1.2; fire.piercing = true; fire.damage = 0.5;
            fire.radius = radius * 0.8; fire.color = 'rgba(255, 100, 0, 0.4)';
            this.projectiles.push(fire);
        }

        // Damage all enemies in range
        this.enemies.forEach(enemy => {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + enemy.radius) {
                if (sourceProj && sourceProj.knocksBack && enemy.type !== 'boss') {
                    enemy.x += (dx / dist) * 35;
                    enemy.y += (dy / dist) * 35;
                }
                const dead = enemy.takeDamage(damage);
                if (dead) {
                    this.handleEnemyDefeat(enemy, true);
                }
            }
        });

        // Damage boss if in range
        if (this.boss) {
            const dx = this.boss.x - x;
            const dy = this.boss.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + this.boss.radius) {
                const dead = this.boss.takeDamage(damage);
                if (dead) this.handleBossDefeat();
            }
        }
    }

    hudFlashDamage() {
        const fill = document.getElementById('health-fill');
        if (fill) {
            fill.classList.add('damage-flash');
            setTimeout(() => { if (fill) fill.classList.remove('damage-flash'); }, 200);
        }
    }

    triggerEMP() {
        this.triggerImpact(0.5, 0.9); // Huge flash effect
        if (this.audio && typeof this.audio.powerUp === 'function') this.audio.powerUp();

        // Freeze logic
        this.empTimer = 5.0;

        // Clear all enemy projectiles
        this.projectiles = this.projectiles.filter(p => p.side !== 'enemy');

        if (this.player) {
            // Visual text
            // We need to import FloatingText in game.js if not already, but it's imported at top.
            this.particles.push(new FloatingText(this, this.player.x, this.player.y - 40, 'E.M.P. BLAST!', '#00ffff'));
        }
    }

    handleBossDefeat() {
        if (!this.boss) return;

        // Mutual Optimistic Combat: Broadcast destruction from either client
        if (this.onlineCoop && this.boss.remoteId) {
            this.netplay.emit('destroy_boss', { id: this.boss.remoteId });
        }

        const loot = this.boss.coinReward || 50;
        this.score += this.boss.points;
        this.coins += loot;
        if (this.achievementManager) this.achievementManager.addStat('bosses', 1);

        // Save coins
        localStorage.setItem('midnight_coins', this.coins);

        // ── Post-Boss Stat Upgrade ──
        // Grant permanent stat boosts per boss kill (capped)
        if (this.player) {
            const maxBonusHP = 15; // Max bonus HP from boss kills
            const maxBonusDmg = 5; // Max bonus damage from boss kills
            if (!this.player.bossKillBonusHP) this.player.bossKillBonusHP = 0;
            if (!this.player.bossKillBonusDmg) this.player.bossKillBonusDmg = 0;

            if (this.player.bossKillBonusHP < maxBonusHP) {
                this.player.bossKillBonusHP += 1;
                this.player.maxHealth += 1;
                this.player.currentHealth = this.player.maxHealth; // Full heal on boss kill
            }
            if (this.player.bossKillBonusDmg < maxBonusDmg) {
                this.player.bossKillBonusDmg += 0.5;
                this.player.damage += 0.5;
            }

            // Trigger Passives
            if (this.player.onBossKill) this.player.onBossKill();
            if (this.playerTwo && this.playerTwo.onBossKill) this.playerTwo.onBossKill();
        }

        const bossPos = { x: this.boss.x, y: this.boss.y };
        this.boss = null;

        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        const enemyCounter = document.getElementById('enemy-counter');
        if (enemyCounter) enemyCounter.style.display = 'block';

        // Cinematic Finisher - Show Reward + Stat Boost
        const rewardText = document.createElement('div');
        rewardText.innerHTML = `+${loot} COINS<br><span style="font-size:1.5rem;color:#00ff88;">⬆ +1 HP  ⬆ +0.5 DMG</span>`;
        rewardText.style.position = 'absolute';
        rewardText.style.top = '50%';
        rewardText.style.left = '50%';
        rewardText.style.transform = 'translate(-50%, -50%)';
        rewardText.style.color = '#ffd700';
        rewardText.style.fontSize = '3rem';
        rewardText.style.fontWeight = 'bold';
        rewardText.style.textShadow = '0 0 20px #ffd700';
        rewardText.style.zIndex = '30';
        rewardText.style.textAlign = 'center';
        rewardText.style.animation = 'fadeOut 3s forwards';
        document.body.appendChild(rewardText);
        setTimeout(() => rewardText.remove(), 3000);

        this.screenShake.trigger(50, 1.0);
        this.particles.push(new Explosion(this, bossPos.x, bossPos.y, '#ff0000'));
    }

    checkPowerUpCollisions() {
        if (this.gameOver) return;

        const players = this.getPlayers();
        if (players.length === 0) return;

        this.powerups.forEach(p => {
            if (p.markedForDeletion) return;
            for (let i = 0; i < players.length; i += 1) {
                const player = players[i];
                const dx = p.x - player.x;
                const dy = p.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < p.radius + player.radius) {
                    // Mutual Optimistic Combat: Whoever grabs it claims it
                    if (this.onlineCoop && p.remoteId) {
                        this.netplay.emit('destroy_powerup', { id: p.remoteId });
                    }

                    player.applyPowerUp(p.type);

                    if (p.type === 'nuke') {
                        [...this.enemies].forEach(e => this.handleEnemyDefeat(e, false));
                        if (this.screenShake) this.screenShake.trigger(60, 0.8);
                    }

                    p.markedForDeletion = true;
                    if (this.achievementManager) this.achievementManager.addStat('powerups', 1);
                    this.screenShake.trigger(10, 0.1);
                    if (this.audio) this.audio.dash();
                    break;
                }
            }
        });
    }

    updateUI() {
        const scoreEl = document.getElementById('score-display');
        const levelEl = document.getElementById('level-display');
        const healthFill = document.getElementById('health-fill');
        const healthFillP2 = document.getElementById('health-fill-p2');

        if (scoreEl) scoreEl.innerText = this.score;

        // Update High Score logic
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('midnight_highscore', this.highScore);
        }

        const highScoreEl = document.getElementById('high-score-display');
        if (highScoreEl) highScoreEl.innerText = this.highScore;

        if (levelEl) levelEl.innerText = this.currentLevel;

        // Update Enemy Count
        const enemyCountEl = document.getElementById('enemy-count');
        if (enemyCountEl) {
            const remaining = (this.enemiesForLevel - this.enemiesSpawned) + this.enemies.length;
            enemyCountEl.innerText = Math.max(0, remaining);
        }

        if (healthFill && this.player) {
            const pct = (this.player.currentHealth / this.player.maxHealth) * 100;
            healthFill.style.width = pct + '%';

            // Expand health bar container based on max health
            const healthBar = document.getElementById('health-bar');
            if (healthBar) {
                // Base width is 80px for 10 maxHealth
                const baseMaxHealth = 10;
                const newWidth = Math.max(100, (this.player.maxHealth / baseMaxHealth) * 100);
                healthBar.style.width = newWidth + 'px';

                // Also update the numerical HP text inside the container if we can target it
                // We'll just leave it to expand naturally for now. The ratio gives immediate feedback.
            }
        }

        if (healthFillP2) {
            if (this.coopMode && this.playerTwo) {
                const pct = (this.playerTwo.currentHealth / this.playerTwo.maxHealth) * 100;
                healthFillP2.style.width = pct + '%';
            } else {
                healthFillP2.style.width = '0%';
            }
        }

        // Update Missile Reload Bar
        const missileFill = document.getElementById('missile-fill');
        if (missileFill && this.player) {
            const cooldownPct = Math.max(0, (this.player.missileCooldown - this.player.missileTimer) / this.player.missileCooldown) * 100;
            missileFill.style.width = (100 - cooldownPct) + '%';

            // Change color when ready
            if (this.player.missileTimer <= 0) {
                missileFill.style.background = '#00ff00';
            } else {
                missileFill.style.background = 'linear-gradient(90deg, #ff6600, #ff0000)';
            }
        }

        // Update Dash Cooldown Bar
        const dashFill = document.getElementById('dash-fill');
        if (dashFill && this.player) {
            const cooldownPct = Math.max(0, (this.player.dashCooldown - this.player.dashCooldownTimer) / this.player.dashCooldown) * 100;
            dashFill.style.width = (100 - cooldownPct) + '%';

            if (this.player.dashCooldownTimer <= 0) {
                dashFill.style.background = '#00ff00';
            } else {
                dashFill.style.background = 'linear-gradient(90deg, #33ccff, #0066ff)';
            }
        }

        // Update Enemy Counter

    }

    handleGameOver() {
        if (this.gameOver) return; // Prevent multiple calls
        this.gameOver = true;

        // Increment play count
        this.playCount += 1;
        localStorage.setItem('midnight_play_count', this.playCount);

        // Stats for achievements
        if (this.achievementManager) {
            this.achievementManager.addStat('games', 1);
            this.achievementManager.addStat('deaths', 1);
            // Best score and max level (only update if exceeded)
            this.achievementManager.updateBestScore(this.score);
            this.achievementManager.updateMaxLevel(this.currentLevel);
        }

        if (this.onlineCoop) {
            this.netplay.emit('player_died', { reason: 'hp_zero' });
        }
        // Do NOT set isRunning to false, so particles can animate

        // Calculate Coins BEFORE prestige multiplier (prevents exponential coin abuse)
        // 1 coin per 150 score — designed for ~50-200 coins per average game
        let earnedCoins = Math.floor(this.score / 150);

        // Rank Perk: Coin Bonus
        if (this.rankPerk && this.rankPerk.coinBonus > 0) {
            const bonus = Math.floor(earnedCoins * this.rankPerk.coinBonus);
            earnedCoins += bonus;
        }

        this.coins += earnedCoins;

        // Score multiplier for prestige ship: affects leaderboard only, NOT coins
        const shipData = SHIP_DATA[this.selectedShip];
        if (shipData?.specialAbility === 'score_triple' || shipData?.specialAbility === 'all_passives') {
            this.score = Math.floor(this.score * 3);
        }
        localStorage.setItem('midnight_coins', this.coins);

        // Track total coins for coin achievements
        if (this.achievementManager) {
            this.achievementManager.addStat('total_coins', earnedCoins);
        }

        if (this.player) {
            this.particles.push(new Explosion(this, this.player.x, this.player.y, '#00f3ff'));
        }
        if (this.coopMode && this.playerTwo) {
            this.particles.push(new Explosion(this, this.playerTwo.x, this.playerTwo.y, '#33ff99'));
        }

        if (this.audio) {
            this.audio.gameOver();
        }

        this.screenShake.trigger(50, 0.5);
        this.triggerGameOver(earnedCoins);
    }

    async triggerGameOver(earnedCoins) {
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.innerText = this.score;
        const finalHighScoreEl = document.getElementById('final-high-score');
        if (finalHighScoreEl) finalHighScoreEl.innerText = this.highScore;

        // Show coins earned
        const coinsEarnedEl = document.getElementById('coins-earned-display');
        if (coinsEarnedEl) coinsEarnedEl.innerText = `+${earnedCoins} COINS`;

        const finalRankEl = document.getElementById('final-rank');
        if (finalRankEl) finalRankEl.innerText = this.getPlayerRank(this.highScore);

        // Submit score to leaderboard
        // In collaborative mode, only the host submits to prevent duplicate entries
        const shouldSubmit = !this.onlineCoop || this.onlineRole === 'host';
        if (shouldSubmit) {
            const teamMembers = this.coopMode ? this.collabTeamMembers : null;
            await this.leaderboard.submitScore(this.score, this.currentLevel, this.selectedShip, teamMembers);
        }

        // Hide boss HUD on termination screen
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        if (this.gameOverScreen) this.gameOverScreen.classList.add('active');
        if (this.hud) this.hud.style.display = 'none';
    }

    // Advanced AI: Dynamic Difficulty Scaling based on selected ship DPS and Passives
    getPlayerScalingMetrics() {
        const defaultScale = { aiAggression: 1.0, bossSpeed: 1.0, projectileDensity: 1.0, damageMultiplier: 1.0, hpMultiplier: 1.0 };
        if (!this.selectedShip) return defaultScale;

        const ship = SHIP_DATA[this.selectedShip];
        if (!ship) return defaultScale;

        // Calculate True Player DPS
        // Interceptor base (3 dmg * 2 count / 1.5 cd) = 4 DPS
        // Absolute base (60 dmg * 20 count / 0.4 cd) = 3000 DPS
        // For burst calculation we use 1 / (fireRate + cooldown) as relative uptime, though we mostly care about raw output potential.
        // Simplified raw burst potential = (Damage * Missile Count) / Missile Cooldown
        const rawDPS = (ship.damage * ship.missileCount) / Math.max(0.1, ship.missileCooldown);

        // Calculate Passive Threat Score
        let passiveThreat = 1.0;
        if (ship.specialAbility === 'all_passives') passiveThreat = 2.5;
        else if (ship.specialAbility === 'phase_dodge') passiveThreat = 1.5;
        else if (ship.passive.includes('Heal') || ship.passive.includes('revive')) passiveThreat = 1.4;
        else if (ship.passive.includes('ignore') || ship.passive.includes('Double damage')) passiveThreat = 1.3;

        // Base Interceptor comparisons for scaling ratios
        const baseDPS = 4.0;
        const baseHp = 5;
        const baseSpeed = 450;

        const dpsRatio = rawDPS / baseDPS; // Can be 1x up to 750x for absolute
        const hpRatio = ship.hp / baseHp; // Can be 1x up to 8x

        // The scaling multipliers output:
        // aiAggression: dictates attack speed and tracking speed.
        // bossSpeed: dictates boss movement velocity.
        // projectileDensity: dictates how many bullets or the spread of bullets an enemy uses.
        // damageMultiplier: directly scales enemy collision and bullet damage.
        // hpMultiplier: directly scales enemy health to match Time-to-Kill (TTK).

        return {
            aiAggression: Math.max(0.6, 1.0 + (Math.log10(dpsRatio) * 0.25) * passiveThreat),
            speedScale: Math.max(0.7, 1.0 + ((ship.speed - baseSpeed) / 600)),
            projectileDensity: Math.max(1, Math.floor(1 + Math.log2(dpsRatio) * 0.2)),
            damageMultiplier: Math.max(0.7, 1.0 + Math.sqrt(Math.max(0, hpRatio - 1)) * 0.6),
            hpMultiplier: Math.max(0.25, 1.0 + Math.pow(Math.max(0, dpsRatio - 1), 0.7) * 0.5 * passiveThreat),
            // Useful flat stat for direct lookups
            rawPlayerDPS: rawDPS
        };
    }

    // Store System
    openStore() {
        this.fromPauseMenu = false;
        this.startScreen.classList.remove('active');
        document.getElementById('store-screen').classList.add('active');
        this.renderStore();
    }

    openStoreFromPause() {
        this.fromPauseMenu = true;
        document.getElementById('pause-menu').classList.remove('active');
        document.getElementById('store-screen').classList.add('active');
        this.renderStore();
    }

    closeStore() {
        document.getElementById('store-screen').classList.remove('active');
        if (this.fromPauseMenu) {
            // Return to pause menu
            document.getElementById('pause-menu').classList.add('active');

            // Ensure player is updated with selected ship if changed while paused
            if (this.isRunning && this.player && !this.gameOver) {
                if (this.player.shipType !== this.selectedShip) {
                    const oldX = this.player.x;
                    const oldY = this.player.y;
                    const oldHealth = this.player.currentHealth;
                    const oldPowerups = {
                        speedBoostTimer: this.player.speedBoostTimer,
                        doubleDamageTimer: this.player.doubleDamageTimer,
                        rapidFireTimer: this.player.rapidFireTimer,
                        invulnerabilityTimer: this.player.invulnerabilityTimer,
                        slowMotionTimer: this.player.slowMotionTimer,
                        ghostTimer: this.player.ghostTimer
                    };

                    // Create new player with selected ship
                    this.player = new Player(this, this.selectedShip, { playerId: this.player.playerId || 'player1' });

                    // Restore position and health (capped at new max)
                    this.player.x = oldX;
                    this.player.y = oldY;
                    this.player.currentHealth = Math.min(oldHealth, this.player.maxHealth);

                    // Restore power-ups
                    this.player.speedBoostTimer = oldPowerups.speedBoostTimer;
                    this.player.doubleDamageTimer = oldPowerups.doubleDamageTimer;
                    this.player.rapidFireTimer = oldPowerups.rapidFireTimer;
                    this.player.invulnerabilityTimer = oldPowerups.invulnerabilityTimer;
                    this.player.slowMotionTimer = oldPowerups.slowMotionTimer;
                    this.player.ghostTimer = oldPowerups.ghostTimer;
                }
            }

            this.fromPauseMenu = false;
        } else {
            // Return to start screen
            this.startScreen.classList.add('active');
        }
    }

    // Get previous ship in progression tree (prerequisite)
    getPreviousShip(shipKey) {
        const shipOrder = [
            'default', 'scout', 'phantom', 'rapid', 'fighter', 'pulse',
            'quantum', 'void', 'solar', 'bomber', 'tank', 'laser_drone',
            'wraith', 'vanguard', 'eclipse', 'shadowblade', 'guardian',
            'obliterator', 'inferno', 'juggernaut', 'tempest',
            'reaper', 'crimson_emperor', 'phoenix', 'starborn', 'leviathan',
            'sentinel', 'nova'
        ];
        const idx = shipOrder.indexOf(shipKey);
        return idx > 0 ? shipOrder[idx - 1] : null;
    }

    renderStore() {
        const grid = document.getElementById('ship-grid');
        const coinsDisplay = document.getElementById('coins-display-store');
        grid.innerHTML = '';
        coinsDisplay.innerText = `COINS: ${this.coins}`;
        document.getElementById('total-coins-display').innerText = `COINS: ${this.coins}`;

        // Show ALL ships — Prestige ships at the end, others sorted by price
        const sortedShips = Object.entries(SHIP_DATA)
            .sort((a, b) => {
                const sA = a[1];
                const sB = b[1];
                // Prestige ships go to the end
                if (sA.prestige && !sB.prestige) return 1;
                if (!sA.prestige && sB.prestige) return -1;
                // Otherwise sort by price ASC
                return sA.price - sB.price;
            });

        for (const [key, ship] of sortedShips) {
            const isPrestige = !!ship.prestige;
            const isAchievementUnlocked = isPrestige && this.achievementManager?.isShipUnlocked?.(key);

            const card = document.createElement('div');
            card.className = `ship-card ${this.ownedShips.includes(key) ? 'owned' : ''} ${this.selectedShip === key ? 'selected' : ''} ${isPrestige ? 'prestige' : ''}`;

            // Prestige Badge Overlay
            if (isPrestige) {
                const prestigeTag = document.createElement('div');
                prestigeTag.className = 'prestige-tag';
                prestigeTag.innerText = '⬡ PRESTIGE';
                card.appendChild(prestigeTag);
            }

            // Visual Preview (Canvas)
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');

            ctx.translate(50, 50);
            ctx.rotate(-Math.PI / 2);
            const mockGame = { width: 100, height: 100 };
            const dummyPlayer = new Player(mockGame, key);

            // Prestige glow aura
            if (isPrestige) {
                ctx.save();
                ctx.shadowColor = ship.color;
                ctx.shadowBlur = 25;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fillStyle = `${ship.color}22`;
                ctx.fill();
                ctx.restore();
            }

            const sprite = this.assets.get(key === 'default' ? 'interceptor' : key);
            if (sprite) {
                const size = 60;
                ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
            } else {
                dummyPlayer.drawShape(ctx, ship.color);
            }

            card.appendChild(canvas);

            const title = document.createElement('h3');
            title.innerText = ship.name;
            if (isPrestige) title.style.color = ship.color;
            card.appendChild(title);

            const stats = document.createElement('div');
            stats.className = 'ship-stats';
            const dashStatus = ship.dash === false ? 'NO' : 'YES';
            // Show special ability for prestige ships
            const abilityText = ship.specialAbility ? `<br><span style="color:${ship.color}; font-weight:bold;">⚡ ${ship.specialAbility.replace('_', ' ').toUpperCase()}</span>` : '';
            stats.innerHTML = `
                HP: ${ship.hp}<br>
                SPD: ${ship.speed}<br>
                DMG: ${ship.damage}<br>
                DASH: ${dashStatus}<br>
                RATE: ${(1 / ship.fireRate).toFixed(1)}/s${abilityText}<br>
                <span style="color:#aaa; font-style:italic; font-size:0.75rem">${ship.desc}</span>
            `;
            card.appendChild(stats);

            const btn = document.createElement('button');
            btn.className = 'action-btn';

            if (this.selectedShip === key) {
                btn.innerText = 'EQUIPPED';
                btn.disabled = true;
            } else if (this.ownedShips.includes(key)) {
                btn.innerText = 'EQUIP';
                btn.onclick = () => this.selectShip(key);
            } else if (isPrestige) {
                // Prestige ships: show achievement requirement
                if (isAchievementUnlocked) {
                    btn.innerText = '✦ CLAIM FREE';
                    btn.style.color = ship.color;
                    btn.style.borderColor = ship.color;
                    btn.onclick = () => this.buyShip(key);
                } else {
                    // Look up the actual achievement name from ACHIEVEMENT_DATA
                    const achData = ACHIEVEMENT_DATA.find(a => a.id === ship.achievementLocked);
                    const achName = achData ? achData.name : (ship.achievementLocked?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN');
                    btn.innerText = `🔒 ${achName}`;
                    btn.disabled = true;
                    btn.title = `Complete the "${achName}" achievement to unlock`;
                    btn.style.color = '#ff4466';
                }
            } else if (this.coins < ship.price) {
                btn.innerText = `BUY ⬡ ${ship.price.toLocaleString()}`;
                btn.disabled = true;
                btn.title = `Need ${(ship.price - this.coins).toLocaleString()} more coins`;
            } else {
                btn.innerText = `BUY ⬡ ${ship.price.toLocaleString()}`;
                btn.onclick = () => this.buyShip(key);
            }
            card.appendChild(btn);
            grid.appendChild(card);
        }
    }

    buyShip(type) {
        const ship = SHIP_DATA[type];


        if (this.coins >= ship.price) {
            this.coins -= ship.price;
            this.ownedShips.push(type);
            this.selectedShip = type;
            this.localShipType = type;

            // Save
            localStorage.setItem('midnight_coins', this.coins);
            localStorage.setItem('midnight_owned_ships', JSON.stringify(this.ownedShips));
            localStorage.setItem('midnight_selected_ship', this.selectedShip);

            if (this.audio) this.audio.powerUp(); // Success sound
            this.renderStore();
        } else {
            alert('Not enough coins!');
        }
    }

    resetShipsSection() {
        this.ownedShips = ['default'];
        this.selectedShip = 'default';
        this.localShipType = 'default';
        localStorage.setItem('midnight_owned_ships', JSON.stringify(this.ownedShips));
        localStorage.setItem('midnight_selected_ship', this.selectedShip);
        if (this.audio) this.audio.powerUp();
        alert('Ships section has been reset!');
    }

    selectShip(type) {
        if (this.ownedShips.includes(type)) {
            this.selectedShip = type;
            this.localShipType = type;
            localStorage.setItem('midnight_selected_ship', this.selectedShip);
            if (this.audio) this.audio.dash(); // Select sound

            // Always update player if game is running, even if paused
            if (this.isRunning && this.player && !this.gameOver) {
                // Check if ship actually changed
                const oldShipType = this.player.shipType;
                if (oldShipType !== type) {
                    const oldX = this.player.x;
                    const oldY = this.player.y;
                    const oldHealth = this.player.currentHealth;
                    const oldPowerups = {
                        speedBoostTimer: this.player.speedBoostTimer,
                        doubleDamageTimer: this.player.doubleDamageTimer,
                        rapidFireTimer: this.player.rapidFireTimer,
                        invulnerabilityTimer: this.player.invulnerabilityTimer,
                        slowMotionTimer: this.player.slowMotionTimer,
                        ghostTimer: this.player.ghostTimer
                    };

                    // Create new player with selected ship
                    this.player = new Player(this, this.selectedShip, { playerId: this.player.playerId || 'player1' });

                    // Restore position and health (capped at new max)
                    this.player.x = oldX;
                    this.player.y = oldY;
                    this.player.currentHealth = Math.min(oldHealth, this.player.maxHealth);

                    // Restore power-ups
                    this.player.speedBoostTimer = oldPowerups.speedBoostTimer;
                    this.player.doubleDamageTimer = oldPowerups.doubleDamageTimer;
                    this.player.rapidFireTimer = oldPowerups.rapidFireTimer;
                    this.player.invulnerabilityTimer = oldPowerups.invulnerabilityTimer;
                    this.player.slowMotionTimer = oldPowerups.slowMotionTimer;
                    this.player.ghostTimer = oldPowerups.ghostTimer;
                }
            }

            this.updatePlayerHudInfo();

            this.renderStore();
        }
    }

    async createCollaborateRoom() {
        if (!this.playerName) {
            const name = prompt("Enter your pilot name:");
            if (!name) return;
            this.playerName = name;
            localStorage.setItem('midnight_playerName', name);
            this.updatePlayerNameDisplay();
        }

        const statusEl = document.getElementById('collab-status');
        statusEl.innerText = "Creating secure room...";
        statusEl.style.color = "#00f3ff";

        try {
            const response = await fetch('/api/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostName: this.playerName })
            });
            const data = await response.json();

            if (data.success) {
                const roomId = data.roomId;
                this.collabRoomId = roomId;
                this.initRandom(roomId); // Initialize deterministic PRNG

                await this.netplay.connect({
                    roomId,
                    playerName: this.playerName,
                    shipType: this.selectedShip
                });

                this.netplay.on('peer_joined', (peerData) => {
                    statusEl.innerText = `${peerData.playerName} joined! Starting mission...`;
                    this.collabTeamMembers = [this.playerName, peerData.playerName];
                    this.remoteShipType = peerData.shipType || 'default';
                    this.spawnRemotePlayer(peerData.playerName, this.remoteShipType);

                    setTimeout(() => {
                        this.closeCollaborate();
                        this.startGame();
                    }, 1000);
                });

                document.getElementById('collab-room-id').innerText = roomId;
                document.getElementById('collab-room-display').classList.remove('hidden');
                document.getElementById('collab-waiting').classList.remove('hidden');
                document.getElementById('collab-leave-btn').classList.remove('hidden');
                document.getElementById('collab-create-btn').classList.add('hidden');
                document.getElementById('collab-join-btn').disabled = true;

                statusEl.innerText = "Room created. Waiting for partner...";
                this.isRunning = true;
                this.onlineRole = 'host';
                this.onlineCoop = true;
                this.coopMode = true;
                this.collabTeamMembers = [this.playerName];

            } else {
                statusEl.innerText = "Failed to create room: " + (data.error || "Unknown error");
                statusEl.style.color = "#ff0000";
            }
        } catch (error) {
            statusEl.innerText = "Connection error. Please check internet.";
            statusEl.style.color = "#ff0000";
        }
    }

    async joinCollaborateRoom() {
        const roomIdInput = document.getElementById('collab-room-input');
        const roomId = roomIdInput.value.trim();

        if (!roomId) {
            alert("Please enter a Room ID");
            return;
        }

        if (!this.playerName) {
            const name = prompt("Enter your pilot name:");
            if (!name) return;
            this.playerName = name;
            localStorage.setItem('midnight_playerName', name);
            this.updatePlayerNameDisplay();
        }

        const statusEl = document.getElementById('collab-status');
        statusEl.innerText = "Connecting to room " + roomId + "...";
        statusEl.style.color = "#00f3ff";

        try {
            const response = await fetch('/api/rooms/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, playerName: this.playerName })
            });
            const data = await response.json();

            if (data.success) {
                this.collabRoomId = roomId;
                this.initRandom(roomId); // Initialize deterministic PRNG

                await this.netplay.connect({
                    roomId,
                    playerName: this.playerName,
                    shipType: this.selectedShip
                });

                statusEl.innerText = "Connected to room: " + roomId;
                this.isRunning = true;
                this.onlineRole = 'guest';
                this.onlineCoop = true;
                this.coopMode = true;
                this.collabTeamMembers = [data.room.hostName, this.playerName];
                this.remoteShipType = data.room.hostShipType || 'default';

                this.spawnRemotePlayer(data.room.hostName, this.remoteShipType);

                setTimeout(() => {
                    this.closeCollaborate();
                    this.startGame();
                }, 1000);

            } else {
                statusEl.innerText = "Error: " + (data.error || "Could not join room");
                statusEl.style.color = "#ff0000";
            }
        } catch (error) {
            statusEl.innerText = "Connection error. Please check internet.";
            statusEl.style.color = "#ff0000";
        }
    }

    spawnRemotePlayer(name, shipType) {
        if (this.playerTwo) return;

        // If I am host (player1), the remote player must be player2
        // If I am guest (player2), the remote player must be player1
        const remotePlayerId = (this.onlineRole === 'guest') ? 'player1' : 'player2';

        this.playerTwo = new Player(this, shipType || 'default', { playerId: remotePlayerId });
        this.playerTwo.playerName = name;
        this.updatePlayerHudInfo();
    }

    leaveCollaborateRoom(stopGame = false, silent = false) {
        if (this.onlineCoop) {
            this.netplay.disconnect();
            this.onlineCoop = false;
            this.onlineRole = null;
        }

        this.coopMode = false;
        this.playerTwo = null;
        this.collabRoomId = null;

        document.getElementById('collab-room-display').classList.add('hidden');
        document.getElementById('collab-waiting').classList.add('hidden');
        document.getElementById('collab-leave-btn').classList.add('hidden');
        document.getElementById('collab-create-btn').classList.remove('hidden');
        document.getElementById('collab-join-btn').disabled = false;
        document.getElementById('collab-status').innerText = silent ? "" : "You left the session.";

        if (stopGame && this.isRunning) {
            this.goToMainMenu();
        }

        this.updatePlayerHudInfo();
    }


    async checkDataVersion() {
        try {
            const response = await fetch('/api/version');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const serverVersion = data.version;
                    const localVersion = parseInt(localStorage.getItem('midnight_data_version') || '1');

                    if (serverVersion > localVersion) {
                        console.log(`🚨 Data version mismatch! Server: ${serverVersion}, Local: ${localVersion}. Resetting progress...`);
                        this.resetLocalProgress();
                        localStorage.setItem('midnight_data_version', serverVersion);
                    }
                }
            }
        } catch (e) {
            console.warn('Could not check data version:', e);
        }
    }

    resetLocalProgress() {
        // Clear gameplay progress from localStorage
        localStorage.removeItem('midnight_coins');
        localStorage.removeItem('midnight_owned_ships');
        localStorage.removeItem('midnight_high_score');
        localStorage.removeItem('midnight_lifetime_coins');
        localStorage.removeItem('midnight_play_count');
        localStorage.removeItem('midnight_achievements');

        console.log('✅ Local progress data cleared.');

        // Force reload to apply changes if already on main menu
        if (!this.isRunning) {
            window.location.reload();
        }
    }
}
